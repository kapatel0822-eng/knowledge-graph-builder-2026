// server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const db = require('./db');
const gemini = require('./gemini');
const jira = require('./jira');
const kt = require('./kt');

const PORT = parseInt(process.env.PORT || '4000', 10);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

// Initialize database
db.initDb();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit for audio/video uploads
        reject(new Error('Payload too large (50MB limit)'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ---------------------------------------------------------
    // API ROUTES
    // ---------------------------------------------------------
    if (pathname.startsWith('/api/')) {
      // 1. Projects
      if (pathname === '/api/projects' && method === 'GET') {
        const projects = db.listProjects();
        return sendJson(res, 200, { projects });
      }

      if (pathname === '/api/projects' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name) {
          return sendJson(res, 400, { error: 'Project name is required' });
        }
        const created = db.createProject(body);
        return sendJson(res, 201, { project: created });
      }

      const projMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projMatch && method === 'GET') {
        const projId = projMatch[1];
        const graph = db.getProjectGraph(projId);
        if (!graph) return sendJson(res, 404, { error: 'Project not found' });
        return sendJson(res, 200, graph);
      }

      if (projMatch && method === 'DELETE') {
        const projId = projMatch[1];
        db.deleteProject(projId);
        return sendJson(res, 200, { success: true });
      }

      const resetMatch = pathname.match(/^\/api\/projects\/([^/]+)\/reset$/);
      if (resetMatch && method === 'POST') {
        const graph = db.resetSampleProject();
        return sendJson(res, 200, graph);
      }

      // 2. Nodes
      if (pathname === '/api/nodes' && (method === 'POST' || method === 'PUT')) {
        const body = await parseJsonBody(req);
        if (!body.project_id || !body.name) {
          return sendJson(res, 400, { error: 'project_id and name are required' });
        }
        const saved = db.upsertNode(body);
        return sendJson(res, 200, { node: saved });
      }

      const nodeDeleteMatch = pathname.match(/^\/api\/nodes\/([^/]+)$/);
      if (nodeDeleteMatch && method === 'DELETE') {
        const nodeId = nodeDeleteMatch[1];
        db.deleteNode(nodeId);
        return sendJson(res, 200, { success: true });
      }

      // 3. Edges
      if (pathname === '/api/edges' && (method === 'POST' || method === 'PUT')) {
        const body = await parseJsonBody(req);
        if (!body.project_id || !body.source || !body.target) {
          return sendJson(res, 400, { error: 'project_id, source, and target are required' });
        }
        const saved = db.upsertEdge(body);
        return sendJson(res, 200, { edge: saved });
      }

      const edgeDeleteMatch = pathname.match(/^\/api\/edges\/([^/]+)$/);
      if (edgeDeleteMatch && method === 'DELETE') {
        const edgeId = edgeDeleteMatch[1];
        db.deleteEdge(edgeId);
        return sendJson(res, 200, { success: true });
      }

      // 4. Flows
      if (pathname === '/api/flows' && (method === 'POST' || method === 'PUT')) {
        const body = await parseJsonBody(req);
        if (!body.project_id || !body.name) {
          return sendJson(res, 400, { error: 'project_id and name are required' });
        }
        const saved = db.upsertFlow(body);
        return sendJson(res, 200, { flow: saved });
      }

      const flowDeleteMatch = pathname.match(/^\/api\/flows\/([^/]+)$/);
      if (flowDeleteMatch && method === 'DELETE') {
        const flowId = flowDeleteMatch[1];
        db.deleteFlow(flowId);
        return sendJson(res, 200, { success: true });
      }

      // 5. Settings
      if (pathname === '/api/settings' && method === 'GET') {
        const hasKey = !!gemini.getApiKey();
        return sendJson(res, 200, {
          hasGeminiKey: hasKey,
          model: 'gemini-3.8-flash'
        });
      }

      if (pathname === '/api/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.gemini_api_key !== undefined) {
          db.setSetting('gemini_api_key', body.gemini_api_key.trim());
        }
        return sendJson(res, 200, { success: true, hasGeminiKey: !!gemini.getApiKey() });
      }

      // 6. AI Extractor
      if (pathname === '/api/ai/extract' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.text || !body.project_id) {
          return sendJson(res, 400, { error: 'text and project_id are required' });
        }
        const projectGraph = db.getProjectGraph(body.project_id);
        const extracted = await gemini.extractGraphFromText(
          body.text,
          projectGraph ? projectGraph.project : { name: 'New Project', description: '' },
          body.apiKey
        );

        // Optionally auto-save if requested
        if (body.autoApply) {
          for (const node of extracted.nodes || []) {
            db.upsertNode({ ...node, project_id: body.project_id });
          }
          for (const edge of extracted.edges || []) {
            db.upsertEdge({ ...edge, project_id: body.project_id });
          }
          const updatedGraph = db.getProjectGraph(body.project_id);
          return sendJson(res, 200, { extracted, graph: updatedGraph });
        }

        return sendJson(res, 200, { extracted });
      }

      // 7. AI Chat & Architecture Copilot
      if (pathname === '/api/ai/chat' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.message || !body.project_id) {
          return sendJson(res, 400, { error: 'message and project_id are required' });
        }
        const graphContext = db.getProjectGraph(body.project_id);
        if (!graphContext) {
          return sendJson(res, 404, { error: 'Project not found' });
        }
        const response = await gemini.chatWithArchitecture({
          message: body.message,
          graphContext,
          history: body.history || [],
          customKey: body.apiKey
        });
        return sendJson(res, 200, response);
      }

      // 8. Jira Connector Routes
      if (pathname === '/api/jira/config' && method === 'GET') {
        const config = jira.getJiraConfig();
        return sendJson(res, 200, {
          hasCredentials: config.hasCredentials,
          host: config.host,
          email: config.email
        });
      }

      if (pathname === '/api/jira/config' && method === 'POST') {
        const body = await parseJsonBody(req);
        jira.saveJiraConfig(body);
        const updated = jira.getJiraConfig();
        return sendJson(res, 200, {
          success: true,
          hasCredentials: updated.hasCredentials,
          host: updated.host,
          email: updated.email
        });
      }

      if (pathname === '/api/jira/test' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await jira.testJiraConnection(body);
        return sendJson(res, result.ok ? 200 : 400, result);
      }

      if (pathname === '/api/jira/demo-issues' && method === 'GET') {
        return sendJson(res, 200, {
          host: 'https://demo-corp.atlassian.net',
          total: jira.DEMO_JIRA_ISSUES.length,
          count: jira.DEMO_JIRA_ISSUES.length,
          issues: jira.DEMO_JIRA_ISSUES
        });
      }

      if (pathname === '/api/jira/search' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.demo) {
          return sendJson(res, 200, {
            host: 'https://demo-corp.atlassian.net',
            total: jira.DEMO_JIRA_ISSUES.length,
            count: jira.DEMO_JIRA_ISSUES.length,
            issues: jira.DEMO_JIRA_ISSUES
          });
        }
        try {
          const result = await jira.fetchJiraIssues({
            host: body.host,
            email: body.email,
            apiToken: body.apiToken,
            jql: body.jql,
            maxResults: body.maxResults || 25
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (pathname === '/api/jira/extract' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.project_id) {
          return sendJson(res, 400, { error: 'project_id is required' });
        }
        if (!body.issues || !Array.isArray(body.issues) || body.issues.length === 0) {
          return sendJson(res, 400, { error: 'No Jira issues provided for extraction' });
        }

        const projectGraph = db.getProjectGraph(body.project_id);
        const extracted = await jira.convertJiraToGraph({
          issues: body.issues,
          host: body.host,
          projectInfo: projectGraph ? projectGraph.project : { name: 'Active Project', description: '' },
          customKey: body.geminiApiKey,
          useAi: body.useAi !== false
        });

        if (body.autoApply) {
          for (const node of extracted.nodes || []) {
            db.upsertNode({ ...node, project_id: body.project_id });
          }
          for (const edge of extracted.edges || []) {
            db.upsertEdge({ ...edge, project_id: body.project_id });
          }
          const updatedGraph = db.getProjectGraph(body.project_id);
          return sendJson(res, 200, { extracted, graph: updatedGraph });
        }

        return sendJson(res, 200, { extracted });
      }

      // 9. KT Studio Routes (Speech-to-Text, Audio to Documents & Text-to-Speech)
      if (pathname === '/api/kt/sample' && method === 'GET') {
        const sample = kt.SAMPLE_KT_SESSION;
        const ttsNarration = kt.generateTtsNarration(sample.document_markdown, sample.title);
        return sendJson(res, 200, { session: sample, ttsNarration });
      }

      if (pathname === '/api/kt/sessions' && method === 'GET') {
        const projId = parsedUrl.query.project_id || 'proj_cloudcommerce';
        const sessions = db.listKtSessions(projId);
        return sendJson(res, 200, { sessions });
      }

      const ktSessionDetailMatch = pathname.match(/^\/api\/kt\/sessions\/([^/]+)$/);
      if (ktSessionDetailMatch && method === 'GET') {
        const sessionId = ktSessionDetailMatch[1];
        if (sessionId === kt.SAMPLE_KT_SESSION.id) {
          const sample = kt.SAMPLE_KT_SESSION;
          const ttsNarration = kt.generateTtsNarration(sample.document_markdown, sample.title);
          return sendJson(res, 200, { session: sample, ttsNarration });
        }
        const session = db.getKtSession(sessionId);
        if (!session) return sendJson(res, 404, { error: 'KT Session not found' });
        const ttsNarration = kt.generateTtsNarration(session.document_markdown, session.title);
        return sendJson(res, 200, { session, ttsNarration });
      }

      if (ktSessionDetailMatch && method === 'DELETE') {
        const sessionId = ktSessionDetailMatch[1];
        db.deleteKtSession(sessionId);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/kt/process' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.project_id) {
          return sendJson(res, 400, { error: 'project_id is required' });
        }

        const projectGraph = db.getProjectGraph(body.project_id);
        const result = await kt.processKtSession({
          projectId: body.project_id,
          title: body.title,
          audioData: body.audioData,
          audioMime: body.audioMime,
          transcriptText: body.transcriptText,
          sourceType: body.sourceType || 'audio_upload',
          customKey: body.apiKey,
          projectInfo: projectGraph ? projectGraph.project : { name: 'Active Project', description: '' }
        });

        if (body.autoApply && result.session.extracted_graph) {
          const g = result.session.extracted_graph;
          for (const node of g.nodes || []) {
            db.upsertNode({ ...node, project_id: body.project_id });
          }
          for (const edge of g.edges || []) {
            db.upsertEdge({ ...edge, project_id: body.project_id });
          }
          const updatedGraph = db.getProjectGraph(body.project_id);
          return sendJson(res, 200, { ...result, graph: updatedGraph });
        }

        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'Not Found' });
    }

    // ---------------------------------------------------------
    // STATIC FILE SERVING
    // ---------------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileStream = fs.createReadStream(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      return fileStream.pipe(res);
    }

    // Fallback to index.html for SPA routing
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexPath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Knowledge Builder Graph server running at http://localhost:${PORT}`);
});
