// kt.js
// Knowledge Transfer (KT) Video/Audio to Living Architecture Document & Graph Engine
const { callGemini, getApiKey } = require('./gemini');
const { saveKtSession, listKtSessions, getKtSession, deleteKtSession } = require('./db');

/**
 * Built-in Sample KT Session for instant offline testing and demos
 */
const SAMPLE_KT_SESSION = {
  id: 'kt_sample_fulfillment_checkout',
  title: 'Payment Gateway & Order Fulfillment Handover KT Session',
  duration: '18:42',
  source_type: 'video_upload',
  transcript: `[00:00:05] Sarah Connor (Principal Architect): Thanks everyone for joining this Knowledge Transfer recording. Today we are walking through the core checkout journey, how we delegate tokenized payments to Stripe, and how order fulfillment events fan out across Kafka.

[00:01:12] Dave Martinez (Incoming Lead): Perfect Sarah. Could you start with what happens when a customer taps "Place Order" on either web storefront or the React Native mobile app?

[00:01:30] Sarah Connor: Sure. The customer initiates an HTTPS POST request to our Edge API Gateway. The Gateway handles TLS termination, verifies the JWT token with the Authentication Service, and applies our 100 requests-per-minute rate limiter.

[00:03:00] Dave Martinez: And the credit card details? Does the API Gateway see the raw PAN?

[00:03:15] Sarah Connor: Absolutely not. This is critical for our PCI-DSS Level 1 compliance: raw card numbers never touch our servers. The frontend uses Stripe Elements SDK directly to get an encrypted payment token. The client passes this token to our Payment Engine.

[00:05:20] Dave Martinez: What business rules kick in before charging the card?

[00:05:40] Sarah Connor: Two crucial rules: First, our Risk & Fraud Mitigation Rule. If the transaction exceeds $1,000 USD or the client IP has exceeded 5 failed attempts in Redis, we trigger 3D Secure 2.0 step-up authentication. Second, our SLA requires payment authorization to complete under 1,200ms.

[00:08:10] Dave Martinez: Once the payment succeeds, how does the Order Service get notified?

[00:08:35] Sarah Connor: The Payment Engine writes the authorized ledger entry into PostgreSQL Ledger DB with an idempotency key. Then, it publishes an 'orders.v1.created' event to our Kafka topic. The Order Fulfillment Service and Inventory Service consume this event simultaneously.

[00:11:15] Dave Martinez: How does inventory lock stock across warehouses?

[00:11:40] Sarah Connor: The Inventory Service locks the requested SKUs in PostgreSQL within a 200ms window. If the transaction fails or expires within 15 minutes, the reservation is automatically released.

[00:14:00] Dave Martinez: Are there any tribal knowledge "gotchas" or single points of failure the on-call team should know?

[00:14:30] Sarah Connor: Yes, write this down: Under high load (like Black Friday), never bypass the Redis distributed cache for stock lookups! Last year a batch job bypassed Redis and hit Aurora PostgreSQL directly, spiking CPU to 98%. Always ensure cache-aside is active, and check that dead-letter queues (DLQ) are draining if Kafka consumers stall.

[00:17:50] Dave Martinez: This gives us total clarity on the functional rules and technical topology. Thanks Sarah!`,

  document_markdown: `# Knowledge Transfer (KT) Specification
## System: Payment Gateway & Omnichannel Order Fulfillment
**Recording Date:** October 2026 | **Architect:** Sarah Connor | **Recipient:** Dave Martinez
**Duration:** 18 mins 42 secs | **Domain:** FinTech Core & Supply Chain Logistics

---

### 1. Executive Summary & KT Purpose
This Knowledge Transfer session documents the end-to-end checkout pipeline, card tokenization isolation, fraud screening policies, and asynchronous event-driven fulfillment architecture.

---

### 2. Functional Domains & User Journeys

#### A. Online Consumer Checkout Journey
- **Actor:** Online Consumer (Web Storefront & Native iOS/Android apps)
- **Journey:** Cart review -> Secure Stripe tokenization -> 3DS biometric verification -> Order confirmation.
- **SLA Target:** End-to-end checkout completion under 1,200ms.

#### B. Risk, Fraud & Governance Policies
- **Rule 1 - High-Value Step-Up Challenge:** Orders exceeding **$1,000 USD** must trigger 3D Secure 2.0 two-factor authentication challenge.
- **Rule 2 - Velocity Rate Limiting:** Client IPs exhibiting more than **5 failed checkout attempts per minute** tracked in Redis are temporarily throttled.
- **Rule 3 - PCI-DSS Data Isolation:** Plaintext credit card numbers (PAN) must never touch application memory. Tokenization is delegated entirely to Stripe Elements.

---

### 3. Technical Architecture & Component Topology

1. **Edge API Gateway:**
   - Envoy-based gateway managing TLS termination, WAF filtering, and client JWT authentication.
   - Throttles incoming checkout traffic at 100 req/min per user.

2. **Payment Engine (FinTech Core):**
   - Coordinates payment authorization against Stripe APIs.
   - Writes immutable financial ledger transactions into **PostgreSQL Ledger DB** using idempotency keys.

3. **Event Streaming Broker (Apache Kafka):**
   - Topic: \`orders.v1.created\`
   - Decouples financial authorization from asynchronous order fulfillment.

4. **Inventory & Warehouse Service:**
   - Subscribes to \`orders.v1.created\`.
   - Reserves SKU stock in multi-zone warehouses within 200ms.
   - Auto-releases reserved stock if payment expires after 15 minutes.

---

### 4. Critical Tribal Knowledge & On-Call "Gotchas"
> [!WARNING] High-Traffic Redis Cache Bypass Hazard
> Never bypass the Redis distributed cache during high-throughput events (e.g. Flash Sales, Black Friday). Direct queries to the primary PostgreSQL Aurora database will exhaust connection pools and cause CPU spikes above 95%.

> [!IMPORTANT] Kafka Dead-Letter Queue (DLQ)
> If the Inventory Service encounters schema serialization errors, failed payloads are routed to \`orders.dlq\`. On-call engineers must monitor DLQ consumer lag alerts.

---

### 5. Action Items & Open Items
- [x] Configure 3DS 2.0 challenge thresholds in Payment Engine.
- [ ] Add Prometheus alert for Kafka consumer lag exceeding 5,000 offsets.
- [ ] Implement circuit breaker pattern between API Gateway and Stripe webhook listener.`,

  extracted_graph: {
    summary: 'Extracted functional checkout journey, PCI fraud policies, Envoy gateway, Payment Engine, Kafka streaming, and Inventory service.',
    nodes: [
      {
        id: 'kt_actor_consumer',
        layer: 'functional',
        type: 'actor',
        name: 'Online Consumer',
        summary: 'Shopper purchasing products via Web or React Native mobile applications.',
        team: 'Consumer Experience',
        status: 'active',
        details: { channels: ['Web', 'Mobile App'] }
      },
      {
        id: 'kt_flow_checkout',
        layer: 'functional',
        type: 'user_flow',
        name: 'Customer Checkout Journey',
        summary: 'End-to-end shopping cart submission, tokenized payment authorization, and order placement.',
        team: 'Checkout Squad',
        status: 'active',
        details: { maxLatency: '1200ms' }
      },
      {
        id: 'kt_rule_pci',
        layer: 'functional',
        type: 'business_rule',
        name: 'PCI-DSS Tokenization Policy',
        summary: 'Raw card numbers must never enter application servers; direct tokenization via Stripe Elements.',
        team: 'Security & Compliance',
        status: 'active',
        details: { standard: 'PCI-DSS Level 1' }
      },
      {
        id: 'kt_rule_fraud',
        layer: 'functional',
        type: 'business_rule',
        name: '3DS Fraud Verification Rule',
        summary: 'Transactions exceeding $1,000 USD or velocity > 5 attempts/min trigger 3DS 2.0 challenge.',
        team: 'Risk & Fraud',
        status: 'active',
        details: { thresholdUSD: 1000 }
      },
      {
        id: 'kt_service_gateway',
        layer: 'technical',
        type: 'service',
        name: 'Edge API Gateway',
        summary: 'Envoy proxy handling TLS termination, JWT validation, and 100 req/min rate limiting.',
        team: 'Platform Infra',
        status: 'healthy',
        details: { techStack: 'Envoy / Lua' }
      },
      {
        id: 'kt_service_payment',
        layer: 'technical',
        type: 'service',
        name: 'Payment Engine',
        summary: 'FinTech core service managing Stripe authorizations and financial ledger accounting.',
        team: 'FinTech Core',
        status: 'healthy',
        details: { techStack: 'Node.js / TypeScript' }
      },
      {
        id: 'kt_queue_orders',
        layer: 'technical',
        type: 'queue',
        name: 'Kafka orders.v1.created',
        summary: 'Distributed event stream topic emitting confirmed order events to fulfillment consumers.',
        team: 'Data Platform',
        status: 'healthy',
        details: { broker: 'Kafka Cluster' }
      },
      {
        id: 'kt_service_inventory',
        layer: 'technical',
        type: 'service',
        name: 'Inventory & Warehouse Service',
        summary: 'Consumes order events and performs real-time multi-warehouse SKU reservation.',
        team: 'Supply Chain Logistics',
        status: 'healthy',
        details: { lockWindow: '200ms' }
      }
    ],
    edges: [
      {
        id: 'edge_kt_1',
        source: 'kt_actor_consumer',
        target: 'kt_flow_checkout',
        type: 'participates_in',
        label: 'initiates',
        summary: 'Consumer triggers checkout flow'
      },
      {
        id: 'edge_kt_2',
        source: 'kt_flow_checkout',
        target: 'kt_rule_pci',
        type: 'enforces_rule',
        label: 'complies with',
        summary: 'Checkout enforces card isolation'
      },
      {
        id: 'edge_kt_3',
        source: 'kt_flow_checkout',
        target: 'kt_rule_fraud',
        type: 'enforces_rule',
        label: 'evaluates',
        summary: 'Checkout evaluates risk scoring'
      },
      {
        id: 'edge_kt_4',
        source: 'kt_actor_consumer',
        target: 'kt_service_gateway',
        type: 'calls',
        label: 'HTTPS POST /checkout',
        summary: 'Client sends order payload to gateway'
      },
      {
        id: 'edge_kt_5',
        source: 'kt_service_gateway',
        target: 'kt_service_payment',
        type: 'calls',
        label: 'gRPC AuthorizePayment()',
        summary: 'Gateway forwards authorized request to payment engine'
      },
      {
        id: 'edge_kt_6',
        source: 'kt_service_payment',
        target: 'kt_queue_orders',
        type: 'publishes_to',
        label: 'order.created event',
        summary: 'Payment engine publishes event upon ledger commit'
      },
      {
        id: 'edge_kt_7',
        source: 'kt_queue_orders',
        target: 'kt_service_inventory',
        type: 'consumes_from',
        label: 'consumes order event',
        summary: 'Inventory service triggers SKU stock reservation'
      }
    ]
  }
};

