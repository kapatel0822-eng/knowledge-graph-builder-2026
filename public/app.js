// app.js - Knowledge Builder Graph Client Application
(function () {
  'use strict';

  // --- STATE ---
  let cy = null;
  let currentProjectId = 'proj_cloudcommerce';
  let graphData = { project: {}, nodes: [], edges: [], flows: [] };
  let activeLayer = 'all';
  let activeTypeFilters = new Set([
    'domain', 'user_flow', 'business_rule', 'actor',
    'service', 'database', 'queue', 'external'
  ]);
  let searchTerm = '';
  let activeFlow = null;
  let currentFlowStepIdx = 0;
  let flowPlayInterval = null;
  let selectedElement = null;
  let chatHistory = [];
  let extractedCache = null;

  // --- NODE STYLING PALETTE ---
  const TYPE_COLORS = {
    domain: '#8b5cf6',       // Purple
    user_flow: '#0ea5e9',    // Sky Blue
    business_rule: '#f59e0b',// Amber
    actor: '#10b981',        // Emerald
    service: '#06b6d4',      // Cyan
    database: '#f43f5e',     // Rose
    queue: '#f97316',        // Orange
    external: '#6366f1'      // Indigo
  };

  const TYPE_SHAPES = {
    domain: 'round-rectangle',
    user_flow: 'round-tag',
    business_rule: 'diamond',
    actor: 'ellipse',
    service: 'round-rectangle',
    database: 'barrel',
    queue: 'round-rectangle',
    external: 'hexagon'
  };

  const EDGE_COLORS = {
    calls: '#06b6d4',
    publishes_to: '#f97316',
    consumes_from: '#f97316',
    writes_to: '#f43f5e',
    reads_from: '#f43f5e',
    implements: '#8b5cf6',
    participates_in: '#10b981',
    enforces_rule: '#f59e0b',
    complies_with: '#f59e0b',
    initiates: '#0ea5e9',
    depends_on: '#6b7280'
  };

  // --- DOM ELEMENTS ---
  const projectSelect = document.getElementById('projectSelect');
  const btnNewProject = document.getElementById('btnNewProject');
  const layerFilterGroup = document.getElementById('layerFilterGroup');
  const layoutSelect = document.getElementById('layoutSelect');
  const searchInput = document.getElementById('searchInput');
  const typeFiltersContainer = document.getElementById('typeFilters');
  const flowListContainer = document.getElementById('flowListContainer');
  const statNodes = document.getElementById('statNodes');
  const statEdges = document.getElementById('statEdges');
  const statTech = document.getElementById('statTech');
  const statFunc = document.getElementById('statFunc');
  const activeCount = document.getElementById('activeCount');

  // Canvas floating controls
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnFit = document.getElementById('btnFit');
  const btnResetLayout = document.getElementById('btnResetLayout');
  const btnExportPng = document.getElementById('btnExportPng');

  // Flow player
  const flowPlayerBar = document.getElementById('flowPlayerBar');
  const flowStepNumber = document.getElementById('flowStepNumber');
  const flowStepTitle = document.getElementById('flowStepTitle');
  const flowStepDesc = document.getElementById('flowStepDesc');
  const btnFlowPrev = document.getElementById('btnFlowPrev');
  const btnFlowPlay = document.getElementById('btnFlowPlay');
  const btnFlowNext = document.getElementById('btnFlowNext');
  const btnExitFlow = document.getElementById('btnExitFlow');

  // Drawer & Tabs
  const rightDrawer = document.getElementById('rightDrawer');
  const btnToggleDrawer = document.getElementById('btnToggleDrawer');
  const drawerTabs = document.querySelectorAll('.drawer-tab');
  const tabInspector = document.getElementById('tabInspector');
  const tabCopilot = document.getElementById('tabCopilot');

  // Inspector
  const inspectorEmptyState = document.getElementById('inspectorEmptyState');
  const inspectorDetails = document.getElementById('inspectorDetails');
  const inspectorBadge = document.getElementById('inspectorBadge');
  const inspectorTitle = document.getElementById('inspectorTitle');
  const inspectorSummary = document.getElementById('inspectorSummary');
  const inspectorTeam = document.getElementById('inspectorTeam');
  const inspectorStatus = document.getElementById('inspectorStatus');
  const inspectorMetadata = document.getElementById('inspectorMetadata');
  const inspectorConnections = document.getElementById('inspectorConnections');
  const btnEditCurrentNode = document.getElementById('btnEditCurrentNode');
  const btnDeleteCurrentNode = document.getElementById('btnDeleteCurrentNode');
  const btnAskAiAboutNode = document.getElementById('btnAskAiAboutNode');

  // AI Chat
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const btnSendChat = document.getElementById('btnSendChat');
  const presetChips = document.querySelectorAll('.preset-chip');

  // Modals
  const btnOpenAiExtract = document.getElementById('btnOpenAiExtract');
  const modalAiExtract = document.getElementById('modalAiExtract');
  const aiExtractInput = document.getElementById('aiExtractInput');
  const btnRunAiExtract = document.getElementById('btnRunAiExtract');
  const aiExtractPreview = document.getElementById('aiExtractPreview');
  const aiExtractResults = document.getElementById('aiExtractResults');
  const btnApplyAiExtract = document.getElementById('btnApplyAiExtract');

  const btnAddNode = document.getElementById('btnAddNode');
  const modalNode = document.getElementById('modalNode');
  const modalNodeTitle = document.getElementById('modalNodeTitle');
  const nodeFormId = document.getElementById('nodeFormId');
  const nodeFormLayer = document.getElementById('nodeFormLayer');
  const nodeFormType = document.getElementById('nodeFormType');
  const nodeFormName = document.getElementById('nodeFormName');
  const nodeFormSummary = document.getElementById('nodeFormSummary');
  const nodeFormTeam = document.getElementById('nodeFormTeam');
  const nodeFormStatus = document.getElementById('nodeFormStatus');
  const nodeFormDetails = document.getElementById('nodeFormDetails');
  const btnSaveNode = document.getElementById('btnSaveNode');

  const btnAddEdge = document.getElementById('btnAddEdge');
  const modalEdge = document.getElementById('modalEdge');
  const edgeFormSource = document.getElementById('edgeFormSource');
  const edgeFormTarget = document.getElementById('edgeFormTarget');
  const edgeFormType = document.getElementById('edgeFormType');
  const edgeFormLabel = document.getElementById('edgeFormLabel');
  const edgeFormSummary = document.getElementById('edgeFormSummary');
  const btnSaveEdge = document.getElementById('btnSaveEdge');

  const modalNewProject = document.getElementById('modalNewProject');
  const newProjectName = document.getElementById('newProjectName');
  const newProjectDesc = document.getElementById('newProjectDesc');
  const btnSubmitNewProject = document.getElementById('btnSubmitNewProject');

  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const modalSettings = document.getElementById('modalSettings');
  const settingsGeminiKey = document.getElementById('settingsGeminiKey');
  const settingsAiStatus = document.getElementById('settingsAiStatus');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSampleData = document.getElementById('btnResetSampleData');
  const toastContainer = document.getElementById('toastContainer');

  // --- JIRA CONNECTOR ELEMENTS & STATE ---
  let jiraFetchedIssues = [];
  let jiraSelectedKeys = new Set();
  let jiraExtractedCache = null;
  let jiraConfig = { hasCredentials: false, host: '', email: '' };

  const btnOpenJiraModal = document.getElementById('btnOpenJiraModal');
  const modalJira = document.getElementById('modalJira');
  const navJiraPill = document.getElementById('navJiraPill');
  const jiraActiveHostDisplay = document.getElementById('jiraActiveHostDisplay');
  const jiraHostInput = document.getElementById('jiraHostInput');
  const jiraEmailInput = document.getElementById('jiraEmailInput');
  const jiraTokenInput = document.getElementById('jiraTokenInput');
  const btnTestJiraConnection = document.getElementById('btnTestJiraConnection');
  const btnSaveJiraCredentials = document.getElementById('btnSaveJiraCredentials');
  const jiraTestResultBox = document.getElementById('jiraTestResultBox');
  const jiraJqlInput = document.getElementById('jiraJqlInput');
  const btnSearchJira = document.getElementById('btnSearchJira');
  const btnLoadDemoJira = document.getElementById('btnLoadDemoJira');
  const jiraMaxResults = document.getElementById('jiraMaxResults');
  const jiraIssueListContainer = document.getElementById('jiraIssueListContainer');
  const jiraIssueCount = document.getElementById('jiraIssueCount');
  const jiraSelectAll = document.getElementById('jiraSelectAll');
  const btnExtractJiraGraph = document.getElementById('btnExtractJiraGraph');
  const btnApplyJiraExtract = document.getElementById('btnApplyJiraExtract');
  const jiraExtractPreviewBox = document.getElementById('jiraExtractPreviewBox');
  const statJiraDomains = document.getElementById('statJiraDomains');
  const statJiraFlows = document.getElementById('statJiraFlows');
  const statJiraRules = document.getElementById('statJiraRules');
  const statJiraTech = document.getElementById('statJiraTech');

  // Inspector Jira elements
  const inspectorJiraCard = document.getElementById('inspectorJiraCard');
  const inspectorJiraLink = document.getElementById('inspectorJiraLink');
  const inspectorJiraKeySummary = document.getElementById('inspectorJiraKeySummary');
  const inspectorJiraType = document.getElementById('inspectorJiraType');
  const inspectorJiraStatus = document.getElementById('inspectorJiraStatus');
  const inspectorJiraPriority = document.getElementById('inspectorJiraPriority');
  const inspectorJiraAcSection = document.getElementById('inspectorJiraAcSection');
  const inspectorJiraAcList = document.getElementById('inspectorJiraAcList');

  // --- KT STUDIO (STT & TTS) ELEMENTS & STATE ---
  let ktCurrentSession = null;
  let ktAudioBase64 = null;
  let ktAudioMime = null;
  let ktLiveMediaRecorder = null;
  let ktLiveAudioChunks = [];
  let ktLiveSpeechRecognition = null;
  let ktLiveTimerInterval = null;
  let ktLiveSeconds = 0;
  let ktTtsUtterance = null;
  let ktIsTtsSpeaking = false;
  let ktIsTtsPaused = false;
  let ktTtsNarrationText = '';

  const btnOpenKtModal = document.getElementById('btnOpenKtModal');
  const modalKtStudio = document.getElementById('modalKtStudio');
  const ktSessionTitleInput = document.getElementById('ktSessionTitleInput');
  const ktFileInput = document.getElementById('ktFileInput');
  const ktDropZone = document.getElementById('ktDropZone');
  const btnBrowseKtFile = document.getElementById('btnBrowseKtFile');
  const ktFileSelectedInfo = document.getElementById('ktFileSelectedInfo');
  const ktFileName = document.getElementById('ktFileName');
  const ktFileSize = document.getElementById('ktFileSize');
  const ktFileBadge = document.getElementById('ktFileBadge');
  const btnClearKtFile = document.getElementById('btnClearKtFile');
  const btnStartKtRec = document.getElementById('btnStartKtRec');
  const btnStopKtRec = document.getElementById('btnStopKtRec');
  const ktRecDot = document.getElementById('ktRecDot');
  const ktRecStatusText = document.getElementById('ktRecStatusText');
  const ktRecTimer = document.getElementById('ktRecTimer');
  const ktWaveformBars = document.getElementById('ktWaveformBars');
  const ktLiveTranscriptPreview = document.getElementById('ktLiveTranscriptPreview');
  const ktTranscriptTextInput = document.getElementById('ktTranscriptTextInput');
  const btnLoadSampleKt = document.getElementById('btnLoadSampleKt');
  const btnProcessKt = document.getElementById('btnProcessKt');

  // TTS Player elements
  const btnTtsPlayPause = document.getElementById('btnTtsPlayPause');
  const btnTtsStop = document.getElementById('btnTtsStop');
  const ttsPlayIcon = document.getElementById('ttsPlayIcon');
  const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
  const ttsRateSelect = document.getElementById('ttsRateSelect');
  const ttsStatusText = document.getElementById('ttsStatusText');

  // Document & Graph preview elements
  const ktDocTitleDisplay = document.getElementById('ktDocTitleDisplay');
  const ktDocPreviewContainer = document.getElementById('ktDocPreviewContainer');
  const ktTranscriptPreviewContainer = document.getElementById('ktTranscriptPreviewContainer');
  const btnToggleKtView = document.getElementById('btnToggleKtView');
  const btnCopyKtDoc = document.getElementById('btnCopyKtDoc');
  const btnDownloadKtDoc = document.getElementById('btnDownloadKtDoc');
  const statKtDomains = document.getElementById('statKtDomains');
  const statKtFlows = document.getElementById('statKtFlows');
  const statKtRules = document.getElementById('statKtRules');
  const statKtTech = document.getElementById('statKtTech');
  const ktGraphPreviewBox = document.getElementById('ktGraphPreviewBox');
  const btnApplyKtGraph = document.getElementById('btnApplyKtGraph');
  const ktSessionListContainer = document.getElementById('ktSessionListContainer');

  // --- INITIALIZATION ---
  async function init() {
    initCytoscape();
    setupEventListeners();
    await loadProjectsList();
    await loadProjectGraph(currentProjectId);
    await checkSettings();
    await checkJiraConfig();
    initTtsVoices();
    await loadKtArchiveList();
  }

  // --- CYTOSCAPE GRAPH INITIALIZATION ---
  function initCytoscape() {
    cy = cytoscape({
      container: document.getElementById('cy'),
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        // NODE CORE
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#f9fafb',
            'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'font-size': '11px',
            'font-weight': '600',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-color': '#0b0f19',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px 6px',
            'text-background-shape': 'roundrectangle',
            'background-color': 'data(color)',
            'shape': 'data(shape)',
            'width': 44,
            'height': 44,
            'border-width': 2,
            'border-color': '#1f2937',
            'border-opacity': 0.9,
            'transition-property': 'background-color, line-color, target-arrow-color, opacity, border-width, border-color',
            'transition-duration': '0.2s'
          }
        },
        // SELECTED NODE
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'shadow-blur': 25,
            'shadow-color': '#6366f1',
            'shadow-opacity': 0.8
          }
        },
        // EDGE CORE
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.1,
            'label': 'data(label)',
            'font-size': '9px',
            'font-weight': '500',
            'color': '#9ca3af',
            'text-rotation': 'autorotate',
            'text-background-color': '#0b0f19',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px 5px',
            'text-background-shape': 'roundrectangle',
            'opacity': 0.85,
            'transition-property': 'width, opacity, line-color, target-arrow-color',
            'transition-duration': '0.2s'
          }
        },
        // EDGE DASH PATTERNS
        {
          selector: 'edge[type = "publishes_to"], edge[type = "consumes_from"]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3]
          }
        },
        {
          selector: 'edge[type = "implements"], edge[type = "participates_in"]',
          style: {
            'line-style': 'dotted',
            'line-dash-pattern': [3, 3]
          }
        },
        // HIGHLIGHTED IN FLOW TRACE
        {
          selector: '.highlighted-node',
          style: {
            'border-width': 5,
            'border-color': '#38bdf8',
            'shadow-blur': 30,
            'shadow-color': '#38bdf8',
            'shadow-opacity': 1,
            'z-index': 100
          }
        },
        {
          selector: '.highlighted-edge',
          style: {
            'width': 4.5,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'color': '#ffffff',
            'font-weight': '700',
            'opacity': 1,
            'z-index': 99
          }
        },
        // FADED
        {
          selector: '.faded',
          style: {
            'opacity': 0.12
          }
        }
      ]
    });

    // Node selection
    cy.on('tap', 'node', function (evt) {
      const node = evt.target;
      inspectNode(node.data('raw'));
    });

    // Edge selection
    cy.on('tap', 'edge', function (evt) {
      const edge = evt.target;
      inspectEdge(edge.data('raw'));
    });

    // Canvas background click clears selection
    cy.on('tap', function (evt) {
      if (evt.target === cy) {
        clearInspector();
      }
    });
  }

  // --- LOAD GRAPH DATA ---
  async function loadProjectGraph(projId) {
    try {
      showToast('Loading knowledge graph...', 'info');
      const res = await fetch('/api/projects/' + projId);
      if (!res.ok) throw new Error('Failed to fetch project graph');
      graphData = await res.json();
      currentProjectId = graphData.project.id;

      renderGraphElements();
      updateMetrics();
      renderFlowsList();
      populateDropdowns();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  // --- RENDER CYTOSCAPE ELEMENTS ---
  function renderGraphElements() {
    if (!cy) return;

    cy.elements().remove();
    const elements = [];

    // Filter nodes by layer and active type filters
    const visibleNodes = graphData.nodes.filter(n => {
      // Layer filter
      if (activeLayer === 'functional' && n.layer !== 'functional') return false;
      if (activeLayer === 'technical' && n.layer !== 'technical') return false;
      // Type filter
      if (!activeTypeFilters.has(n.type)) return false;
      return true;
    });

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // Add nodes
    visibleNodes.forEach(n => {
      elements.push({
        group: 'nodes',
        data: {
          id: n.id,
          label: n.name,
          layer: n.layer,
          type: n.type,
          color: TYPE_COLORS[n.type] || '#6366f1',
          shape: TYPE_SHAPES[n.type] || 'ellipse',
          raw: n
        }
      });
    });

    // Add edges where both source and target are visible
    graphData.edges.forEach(e => {
      if (visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)) {
        elements.push({
          group: 'edges',
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label || e.type,
            type: e.type,
            color: EDGE_COLORS[e.type] || '#4f46e5',
            raw: e
          }
        });
      }
    });

    cy.add(elements);
    runLayout();
    applySearchFilter();
  }

  // --- RUN LAYOUT ---
  function runLayout() {
    if (!cy) return;
    const layoutName = layoutSelect.value;
    let layoutConfig = { name: layoutName, animate: true, animationDuration: 400 };

    if (layoutName === 'dagre') {
      layoutConfig = {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 60,
        rankSep: 110,
        animate: true,
        animationDuration: 450,
        padding: 40
      };
    } else if (layoutName === 'cose') {
      layoutConfig = {
        name: 'cose',
        idealEdgeLength: 120,
        nodeOverlap: 25,
        refresh: 20,
        fit: true,
        padding: 40,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
        animate: true
      };
    }

    const layout = cy.layout(layoutConfig);
    layout.run();
  }

  // --- FLOW SIMULATOR & TRACER ---
  function startFlowTrace(flowId) {
    const flow = graphData.flows.find(f => f.id === flowId);
    if (!flow || !flow.steps || flow.steps.length === 0) {
      showToast('This flow has no execution steps.', 'warning');
      return;
    }

    activeFlow = flow;
    currentFlowStepIdx = 0;
    activeLayer = 'flow';

    // Update pill UI
    document.querySelectorAll('#layerFilterGroup .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === 'flow');
    });

    // Make sure all nodes are visible for the trace
    activeTypeFilters = new Set([
      'domain', 'user_flow', 'business_rule', 'actor',
      'service', 'database', 'queue', 'external'
    ]);
    renderGraphElements();

    flowPlayerBar.classList.remove('hidden');
    highlightCurrentFlowStep();
  }

  function highlightCurrentFlowStep() {
    if (!activeFlow || !cy) return;

    const step = activeFlow.steps[currentFlowStepIdx];
    const totalSteps = activeFlow.steps.length;

    // Update UI
    flowStepNumber.textContent = 'Step ' + (currentFlowStepIdx + 1) + ' of ' + totalSteps + ' - Order: ' + step.order;
    flowStepTitle.textContent = step.title;
    flowStepDesc.textContent = step.description;

    // Dim everything first
    cy.elements().addClass('faded').removeClass('highlighted-node').removeClass('highlighted-edge');

    // Highlight source and target nodes
    const srcNode = cy.getElementById(step.source);
    const tgtNode = cy.getElementById(step.target);

    if (srcNode.length) {
      srcNode.removeClass('faded').addClass('highlighted-node');
    }
    if (tgtNode.length) {
      tgtNode.removeClass('faded').addClass('highlighted-node');
    }

    // Highlight matching edge(s)
    const matchingEdge = cy.edges().filter(e => e.data('source') === step.source && e.data('target') === step.target);
    if (matchingEdge.length) {
      matchingEdge.removeClass('faded').addClass('highlighted-edge');
    }

    // Pan & zoom smoothly to focus on active step
    const stepElements = srcNode.union(tgtNode).union(matchingEdge);
    if (stepElements.length > 0) {
      cy.animate({
        fit: {
          eles: stepElements,
          padding: 120
        },
        duration: 350
      });
    }
  }

  function nextFlowStep() {
    if (!activeFlow) return;
    if (currentFlowStepIdx < activeFlow.steps.length - 1) {
      currentFlowStepIdx++;
      highlightCurrentFlowStep();
    } else {
      stopFlowAutoPlay();
      showToast('Completed flow trace!', 'info');
    }
  }

  function prevFlowStep() {
    if (!activeFlow) return;
    if (currentFlowStepIdx > 0) {
      currentFlowStepIdx--;
      highlightCurrentFlowStep();
    }
  }

  function toggleFlowAutoPlay() {
    if (flowPlayInterval) {
      stopFlowAutoPlay();
    } else {
      btnFlowPlay.textContent = '⏸ Pause';
      btnFlowPlay.classList.remove('btn-primary');
      btnFlowPlay.classList.add('btn-ai');
      flowPlayInterval = setInterval(() => {
        if (currentFlowStepIdx < activeFlow.steps.length - 1) {
          nextFlowStep();
        } else {
          stopFlowAutoPlay();
        }
      }, 2400);
    }
  }

  function stopFlowAutoPlay() {
    if (flowPlayInterval) {
      clearInterval(flowPlayInterval);
      flowPlayInterval = null;
    }
    btnFlowPlay.textContent = '▶ Play';
    btnFlowPlay.classList.add('btn-primary');
    btnFlowPlay.classList.remove('btn-ai');
  }

  function exitFlowTrace() {
    stopFlowAutoPlay();
    activeFlow = null;
    flowPlayerBar.classList.add('hidden');
    cy.elements().removeClass('faded').removeClass('highlighted-node').removeClass('highlighted-edge');

    activeLayer = 'all';
    document.querySelectorAll('#layerFilterGroup .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === 'all');
    });
    cy.fit(null, 50);
  }

  // --- INSPECTOR LOGIC ---
  function inspectNode(node) {
    selectedElement = { type: 'node', data: node };
    openDrawerTab('inspector');

    inspectorEmptyState.style.display = 'none';
    inspectorDetails.style.display = 'flex';

    inspectorBadge.textContent = node.layer + ' • ' + node.type;
    inspectorBadge.className = 'badge badge-' + node.layer;
    inspectorTitle.textContent = node.name;
    inspectorSummary.textContent = node.summary || 'No summary provided.';
    inspectorTeam.textContent = node.team || 'Unassigned';
    inspectorStatus.textContent = node.status || 'Active';

    // Jira Issue Details
    if (node.details && node.details.jira) {
      const j = node.details.jira;
      inspectorJiraCard.style.display = 'block';
      inspectorJiraKeySummary.textContent = `${j.key}: ${j.summary || node.name}`;
      inspectorJiraLink.href = j.url || '#';
      inspectorJiraType.textContent = j.issueType || node.type;
      inspectorJiraStatus.textContent = j.status || node.status;
      inspectorJiraPriority.textContent = j.priority || 'Medium';

      const criteria = node.details.acceptanceCriteria || j.acceptanceCriteria || [];
      if (Array.isArray(criteria) && criteria.length > 0) {
        inspectorJiraAcSection.style.display = 'block';
        inspectorJiraAcList.innerHTML = criteria.map(c => `<li>${c}</li>`).join('');
      } else {
        inspectorJiraAcSection.style.display = 'none';
      }
    } else {
      inspectorJiraCard.style.display = 'none';
    }

    // Technical specs
    if (node.details && Object.keys(node.details).length > 0) {
      inspectorMetadata.textContent = JSON.stringify(node.details, null, 2);
      document.getElementById('inspectorTechSpecsGroup').style.display = 'flex';
    } else {
      document.getElementById('inspectorTechSpecsGroup').style.display = 'none';
    }

    // Upstream & Downstream connections
    renderNodeConnections(node.id);
  }

  function renderNodeConnections(nodeId) {
    inspectorConnections.innerHTML = '';

    const inbound = graphData.edges.filter(e => e.target === nodeId);
    const outbound = graphData.edges.filter(e => e.source === nodeId);

    if (inbound.length === 0 && outbound.length === 0) {
      inspectorConnections.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">No direct relationships connected.</span>';
      return;
    }

    inbound.forEach(e => {
      const srcNode = graphData.nodes.find(n => n.id === e.source);
      const item = document.createElement('div');
      item.className = 'connection-item';
      item.innerHTML = '<span><strong style="color:#60a5fa;">◀ From:</strong> ' + (srcNode ? srcNode.name : e.source) + '</span><span class="badge" style="background:#1f2937; border:1px solid #374151;">' + e.type + '</span>';
      item.onclick = () => {
        if (srcNode) {
          const cyNode = cy.getElementById(srcNode.id);
          cy.fit(cyNode, 100);
          inspectNode(srcNode);
        }
      };
      inspectorConnections.appendChild(item);
    });

    outbound.forEach(e => {
      const tgtNode = graphData.nodes.find(n => n.id === e.target);
      const item = document.createElement('div');
      item.className = 'connection-item';
      item.innerHTML = '<span><strong style="color:#34d399;">▶ To:</strong> ' + (tgtNode ? tgtNode.name : e.target) + '</span><span class="badge" style="background:#1f2937; border:1px solid #374151;">' + e.type + '</span>';
      item.onclick = () => {
        if (tgtNode) {
          const cyNode = cy.getElementById(tgtNode.id);
          cy.fit(cyNode, 100);
          inspectNode(tgtNode);
        }
      };
      inspectorConnections.appendChild(item);
    });
  }

  function inspectEdge(edge) {
    selectedElement = { type: 'edge', data: edge };
    openDrawerTab('inspector');

    inspectorEmptyState.style.display = 'none';
    inspectorDetails.style.display = 'flex';

    const src = graphData.nodes.find(n => n.id === edge.source)?.name || edge.source;
    const tgt = graphData.nodes.find(n => n.id === edge.target)?.name || edge.target;

    inspectorBadge.textContent = 'Edge • ' + edge.type;
    inspectorBadge.className = 'badge badge-technical';
    inspectorTitle.textContent = src + ' ➔ ' + tgt;
    inspectorSummary.textContent = edge.summary || ('Relationship of type "' + edge.type + '"');
    inspectorTeam.textContent = 'Label: ' + (edge.label || 'None');
    inspectorStatus.textContent = 'Active Connection';

    document.getElementById('inspectorTechSpecsGroup').style.display = 'none';
    inspectorConnections.innerHTML = '';
  }

  function clearInspector() {
    selectedElement = null;
    inspectorEmptyState.style.display = 'block';
    inspectorDetails.style.display = 'none';
    if (inspectorJiraCard) inspectorJiraCard.style.display = 'none';
  }

  // --- AI ARCHITECTURE COPILOT ---
  async function sendChatMessage(promptText) {
    const text = promptText || chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';

    // Append user message
    appendChatMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    // Show typing bubble
    const typingBubble = appendChatMessage('ai', '<span style="color:#9ca3af; font-style:italic;">Analyzing graph topology & generating architectural response...</span>');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          project_id: currentProjectId,
          history: chatHistory
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'AI Chat failed');
      }

      const data = await res.json();
      const htmlReply = marked.parse(data.reply);
      typingBubble.innerHTML = htmlReply;
      chatHistory.push({ role: 'model', content: data.reply });
    } catch (err) {
      console.error(err);
      typingBubble.innerHTML = '<span style="color:#f87171;">Error: ' + err.message + '</span>';
    }
  }

  function appendChatMessage(role, contentHtml) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + role;
    bubble.innerHTML = contentHtml;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  }

  // --- AI GRAPH EXTRACTOR ---
  async function runAiExtract() {
    const text = aiExtractInput.value.trim();
    if (!text) {
      showToast('Please paste architecture or requirements text.', 'warning');
      return;
    }

    btnRunAiExtract.textContent = 'Extracting Graph with Gemini...';
    btnRunAiExtract.disabled = true;

    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          project_id: currentProjectId,
          autoApply: false
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'AI Extraction failed');
      }

      const data = await res.json();
      extractedCache = data.extracted;

      aiExtractPreview.style.display = 'flex';
      btnApplyAiExtract.style.display = 'inline-flex';

      const nodesSummary = (extractedCache.nodes || []).map(n => '• [' + n.layer.toUpperCase() + '] ' + n.name + ' (' + n.type + ')').join('\n');
      const edgesSummary = (extractedCache.edges || []).map(e => '• ' + e.source + ' --[' + e.type + ']--> ' + e.target).join('\n');

      aiExtractResults.textContent = 'SUMMARY:\n' + (extractedCache.summary || 'Extracted elements:') + '\n\nNODES (' + (extractedCache.nodes || []).length + '):\n' + nodesSummary + '\n\nRELATIONSHIPS (' + (extractedCache.edges || []).length + '):\n' + edgesSummary;

      showToast('Extracted ' + (extractedCache.nodes || []).length + ' nodes and ' + (extractedCache.edges || []).length + ' relationships!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnRunAiExtract.textContent = 'Run AI Extraction';
      btnRunAiExtract.disabled = false;
    }
  }

  async function applyExtractedGraph() {
    if (!extractedCache) return;

    try {
      showToast('Merging extracted nodes and relationships into graph...', 'info');

      for (const node of extractedCache.nodes || []) {
        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...node, project_id: currentProjectId })
        });
      }

      for (const edge of extractedCache.edges || []) {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...edge, project_id: currentProjectId })
        });
      }

      await loadProjectGraph(currentProjectId);
      closeModal('modalAiExtract');
      showToast('Successfully updated Knowledge Graph!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  // --- JIRA CONNECTOR LOGIC ---
  async function checkJiraConfig() {
    try {
      const res = await fetch('/api/jira/config');
      if (!res.ok) return;
      jiraConfig = await res.json();
      if (jiraConfig.hasCredentials) {
        navJiraPill.textContent = 'Connected';
        navJiraPill.style.background = '#10b981';
        navJiraPill.style.color = '#fff';
        jiraActiveHostDisplay.textContent = jiraConfig.host;
      } else {
        navJiraPill.textContent = 'Configure';
        navJiraPill.style.background = 'rgba(255,255,255,0.15)';
        jiraActiveHostDisplay.textContent = 'Not connected';
      }
      if (jiraConfig.host) jiraHostInput.value = jiraConfig.host;
      if (jiraConfig.email) jiraEmailInput.value = jiraConfig.email;
    } catch (err) {
      console.warn('Failed to load Jira config:', err);
    }
  }

  async function testJiraConnection() {
    const host = jiraHostInput.value.trim();
    const email = jiraEmailInput.value.trim();
    const apiToken = jiraTokenInput.value.trim();

    if (!host) {
      showToast('Jira Host URL is required.', 'warning');
      return;
    }

    btnTestJiraConnection.textContent = 'Testing...';
    btnTestJiraConnection.disabled = true;

    try {
      const res = await fetch('/api/jira/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, email, apiToken })
      });
      const data = await res.json();
      jiraTestResultBox.style.display = 'block';

      if (data.ok) {
        jiraTestResultBox.style.background = 'rgba(16, 185, 129, 0.15)';
        jiraTestResultBox.style.border = '1px solid #10b981';
        jiraTestResultBox.style.color = '#a7f3d0';
        jiraTestResultBox.innerHTML = `<strong>Connected Successfully!</strong> Authenticated as <strong>${data.user.displayName}</strong> (${data.user.emailAddress}) on <code>${data.host}</code>.`;
        showToast('Jira connection verified!', 'success');
        await checkJiraConfig();
      } else {
        jiraTestResultBox.style.background = 'rgba(239, 68, 68, 0.15)';
        jiraTestResultBox.style.border = '1px solid #ef4444';
        jiraTestResultBox.style.color = '#fca5a5';
        jiraTestResultBox.innerHTML = `<strong>Connection Failed:</strong> ${data.error}`;
        showToast('Connection failed: ' + data.error, 'error');
      }
    } catch (err) {
      jiraTestResultBox.style.display = 'block';
      jiraTestResultBox.style.background = 'rgba(239, 68, 68, 0.15)';
      jiraTestResultBox.style.color = '#fca5a5';
      jiraTestResultBox.textContent = err.message;
      showToast(err.message, 'error');
    } finally {
      btnTestJiraConnection.textContent = 'Test Connection';
      btnTestJiraConnection.disabled = false;
    }
  }

  async function saveJiraCredentials() {
    const host = jiraHostInput.value.trim();
    const email = jiraEmailInput.value.trim();
    const apiToken = jiraTokenInput.value.trim();

    try {
      const res = await fetch('/api/jira/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, email, apiToken })
      });
      if (!res.ok) throw new Error('Failed to save Jira configuration');
      await checkJiraConfig();
      showToast('Jira credentials saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function searchJiraIssues(isDemo = false) {
    const jql = jiraJqlInput.value.trim();
    const maxResults = jiraMaxResults.value;

    btnSearchJira.textContent = 'Searching Jira...';
    btnSearchJira.disabled = true;

    try {
      let res;
      if (isDemo) {
        res = await fetch('/api/jira/demo-issues');
      } else {
        res = await fetch('/api/jira/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jql, maxResults, demo: false })
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to search Jira');
      }

      const data = await res.json();
      jiraFetchedIssues = data.issues || [];
      jiraSelectedKeys = new Set(jiraFetchedIssues.map(i => i.key));

      renderJiraIssuesList();
      showToast(`Retrieved ${jiraFetchedIssues.length} Jira tickets!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnSearchJira.textContent = 'Search Live Jira';
      btnSearchJira.disabled = false;
    }
  }

  function renderJiraIssuesList() {
    jiraIssueListContainer.innerHTML = '';
    jiraIssueCount.textContent = `${jiraSelectedKeys.size} of ${jiraFetchedIssues.length} selected`;

    if (jiraFetchedIssues.length === 0) {
      jiraIssueListContainer.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--text-muted);">No issues matched the query. Try a broader JQL or check project permissions.</div>';
      return;
    }

    jiraFetchedIssues.forEach(issue => {
      const isSelected = jiraSelectedKeys.has(issue.key);
      const isEpic = issue.issueType.toLowerCase() === 'epic';
      const badgeClass = isEpic ? 'jira-badge-epic' : issue.issueType.toLowerCase() === 'story' ? 'jira-badge-story' : 'jira-badge-task';

      const card = document.createElement('div');
      card.className = `jira-issue-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <input type="checkbox" class="jira-issue-cb" data-key="${issue.key}" ${isSelected ? 'checked' : ''} style="margin-top: 3px; cursor: pointer;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="jira-badge ${badgeClass}">${issue.issueType}</span>
              <a href="${issue.url}" target="_blank" rel="noopener noreferrer" style="font-weight: 700; color: #60a5fa; font-size: 0.8rem; text-decoration: none;">
                ${issue.key} ↗
              </a>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${(issue.acceptanceCriteria || []).length > 0 ? `<span class="badge" style="background:#065f46; color:#a7f3d0; font-size:0.65rem;">${issue.acceptanceCriteria.length} Criteria</span>` : ''}
              <span class="badge" style="background:#1f2937; color:#9ca3af; font-size:0.65rem;">${issue.status}</span>
            </div>
          </div>
          <div style="font-size: 0.82rem; font-weight: 600; color: #fff; margin-bottom: 3px;">${issue.summary}</div>
          <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.35;">
            ${issue.description ? issue.description.slice(0, 110) + '...' : 'No description provided.'}
          </div>
        </div>
      `;

      card.onclick = (e) => {
        if (e.target.tagName.toLowerCase() === 'a') return;
        const cb = card.querySelector('.jira-issue-cb');
        if (e.target !== cb) {
          cb.checked = !cb.checked;
        }
        if (cb.checked) {
          jiraSelectedKeys.add(issue.key);
          card.classList.add('selected');
        } else {
          jiraSelectedKeys.delete(issue.key);
          card.classList.remove('selected');
        }
        jiraIssueCount.textContent = `${jiraSelectedKeys.size} of ${jiraFetchedIssues.length} selected`;
        jiraSelectAll.checked = jiraSelectedKeys.size === jiraFetchedIssues.length;
      };

      jiraIssueListContainer.appendChild(card);
    });
  }

  function toggleAllJiraIssues(select) {
    if (select) {
      jiraSelectedKeys = new Set(jiraFetchedIssues.map(i => i.key));
    } else {
      jiraSelectedKeys.clear();
    }
    renderJiraIssuesList();
  }

  async function extractJiraGraph() {
    const selectedIssues = jiraFetchedIssues.filter(i => jiraSelectedKeys.has(i.key));
    if (selectedIssues.length === 0) {
      showToast('Please select at least one Jira issue to convert.', 'warning');
      return;
    }

    const useAi = document.getElementById('jiraModeAi').checked;

    btnExtractJiraGraph.textContent = useAi ? 'Synthesizing with Gemini 3.8...' : 'Mapping Structural Graph...';
    btnExtractJiraGraph.disabled = true;

    try {
      const res = await fetch('/api/jira/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          issues: selectedIssues,
          host: jiraConfig.host,
          useAi,
          autoApply: false
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to extract Jira graph');
      }

      const data = await res.json();
      jiraExtractedCache = data.extracted;

      // Switch to preview tab
      switchJiraTab('preview');

      // Update telemetry numbers
      const domains = (jiraExtractedCache.nodes || []).filter(n => n.type === 'domain').length;
      const flows = (jiraExtractedCache.nodes || []).filter(n => n.type === 'user_flow').length;
      const rules = (jiraExtractedCache.nodes || []).filter(n => n.type === 'business_rule').length;
      const tech = (jiraExtractedCache.nodes || []).filter(n => n.layer === 'technical').length;

      statJiraDomains.textContent = domains;
      statJiraFlows.textContent = flows;
      statJiraRules.textContent = rules;
      statJiraTech.textContent = tech;

      const nodesSummary = (jiraExtractedCache.nodes || []).map(n => `• [${n.layer.toUpperCase()}] ${n.name} (${n.type})`).join('\n');
      const edgesSummary = (jiraExtractedCache.edges || []).map(e => `• ${e.source} --[${e.type}]--> ${e.target}`).join('\n');

      jiraExtractPreviewBox.textContent = `SUMMARY:\n${jiraExtractedCache.summary || 'Jira Architecture Extraction:'}\n\nEXTRACTED ENTITIES (${(jiraExtractedCache.nodes || []).length}):\n${nodesSummary}\n\nRELATIONSHIPS (${(jiraExtractedCache.edges || []).length}):\n${edgesSummary}`;

      btnApplyJiraExtract.style.display = 'inline-flex';
      showToast(`Synthesized ${(jiraExtractedCache.nodes || []).length} nodes and ${(jiraExtractedCache.edges || []).length} relationships!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnExtractJiraGraph.textContent = 'Synthesize Knowledge Graph';
      btnExtractJiraGraph.disabled = false;
    }
  }

  async function applyJiraGraph() {
    if (!jiraExtractedCache) return;

    btnApplyJiraExtract.textContent = 'Importing...';
    btnApplyJiraExtract.disabled = true;

    try {
      showToast('Importing Jira functional architecture into Knowledge Graph...', 'info');

      for (const node of jiraExtractedCache.nodes || []) {
        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...node, project_id: currentProjectId })
        });
      }

      for (const edge of jiraExtractedCache.edges || []) {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...edge, project_id: currentProjectId })
        });
      }

      await loadProjectGraph(currentProjectId);
      closeModal('modalJira');
      showToast('Successfully integrated Jira Functional Architecture!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnApplyJiraExtract.textContent = 'Add to Active Knowledge Graph';
      btnApplyJiraExtract.disabled = false;
    }
  }

  function switchJiraTab(tabName) {
    document.querySelectorAll('.jira-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.jiratab === tabName);
    });
    document.getElementById('jiraTabQuery').style.display = tabName === 'query' ? 'block' : 'none';
    document.getElementById('jiraTabConnect').style.display = tabName === 'connect' ? 'block' : 'none';
    document.getElementById('jiraTabPreview').style.display = tabName === 'preview' ? 'block' : 'none';
  }

  // --- KT STUDIO (STT & TTS) CONTROLLER ---
  function initTtsVoices() {
    if (!('speechSynthesis' in window)) {
      if (ttsVoiceSelect) ttsVoiceSelect.innerHTML = '<option value="">TTS not supported</option>';
      return;
    }
    function populateVoices() {
      if (!ttsVoiceSelect) return;
      const voices = window.speechSynthesis.getVoices();
      ttsVoiceSelect.innerHTML = '';
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const list = englishVoices.length > 0 ? englishVoices : voices;
      list.forEach((v, idx) => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.default || idx === 0) opt.selected = true;
        ttsVoiceSelect.appendChild(opt);
      });
    }
    populateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  function toggleTtsPlayback() {
    if (!('speechSynthesis' in window)) {
      showToast('Speech Synthesis is not supported in this browser.', 'warning');
      return;
    }
    if (!ktTtsNarrationText) {
      showToast('No KT document available to speak yet. Load or generate a KT session first.', 'warning');
      return;
    }

    if (window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        ktIsTtsPaused = false;
        if (ttsPlayIcon) ttsPlayIcon.textContent = '⏸ Pause (TTS)';
        if (ttsStatusText) ttsStatusText.textContent = 'Speaking...';
      } else {
        window.speechSynthesis.pause();
        ktIsTtsPaused = true;
        if (ttsPlayIcon) ttsPlayIcon.textContent = '▶ Resume (TTS)';
        if (ttsStatusText) ttsStatusText.textContent = 'Paused';
      }
      return;
    }

    window.speechSynthesis.cancel();
    ktTtsUtterance = new SpeechSynthesisUtterance(ktTtsNarrationText);

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === ttsVoiceSelect.value);
    if (selectedVoice) ktTtsUtterance.voice = selectedVoice;

    ktTtsUtterance.rate = parseFloat(ttsRateSelect.value || '1.0');

    ktTtsUtterance.onstart = () => {
      ktIsTtsSpeaking = true;
      ktIsTtsPaused = false;
      if (ttsPlayIcon) ttsPlayIcon.textContent = '⏸ Pause (TTS)';
      if (ttsStatusText) ttsStatusText.textContent = '🔊 Speaking KT Walkthrough...';
    };

    ktTtsUtterance.onend = () => {
      ktIsTtsSpeaking = false;
      ktIsTtsPaused = false;
      if (ttsPlayIcon) ttsPlayIcon.textContent = '▶ Listen (TTS)';
      if (ttsStatusText) ttsStatusText.textContent = 'Finished narration';
    };

    ktTtsUtterance.onerror = (e) => {
      console.warn('TTS error:', e);
      ktIsTtsSpeaking = false;
      ktIsTtsPaused = false;
      if (ttsPlayIcon) ttsPlayIcon.textContent = '▶ Listen (TTS)';
      if (ttsStatusText) ttsStatusText.textContent = 'Voice stopped';
    };

    window.speechSynthesis.speak(ktTtsUtterance);
  }

  function stopTtsPlayback() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    ktIsTtsSpeaking = false;
    ktIsTtsPaused = false;
    if (ttsPlayIcon) ttsPlayIcon.textContent = '▶ Listen (TTS)';
    if (ttsStatusText) ttsStatusText.textContent = 'Ready for Voice Narration';
  }

  async function startLiveRecording() {
    ktLiveAudioChunks = [];
    ktLiveSeconds = 0;
    ktRecTimer.textContent = '00:00';
    ktLiveTranscriptPreview.textContent = 'Listening... Speak clearly into your microphone.';
    ktLiveTranscriptPreview.dataset.fullTranscript = '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        ktLiveSpeechRecognition = new SpeechRecognition();
        ktLiveSpeechRecognition.continuous = true;
        ktLiveSpeechRecognition.interimResults = true;
        ktLiveSpeechRecognition.lang = 'en-US';

        ktLiveSpeechRecognition.onresult = (evt) => {
          let interim = '';
          let final = '';
          for (let i = evt.resultIndex; i < evt.results.length; ++i) {
            if (evt.results[i].isFinal) {
              final += evt.results[i][0].transcript + ' ';
            } else {
              interim += evt.results[i][0].transcript;
            }
          }
          if (final) {
            ktLiveTranscriptPreview.dataset.fullTranscript = (ktLiveTranscriptPreview.dataset.fullTranscript || '') + final;
          }
          ktLiveTranscriptPreview.textContent = (ktLiveTranscriptPreview.dataset.fullTranscript || '') + interim;
        };

        ktLiveSpeechRecognition.onerror = (err) => {
          console.warn('SpeechRecognition error:', err);
        };

        ktLiveSpeechRecognition.start();
      } catch (err) {
        console.warn('SpeechRecognition error:', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ktLiveMediaRecorder = new MediaRecorder(stream);
      ktLiveMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) ktLiveAudioChunks.push(e.data);
      };
      ktLiveMediaRecorder.onstop = async () => {
        const audioBlob = new Blob(ktLiveAudioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(',')[1];
          ktAudioBase64 = base64String;
          ktAudioMime = 'audio/webm';
          showToast('Live microphone audio captured successfully!', 'success');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      ktLiveMediaRecorder.start(1000);

      btnStartKtRec.style.display = 'none';
      btnStopKtRec.style.display = 'inline-flex';
      ktRecDot.classList.add('pulsing');
      ktRecStatusText.textContent = 'Recording & Transcribing (STT)...';
      ktRecStatusText.style.color = '#ef4444';
      ktWaveformBars.querySelectorAll('.kt-wave-bar').forEach(b => b.classList.add('active'));

      ktLiveTimerInterval = setInterval(() => {
        ktLiveSeconds++;
        const mins = String(Math.floor(ktLiveSeconds / 60)).padStart(2, '0');
        const secs = String(ktLiveSeconds % 60).padStart(2, '0');
        ktRecTimer.textContent = `${mins}:${secs}`;
      }, 1000);

      showToast('Live microphone recording started!', 'info');
    } catch (err) {
      console.error('Microphone access denied:', err);
      showToast('Microphone error: ' + err.message, 'error');
    }
  }

  function stopLiveRecording() {
    if (ktLiveMediaRecorder && ktLiveMediaRecorder.state !== 'inactive') {
      ktLiveMediaRecorder.stop();
    }
    if (ktLiveSpeechRecognition) {
      ktLiveSpeechRecognition.stop();
    }
    if (ktLiveTimerInterval) {
      clearInterval(ktLiveTimerInterval);
      ktLiveTimerInterval = null;
    }

    btnStartKtRec.style.display = 'inline-flex';
    btnStopKtRec.style.display = 'none';
    ktRecDot.classList.remove('pulsing');
    ktRecStatusText.textContent = 'Recording Complete';
    ktRecStatusText.style.color = '#10b981';
    ktWaveformBars.querySelectorAll('.kt-wave-bar').forEach(b => b.classList.remove('active'));
  }

  function handleKtFile(file) {
    if (!file) return;
    const mime = file.type || 'audio/mp3';
    const reader = new FileReader();

    showToast(`Loading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`, 'info');

    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      ktAudioBase64 = base64;
      ktAudioMime = mime;

      ktFileName.textContent = file.name;
      ktFileSize.textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      ktFileBadge.textContent = file.type.startsWith('video') ? 'VIDEO' : 'AUDIO';
      ktFileSelectedInfo.style.display = 'flex';
      ktDropZone.style.display = 'none';

      if (!ktSessionTitleInput.value || ktSessionTitleInput.value.includes('Handover')) {
        ktSessionTitleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') + ' Architecture KT';
      }

      showToast('File loaded and ready for Speech-to-Text processing!', 'success');
    };

    reader.readAsDataURL(file);
  }

  function clearKtFile() {
    ktAudioBase64 = null;
    ktAudioMime = null;
    ktFileInput.value = '';
    ktFileSelectedInfo.style.display = 'none';
    ktDropZone.style.display = 'flex';
  }

  async function processKtSession() {
    const title = ktSessionTitleInput.value.trim() || 'KT Architecture Session';
    const activeModeBtn = document.querySelector('.kt-mode-btn.active');
    const mode = activeModeBtn ? activeModeBtn.dataset.ktmode : 'file';

    let transcriptText = '';
    if (mode === 'text') {
      transcriptText = ktTranscriptTextInput.value.trim();
    } else if (mode === 'mic') {
      transcriptText = (ktLiveTranscriptPreview.dataset.fullTranscript || '') + ktLiveTranscriptPreview.textContent;
    }

    if (!ktAudioBase64 && !transcriptText) {
      showToast('Please upload a video/audio file, record live microphone, or paste meeting transcript.', 'warning');
      return;
    }

    btnProcessKt.textContent = 'Transcribing & Generating Architecture...';
    btnProcessKt.disabled = true;

    try {
      const res = await fetch('/api/kt/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          title,
          audioData: ktAudioBase64,
          audioMime: ktAudioMime,
          transcriptText,
          sourceType: mode === 'mic' ? 'live_mic' : mode === 'file' ? 'video_upload' : 'transcript_text',
          autoApply: false
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to process KT session');
      }

      const data = await res.json();
      renderKtSessionDetails(data.session, data.ttsNarration);
      switchKtTab('document');
      await loadKtArchiveList();
      showToast('KT Session transcribed and architecture document generated!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnProcessKt.textContent = 'Transcribe & Synthesize Architecture';
      btnProcessKt.disabled = false;
    }
  }

  async function loadSampleKtSession() {
    btnLoadSampleKt.textContent = 'Loading Sample...';
    btnLoadSampleKt.disabled = true;

    try {
      const res = await fetch('/api/kt/sample');
      if (!res.ok) throw new Error('Failed to load sample KT');
      const data = await res.json();

      renderKtSessionDetails(data.session, data.ttsNarration);
      switchKtTab('document');
      showToast('Sample 18-minute Payment & Fulfillment KT session loaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnLoadSampleKt.textContent = '⚡ Load Sample KT Session (Demo)';
      btnLoadSampleKt.disabled = false;
    }
  }

  function renderKtSessionDetails(session, ttsNarration) {
    ktCurrentSession = session;
    ktTtsNarrationText = ttsNarration || session.document_markdown || '';

    ktDocTitleDisplay.textContent = session.title || 'Architecture Specification';

    if (typeof marked !== 'undefined' && marked.parse) {
      ktDocPreviewContainer.innerHTML = marked.parse(session.document_markdown || '# No Content');
    } else {
      ktDocPreviewContainer.textContent = session.document_markdown || 'No Content';
    }

    ktTranscriptPreviewContainer.textContent = session.transcript || 'No raw transcript recorded.';

    const g = session.extracted_graph || { nodes: [], edges: [] };
    const domains = (g.nodes || []).filter(n => n.type === 'domain').length;
    const flows = (g.nodes || []).filter(n => n.type === 'user_flow').length;
    const rules = (g.nodes || []).filter(n => n.type === 'business_rule').length;
    const tech = (g.nodes || []).filter(n => n.layer === 'technical').length;

    statKtDomains.textContent = domains;
    statKtFlows.textContent = flows;
    statKtRules.textContent = rules;
    statKtTech.textContent = tech;

    const nodesSummary = (g.nodes || []).map(n => `• [${n.layer.toUpperCase()}] ${n.name} (${n.type})`).join('\n');
    const edgesSummary = (g.edges || []).map(e => `• ${e.source} --[${e.type}]--> ${e.target}`).join('\n');
    ktGraphPreviewBox.textContent = `SUMMARY:\n${g.summary || 'Topology extracted from KT session:'}\n\nENTITIES (${(g.nodes || []).length}):\n${nodesSummary}\n\nRELATIONSHIPS (${(g.edges || []).length}):\n${edgesSummary}`;
  }

  async function applyKtGraph() {
    if (!ktCurrentSession || !ktCurrentSession.extracted_graph) {
      showToast('No extracted architecture graph available.', 'warning');
      return;
    }

    const g = ktCurrentSession.extracted_graph;
    btnApplyKtGraph.textContent = 'Importing into Graph...';
    btnApplyKtGraph.disabled = true;

    try {
      showToast('Importing KT architecture into active Knowledge Graph...', 'info');

      for (const node of g.nodes || []) {
        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...node, project_id: currentProjectId })
        });
      }

      for (const edge of g.edges || []) {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...edge, project_id: currentProjectId })
        });
      }

      await loadProjectGraph(currentProjectId);
      closeModal('modalKtStudio');
      showToast('Successfully merged KT architecture into Knowledge Graph!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      btnApplyKtGraph.textContent = 'Add Extracted Architecture to Active Knowledge Graph';
      btnApplyKtGraph.disabled = false;
    }
  }

  async function loadKtArchiveList() {
    if (!ktSessionListContainer) return;
    try {
      const res = await fetch(`/api/kt/sessions?project_id=${currentProjectId}`);
      if (!res.ok) return;
      const data = await res.json();
      const sessions = data.sessions || [];

      ktSessionListContainer.innerHTML = '';
      if (sessions.length === 0) {
        ktSessionListContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.78rem;">No KT sessions saved for this project yet.</div>';
        return;
      }

      sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'kt-session-item';
        item.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.83rem; color: #fff; margin-bottom: 3px;">${s.title}</div>
            <div style="font-size: 0.72rem; color: var(--text-secondary);">${new Date(s.created_at).toLocaleDateString()} • Duration: ${s.duration || 'N/A'} • Source: ${s.source_type}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary btn-open-kt" data-id="${s.id}">Open</button>
            <button class="btn btn-sm btn-danger btn-del-kt" data-id="${s.id}">&times;</button>
          </div>
        `;

        item.querySelector('.btn-open-kt').onclick = async (e) => {
          e.stopPropagation();
          const detailRes = await fetch(`/api/kt/sessions/${s.id}`);
          const detailData = await detailRes.json();
          renderKtSessionDetails(detailData.session, detailData.ttsNarration);
          switchKtTab('document');
          showToast(`Loaded "${s.title}"!`, 'info');
        };

        item.querySelector('.btn-del-kt').onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`Delete KT session "${s.title}"?`)) return;
          await fetch(`/api/kt/sessions/${s.id}`, { method: 'DELETE' });
          await loadKtArchiveList();
          showToast('KT Session deleted', 'info');
        };

        ktSessionListContainer.appendChild(item);
      });
    } catch (err) {
      console.warn('Failed to load KT archive:', err);
    }
  }

  function switchKtTab(tabName) {
    document.querySelectorAll('.kt-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.kttab === tabName);
    });
    document.getElementById('ktTabImport').style.display = tabName === 'import' ? 'block' : 'none';
    document.getElementById('ktTabDocument').style.display = tabName === 'document' ? 'block' : 'none';
    document.getElementById('ktTabGraph').style.display = tabName === 'graph' ? 'block' : 'none';
    document.getElementById('ktTabArchive').style.display = tabName === 'archive' ? 'block' : 'none';
  }

  function switchKtMode(mode) {
    document.querySelectorAll('.kt-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ktmode === mode);
    });
    document.getElementById('ktBoxFile').style.display = mode === 'file' ? 'block' : 'none';
    document.getElementById('ktBoxMic').style.display = mode === 'mic' ? 'block' : 'none';
    document.getElementById('ktBoxText').style.display = mode === 'text' ? 'block' : 'none';
  }

  // --- CRUD NODE & EDGE ---
  async function saveNode() {
    const name = nodeFormName.value.trim();
    if (!name) {
      showToast('Node name is required', 'warning');
      return;
    }

    let details = {};
    if (nodeFormDetails.value.trim()) {
      try {
        details = JSON.parse(nodeFormDetails.value.trim());
      } catch (err) {
        showToast('Technical Details must be valid JSON', 'error');
        return;
      }
    }

    const payload = {
      id: nodeFormId.value || undefined,
      project_id: currentProjectId,
      layer: nodeFormLayer.value,
      type: nodeFormType.value,
      name,
      summary: nodeFormSummary.value.trim(),
      team: nodeFormTeam.value.trim(),
      status: nodeFormStatus.value,
      details
    };

    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save node');
      await loadProjectGraph(currentProjectId);
      closeModal('modalNode');
      showToast('Node "' + name + '" saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteCurrentNode() {
    if (!selectedElement || selectedElement.type !== 'node') return;
    if (!confirm('Are you sure you want to delete "' + selectedElement.data.name + '" and all connected relationships?')) return;

    try {
      const res = await fetch('/api/nodes/' + selectedElement.data.id, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete node');
      clearInspector();
      await loadProjectGraph(currentProjectId);
      showToast('Node deleted', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveEdge() {
    const source = edgeFormSource.value;
    const target = edgeFormTarget.value;
    if (!source || !target) {
      showToast('Source and Target nodes are required', 'warning');
      return;
    }
    if (source === target) {
      showToast('Cannot connect a node to itself', 'warning');
      return;
    }

    const payload = {
      project_id: currentProjectId,
      source,
      target,
      type: edgeFormType.value,
      label: edgeFormLabel.value.trim(),
      summary: edgeFormSummary.value.trim()
    };

    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to connect nodes');
      await loadProjectGraph(currentProjectId);
      closeModal('modalEdge');
      showToast('Nodes connected successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- PROJECT MANAGEMENT ---
  async function loadProjectsList() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      projectSelect.innerHTML = '';
      (data.projects || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projectSelect.appendChild(opt);
      });
      if (data.projects && data.projects.length > 0) {
        projectSelect.value = currentProjectId;
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function submitNewProject() {
    const name = newProjectName.value.trim();
    if (!name) {
      showToast('Project name is required', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: newProjectDesc.value.trim()
        })
      });
      if (!res.ok) throw new Error('Failed to create project');
      const created = await res.json();
      currentProjectId = created.project.id;
      await loadProjectsList();
      projectSelect.value = currentProjectId;
      await loadProjectGraph(currentProjectId);
      closeModal('modalNewProject');
      showToast('Created project "' + name + '"!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- SETTINGS ---
  async function checkSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      settingsAiStatus.textContent = data.hasGeminiKey ? 'Active (API Key Verified)' : 'Simulation / Heuristic Mode (No Key)';
      settingsAiStatus.style.color = data.hasGeminiKey ? '#34d399' : '#f59e0b';
    } catch (err) {
      console.error(err);
    }
  }

  async function saveSettings() {
    const key = settingsGeminiKey.value.trim();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_api_key: key })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      await checkSettings();
      closeModal('modalSettings');
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function resetSampleProject() {
    if (!confirm('This will reset the CloudCommerce sample project back to its initial 21 nodes, relationships, and checkout trace flows. Continue?')) return;
    try {
      const res = await fetch('/api/projects/' + currentProjectId + '/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset project');
      await loadProjectGraph(currentProjectId);
      closeModal('modalSettings');
      showToast('Sample project reset to defaults!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- UI HELPERS ---
  function updateMetrics() {
    const totalNodes = graphData.nodes.length;
    const totalEdges = graphData.edges.length;
    const techCount = graphData.nodes.filter(n => n.layer === 'technical').length;
    const funcCount = graphData.nodes.filter(n => n.layer === 'functional').length;

    statNodes.textContent = totalNodes;
    statEdges.textContent = totalEdges;
    statTech.textContent = techCount;
    statFunc.textContent = funcCount;

    const visibleCount = cy ? cy.nodes(':visible').length : totalNodes;
    activeCount.textContent = visibleCount + ' of ' + totalNodes + ' visible';
  }

  function renderFlowsList() {
    flowListContainer.innerHTML = '';
    if (!graphData.flows || graphData.flows.length === 0) {
      flowListContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">No flows defined yet.</span>';
      return;
    }

    graphData.flows.forEach(f => {
      const card = document.createElement('div');
      card.className = 'flow-card ' + (activeFlow && activeFlow.id === f.id ? 'active' : '');
      card.innerHTML = '<div class="flow-card-title">' + f.name + '</div><div class="flow-card-desc">' + (f.steps || []).length + ' steps • ' + (f.description ? f.description.slice(0, 75) + '...' : '') + '</div>';
      card.onclick = () => startFlowTrace(f.id);
      flowListContainer.appendChild(card);
    });
  }

  function populateDropdowns() {
    edgeFormSource.innerHTML = '';
    edgeFormTarget.innerHTML = '';

    graphData.nodes.forEach(n => {
      const optSrc = document.createElement('option');
      optSrc.value = n.id;
      optSrc.textContent = '[' + n.type + '] ' + n.name;
      edgeFormSource.appendChild(optSrc);

      const optTgt = document.createElement('option');
      optTgt.value = n.id;
      optTgt.textContent = '[' + n.type + '] ' + n.name;
      edgeFormTarget.appendChild(optTgt);
    });
  }

  function applySearchFilter() {
    if (!cy) return;
    const term = searchInput.value.toLowerCase().trim();

    if (!term) {
      cy.elements().removeClass('faded');
      updateMetrics();
      return;
    }

    const matchingNodes = cy.nodes().filter(n => {
      const d = n.data('raw');
      return (
        d.name.toLowerCase().includes(term) ||
        (d.summary && d.summary.toLowerCase().includes(term)) ||
        (d.team && d.team.toLowerCase().includes(term)) ||
        d.type.toLowerCase().includes(term)
      );
    });

    const connectedEdges = matchingNodes.connectedEdges();
    cy.elements().addClass('faded');
    matchingNodes.removeClass('faded');
    connectedEdges.removeClass('faded');

    activeCount.textContent = matchingNodes.length + ' matches';
  }

  function openDrawerTab(tabName) {
    drawerTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabInspector.style.display = tabName === 'inspector' ? 'flex' : 'none';
    tabCopilot.style.display = tabName === 'copilot' ? 'flex' : 'none';
    rightDrawer.classList.remove('collapsed');
  }

  function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
    toast.style.borderLeft = '4px solid ' + color;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3800);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Project selection
    projectSelect.onchange = () => loadProjectGraph(projectSelect.value);

    // Layer switcher pills
    layerFilterGroup.querySelectorAll('.pill-btn').forEach(btn => {
      btn.onclick = () => {
        layerFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLayer = btn.dataset.layer;

        if (activeLayer === 'flow') {
          if (graphData.flows && graphData.flows.length > 0) {
            startFlowTrace(graphData.flows[0].id);
          }
        } else {
          exitFlowTrace();
          activeLayer = btn.dataset.layer;
          btn.classList.add('active');
          renderGraphElements();
        }
      };
    });

    // Layout selector
    layoutSelect.onchange = () => runLayout();

    // Search
    searchInput.oninput = () => applySearchFilter();

    // Type filter chips
    typeFiltersContainer.querySelectorAll('.filter-chip').forEach(chip => {
      chip.onclick = () => {
        const type = chip.dataset.type;
        if (activeTypeFilters.has(type)) {
          activeTypeFilters.delete(type);
          chip.classList.remove('active');
        } else {
          activeTypeFilters.add(type);
          chip.classList.add('active');
        }
        renderGraphElements();
      };
    });

    // Canvas floating buttons
    btnZoomIn.onclick = () => cy && cy.zoom(cy.zoom() * 1.25);
    btnZoomOut.onclick = () => cy && cy.zoom(cy.zoom() * 0.8);
    btnFit.onclick = () => cy && cy.fit(null, 50);
    btnResetLayout.onclick = () => runLayout();
    btnExportPng.onclick = () => {
      if (!cy) return;
      const pngData = cy.png({ full: true, bg: '#0b0f19', scale: 2 });
      const link = document.createElement('a');
      link.href = pngData;
      link.download = (graphData.project.name || 'knowledge-graph') + '.png';
      link.click();
      showToast('Exported PNG image!', 'success');
    };

    // Flow player controls
    btnFlowPrev.onclick = () => prevFlowStep();
    btnFlowNext.onclick = () => nextFlowStep();
    btnFlowPlay.onclick = () => toggleFlowAutoPlay();
    btnExitFlow.onclick = () => exitFlowTrace();

    // Drawer toggle & tabs
    btnToggleDrawer.onclick = () => rightDrawer.classList.toggle('collapsed');
    drawerTabs.forEach(tab => {
      tab.onclick = () => openDrawerTab(tab.dataset.tab);
    });

    // AI Chat
    btnSendChat.onclick = () => sendChatMessage();
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    };
    presetChips.forEach(chip => {
      chip.onclick = () => {
        openDrawerTab('copilot');
        sendChatMessage(chip.dataset.prompt);
      };
    });

    // Node inspector AI action
    btnAskAiAboutNode.onclick = () => {
      if (!selectedElement || selectedElement.type !== 'node') return;
      openDrawerTab('copilot');
      sendChatMessage('What is the direct impact and downstream failure cascade if "' + selectedElement.data.name + '" (' + selectedElement.data.type + ') experiences a critical outage?');
    };

    // Node edit & delete
    btnEditCurrentNode.onclick = () => {
      if (!selectedElement || selectedElement.type !== 'node') return;
      const n = selectedElement.data;
      nodeFormId.value = n.id;
      modalNodeTitle.textContent = 'Edit Knowledge Graph Node';
      nodeFormLayer.value = n.layer;
      nodeFormType.value = n.type;
      nodeFormName.value = n.name;
      nodeFormSummary.value = n.summary || '';
      nodeFormTeam.value = n.team || '';
      nodeFormStatus.value = n.status || 'healthy';
      nodeFormDetails.value = JSON.stringify(n.details || {}, null, 2);
      openModal('modalNode');
    };
    btnDeleteCurrentNode.onclick = () => deleteCurrentNode();

    // Modals: Open & Close
    btnOpenAiExtract.onclick = () => openModal('modalAiExtract');
    btnRunAiExtract.onclick = () => runAiExtract();
    btnApplyAiExtract.onclick = () => applyExtractedGraph();

    btnAddNode.onclick = () => {
      nodeFormId.value = '';
      modalNodeTitle.textContent = 'Add Knowledge Graph Node';
      nodeFormName.value = '';
      nodeFormSummary.value = '';
      nodeFormTeam.value = '';
      nodeFormDetails.value = '{}';
      openModal('modalNode');
    };
    btnSaveNode.onclick = () => saveNode();

    btnAddEdge.onclick = () => {
      populateDropdowns();
      openModal('modalEdge');
    };
    btnSaveEdge.onclick = () => saveEdge();

    btnNewProject.onclick = () => {
      newProjectName.value = '';
      newProjectDesc.value = '';
      openModal('modalNewProject');
    };
    btnSubmitNewProject.onclick = () => submitNewProject();

    btnOpenSettings.onclick = () => openModal('modalSettings');
    btnSaveSettings.onclick = () => saveSettings();
    btnResetSampleData.onclick = () => resetSampleProject();

    // Jira Connector listeners
    if (btnOpenJiraModal) {
      btnOpenJiraModal.onclick = () => openModal('modalJira');
    }

    document.querySelectorAll('.jira-tab-btn').forEach(btn => {
      btn.onclick = () => switchJiraTab(btn.dataset.jiratab);
    });

    document.querySelectorAll('.jira-preset-chip').forEach(chip => {
      chip.onclick = () => {
        if (jiraJqlInput && chip.dataset.jql) {
          jiraJqlInput.value = chip.dataset.jql;
          searchJiraIssues(false);
        }
      };
    });

    if (btnTestJiraConnection) btnTestJiraConnection.onclick = () => testJiraConnection();
    if (btnSaveJiraCredentials) btnSaveJiraCredentials.onclick = () => saveJiraCredentials();
    if (btnSearchJira) btnSearchJira.onclick = () => searchJiraIssues(false);
    if (btnLoadDemoJira) btnLoadDemoJira.onclick = () => searchJiraIssues(true);
    if (jiraSelectAll) jiraSelectAll.onchange = () => toggleAllJiraIssues(jiraSelectAll.checked);
    if (btnExtractJiraGraph) btnExtractJiraGraph.onclick = () => extractJiraGraph();
    if (btnApplyJiraExtract) btnApplyJiraExtract.onclick = () => applyJiraGraph();

    // KT Studio Listeners
    if (btnOpenKtModal) {
      btnOpenKtModal.onclick = () => {
        openModal('modalKtStudio');
        loadKtArchiveList();
      };
    }

    document.querySelectorAll('.kt-tab-btn').forEach(btn => {
      btn.onclick = () => switchKtTab(btn.dataset.kttab);
    });

    document.querySelectorAll('.kt-mode-btn').forEach(btn => {
      btn.onclick = () => switchKtMode(btn.dataset.ktmode);
    });

    if (btnBrowseKtFile && ktFileInput) {
      btnBrowseKtFile.onclick = (e) => {
        e.stopPropagation();
        ktFileInput.click();
      };
      ktFileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) handleKtFile(e.target.files[0]);
      };
    }

    if (ktDropZone) {
      ktDropZone.ondragover = (e) => { e.preventDefault(); ktDropZone.classList.add('dragover'); };
      ktDropZone.ondragleave = () => ktDropZone.classList.remove('dragover');
      ktDropZone.ondrop = (e) => {
        e.preventDefault();
        ktDropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleKtFile(e.dataTransfer.files[0]);
        }
      };
      ktDropZone.onclick = (e) => {
        if (e.target !== btnBrowseKtFile && ktFileInput) ktFileInput.click();
      };
    }

    if (btnClearKtFile) btnClearKtFile.onclick = () => clearKtFile();
    if (btnStartKtRec) btnStartKtRec.onclick = () => startLiveRecording();
    if (btnStopKtRec) btnStopKtRec.onclick = () => stopLiveRecording();
    if (btnLoadSampleKt) btnLoadSampleKt.onclick = () => loadSampleKtSession();
    if (btnProcessKt) btnProcessKt.onclick = () => processKtSession();

    // TTS Voice Player Listeners
    if (btnTtsPlayPause) btnTtsPlayPause.onclick = () => toggleTtsPlayback();
    if (btnTtsStop) btnTtsStop.onclick = () => stopTtsPlayback();
    if (ttsRateSelect) {
      ttsRateSelect.onchange = () => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          // Restart with new rate
          stopTtsPlayback();
          toggleTtsPlayback();
        }
      };
    }

    if (btnToggleKtView) {
      btnToggleKtView.onclick = () => {
        const isShowingDoc = ktDocPreviewContainer.style.display !== 'none';
        ktDocPreviewContainer.style.display = isShowingDoc ? 'none' : 'block';
        ktTranscriptPreviewContainer.style.display = isShowingDoc ? 'block' : 'none';
        btnToggleKtView.textContent = isShowingDoc ? 'View Document' : 'View Transcript';
      };
    }

    if (btnCopyKtDoc) {
      btnCopyKtDoc.onclick = () => {
        if (ktCurrentSession && ktCurrentSession.document_markdown) {
          navigator.clipboard.writeText(ktCurrentSession.document_markdown);
          showToast('Architecture document markdown copied to clipboard!', 'success');
        }
      };
    }

    if (btnDownloadKtDoc) {
      btnDownloadKtDoc.onclick = () => {
        if (ktCurrentSession && ktCurrentSession.document_markdown) {
          const blob = new Blob([ktCurrentSession.document_markdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(ktCurrentSession.title || 'kt-architecture').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Downloaded KT specification document!', 'success');
        }
      };
    }

    if (btnApplyKtGraph) btnApplyKtGraph.onclick = () => applyKtGraph();

    // Generic modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.onclick = () => closeModal(btn.dataset.close);
    });
  }

  // Run on load
  window.addEventListener('DOMContentLoaded', init);
})();
