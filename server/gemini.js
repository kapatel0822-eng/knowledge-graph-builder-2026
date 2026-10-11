// gemini.js
// Gemini 3.8 Flash AI Integration for Knowledge Builder Graph
const { getSetting } = require('./db');

const GEMINI_MODEL = 'gemini-3.8-flash';

function getApiKey(customKey) {
  if (customKey && customKey.trim()) return customKey.trim();
  const dbKey = getSetting('gemini_api_key');
  if (dbKey && dbKey.trim()) return dbKey.trim();
  return process.env.GEMINI_API_KEY || '';
}

/**
 * Call Gemini API using modern v1beta interactions or models:generateContent
 */
async function callGemini({ prompt, parts, systemInstruction, responseFormat, customKey }) {
  const apiKey = getApiKey(customKey);
  if (!apiKey) {
    return { fallback: true, error: 'NO_API_KEY' };
  }

  // Use Google Gemini REST API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const userParts = parts || [{ text: prompt }];
  const contents = [
    {
      role: 'user',
      parts: userParts
    }
  ];

  const body = {
    contents,
    generationConfig: {}
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (responseFormat === 'json') {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', response.status, errorText);
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const outputText = candidate?.content?.parts?.map(p => p.text).join('') || '';

  return { fallback: false, text: outputText };
}

/**
 * AI Graph Extractor: Extract nodes and edges from unstructured text
 */
async function extractGraphFromText(text, projectInfo, customKey) {
  const systemInstruction = `You are a Principal Software Architect and Knowledge Graph Engineer.
Analyze the provided system text (PRD, technical design document, user stories, or architecture notes).
Extract the architecture into two distinct layers:
1. FUNCTIONAL LAYER:
   - "domain" (business capabilities, e.g., Billing, Identity, Inventory)
   - "user_flow" (user journey, e.g., Checkout Journey, Password Reset)
   - "business_rule" (policies, constraints, e.g., Fraud Check, PCI-DSS)
   - "actor" (users, roles, personas, e.g., Shopper, Admin)

2. TECHNICAL LAYER:
   - "service" (microservices, workers, proxies, e.g., Order Service, Auth API)
   - "database" (relational DB, NoSQL, caches, e.g., Postgres, Redis)
   - "queue" (event streams, brokers, e.g., Kafka, RabbitMQ)
   - "external" (third-party APIs or gateways, e.g., Stripe, SendGrid)

Also extract directional EDGES connecting them:
- types: "calls", "publishes_to", "consumes_from", "reads_from", "writes_to", "implements", "participates_in", "depends_on"

You must output STRICT JSON matching this schema:
{
  "summary": "Brief summary of the extracted architecture",
  "nodes": [
    {
      "id": "unique_snake_case_id",
      "layer": "functional" or "technical",
      "type": "domain" | "user_flow" | "business_rule" | "actor" | "service" | "database" | "queue" | "external",
      "name": "Human Readable Name",
      "summary": "1-2 sentence description",
      "team": "Suggested owner team",
      "status": "active" | "planned" | "production",
      "details": {
        "techStack": "string if technical",
        "endpoints": ["string list if service"],
        "compliance": ["string list if functional"]
      }
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "type": "calls" | "publishes_to" | "consumes_from" | "reads_from" | "writes_to" | "implements" | "participates_in" | "depends_on",
      "label": "Short Action Label (e.g. POST /orders, writes order)",
      "summary": "Explanation of interaction"
    }
  ]
}`;

  const prompt = `Project Name: ${projectInfo.name}\nProject Description: ${projectInfo.description}\n\nArchitecture/Requirements Document to Analyze:\n${text}`;

  try {
    const result = await callGemini({
      prompt,
      systemInstruction,
      responseFormat: 'json',
      customKey
    });

    if (result.fallback) {
      return fallbackHeuristicExtractor(text, projectInfo);
    }

    const cleanJson = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (err) {
    console.warn('Falling back to local heuristic extractor due to:', err.message);
    return fallbackHeuristicExtractor(text, projectInfo);
  }
}

/**
 * Interactive Architecture Copilot Chat
 */
async function chatWithArchitecture({ message, graphContext, history, customKey }) {
  const nodeContext = graphContext.nodes.map(n => 
    `• [${n.layer.toUpperCase()} - ${n.type}] "${n.name}" (ID: ${n.id}): ${n.summary} [Team: ${n.team || 'Unassigned'}]`
  ).join('\n');

  const edgeContext = graphContext.edges.map(e => {
    const src = graphContext.nodes.find(n => n.id === e.source)?.name || e.source;
    const tgt = graphContext.nodes.find(n => n.id === e.target)?.name || e.target;
    return `• ${src} --[${e.type}: ${e.label || ''}]--> ${tgt}`;
  }).join('\n');

  const flowContext = (graphContext.flows || []).map(f => {
    const steps = (f.steps || []).map(s => `    ${s.order}. ${s.title}: ${s.description}`).join('\n');
    return `Flow "${f.name}":\n${steps}`;
  }).join('\n\n');

  const systemInstruction = `You are the AI Architecture & Knowledge Lead for the project "${graphContext.project.name}".
You have deep, complete insight into both the Functional Requirements and Technical Infrastructure of this system.

CURRENT KNOWLEDGE GRAPH TOPOLOGY:
================================
PROJECT: ${graphContext.project.name} - ${graphContext.project.description}

NODES (${graphContext.nodes.length} total):
${nodeContext}

RELATIONSHIPS (${graphContext.edges.length} total):
${edgeContext}

FLOWS (${(graphContext.flows || []).length} total):
${flowContext}

GUIDELINES FOR YOUR ANSWERS:
1. Ground your answers strictly in the graph topology above. Refer to nodes by their exact names.
2. If asked about Impact Analysis (e.g. "What happens if X fails?"), identify:
   - Direct callers (upstream services impacted)
   - Downstream dependencies that lose input
   - Affected functional user flows and customer impact
   - Fallback strategies, dead-letter queues, or mitigation recommendations.
3. If asked about a user flow, walk through the sequence of calls clearly step by step.
4. If asked to suggest architecture changes or find architectural gaps (SPOF, missing caches, unhandled queues), highlight concrete additions.
5. Format your answers with clear markdown, bullet points, and highlight node names with \`Node Name\`.`;

  const prompt = `User Question: ${message}`;

  try {
    const result = await callGemini({
      prompt,
      systemInstruction,
      customKey
    });

    if (result.fallback) {
      return fallbackArchitectureChat(message, graphContext);
    }

    return { reply: result.text, aiPowered: true };
  } catch (err) {
    console.warn('Falling back to local architecture assistant:', err.message);
    const simulated = fallbackArchitectureChat(message, graphContext);
    return {
      reply: `${simulated.reply}\n\n*(Note: Live Gemini API encountered: ${err.message}. To use live Gemini 3.8 Flash, provide a valid API key in Settings.)*`,
      aiPowered: false
    };
  }
}

/**
 * Intelligent local fallback heuristic for offline/demo use without API key
 */
function fallbackHeuristicExtractor(text, projectInfo) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const detectedNodes = [];
  const detectedEdges = [];
  let counter = 1;

  // Keyword scanners
  const techKeywords = [
    { regex: /gateway|proxy/i, type: 'service', layer: 'technical', name: 'API Gateway', team: 'Platform Infra' },
    { regex: /auth|login|identity|token|jwt/i, type: 'service', layer: 'technical', name: 'Authentication Service', team: 'Security Team' },
    { regex: /payment|stripe|billing|checkout/i, type: 'service', layer: 'technical', name: 'Payment Engine', team: 'FinTech' },
    { regex: /notification|email|sms|alert/i, type: 'service', layer: 'technical', name: 'Notification Service', team: 'Communications' },
    { regex: /order|cart/i, type: 'service', layer: 'technical', name: 'Order Processing Service', team: 'Order Management' },
    { regex: /postgres|mysql|database|sql/i, type: 'database', layer: 'technical', name: 'Primary Database', team: 'DBA Squad' },
    { regex: /redis|cache|memcached/i, type: 'database', layer: 'technical', name: 'Distributed Cache', team: 'Infra' },
    { regex: /kafka|queue|rabbitmq|pubsub/i, type: 'queue', layer: 'technical', name: 'Event Streaming Broker', team: 'Data Platform' },
    { regex: /user|customer|shopper|admin|merchant/i, type: 'actor', layer: 'functional', name: 'Platform User', team: 'Product' },
    { regex: /rule|policy|compliance|pci|gdpr/i, type: 'business_rule', layer: 'functional', name: 'Security & Compliance Rule', team: 'Governance' },
    { regex: /flow|journey|process/i, type: 'user_flow', layer: 'functional', name: 'Core User Journey', team: 'Product Management' }
  ];

  for (const kw of techKeywords) {
    if (kw.regex.test(text)) {
      const id = `extracted_${kw.type}_${counter++}`;
      detectedNodes.push({
        id,
        layer: kw.layer,
        type: kw.type,
        name: kw.name,
        summary: `Automatically identified from requirements: relates to ${kw.name.toLowerCase()}.`,
        team: kw.team,
        status: 'planned',
        details: { extractedFrom: 'Architecture Text Input' }
      });
    }
  }

  // If few nodes detected, generate standard nodes based on lines
  if (detectedNodes.length < 3) {
    lines.slice(0, 4).forEach((line, idx) => {
      const clean = line.replace(/^[-*0-9.]+\s*/, '').slice(0, 40);
      if (clean.length > 3) {
        detectedNodes.push({
          id: `extracted_component_${idx + 1}`,
          layer: idx % 2 === 0 ? 'functional' : 'technical',
          type: idx % 2 === 0 ? 'domain' : 'service',
          name: clean,
          summary: `Extracted from text: "${clean}"`,
          team: 'Engineering Squad',
          status: 'planned',
          details: { origin: line }
        });
      }
    });
  }

  // Create chain edges between detected nodes
  for (let i = 0; i < detectedNodes.length - 1; i++) {
    const src = detectedNodes[i];
    const tgt = detectedNodes[i + 1];
    detectedEdges.push({
      id: `extracted_edge_${i + 1}`,
      source: src.id,
      target: tgt.id,
      type: src.layer === 'functional' && tgt.layer === 'technical' ? 'initiates' : 'calls',
      label: `${src.type} -> ${tgt.type}`,
      summary: `Interaction detected between ${src.name} and ${tgt.name}`
    });
  }

  return {
    summary: `Heuristically extracted ${detectedNodes.length} nodes and ${detectedEdges.length} relationships from the provided architecture text. (Connect Gemini API key in Settings for deep semantic reasoning).`,
    nodes: detectedNodes,
    edges: detectedEdges
  };
}

/**
 * Intelligent local graph traversal fallback for offline chat
 */
function fallbackArchitectureChat(message, graphContext) {
  const lower = message.toLowerCase();
  const { nodes, edges, flows } = graphContext;

  // 1. Failure / Impact Analysis
  if (lower.includes('fail') || lower.includes('down') || lower.includes('outage') || lower.includes('impact') || lower.includes('what happens if')) {
    const matchedNode = nodes.find(n => lower.includes(n.name.toLowerCase()) || lower.includes(n.id.toLowerCase()));
    if (matchedNode) {
      const upstreamEdges = edges.filter(e => e.target === matchedNode.id);
      const downstreamEdges = edges.filter(e => e.source === matchedNode.id);
      const upstreamNodes = upstreamEdges.map(e => nodes.find(n => n.id === e.source)?.name || e.source);
      const downstreamNodes = downstreamEdges.map(e => nodes.find(n => n.id === e.target)?.name || e.target);
      const affectedFlows = flows.filter(f => (f.steps || []).some(s => s.source === matchedNode.id || s.target === matchedNode.id)).map(f => f.name);

      return {
        reply: `### Impact Analysis for \`${matchedNode.name}\` (${matchedNode.layer.toUpperCase()} - ${matchedNode.type})

**Overview:**
${matchedNode.summary}

**1. Upstream Impact (Direct Callers Affected):**
${upstreamNodes.length > 0 ? upstreamNodes.map(name => `• \`${name}\` will experience connection timeouts or error responses.`).join('\n') : '• No direct upstream callers detected in the graph.'}

**2. Downstream Dependencies (Stalled Operations):**
${downstreamNodes.length > 0 ? downstreamNodes.map(name => `• \`${name}\` will cease receiving downstream updates from this component.`).join('\n') : '• No downstream services directly dependent.'}

**3. Affected Functional User Flows:**
${affectedFlows.length > 0 ? affectedFlows.map(name => `• **Flow Disrupted:** *${name}*`).join('\n') : '• No explicit multi-step flows directly contain this node.'}

**Recommended Mitigation:**
- Implement circuit breaker patterns (e.g. Resilience4j/Envoy circuit breaking).
- Deploy redundant multi-AZ replicas with health-check-based automated failover.
- Ensure dead-letter queues (DLQ) are configured for asynchronous recovery.`,
        aiPowered: false
      };
    }
  }

  // 2. Flow inquiry
  if (lower.includes('flow') || lower.includes('step') || lower.includes('how does') || lower.includes('trace')) {
    if (flows.length > 0) {
      const flow = flows[0];
      const steps = flow.steps.map(s => `${s.order}. **${s.title}**: ${s.description}`).join('\n');
      return {
        reply: `### Architecture Flow: ${flow.name}

${flow.description}

**Execution Sequence:**
${steps}

*Tip: You can visualize and animate this exact path on the canvas using the **Flow Trace** mode!*`,
        aiPowered: false
      };
    }
  }

  // 3. General overview
  const functionalNodes = nodes.filter(n => n.layer === 'functional');
  const technicalNodes = nodes.filter(n => n.layer === 'technical');

  return {
    reply: `### Project Architecture Summary: ${graphContext.project.name}

${graphContext.project.description}

**Architecture Breakdown:**
- **Functional Layer (${functionalNodes.length} nodes)**: Domains, user journeys, business rules, and actors (e.g. ${functionalNodes.slice(0, 3).map(n => `\`${n.name}\``).join(', ')}).
- **Technical Layer (${technicalNodes.length} nodes)**: Services, databases, queues, and external APIs (e.g. ${technicalNodes.slice(0, 3).map(n => `\`${n.name}\``).join(', ')}).
- **Relationships (${edges.length} connections)**: Tracing calls, event streaming, data persistence, and domain implementations.
- **Traceable Flows (${flows.length} configured)**.

*Ask questions like:*
- *"What happens if the Edge API Gateway goes down?"*
- *"Trace the customer checkout flow step by step."*
- *"Which services handle financial payments and compliance?"*`,
    aiPowered: false
  };
}

module.exports = {
  callGemini,
  extractGraphFromText,
  chatWithArchitecture,
  getApiKey
};
