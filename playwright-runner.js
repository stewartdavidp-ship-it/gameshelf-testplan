/**
 * Game Shelf Playwright Runner Integration
 * 
 * Enhances the existing "🤖 Auto" tab to support:
 * - Running actual Playwright tests (not just stubs)
 * - Live progress in the existing automation log
 * - Results saved to Firebase alongside manual results
 * 
 * This works WITH the existing auto-advance step-through mode,
 * adding a new "True Automation" section.
 * 
 * Requires: test-server running on localhost:3000
 */

(function() {
  'use strict';
  
  // ============================================================
  // CONFIGURATION
  // ============================================================
  const PLAYWRIGHT_SERVER = 'http://localhost:3000';
  
  // ============================================================
  // STATE
  // ============================================================
  const playwrightState = {
    connected: false,
    running: false,
    currentRun: null,
    eventSource: null,
    results: {} // testId -> result
  };
  
  // ============================================================
  // INJECT UI INTO EXISTING AUTO TAB
  // ============================================================
  function injectPlaywrightSection() {
    const autoTab = document.getElementById('tab-automation');
    if (!autoTab) {
      console.warn('Auto tab not found, retrying...');
      setTimeout(injectPlaywrightSection, 1000);
      return;
    }
    
    // Check if already injected
    if (document.getElementById('playwright-section')) return;
    
    // Find the "Test Scripts" panel (we'll insert before it)
    const scriptsPanel = autoTab.querySelector('.panel:last-child');
    
    // Create Playwright section
    const section = document.createElement('div');
    section.id = 'playwright-section';
    section.className = 'panel';
    section.style.borderLeft = '4px solid var(--primary)';
    section.innerHTML = `
      <h3>🎭 Playwright Runner</h3>
      <p style="font-size: 0.8rem; color: var(--gray-500); margin-bottom: 12px;">
        Run real automated tests with Playwright. Results sync to Firebase.
      </p>
      
      <!-- Server Status -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--gray-50); border-radius: 6px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="pw-status-dot" style="width: 10px; height: 10px; border-radius: 50%; background: var(--gray-300);"></span>
          <span id="pw-status-text" style="font-size: 0.85rem;">Connecting to server...</span>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="PlaywrightRunner.reconnect()">🔄 Reconnect</button>
      </div>
      
      <!-- Run Options -->
      <div class="form-row" style="margin-bottom: 12px;">
        <div class="form-group">
          <label>Browser</label>
          <select id="pw-browser">
            <option value="chromium">🖥️ Chrome</option>
            <option value="firefox">🦊 Firefox</option>
            <option value="webkit">🧭 Safari</option>
            <option value="Mobile Chrome">📱 Mobile Chrome</option>
            <option value="Mobile Safari">📱 Mobile Safari</option>
          </select>
        </div>
        <div class="form-group">
          <label>Options</label>
          <div style="display: flex; gap: 12px; padding-top: 6px;">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="pw-headed"> Headed
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="pw-parallel"> Parallel
            </label>
          </div>
        </div>
      </div>
      
      <!-- Run Buttons -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <button id="pw-run-all" class="btn btn-primary" onclick="PlaywrightRunner.runAll()" disabled>
          🎭 Run All (Playwright)
        </button>
        <button id="pw-run-selected" class="btn btn-secondary" onclick="PlaywrightRunner.runSelected()" disabled>
          🎭 Run Selected
        </button>
        <button id="pw-run-smoke" class="btn btn-secondary" onclick="PlaywrightRunner.runSmoke()" disabled>
          🚀 Smoke Tests
        </button>
        <button id="pw-stop" class="btn btn-danger" onclick="PlaywrightRunner.stop()" disabled>
          ⏹️ Stop
        </button>
      </div>
      
      <!-- Progress -->
      <div id="pw-progress" style="display: none; padding: 10px; background: var(--gray-50); border-radius: 6px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span id="pw-progress-text" style="font-size: 0.85rem; font-weight: 500;">Running...</span>
          <span id="pw-progress-counts" style="font-size: 0.8rem;">✅ 0 ❌ 0</span>
        </div>
        <div style="height: 6px; background: var(--gray-200); border-radius: 3px; overflow: hidden;">
          <div id="pw-progress-bar" style="height: 100%; background: var(--success); width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
      
      <!-- Quick Section Buttons -->
      <div style="margin-bottom: 12px;">
        <label style="font-size: 0.75rem; font-weight: 500; color: var(--gray-500); display: block; margin-bottom: 6px;">QUICK RUN BY SECTION</label>
        <div id="pw-section-buttons" style="display: flex; gap: 4px; flex-wrap: wrap;">
          <!-- Populated dynamically -->
        </div>
      </div>
      
      <!-- Results Summary -->
      <div id="pw-results-summary" style="display: none;">
        <label style="font-size: 0.75rem; font-weight: 500; color: var(--gray-500); display: block; margin-bottom: 6px;">AUTOMATED RESULTS</label>
        <div id="pw-results-grid" style="display: flex; gap: 4px; flex-wrap: wrap; max-height: 150px; overflow-y: auto; padding: 8px; background: var(--gray-50); border-radius: 6px;">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;
    
    // Insert before scripts panel
    if (scriptsPanel) {
      autoTab.insertBefore(section, scriptsPanel);
    } else {
      autoTab.appendChild(section);
    }
    
    // Populate section buttons
    populateSectionButtons();
    
    console.log('✅ Playwright section injected into Auto tab');
  }
  
  function populateSectionButtons() {
    const container = document.getElementById('pw-section-buttons');
    if (!container || typeof TEST_SECTIONS === 'undefined') return;
    
    container.innerHTML = TEST_SECTIONS.map(s => `
      <button class="btn btn-sm btn-secondary pw-section-btn" 
              onclick="PlaywrightRunner.runSection('${s.id}')" 
              disabled
              title="${s.name}">
        ${s.icon}
      </button>
    `).join('');
  }
  
  // ============================================================
  // SERVER CONNECTION (SSE)
  // ============================================================
  function connectToServer() {
    if (playwrightState.eventSource) {
      playwrightState.eventSource.close();
    }
    
    updateStatus('connecting');
    
    try {
      playwrightState.eventSource = new EventSource(`${PLAYWRIGHT_SERVER}/api/events`);
      
      playwrightState.eventSource.onopen = () => {
        playwrightState.connected = true;
        updateStatus('connected');
        enableButtons(true);
        addToLog('Connected to Playwright server', 'success');
      };
      
      playwrightState.eventSource.onmessage = (event) => {
        handleServerEvent(JSON.parse(event.data));
      };
      
      playwrightState.eventSource.onerror = () => {
        playwrightState.connected = false;
        updateStatus('disconnected');
        enableButtons(false);
        
        // Retry after delay
        setTimeout(connectToServer, 5000);
      };
    } catch (e) {
      console.error('Failed to connect:', e);
      updateStatus('disconnected');
    }
  }
  
  function handleServerEvent(event) {
    switch (event.type) {
      case 'run-started':
        playwrightState.running = true;
        playwrightState.currentRun = event.data;
        showProgress(true);
        addToLog(`🎭 Playwright run started: ${event.data.project}`, 'info');
        break;
        
      case 'test-complete':
        handleTestResult(event.data);
        break;
        
      case 'run-complete':
        playwrightState.running = false;
        playwrightState.currentRun = event.data;
        showProgress(false);
        addToLog(`✅ Run complete: ${event.data.passed} passed, ${event.data.failed} failed`, 'success');
        saveRunToFirebase(event.data);
        updateResultsGrid();
        enableButtons(true);
        break;
        
      case 'run-stopped':
        playwrightState.running = false;
        showProgress(false);
        addToLog('⏹️ Run stopped', 'warn');
        enableButtons(true);
        break;
    }
    
    updateProgressDisplay();
  }
  
  function handleTestResult(result) {
    // Store result
    playwrightState.results[result.testId] = result;
    
    // Add to existing automation log
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    addToLog(`${icon} ${result.testId}: ${result.title || ''} (${Math.round(result.duration)}ms)`, 
             result.status === 'pass' ? 'success' : result.status === 'fail' ? 'error' : 'info');
    
    // Save individual result to Firebase
    saveResultToFirebase(result);
    
    // Update test card badge in Testing tab
    updateTestCardBadge(result.testId, result.status);
    
    // Update progress
    updateProgressDisplay();
  }
  
  // ============================================================
  // UI UPDATES
  // ============================================================
  function updateStatus(state) {
    const dot = document.getElementById('pw-status-dot');
    const text = document.getElementById('pw-status-text');
    if (!dot || !text) return;
    
    switch (state) {
      case 'connected':
        dot.style.background = 'var(--success)';
        text.textContent = 'Connected to Playwright server';
        break;
      case 'connecting':
        dot.style.background = 'var(--warning)';
        text.textContent = 'Connecting...';
        break;
      case 'disconnected':
        dot.style.background = 'var(--danger)';
        text.textContent = 'Server not running. Start with: npm start';
        break;
    }
  }
  
  function enableButtons(enabled) {
    const canRun = enabled && playwrightState.connected && !playwrightState.running;
    
    ['pw-run-all', 'pw-run-selected', 'pw-run-smoke'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !canRun;
    });
    
    document.querySelectorAll('.pw-section-btn').forEach(btn => {
      btn.disabled = !canRun;
    });
    
    const stopBtn = document.getElementById('pw-stop');
    if (stopBtn) stopBtn.disabled = !playwrightState.running;
  }
  
  function showProgress(show) {
    const el = document.getElementById('pw-progress');
    if (el) el.style.display = show ? 'block' : 'none';
  }
  
  function updateProgressDisplay() {
    if (!playwrightState.currentRun) return;
    
    const run = playwrightState.currentRun;
    const total = run.passed + run.failed + run.skipped;
    const expected = typeof run.tests === 'number' ? run.tests : 
                     Array.isArray(run.tests) ? run.tests.length : 
                     Object.keys(playwrightState.results).length;
    
    const textEl = document.getElementById('pw-progress-text');
    const countsEl = document.getElementById('pw-progress-counts');
    const barEl = document.getElementById('pw-progress-bar');
    
    if (textEl) textEl.textContent = `Running... ${total}/${expected || '?'}`;
    if (countsEl) countsEl.textContent = `✅ ${run.passed} ❌ ${run.failed}`;
    if (barEl && expected) barEl.style.width = `${(total / expected) * 100}%`;
  }
  
  function updateResultsGrid() {
    const container = document.getElementById('pw-results-grid');
    const summary = document.getElementById('pw-results-summary');
    if (!container || !summary) return;
    
    const results = Object.entries(playwrightState.results);
    if (results.length === 0) {
      summary.style.display = 'none';
      return;
    }
    
    summary.style.display = 'block';
    
    container.innerHTML = results.map(([testId, result]) => {
      const bg = result.status === 'pass' ? '#dcfce7' : 
                 result.status === 'fail' ? '#fee2e2' : '#f3f4f6';
      const color = result.status === 'pass' ? '#166534' : 
                    result.status === 'fail' ? '#991b1b' : '#374151';
      return `<div style="padding: 4px 8px; background: ${bg}; color: ${color}; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer;" 
                  onclick="scrollToTestCard('${testId}')" 
                  title="${result.title || testId}">${testId}</div>`;
    }).join('');
  }
  
  function updateTestCardBadge(testId, status) {
    // Find test card in Testing tab and add/update badge
    const card = document.querySelector(`[data-test-id="${testId}"]`);
    if (!card) return;
    
    let badge = card.querySelector('.pw-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pw-badge';
      badge.style.cssText = 'position: absolute; top: 4px; right: 4px; font-size: 0.6rem; padding: 2px 4px; border-radius: 4px; z-index: 5;';
      card.style.position = 'relative';
      card.appendChild(badge);
    }
    
    badge.textContent = status === 'pass' ? '🎭✅' : status === 'fail' ? '🎭❌' : '🎭⏭️';
    badge.style.background = status === 'pass' ? '#dcfce7' : status === 'fail' ? '#fee2e2' : '#f3f4f6';
  }
  
  // Use existing automation log
  function addToLog(message, type = 'info') {
    const log = document.getElementById('automation-log');
    if (!log) return;
    
    const line = document.createElement('div');
    line.className = type;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
  
  // ============================================================
  // API CALLS
  // ============================================================
  async function runTests(testIds = []) {
    if (!playwrightState.connected) {
      toast('Not connected to Playwright server');
      return;
    }
    
    if (playwrightState.running) {
      toast('Tests already running');
      return;
    }
    
    const payload = {
      tests: testIds,
      project: document.getElementById('pw-browser')?.value || 'chromium',
      headed: document.getElementById('pw-headed')?.checked || false,
      workers: document.getElementById('pw-parallel')?.checked ? 2 : 1
    };
    
    enableButtons(false);
    
    try {
      const response = await fetch(`${PLAYWRIGHT_SERVER}/api/run-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast(`Error: ${error.error}`);
        enableButtons(true);
        return;
      }
      
      const data = await response.json();
      addToLog(`Started run: ${data.runId}`, 'info');
      
    } catch (e) {
      toast('Failed to start tests. Is server running?');
      addToLog('Failed to connect to server', 'error');
      enableButtons(true);
    }
  }
  
  async function stopTests() {
    try {
      await fetch(`${PLAYWRIGHT_SERVER}/api/stop-tests`, { method: 'POST' });
    } catch (e) {
      toast('Failed to stop tests');
    }
  }
  
  // ============================================================
  // FIREBASE SYNC
  // ============================================================
  function saveResultToFirebase(result) {
    if (typeof firebase === 'undefined' || !firebase.database) return;
    
    const data = {
      testId: result.testId,
      status: result.status,
      duration: result.duration,
      timestamp: new Date().toISOString(),
      automated: true,
      source: 'playwright',
      project: playwrightState.currentRun?.project || 'unknown'
    };
    
    if (result.error) {
      data.error = typeof result.error === 'string' ? result.error : result.error.message;
    }
    
    firebase.database().ref(`automated-results/${result.testId}`).set(data)
      .catch(e => console.error('Firebase save error:', e));
  }
  
  function saveRunToFirebase(run) {
    if (typeof firebase === 'undefined' || !firebase.database) return;
    
    firebase.database().ref(`automated-runs/${run.id}`).set({
      id: run.id,
      startTime: run.startTime,
      endTime: run.endTime,
      duration: run.duration,
      status: run.status,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      project: run.project
    }).catch(e => console.error('Firebase save error:', e));
  }
  
  function loadResultsFromFirebase() {
    if (typeof firebase === 'undefined' || !firebase.database) return;
    
    firebase.database().ref('automated-results').once('value')
      .then(snapshot => {
        const results = snapshot.val() || {};
        playwrightState.results = results;
        
        // Update all test card badges
        Object.entries(results).forEach(([testId, result]) => {
          updateTestCardBadge(testId, result.status);
        });
        
        updateResultsGrid();
        console.log(`📥 Loaded ${Object.keys(results).length} automated results`);
      })
      .catch(e => console.error('Firebase load error:', e));
  }
  
  // ============================================================
  // HELPERS
  // ============================================================
  function getSelectedTestIds() {
    // Use existing test checkboxes from Auto tab
    const checkboxes = document.querySelectorAll('.auto-test:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }
  
  function getSectionTestIds(sectionId) {
    if (typeof TEST_SECTIONS === 'undefined') return [];
    const section = TEST_SECTIONS.find(s => s.id === sectionId);
    return section ? section.tests.map(t => t.id) : [];
  }
  
  function getAllTestIds() {
    if (typeof TEST_SECTIONS === 'undefined') return [];
    return TEST_SECTIONS.flatMap(s => s.tests.map(t => t.id));
  }
  
  // ============================================================
  // PUBLIC API
  // ============================================================
  window.PlaywrightRunner = {
    runAll: () => runTests([]),
    runSelected: () => {
      const selected = getSelectedTestIds();
      if (selected.length === 0) {
        toast('Select tests first (use checkboxes above)');
        return;
      }
      runTests(selected);
    },
    runSmoke: () => runTests(['A1', 'A5', 'B1', 'B2', 'C1']),
    runSection: (sectionId) => runTests(getSectionTestIds(sectionId)),
    stop: stopTests,
    reconnect: connectToServer,
    getState: () => playwrightState,
    loadResults: loadResultsFromFirebase
  };
  
  // Expose scroll helper
  window.scrollToTestCard = function(testId) {
    const card = document.querySelector(`[data-test-id="${testId}"]`);
    if (card) {
      // Switch to Testing tab first
      if (typeof switchTab === 'function') switchTab('testing');
      setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '3px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
      }, 100);
    }
  };
  
  // ============================================================
  // INITIALIZATION
  // ============================================================
  function init() {
    console.log('🎭 Initializing Playwright Runner...');
    
    // Inject UI into existing Auto tab
    injectPlaywrightSection();
    
    // Connect to server
    connectToServer();
    
    // Load previous results from Firebase
    setTimeout(loadResultsFromFirebase, 1000);
    
    console.log('✅ Playwright Runner ready');
  }
  
  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #playwright-section .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pw-badge { transition: all 0.3s; }
  `;
  document.head.appendChild(style);
  
})();