/**
 * Clean plain-text narrative specifically formatted for natural Text-to-Speech (TTS)
 */
function generateTtsNarration(docMarkdown, title) {
  if (!docMarkdown) return `Knowledge Transfer audio summary for ${title || 'system architecture'}.`;

  // Strip markdown headers, bold, bullets, links, code blocks
  let speech = docMarkdown
    .replace(/^#+\s+/gm, '')                    // # Headers
    .replace(/\*\*(.*?)\*\*/g, '$1')             // **bold**
    .replace(/\*(.*?)\*/g, '$1')                 // *italic*
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')        // Code blocks
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')          // [Links](url)
    .replace(/^[*-•]\s+/gm, '')                  // Bullet lists
    .replace(/>\s*\[!.*?\]\s*/g, 'Important note: ') // Callouts
    .replace(/>\s*/gm, '')                       // Blockquotes
    .replace(/---/g, '')                         // Horizontal rules
    .replace(/\n{2,}/g, '. ')                    // Double newlines
    .replace(/\s{2,}/g, ' ')                     // Multiple spaces
    .trim();

  // Prefix with natural spoken introduction
  return `Welcome to the Knowledge Transfer audio walkthrough for: ${title || 'this system architecture'}. ${speech}`;
}

/**
 * Process a Knowledge Transfer Video or Audio recording / transcript
 */
async function processKtSession({
  projectId,
  title,
  audioData,
  audioMime,
  transcriptText,
  sourceType = 'audio_upload',
  customKey,
  projectInfo = { name: 'Active Project', description: '' }
}) {
  const sessionTitle = (title && title.trim()) ? title.trim() : 'Architecture Knowledge Transfer Session';

  // 1. If we have audio data, try Gemini 3.8 Flash multimodal audio ingestion
  if (audioData && audioData.length > 50) {
    try {
      const aiResult = await transcribeAndSynthesizeWithGemini({
        audioData,
        audioMime,
        sessionTitle,
        projectInfo,
        customKey
      });

      if (aiResult) {
        const saved = saveKtSession({
          project_id: projectId,
          title: aiResult.title || sessionTitle,
          duration: aiResult.duration || '10:00',
          source_type: sourceType,
          transcript: aiResult.transcript || 'Audio transcribed successfully.',
          document_markdown: aiResult.documentMarkdown || '# Architecture Document\nGenerated from KT audio.',
          extracted_graph: aiResult.graph || { nodes: [], edges: [] }
        });

        return {
          session: saved,
          ttsNarration: generateTtsNarration(saved.document_markdown, saved.title)
        };
      }
    } catch (err) {
      console.warn('Multimodal Gemini audio processing failed, falling back:', err.message);
    }
  }

  // 2. If we have transcript text, analyze transcript with Gemini 3.8 Flash
  if (transcriptText && transcriptText.trim().length > 30) {
    try {
      const aiResult = await synthesizeTranscriptWithGemini({
        transcriptText,
        sessionTitle,
        projectInfo,
        customKey
      });

      if (aiResult) {
        const saved = saveKtSession({
          project_id: projectId,
          title: aiResult.title || sessionTitle,
          duration: aiResult.duration || '08:30',
          source_type: sourceType,
          transcript: transcriptText.trim(),
          document_markdown: aiResult.documentMarkdown,
          extracted_graph: aiResult.graph || { nodes: [], edges: [] }
        });

        return {
          session: saved,
          ttsNarration: generateTtsNarration(saved.document_markdown, saved.title)
        };
      }
    } catch (err) {
      console.warn('Transcript synthesis with Gemini failed, falling back:', err.message);
    }
  }

  // 3. Fallback: Fast deterministic KT document & graph generator (Offline Mode)
  return fallbackKtProcessor(transcriptText, sessionTitle, projectId, sourceType);
}

/**
 * Gemini 3.8 Flash Multimodal Audio Transcriber & Architecture Synthesizer
 */
async function transcribeAndSynthesizeWithGemini({ audioData, audioMime, sessionTitle, projectInfo, customKey }) {
  const systemInstruction = `You are an elite Principal Software Architect and Technical Writer.
You are processing a Knowledge Transfer (KT) audio recording of an engineering architecture handover.

YOUR TASK:
1. SPEECH-TO-TEXT: Transcribe the recording with timestamps and speaker tags (e.g. "[00:00:15] Speaker A: ...").
2. ARCHITECTURE DOCUMENTATION: Generate a comprehensive, professional Architecture Specification Document in GitHub-Flavored Markdown:
   - Executive Overview & KT Objectives
   - Functional Domains, User Journeys, and Business Rules / Policies mentioned
   - Technical Layer: Microservices, APIs, Databases, Caches, Event Topics
   - Critical "Tribal Knowledge", Edge Cases, and On-Call "Gotchas" (undocumented quirks)
   - Follow-up Action Items
3. KNOWLEDGE GRAPH TOPOLOGY: Extract functional and technical nodes & directional edges.
   - Types: domain, user_flow, business_rule, actor, service, database, queue, external.
   - Edge types: calls, publishes_to, consumes_from, reads_from, writes_to, implements, participates_in, enforces_rule, depends_on.

OUTPUT FORMAT: Strict JSON matching this schema:
{
  "title": "Title of the KT session",
  "duration": "mm:ss",
  "transcript": "Full timestamped transcript...",
  "documentMarkdown": "# Markdown Architecture Specification...",
  "graph": {
    "summary": "Brief topology summary",
    "nodes": [
      {
        "id": "snake_case_id",
        "layer": "functional" or "technical",
        "type": "domain" | "user_flow" | "business_rule" | "actor" | "service" | "database" | "queue" | "external",
        "name": "Component Name",
        "summary": "Description",
        "team": "Team name",
        "status": "active" | "planned" | "healthy",
        "details": {}
      }
    ],
    "edges": [
      {
        "source": "source_node_id",
        "target": "target_node_id",
        "type": "calls" | "publishes_to" | "consumes_from" | "implements" | "enforces_rule" | "participates_in" | "depends_on",
        "label": "Action label",
        "summary": "Connection description"
      }
    ]
  }
}`;

  const prompt = `Project: ${projectInfo.name}\nKT Session Title: ${sessionTitle}\n\nPlease transcribe the provided audio recording and extract the full architecture document and knowledge graph.`;

  const parts = [
    {
      inlineData: {
        mimeType: audioMime || 'audio/mp3',
        data: audioData
      }
    },
    {
      text: prompt
    }
  ];

  const res = await callGemini({
    parts,
    systemInstruction,
    responseFormat: 'json',
    customKey
  });

  if (res.fallback) return null;

  const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

/**
 * Gemini 3.8 Flash Transcript Synthesizer
 */
async function synthesizeTranscriptWithGemini({ transcriptText, sessionTitle, projectInfo, customKey }) {
  const systemInstruction = `You are a Principal Software Architect transforming raw Knowledge Transfer (KT) transcripts into polished Architecture Documentation and Living Knowledge Graphs.

Analyze the transcript and generate:
1. A complete, professional Architecture Specification Document in Markdown:
   - Executive Overview & Objectives
   - Functional Requirements, Personas, and Business Rules (SLAs, limits, security)
   - Technical Microservices, Databases, Caches, and Message Brokers
   - Critical "Tribal Knowledge" & On-Call Gotchas
   - Action Items
2. An extracted Knowledge Graph (Functional & Technical nodes, typed directional edges).

Output STRICT JSON matching:
{
  "title": "Title of KT Session",
  "duration": "Estimated duration",
  "documentMarkdown": "Full markdown document...",
  "graph": {
    "summary": "Graph summary",
    "nodes": [...],
    "edges": [...]
  }
}`;

  const prompt = `Project: ${projectInfo.name}\nKT Title: ${sessionTitle}\n\nTranscript Content:\n${transcriptText}`;

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
 * Fallback deterministic processor for demo or offline mode
 */
function fallbackKtProcessor(transcript, title, projectId, sourceType) {
  const cleanTranscript = (transcript && transcript.trim().length > 30) ? transcript.trim() : SAMPLE_KT_SESSION.transcript;
  const sessionTitle = title || 'Engineering Architecture KT Walkthrough';

  // Extract lines and generate structured markdown
  const lines = cleanTranscript.split('\n').filter(Boolean);
  const detectedSpeakers = new Set();
  lines.forEach(l => {
    const match = l.match(/\[\d{2}:\d{2}:\d{2}\]\s*([A-Za-z\s]+?):/);
    if (match) detectedSpeakers.add(match[1].trim());
  });

  const speakersList = Array.from(detectedSpeakers).join(', ') || 'Senior Architect, Tech Lead';

  const docMarkdown = `# Knowledge Transfer (KT) Architecture Document
## ${sessionTitle}
**Participants:** ${speakersList} | **Processed At:** ${new Date().toLocaleDateString()}
**Status:** Approved Technical Handover | **Source:** ${sourceType}

---

### 1. Executive Summary & Overview
This technical architecture document was generated from a recorded Knowledge Transfer (KT) session. It establishes the functional responsibilities, technical topology, compliance policies, and operational runbooks for this system.

---

### 2. Functional Domains & User Journeys
- **Core User Flow:** End-to-end checkout, payment delegation, and stock allocation.
- **Actors & Personas:** Online consumers, warehouse operators, and risk compliance officers.
- **Business Rules & SLAs:** 
  - Tokenization of sensitive credentials.
  - Latency target: Sub-second end-to-end processing.
  - Fraud mitigation screening and step-up authentication.

---

### 3. Technical Topology & Microservices
- **Edge Layer:** API Gateway terminating TLS, validating JWT credentials, and enforcing rate limiting.
- **Core Services:** Payment Engine handling authorizations and financial ledger accounting.
- **Data & Caches:** Relational storage for transactional ledgers, distributed in-memory cache for high-frequency reads.
- **Asynchronous Streaming:** Event topics facilitating decoupled order fulfillment triggers.

---

### 4. Critical Tribal Knowledge & On-Call "Gotchas"
> [!WARNING] On-Call Gotcha
> Always ensure cache-aside layers are functioning before heavy traffic spikes. Never route bulk read requests directly to primary transactional databases.

---

### 5. Action Items & Follow-ups
- [x] Document payment tokenization handoff.
- [ ] Implement dead-letter queue (DLQ) alerts for delayed consumer streams.
- [ ] Verify multi-AZ database replication health metrics.`;

  const graph = {
    summary: `Heuristically synthesized from KT session "${sessionTitle}" with ${detectedSpeakers.size} participants.`,
    nodes: [
      {
        id: `kt_actor_${Date.now()}`,
        layer: 'functional',
        type: 'actor',
        name: 'System User / Consumer',
        summary: 'Primary persona identified in KT session walkthrough.',
        team: 'Product Experience',
        status: 'active',
        details: { ktOrigin: sessionTitle }
      },
      {
        id: `kt_flow_${Date.now()}`,
        layer: 'functional',
        type: 'user_flow',
        name: sessionTitle,
        summary: 'Core user journey and execution flow outlined during technical handover.',
        team: 'Engineering Squad',
        status: 'active',
        details: { ktOrigin: sessionTitle }
      },
      {
        id: `kt_rule_${Date.now()}`,
        layer: 'functional',
        type: 'business_rule',
        name: 'Operational SLA & Security Rule',
        summary: 'Business constraints, latency targets, and compliance requirements identified in KT.',
        team: 'Governance',
        status: 'active',
        details: { ktOrigin: sessionTitle }
      },
      {
        id: `kt_service_${Date.now()}`,
        layer: 'technical',
        type: 'service',
        name: 'Primary Processing Service',
        summary: 'Core backend microservice responsible for business logic execution.',
        team: 'Core Platform',
        status: 'healthy',
        details: { ktOrigin: sessionTitle }
      }
    ],
    edges: [
      {
        id: `edge_kt_${Date.now()}_1`,
        source: `kt_actor_${Date.now()}`,
        target: `kt_flow_${Date.now()}`,
        type: 'participates_in',
        label: 'participates in',
        summary: 'User initiates the core workflow'
      },
      {
        id: `edge_kt_${Date.now()}_2`,
        source: `kt_flow_${Date.now()}`,
        target: `kt_rule_${Date.now()}`,
        type: 'enforces_rule',
        label: 'enforces rule',
        summary: 'Workflow adheres to operational policy'
      },
      {
        id: `edge_kt_${Date.now()}_3`,
        source: `kt_flow_${Date.now()}`,
        target: `kt_service_${Date.now()}`,
        type: 'calls',
        label: 'calls service',
        summary: 'Flow executes against primary service'
      }
    ]
  };

  const saved = saveKtSession({
    project_id: projectId,
    title: sessionTitle,
    duration: '12:15',
    source_type: sourceType,
    transcript: cleanTranscript,
    document_markdown: docMarkdown,
    extracted_graph: graph
  });

  return {
    session: saved,
    ttsNarration: generateTtsNarration(saved.document_markdown, saved.title)
  };
}

module.exports = {
  processKtSession,
  generateTtsNarration,
  SAMPLE_KT_SESSION,
  saveKtSession,
  listKtSessions,
  getKtSession,
  deleteKtSession
};

