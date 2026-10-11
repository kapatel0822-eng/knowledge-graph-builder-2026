// jira.js
// Direct Jira REST API Connector & Functional Knowledge Graph Extractor
const { getSetting, setSetting } = require('./db');
const { callGemini } = require('./gemini');

/**
 * Clean and normalize host URL
 */
function normalizeHost(host) {
  if (!host) return '';
  let clean = host.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}

/**
 * Generate authorization headers for Jira Cloud or Data Center / Server
 */
function getAuthHeaders(email, apiToken) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Knowledge-Graph-Builder/1.0'
  };

  const cleanEmail = email ? email.trim() : '';
  const cleanToken = apiToken ? apiToken.trim() : '';

  if (cleanEmail && cleanToken) {
    // Basic Auth: base64(email:api_token) for Jira Cloud
    const encoded = Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  } else if (cleanToken) {
    // Bearer token (Personal Access Token for Jira Server/Data Center)
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  return headers;
}

/**
 * Retrieve saved Jira configuration from DB
 */
function getJiraConfig() {
  const host = getSetting('jira_host') || process.env.JIRA_HOST || '';
  const email = getSetting('jira_email') || process.env.JIRA_EMAIL || '';
  const apiToken = getSetting('jira_api_token') || process.env.JIRA_API_TOKEN || '';

  return {
    host: normalizeHost(host),
    email,
    apiToken,
    hasCredentials: !!(host && apiToken)
  };
}

/**
 * Save Jira configuration into DB settings
 */
function saveJiraConfig({ host, email, apiToken }) {
  if (host !== undefined) setSetting('jira_host', normalizeHost(host));
  if (email !== undefined) setSetting('jira_email', (email || '').trim());
  if (apiToken !== undefined && apiToken.trim()) setSetting('jira_api_token', apiToken.trim());
}

/**
 * Test Jira Connection
 */
async function testJiraConnection(credentials = {}) {
  const config = getJiraConfig();
  const host = normalizeHost(credentials.host || config.host);
  const email = credentials.email !== undefined ? credentials.email : config.email;
  const apiToken = credentials.apiToken !== undefined ? credentials.apiToken : config.apiToken;

  if (!host) {
    return { ok: false, error: 'Jira host URL is required (e.g. https://your-company.atlassian.net)' };
  }
  if (!apiToken) {
    return { ok: false, error: 'Jira API Token or PAT is required.' };
  }

  const headers = getAuthHeaders(email, apiToken);

  try {
    // Try Jira Cloud v3 myself endpoint
    let res = await fetch(`${host}/rest/api/3/myself`, { method: 'GET', headers });

    // Fallback to v2 if v3 fails (common on Jira Server/Data Center)
    if (res.status === 404) {
      res = await fetch(`${host}/rest/api/2/myself`, { method: 'GET', headers });
    }

    if (res.status === 401) {
      return {
        ok: false,
        error: 'Authentication failed (401 Unauthorized). Verify your Jira Email and API Token.'
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        error: 'Access forbidden (403 Forbidden). Ensure your Atlassian account has API access permissions.'
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Jira API returned HTTP ${res.status}: ${errText.slice(0, 200)}`
      };
    }

    const userData = await res.json();
    return {
      ok: true,
      host,
      user: {
        displayName: userData.displayName || userData.name || email,
        emailAddress: userData.emailAddress || email,
        active: userData.active !== false,
        timeZone: userData.timeZone || 'UTC'
      }
    };
  } catch (err) {
    return {
      ok: false,
      error: `Connection error: ${err.message}. Please check if the host URL is reachable.`
    };
  }
}

/**
 * Convert Atlassian Document Format (ADF) into clean Markdown text
 */
function parseAdfToMarkdown(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;

  if (Array.isArray(node)) {
    return node.map(parseAdfToMarkdown).join('');
  }

  if (node.type === 'text') {
    let text = node.text || '';
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'strong') text = `**${text}**`;
        if (mark.type === 'em') text = `*${text}*`;
        if (mark.type === 'code') text = `\`${text}\``;
        if (mark.type === 'link' && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
      }
    }
    return text;
  }

  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(parseAdfToMarkdown).join('');
    return `${inner}\n\n`;
  }

  if (node.type === 'heading') {
    const level = '#'.repeat(node.attrs?.level || 1);
    const inner = (node.content || []).map(parseAdfToMarkdown).join('');
    return `${level} ${inner}\n\n`;
  }

  if (node.type === 'bulletList') {
    return (node.content || []).map(li => `- ${parseAdfToMarkdown(li).trim()}\n`).join('') + '\n';
  }

  if (node.type === 'orderedList') {
    return (node.content || []).map((li, idx) => `${idx + 1}. ${parseAdfToMarkdown(li).trim()}\n`).join('') + '\n';
  }

  if (node.type === 'listItem') {
    return (node.content || []).map(parseAdfToMarkdown).join(' ').trim();
  }

  if (node.type === 'codeBlock') {
    const lang = node.attrs?.language || '';
    const code = (node.content || []).map(parseAdfToMarkdown).join('');
    return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  }

  if (node.type === 'blockquote') {
    const inner = (node.content || []).map(parseAdfToMarkdown).join('');
    return `> ${inner.trim()}\n\n`;
  }

  if (node.content && Array.isArray(node.content)) {
    return node.content.map(parseAdfToMarkdown).join('');
  }

  return '';
}

