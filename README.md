# Knowledge Builder Graph (KBG)
> **Collaborative Functional & Technical Architecture Platform with Integrated Gemini AI**

Knowledge Builder Graph (KBG) bridges the gap between **product requirements** and **engineering infrastructure**. It allows engineering teams, software architects, and product managers to document, visualize, trace, and interact with complex architectures across both functional domains and technical components.

---

## 🌟 Key Capabilities

### 1. Dual-Layer Architecture Modeling
- **Functional Layer**:
  - **Domains & Subdomains** (e.g., Identity, Payments, Fulfillment)
  - **User Journeys & Flows** (e.g., Customer Checkout, Passwordless Auth)
  - **Business Rules & SLAs** (e.g., Fraud Screening, 15-Minute Delivery SLA, PCI-DSS)
  - **Actors & Personas** (e.g., Online Shopper, Operations Manager)
- **Technical Layer**:
  - **Microservices & Proxies** (e.g., Edge API Gateway, Order Service, Auth API)
  - **Databases & Caches** (e.g., PostgreSQL Aurora, MongoDB, Redis Cluster)
  - **Event Streaming Topics** (e.g., Kafka `orders.v1.events`)
  - **External 3rd-Party APIs** (e.g., Stripe, SendGrid)

### 2. Interactive Graph Visualizer (Cytoscape.js)
- **Layer Switching**: Instantly switch between **Unified View**, **Functional Only**, and **Technical Only**.
- **Layout Engines**: Dagre (Hierarchical left-to-right DAG) and CoSE (Physics force-directed).
- **Deep Inspector**: Click any node or connection to inspect schemas, SLAs, runbooks, and upstream/downstream dependencies.
- **Search & Filter**: Real-time filtering by team, layer, status, and keywords.
- **Export**: One-click high-resolution PNG export.

### 3. Traceable End-to-End Execution Flows
- Step-by-step sequential flow simulator.
- Click any flow (e.g., **"Customer Checkout & Payment Processing"**) to watch the execution path animate across services, databases, and message brokers with step descriptions.

### 4. Integrated Gemini AI (Gemini 3.8 Flash)
- **AI Graph Extractor (PRD to Graph)**: Paste unstructured PRDs, READMEs, or architectural specs -> Gemini extracts structured nodes, layers, and directional edges with one-click import.
- **AI Architecture Copilot ("Chat with your Graph")**: Context-aware Q&A grounded in your active graph topology.
  - **Failure & Impact Analysis**: *"What happens if the Edge API Gateway fails?"* -> AI traces callers and dependencies to forecast blast radius.
  - **Flow Explanation**: *"Trace the payment verification flow."*
  - **Single Point of Failure (SPOF) Detection**.
- **Offline & Simulation Mode**: Includes a built-in heuristic engine so the entire app works seamlessly even before entering an API key.

### 5. Direct Atlassian Jira API Connector
- **Live Jira Integration**: Connect directly to Jira Cloud (`https://company.atlassian.net`) or Jira Server/Data Center via REST API.
- **JQL Search Engine**: Query Epics, User Stories, and Tasks with real-time presets (*"All Epics & Stories"*, *"Open Stories"*, *"High Priority Requirements"*).
- **Functional Architecture Synthesis**:
  - **Jira Epics** $\rightarrow$ **Functional Domains**
  - **User Stories** (*"As a..., I want..."*) $\rightarrow$ **User Flows & Journeys**
  - **User Personas** (*"As a..."*) $\rightarrow$ **Functional Actors & Personas**
  - **Acceptance Criteria & SLAs** $\rightarrow$ **Business Rules & Policies**
  - **Components & Microservices** $\rightarrow$ **Technical Services**
- **Deep-Linking & Traceability**: Inspected nodes display live Jira key badges with 1-click **`Open in Jira ↗`** links directly to Atlassian tickets.
- **Dual Mode**: Choose between **Gemini 3.8 Flash Semantic AI Extraction** or **Fast Structural Deterministic Mapping**, plus a built-in **1-Click Demo Dataset** for testing without live credentials.

### 6. Knowledge Transfer (KT) Video & Audio Studio (STT & TTS)
- **Speech-to-Text (STT) Ingestion**: Import recorded KT video/audio files (`.mp4`, `.webm`, `.mp3`, `.wav`, `.m4a`), record real-time voice directly from your microphone with audio waveform visualizers, or paste raw meeting transcripts (Zoom, Microsoft Teams, Loom, Otter.ai).
- **Automated Architecture Specification Generation**: Transforms unstructured spoken handover sessions into structured, professional Architecture Documents (System Overview, Functional Journeys, Technical Topology, On-Call "Gotchas" / Tribal Knowledge, Action Items).
- **Natural Text-to-Speech (TTS) Voice Player**: Listen to natural voice narrations of the generated architecture specifications using Web Speech API synthesis with customizable voices, playback speed rates (0.8x - 1.5x), and play/pause controls.
- **Knowledge Graph Extraction & Archive**: Automatically extracts Functional and Technical nodes and directional relationships with 1-click import into your active canvas, with full session archiving in SQLite.

---

## 🚀 Getting Started

### 1. Launch the Application
Simply double-click `start.bat` or run:
```bash
agy-node server/server.js
```
The server will start at **`http://localhost:4000`** and open in your default browser.

### 2. Configure Gemini API Key (Optional)
Click the **Settings** icon in the top-right navbar, paste your Google Gemini API key, and click **Save Settings**. (Alternatively, set the `GEMINI_API_KEY` environment variable).

### 3. Connect Jira (Optional)
Click the **Jira Connector** button in the navbar, configure your Jira Host URL and API Token (or click **⚡ Load Demo Dataset** to immediately test sample tickets), search via JQL, and click **Synthesize Knowledge Graph**.

### 4. Import Knowledge Transfer Videos / Audios (KT Studio)
Click the **KT Studio** button in the navbar to import KT recordings, record live voice sessions, generate architecture specifications, listen to TTS audio walkthroughs, and export to your graph.

---

## 📂 Project Structure
```
knowledge-graph-builder/
├── server/
│   ├── server.js          # HTTP & REST API server
│   ├── db.js              # SQLite database (node:sqlite)
│   ├── gemini.js          # Gemini 3.8 Flash AI engine & heuristics
│   ├── jira.js            # Direct Jira REST API connector & ADF parser
│   ├── kt.js              # KT Video/Audio Speech-to-Text & Document engine
│   └── sample-data.js     # CloudCommerce Omni-Engine seed graph
├── public/
│   ├── index.html         # Single-Page Application UI
│   ├── app.js             # Graph logic, Cytoscape controller, Jira, KT & TTS
│   ├── styles.css         # Dark-themed engineering design system
│   └── vendor/            # Offline Cytoscape, Dagre, and Marked libraries
├── data/
│   └── knowledge_graph.db # Persistent SQLite database
├── start.bat              # One-click Windows launcher
└── README.md
```
