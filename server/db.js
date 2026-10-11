// db.js
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { SAMPLE_PROJECT, SAMPLE_NODES, SAMPLE_EDGES, SAMPLE_FLOWS } = require('./sample-data');

const DB_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'knowledge_graph.db');

const db = new DatabaseSync(DB_PATH);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      layer TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT,
      team TEXT,
      status TEXT,
      details_json TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT,
      summary TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      steps_json TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS kt_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      duration TEXT,
      source_type TEXT,
      transcript TEXT,
      document_markdown TEXT,
      extracted_graph_json TEXT,
      created_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Check if sample project exists; if not, seed it
  const checkProj = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (checkProj.count === 0) {
    seedSampleProject();
  }
}

// Auto-initialize tables
initDb();

function seedSampleProject() {
  const insertProj = db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, description, created_at)
    VALUES (?, ?, ?, ?)
  `);
  insertProj.run(
    SAMPLE_PROJECT.id,
    SAMPLE_PROJECT.name,
    SAMPLE_PROJECT.description,
    SAMPLE_PROJECT.created_at
  );

  const insertNode = db.prepare(`
    INSERT OR REPLACE INTO nodes (id, project_id, layer, type, name, summary, team, status, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const node of SAMPLE_NODES) {
    insertNode.run(
      node.id,
      node.project_id,
      node.layer,
      node.type,
      node.name,
      node.summary || '',
      node.team || '',
      node.status || 'active',
      JSON.stringify(node.details || {})
    );
  }

  const insertEdge = db.prepare(`
    INSERT OR REPLACE INTO edges (id, project_id, source, target, type, label, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const edge of SAMPLE_EDGES) {
    insertEdge.run(
      edge.id,
      edge.project_id,
      edge.source,
      edge.target,
      edge.type,
      edge.label || '',
      edge.summary || ''
    );
  }

  const insertFlow = db.prepare(`
    INSERT OR REPLACE INTO flows (id, project_id, name, description, steps_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const flow of SAMPLE_FLOWS) {
    insertFlow.run(
      flow.id,
      flow.project_id,
      flow.name,
      flow.description || '',
      JSON.stringify(flow.steps || [])
    );
  }
}

function listProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
}

function createProject({ id, name, description }) {
  const projId = id || `proj_${Date.now()}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, description, created_at)
    VALUES (?, ?, ?, ?)
  `).run(projId, name, description || '', createdAt);
  return { id: projId, name, description, created_at: createdAt };
}

function deleteProject(projectId) {
  db.prepare('DELETE FROM edges WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM nodes WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM flows WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM kt_sessions WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
}

function getProjectGraph(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;

  const rawNodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
  const nodes = rawNodes.map(n => ({
    ...n,
    details: n.details_json ? JSON.parse(n.details_json) : {}
  }));

  const edges = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(projectId);

  const rawFlows = db.prepare('SELECT * FROM flows WHERE project_id = ?').all(projectId);
  const flows = rawFlows.map(f => ({
    ...f,
    steps: f.steps_json ? JSON.parse(f.steps_json) : []
  }));

  return { project, nodes, edges, flows };
}

function upsertNode(node) {
  const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT OR REPLACE INTO nodes (id, project_id, layer, type, name, summary, team, status, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nodeId,
    node.project_id,
    node.layer || 'technical',
    node.type || 'service',
    node.name,
    node.summary || '',
    node.team || '',
    node.status || 'active',
    JSON.stringify(node.details || {})
  );
  return { ...node, id: nodeId };
}

function deleteNode(nodeId) {
  db.prepare('DELETE FROM edges WHERE source = ? OR target = ?').run(nodeId, nodeId);
  db.prepare('DELETE FROM nodes WHERE id = ?').run(nodeId);
}

function upsertEdge(edge) {
  const edgeId = edge.id || `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT OR REPLACE INTO edges (id, project_id, source, target, type, label, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    edgeId,
    edge.project_id,
    edge.source,
    edge.target,
    edge.type || 'relates_to',
    edge.label || '',
    edge.summary || ''
  );
  return { ...edge, id: edgeId };
}

function deleteEdge(edgeId) {
  db.prepare('DELETE FROM edges WHERE id = ?').run(edgeId);
}

function upsertFlow(flow) {
  const flowId = flow.id || `flow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT OR REPLACE INTO flows (id, project_id, name, description, steps_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    flowId,
    flow.project_id,
    flow.name,
    flow.description || '',
    JSON.stringify(flow.steps || [])
  );
  return { ...flow, id: flowId };
}

function deleteFlow(flowId) {
  db.prepare('DELETE FROM flows WHERE id = ?').run(flowId);
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function resetSampleProject() {
  seedSampleProject();
  return getProjectGraph(SAMPLE_PROJECT.id);
}

function saveKtSession(session) {
  const sessionId = session.id || `kt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const createdAt = session.created_at || new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO kt_sessions (id, project_id, title, duration, source_type, transcript, document_markdown, extracted_graph_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    session.project_id,
    session.title || 'Untitled KT Session',
    session.duration || '00:00',
    session.source_type || 'audio_upload',
    session.transcript || '',
    session.document_markdown || '',
    JSON.stringify(session.extracted_graph || {}),
    createdAt
  );
  return { ...session, id: sessionId, created_at: createdAt };
}

function listKtSessions(projectId) {
  const rows = db.prepare(`
    SELECT id, project_id, title, duration, source_type, created_at, SUBSTR(document_markdown, 1, 240) as preview
    FROM kt_sessions
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId);
  return rows;
}

function getKtSession(id) {
  const row = db.prepare('SELECT * FROM kt_sessions WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    extracted_graph: row.extracted_graph_json ? JSON.parse(row.extracted_graph_json) : null
  };
}

function deleteKtSession(id) {
  db.prepare('DELETE FROM kt_sessions WHERE id = ?').run(id);
}

module.exports = {
  initDb,
  listProjects,
  createProject,
  deleteProject,
  getProjectGraph,
  upsertNode,
  deleteNode,
  upsertEdge,
  deleteEdge,
  upsertFlow,
  deleteFlow,
  getSetting,
  setSetting,
  resetSampleProject,
  saveKtSession,
  listKtSessions,
  getKtSession,
  deleteKtSession
};