/**
 * Extract Acceptance Criteria list from description or custom fields
 */
function extractAcceptanceCriteria(descText, fields = {}) {
  const criteria = [];

  // 1. Check description text for Acceptance Criteria sections
  if (descText) {
    const acRegex = /(?:acceptance\s*criteria|definition\s*of\s*done|ac:?|scenarios?:?|given\s+when\s+then)[\s\S]*?(?=(?:\n#{1,3}\s+[A-Z]|\n[A-Z][a-z]+:|$))/i;
    const match = descText.match(acRegex);
    if (match) {
      const block = match[0];
      const lines = block.split('\n');
      for (const line of lines) {
        const trimmed = line.replace(/^[*-•\d.]+\s*/, '').trim();
        if (
          trimmed.length > 5 &&
          !/^(acceptance criteria|definition of done|ac|scenarios?):?$/i.test(trimmed)
        ) {
          criteria.push(trimmed);
        }
      }
    }
  }

  // 2. Check custom fields that may hold criteria
  for (const [key, val] of Object.entries(fields)) {
    if (key.startsWith('customfield_') && typeof val === 'string' && val.length > 10) {
      if (val.toLowerCase().includes('acceptance') || val.toLowerCase().includes('criteria')) {
        const subLines = val.split('\n').map(l => l.replace(/^[*-•\d.]+\s*/, '').trim()).filter(l => l.length > 5);
        criteria.push(...subLines);
      }
    }
  }

  return criteria.slice(0, 6);
}

/**
 * Fetch Jira issues using JQL
 */
async function fetchJiraIssues({ host, email, apiToken, jql, maxResults = 25 }) {
  const config = getJiraConfig();
  const targetHost = normalizeHost(host || config.host);
  const targetEmail = email !== undefined ? email : config.email;
  const targetToken = apiToken !== undefined ? apiToken : config.apiToken;

  if (!targetHost || !targetToken) {
    throw new Error('Jira connection credentials are not configured. Please test or configure Jira in Settings.');
  }

  const cleanJql = (jql && jql.trim()) ? jql.trim() : 'issuetype in (Epic, Story, Task) ORDER BY created DESC';
  const limit = Math.min(Math.max(parseInt(maxResults || 25, 10), 1), 100);

  const headers = getAuthHeaders(targetEmail, targetToken);

  // Preferred endpoint: POST /rest/api/3/search or GET /rest/api/3/search
  const queryParams = new URLSearchParams({
    jql: cleanJql,
    maxResults: String(limit),
    fields: 'summary,description,issuetype,status,priority,assignee,components,labels,fixVersions,issuelinks,parent'
  });

  let url = `${targetHost}/rest/api/3/search?${queryParams.toString()}`;
  let res = await fetch(url, { method: 'GET', headers });

  if (res.status === 404) {
    // Fallback to v2
    url = `${targetHost}/rest/api/2/search?${queryParams.toString()}`;
    res = await fetch(url, { method: 'GET', headers });
  }

  if (!res.ok) {
    const errText = await res.text();
    let msg = `Jira API Error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.errorMessages && errJson.errorMessages.length > 0) {
        msg += `: ${errJson.errorMessages.join(', ')}`;
      } else if (errJson.errors) {
        msg += `: ${JSON.stringify(errJson.errors)}`;
      }
    } catch (_) {
      msg += `: ${errText.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const rawIssues = data.issues || [];

  const issues = rawIssues.map(issue => {
    const fields = issue.fields || {};
    const descText = parseAdfToMarkdown(fields.description).trim();
    const criteria = extractAcceptanceCriteria(descText, fields);

    return {
      id: issue.id,
      key: issue.key,
      url: `${targetHost}/browse/${issue.key}`,
      summary: fields.summary || 'Untitled Issue',
      issueType: fields.issuetype?.name || 'Story',
      isSubtask: !!fields.issuetype?.subtask,
      status: fields.status?.name || 'Open',
      statusCategory: fields.status?.statusCategory?.name || 'To Do',
      priority: fields.priority?.name || 'Medium',
      assignee: fields.assignee?.displayName || 'Unassigned',
      components: (fields.components || []).map(c => c.name),
      labels: fields.labels || [],
      fixVersions: (fields.fixVersions || []).map(v => v.name),
      parentKey: fields.parent ? fields.parent.key : null,
      parentSummary: fields.parent ? fields.parent.fields?.summary : null,
      description: descText,
      acceptanceCriteria: criteria,
      issueLinks: (fields.issuelinks || []).map(link => {
        const other = link.outwardIssue || link.inwardIssue;
        return {
          type: link.type?.name || 'relates to',
          direction: link.outwardIssue ? 'outward' : 'inward',
          desc: link.type?.outward || link.type?.inward || 'relates to',
          targetKey: other?.key,
          targetSummary: other?.fields?.summary
        };
      })
    };
  });

  return {
    host: targetHost,
    total: data.total || issues.length,
    count: issues.length,
    issues
  };
}

/**
 * Demo Jira issues for instant testing without an active Atlassian account
 */
const DEMO_JIRA_ISSUES = [
  {
    id: '10001',
    key: 'PAY-100',
    url: 'https://demo-corp.atlassian.net/browse/PAY-100',
    summary: 'Global Digital Checkout & Multi-Currency Payments Epic',
    issueType: 'Epic',
    status: 'In Progress',
    statusCategory: 'In Progress',
    priority: 'Highest',
    assignee: 'Sarah Connor',
    components: ['Payment Engine', 'Edge API Gateway'],
    labels: ['fintech', 'pci-dss', 'core-platform'],
    fixVersions: ['v2.4.0'],
    description: 'Provide seamless checkout experience across Web and Mobile with tokenized payment authorizations, PCI-DSS Level 1 compliance, and instant settlement.',
    acceptanceCriteria: [
      'Tokenize card data directly via Stripe SDK (no raw card data on servers)',
      'Authorize transactions within 1200ms SLA',
      'Support Apple Pay, Google Pay, and standard credit cards'
    ]
  },
  {
    id: '10002',
    key: 'PAY-101',
    url: 'https://demo-corp.atlassian.net/browse/PAY-101',
    summary: 'Customer Checkout via Apple Pay & One-Click Wallets',
    issueType: 'Story',
    status: 'In Progress',
    statusCategory: 'In Progress',
    priority: 'High',
    assignee: 'Alex Chen',
    parentKey: 'PAY-100',
    components: ['Payment Engine', 'Checkout Frontend'],
    labels: ['checkout', 'mobile-pay'],
    fixVersions: ['v2.4.0'],
    description: 'As an Online Consumer, I want to pay with Apple Pay or Google Pay during checkout so that I do not need to enter my billing address or card details manually.\n\nAcceptance Criteria:\n- Authenticate buyer identity using native device biometric verification.\n- Authorize transaction via Stripe PaymentIntents API.\n- If authorization succeeds, write confirmed transaction to PostgreSQL Ledger.',
    acceptanceCriteria: [
      'Authenticate buyer identity using native biometric verification',
      'Authorize transaction via Stripe PaymentIntents API',
      'Persist confirmed transaction record in PostgreSQL Ledger'
    ]
  },
  {
    id: '10003',
    key: 'PAY-102',
    url: 'https://demo-corp.atlassian.net/browse/PAY-102',
    summary: 'Risk & Fraud Mitigation Velocity Rules',
    issueType: 'Story',
    status: 'Done',
    statusCategory: 'Done',
    priority: 'Highest',
    assignee: 'Elena Rostova',
    parentKey: 'PAY-100',
    components: ['Payment Engine', 'Redis Cache'],
    labels: ['security', 'fraud'],
    fixVersions: ['v2.3.0'],
    description: 'As a Risk & Compliance Officer, I want automated fraud screening on every checkout attempt to prevent stolen card testing and fraudulent chargebacks.\n\nAcceptance Criteria:\n- Any transaction exceeding $1,000 USD triggers 3D Secure 2.0 step-up challenge.\n- Decline IP addresses with > 5 failed checkout attempts per minute tracked in Redis.\n- Log all fraud scoring outcomes to Kafka audit topic.',
    acceptanceCriteria: [
      'Transactions > $1,000 USD trigger 3D Secure 2.0 challenge',
      'Block velocity exceeding 5 attempts/minute via Redis counter',
      'Publish audit stream event to Kafka topic orders.fraud.events'
    ]
  },
  {
    id: '10004',
    key: 'ORD-200',
    url: 'https://demo-corp.atlassian.net/browse/ORD-200',
    summary: 'Omnichannel Order Orchestration Domain Epic',
    issueType: 'Epic',
    status: 'Active',
    statusCategory: 'In Progress',
    priority: 'High',
    assignee: 'Marcus Vance',
    components: ['Order Processing Service'],
    labels: ['orders', 'fulfillment'],
    fixVersions: ['v2.4.0'],
    description: 'End-to-end orchestration of customer orders from submission, cart validation, inventory allocation, pick-and-pack routing, to final carrier dispatch.',
    acceptanceCriteria: [
      'Process order lifecycle state transitions within 500ms',
      'Guaranteed at-least-once message delivery via Kafka',
      'Support idempotency on order submission'
    ]
  },
  {
    id: '10005',
    key: 'ORD-201',
    url: 'https://demo-corp.atlassian.net/browse/ORD-201',
    summary: 'Automated Multi-Warehouse Inventory Stock Reservation',
    issueType: 'Story',
    status: 'To Do',
    statusCategory: 'To Do',
    priority: 'Medium',
    assignee: 'David Kim',
    parentKey: 'ORD-200',
    components: ['Inventory Service', 'Order Processing Service'],
    labels: ['warehouse', 'logistics'],
    fixVersions: ['v2.5.0'],
    description: 'As a Warehouse Logistics Manager, I want real-time stock reservation upon payment confirmation so that items are not oversold across physical warehouses.\n\nAcceptance Criteria:\n- Order Processing Service publishes order.created to Kafka.\n- Inventory Service consumes event and locks SKU quantity in PostgreSQL.\n- Release reservation if payment is rejected or expires after 15 minutes.',
    acceptanceCriteria: [
      'Publish order.created event to Kafka',
      'Lock SKU quantity in Inventory PostgreSQL within 200ms',
      'Release reservation lock if payment fails or expires within 15 minutes'
    ]
  }
];

/**
 * Convert Jira Issues to Knowledge Graph Nodes & Edges
 * Supports both Gemini 3.8 Flash semantic extraction and fast deterministic rule mapping.
 */
async function convertJiraToGraph({ issues, host, projectInfo, customKey, useAi = true }) {
  if (!issues || issues.length === 0) {
    return { summary: 'No Jira issues provided.', nodes: [], edges: [] };
  }

  // If useAi is enabled, try Gemini 3.8 Flash semantic synthesis
  if (useAi) {
    try {
      const aiResult = await extractGraphWithGeminiFromJira(issues, host, projectInfo, customKey);
      if (aiResult && aiResult.nodes && aiResult.nodes.length > 0) {
        return aiResult;
      }
    } catch (err) {
      console.warn('Jira AI extraction fallback to deterministic rules:', err.message);
    }
  }

  // Fast Deterministic Structural Converter
  return deterministicJiraToGraph(issues, host);
}

/**
 * Gemini 3.8 Flash AI synthesis for Jira issues
 */
async function extractGraphWithGeminiFromJira(issues, host, projectInfo, customKey) {
  const issuesSummaryText = issues.map(iss => {
    return `---
ISSUE KEY: ${iss.key}
TYPE: ${iss.issueType}
SUMMARY: ${iss.summary}
STATUS: ${iss.status}
ASSIGNEE: ${iss.assignee}
COMPONENTS: ${(iss.components || []).join(', ') || 'None'}
PARENT: ${iss.parentKey || 'None'}
DESCRIPTION:
${iss.description || 'No description'}
ACCEPTANCE CRITERIA:
${(iss.acceptanceCriteria || []).map(ac => `• ${ac}`).join('\n') || 'None'}
JIRA URL: ${iss.url || `${host}/browse/${iss.key}`}
`;
  }).join('\n\n');

  const systemInstruction = `You are a Principal Enterprise Architect specializing in mapping Agile Jira Requirements (Epics, Stories, Criteria) into a comprehensive Functional & Technical Architecture Knowledge Graph.

Analyze the provided Jira issues and extract a coherent Knowledge Graph:
1. FUNCTIONAL LAYER:
   - "domain" (Derived from Jira Epics or high-level business capabilities)
   - "user_flow" (Derived from User Stories, e.g. Customer Checkout Journey)
   - "business_rule" (Derived from Acceptance Criteria, SLAs, compliance, e.g. 3DS Step-Up Rule, PCI Tokenization)
   - "actor" (Derived from the "As a <role>" persona in user stories, e.g. Online Consumer, Risk Officer)

2. TECHNICAL LAYER:
   - "service" (Derived from Jira Components or technical services mentioned in stories)
   - "database" (Databases or caches mentioned, e.g. PostgreSQL Ledger, Redis)
   - "queue" (Event streams or brokers mentioned, e.g. Kafka topics)
   - "external" (External 3rd-party services mentioned, e.g. Stripe, SendGrid)

3. DIRECTIONAL RELATIONSHIPS (EDGES):
   - types: "calls", "publishes_to", "consumes_from", "reads_from", "writes_to", "implements", "participates_in", "enforces_rule", "depends_on"
   - Every Actor should "participates_in" User Flows.
   - User Flows should "implements" their parent Domain.
   - User Flows should "enforces_rule" to their Business Rules.
   - Technical services should "implements" functional domains or flows.

IMPORTANT: For every node originating from or linked to a Jira issue, populate details.jira:
{
  "key": "JIRA-KEY",
  "summary": "Original summary",
  "status": "In Progress",
  "url": "https://.../browse/KEY",
  "priority": "High"
}

Output STRICT JSON matching this schema:
{
  "summary": "High-level summary of the functional architecture extracted from Jira",
  "nodes": [
    {
      "id": "unique_snake_case_id",
      "layer": "functional" or "technical",
      "type": "domain" | "user_flow" | "business_rule" | "actor" | "service" | "database" | "queue" | "external",
      "name": "Human Readable Name",
      "summary": "1-2 sentence description",
      "team": "Team or Assignee",
      "status": "active" | "planned" | "production",
      "details": {
        "jira": {
          "key": "PAY-101",
          "summary": "Customer Checkout",
          "status": "In Progress",
          "url": "https://.../browse/PAY-101",
          "priority": "High"
        }
      }
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "type": "calls" | "publishes_to" | "consumes_from" | "reads_from" | "writes_to" | "implements" | "participates_in" | "enforces_rule" | "depends_on",
      "label": "Action label",
      "summary": "Explanation of connection"
    }
  ]
}`;

  const prompt = `Project: ${projectInfo?.name || 'Architecture Project'}\nJira Issues to Transform:\n\n${issuesSummaryText}`;

  const res = await callGemini({
    prompt,
    systemInstruction,
    responseFormat: 'json',
    customKey
  });

  if (res.fallback) return null;

  const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

/**
 * Deterministic rule-based transformer from Jira issues to Knowledge Graph
 */
function deterministicJiraToGraph(issues, host) {
  const nodes = [];
  const edges = [];
  const actorMap = new Map();
  const componentMap = new Map();

  const baseHost = normalizeHost(host) || 'https://jira.corp';

  // 1. Process issues into nodes
  for (const iss of issues) {
    const isEpic = iss.issueType.toLowerCase() === 'epic';
    const nodeId = `jira_${iss.key.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const jiraMeta = {
      key: iss.key,
      summary: iss.summary,
      status: iss.status,
      priority: iss.priority,
      assignee: iss.assignee,
      url: iss.url || `${baseHost}/browse/${iss.key}`,
      issueType: iss.issueType
    };

    if (isEpic) {
      // Epics become Functional Domains
      nodes.push({
        id: nodeId,
        layer: 'functional',
        type: 'domain',
        name: iss.summary,
        summary: iss.description ? iss.description.slice(0, 160) + '...' : `Functional Domain defined in Epic ${iss.key}`,
        team: iss.assignee || 'Product Squad',
        status: iss.status.toLowerCase().includes('done') ? 'production' : 'active',
        details: {
          jira: jiraMeta,
          acceptanceCriteria: iss.acceptanceCriteria
        }
      });
    } else {
      // Stories / Tasks become Functional User Flows
      nodes.push({
        id: nodeId,
        layer: 'functional',
        type: 'user_flow',
        name: iss.summary,
        summary: iss.description ? iss.description.slice(0, 160) + '...' : `User Flow specified in Story ${iss.key}`,
        team: iss.assignee || 'Engineering Squad',
        status: iss.status.toLowerCase().includes('done') ? 'active' : 'planned',
        details: {
          jira: jiraMeta,
          acceptanceCriteria: iss.acceptanceCriteria
        }
      });

      // Link Story to Epic if parentKey exists
      if (iss.parentKey) {
        const parentId = `jira_${iss.parentKey.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        edges.push({
          id: `edge_${nodeId}_implements_${parentId}`,
          source: nodeId,
          target: parentId,
          type: 'implements',
          label: 'implements epic',
          summary: `Story ${iss.key} implements functional capabilities in Epic ${iss.parentKey}`
        });
      }

      // Check for Persona / Actor ("As a <role>, I want...")
      const personaMatch = (iss.description || iss.summary).match(/as\s+(?:an?|the)\s+([a-zA-Z\s]{3,25}?)(?:,|\s+i\s+want)/i);
      if (personaMatch && personaMatch[1]) {
        const role = personaMatch[1].trim();
        const roleId = `actor_${role.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

        if (!actorMap.has(roleId)) {
          const actorNode = {
            id: roleId,
            layer: 'functional',
            type: 'actor',
            name: role.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            summary: `Functional persona identified from Jira story: "${role}".`,
            team: 'User Experience',
            status: 'active',
            details: { originStory: iss.key }
          };
          nodes.push(actorNode);
          actorMap.set(roleId, actorNode);
        }

        edges.push({
          id: `edge_${roleId}_participates_${nodeId}`,
          source: roleId,
          target: nodeId,
          type: 'participates_in',
          label: 'participates in',
          summary: `${role} interacts with user flow "${iss.summary}"`
        });
      }

      // Acceptance criteria become Business Rules
      (iss.acceptanceCriteria || []).forEach((ruleText, idx) => {
        if (ruleText.length > 8) {
          const ruleId = `rule_${nodeId}_${idx + 1}`;
          const cleanRuleName = ruleText.slice(0, 45) + (ruleText.length > 45 ? '...' : '');

          nodes.push({
            id: ruleId,
            layer: 'functional',
            type: 'business_rule',
            name: cleanRuleName,
            summary: ruleText,
            team: iss.assignee || 'Governance & Quality',
            status: 'active',
            details: {
              sourceStory: iss.key,
              jiraUrl: iss.url || `${baseHost}/browse/${iss.key}`
            }
          });

          edges.push({
            id: `edge_${nodeId}_enforces_${ruleId}`,
            source: nodeId,
            target: ruleId,
            type: 'enforces_rule',
            label: 'enforces criteria',
            summary: `Story ${iss.key} enforces business rule "${cleanRuleName}"`
          });
        }
      });
    }

    // Process Components as Technical Services
    (iss.components || []).forEach(compName => {
      const compId = `tech_comp_${compName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      if (!componentMap.has(compId)) {
        const compNode = {
          id: compId,
          layer: 'technical',
          type: 'service',
          name: compName,
          summary: `Technical service component extracted from Jira issue ${iss.key}`,
          team: iss.assignee || 'Platform Squad',
          status: 'healthy',
          details: { jiraComponent: compName }
        };
        nodes.push(compNode);
        componentMap.set(compId, compNode);
      }

      edges.push({
        id: `edge_${nodeId}_calls_${compId}`,
        source: nodeId,
        target: compId,
        type: 'calls',
        label: 'implemented by',
        summary: `Jira functional item ${iss.key} is implemented by technical service "${compName}"`
      });
    });

    // Process Issue Links (depends on, blocks)
    (iss.issueLinks || []).forEach(link => {
      if (link.targetKey) {
        const targetId = `jira_${link.targetKey.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
        edges.push({
          id: `edge_${nodeId}_link_${targetId}`,
          source: nodeId,
          target: targetId,
          type: 'depends_on',
          label: link.desc || 'depends on',
          summary: `Jira relationship: ${iss.key} ${link.desc} ${link.targetKey}`
        });
      }
    });
  }

  return {
    summary: `Transformed ${issues.length} Jira tickets into ${nodes.length} functional and technical architecture entities with ${edges.length} connections.`,
    nodes,
    edges
  };
}

module.exports = {
  getJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  fetchJiraIssues,
  convertJiraToGraph,
  DEMO_JIRA_ISSUES,
  normalizeHost
};

