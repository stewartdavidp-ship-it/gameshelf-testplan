/**
 * Game Shelf Test Server
 * 
 * Unified test runner that:
 * - Serves the test plan web app
 * - Runs Playwright tests via API
 * - Streams live results via Server-Sent Events
 * - Client writes results to Firebase (using existing auth)
 * 
 * Usage:
 *   npm start           # Start server on port 3000
 *   npm run dev         # Start with auto-reload
 * 
 * Then open http://localhost:3000
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// STATE
// ============================================================
let currentRun = null;
let sseClients = [];

// ============================================================
// SERVER-SENT EVENTS FOR LIVE UPDATES
// ============================================================
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add this client to the list
  sseClients.push(res);
  console.log(`📡 SSE client connected (${sseClients.length} total)`);

  // Send current status immediately
  if (currentRun) {
    res.write(`data: ${JSON.stringify({ type: 'status', data: currentRun })}\n\n`);
  }

  // Remove client on disconnect
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`📡 SSE client disconnected (${sseClients.length} remaining)`);
  });
});

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => client.write(data));
}

// ============================================================
// API: GET TEST STATUS
// ============================================================
app.get('/api/status', (req, res) => {
  res.json({
    running: currentRun !== null,
    currentRun,
    playwrightInstalled: fs.existsSync(path.join(__dirname, 'node_modules', '@playwright'))
  });
});

// ============================================================
// API: RUN PLAYWRIGHT TESTS
// ============================================================
app.post('/api/run-tests', async (req, res) => {
  if (currentRun) {
    return res.status(409).json({ error: 'Tests already running' });
  }

  const { 
    tests = [],           // Specific test IDs to run, empty = all
    project = 'chromium', // Browser: chromium, firefox, webkit, Mobile Chrome
    headed = false,       // Show browser window
    workers = 1           // Parallel workers
  } = req.body;

  const runId = `run-${Date.now()}`;
  
  currentRun = {
    id: runId,
    startTime: new Date().toISOString(),
    status: 'running',
    tests: tests.length || 'all',
    project,
    results: [],
    passed: 0,
    failed: 0,
    skipped: 0
  };

  broadcast({ type: 'run-started', data: currentRun });
  res.json({ runId, status: 'started' });

  // Build Playwright command
  const args = ['playwright', 'test'];
  
  // Add specific tests if provided
  if (tests.length > 0) {
    // Convert test IDs to grep pattern: A1|A2|B3
    args.push('--grep', tests.join('|'));
  }
  
  args.push('--project', project);
  args.push('--workers', workers.toString());
  args.push('--reporter', 'line');
  
  if (headed) {
    args.push('--headed');
  }

  console.log(`\n🚀 Starting Playwright: npx ${args.join(' ')}`);

  // Spawn Playwright process
  const playwright = spawn('npx', args, {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  // Parse stdout for progress
  playwright.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    // Parse line reporter output for live updates
    // Format: "  ✓  1 [chromium] › test.spec.ts:10:5 › A1: Welcome modal (1.2s)"
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match passed test
      const passMatch = line.match(/✓.*›\s+([A-Z]\d+):\s+(.+?)\s+\((\d+\.?\d*)(?:m?s)?\)/i) ||
                        line.match(/✓.*([A-Z]\d+).*\((\d+\.?\d*)(?:m?s)?\)/i);
      
      // Match failed test  
      const failMatch = line.match(/✘.*›\s+([A-Z]\d+):\s+(.+?)\s+\((\d+\.?\d*)(?:m?s)?\)/i) ||
                        line.match(/[✘✗×].*([A-Z]\d+)/i);
      
      // Match skipped
      const skipMatch = line.match(/-.*›\s+([A-Z]\d+):\s+(.+)/i);

      if (passMatch) {
        const result = {
          testId: passMatch[1],
          title: passMatch[2] || passMatch[1],
          status: 'pass',
          duration: parseFloat(passMatch[3] || passMatch[2]) * (line.includes('ms') ? 1 : 1000),
          timestamp: new Date().toISOString()
        };
        currentRun.results.push(result);
        currentRun.passed++;
        broadcast({ type: 'test-complete', data: result });
      }

      if (failMatch && !passMatch) {
        const result = {
          testId: failMatch[1],
          title: failMatch[2] || failMatch[1],
          status: 'fail',
          duration: parseFloat(failMatch[3] || 0) * 1000,
          timestamp: new Date().toISOString()
        };
        currentRun.results.push(result);
        currentRun.failed++;
        broadcast({ type: 'test-complete', data: result });
      }

      if (skipMatch) {
        const result = {
          testId: skipMatch[1],
          title: skipMatch[2] || skipMatch[1],
          status: 'skip',
          duration: 0,
          timestamp: new Date().toISOString()
        };
        currentRun.results.push(result);
        currentRun.skipped++;
        broadcast({ type: 'test-complete', data: result });
      }
    }
  });

  playwright.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(output);
    
    // Also check stderr for test results (Playwright sometimes outputs there)
    if (output.includes('passed') || output.includes('failed')) {
      broadcast({ type: 'log', data: output });
    }
  });

  playwright.on('close', async (code) => {
    currentRun.status = code === 0 ? 'completed' : 'failed';
    currentRun.endTime = new Date().toISOString();
    currentRun.exitCode = code;
    currentRun.duration = new Date(currentRun.endTime) - new Date(currentRun.startTime);

    console.log(`\n✅ Playwright finished with code ${code}`);
    console.log(`   Passed: ${currentRun.passed}, Failed: ${currentRun.failed}, Skipped: ${currentRun.skipped}`);

    // Try to parse JSON results for more details
    try {
      const jsonPath = path.join(__dirname, 'test-results', 'results.json');
      if (fs.existsSync(jsonPath)) {
        const fullResults = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        // Extract error details for failed tests
        if (fullResults.suites) {
          extractErrorDetails(fullResults.suites, currentRun);
        }
      }
    } catch (e) {
      console.error('Could not parse JSON results:', e.message);
    }

    broadcast({ type: 'run-complete', data: currentRun });
    
    // Store run locally for history
    saveRunLocally(currentRun);
    
    // Clear current run after a delay
    setTimeout(() => {
      currentRun = null;
    }, 5000);
  });
});

// ============================================================
// API: STOP RUNNING TESTS
// ============================================================
app.post('/api/stop-tests', (req, res) => {
  if (!currentRun) {
    return res.status(400).json({ error: 'No tests running' });
  }
  
  // Kill all Playwright processes
  spawn('pkill', ['-f', 'playwright']);
  
  currentRun.status = 'stopped';
  currentRun.endTime = new Date().toISOString();
  
  broadcast({ type: 'run-stopped', data: currentRun });
  
  setTimeout(() => {
    currentRun = null;
  }, 1000);
  
  res.json({ status: 'stopped' });
});

// ============================================================
// API: GET LOCAL RUN HISTORY
// ============================================================
app.get('/api/runs', (req, res) => {
  const historyPath = path.join(__dirname, 'test-results', 'run-history.json');
  
  if (fs.existsSync(historyPath)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      res.json({ runs: history.slice(-20).reverse() });
    } catch (e) {
      res.json({ runs: [] });
    }
  } else {
    res.json({ runs: [] });
  }
});

// ============================================================
// API: GET ARTIFACTS (screenshots, traces)
// ============================================================
app.get('/api/artifacts/:testId', (req, res) => {
  const artifactsDir = path.join(__dirname, 'test-results', 'artifacts');
  const testId = req.params.testId;
  
  // Find matching artifact directory
  if (fs.existsSync(artifactsDir)) {
    const dirs = fs.readdirSync(artifactsDir);
    const matchDir = dirs.find(d => d.includes(testId));
    
    if (matchDir) {
      const fullPath = path.join(artifactsDir, matchDir);
      const files = fs.readdirSync(fullPath);
      
      res.json({
        testId,
        artifacts: files.map(f => ({
          name: f,
          path: `/artifacts/${matchDir}/${f}`,
          type: f.endsWith('.png') ? 'screenshot' : f.endsWith('.webm') ? 'video' : 'trace'
        }))
      });
      return;
    }
  }
  
  res.json({ testId, artifacts: [] });
});

// Serve artifacts statically
app.use('/artifacts', express.static(path.join(__dirname, 'test-results', 'artifacts')));

// ============================================================
// HELPERS
// ============================================================
function extractErrorDetails(suites, run) {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (result.status === 'failed' && result.error) {
              const testId = spec.title.match(/^([A-Z]\d+)/)?.[1];
              const existingResult = run.results.find(r => r.testId === testId);
              if (existingResult) {
                existingResult.error = {
                  message: result.error.message?.substring(0, 500),
                  snippet: result.error.snippet
                };
              }
            }
          }
        }
      }
    }
    if (suite.suites) {
      extractErrorDetails(suite.suites, run);
    }
  }
}

function saveRunLocally(run) {
  const resultsDir = path.join(__dirname, 'test-results');
  const historyPath = path.join(resultsDir, 'run-history.json');
  
  // Ensure directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Load existing history
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch (e) {}
  }
  
  // Add this run (without full results to save space)
  history.push({
    id: run.id,
    startTime: run.startTime,
    endTime: run.endTime,
    duration: run.duration,
    status: run.status,
    passed: run.passed,
    failed: run.failed,
    skipped: run.skipped,
    project: run.project
  });
  
  // Keep last 100 runs
  if (history.length > 100) {
    history = history.slice(-100);
  }
  
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

// ============================================================
// SERVE TEST PLAN APP
// ============================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🎮 Game Shelf Test Server                          ║
╠══════════════════════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}                            ║
╠══════════════════════════════════════════════════════════════╣
║  The test plan app handles Firebase directly.                ║
║  No service account needed!                                  ║
╠══════════════════════════════════════════════════════════════╣
║  API Endpoints:                                              ║
║    POST /api/run-tests    - Start Playwright tests          ║
║    POST /api/stop-tests   - Stop running tests              ║
║    GET  /api/events       - SSE stream for live updates     ║
║    GET  /api/runs         - Get local run history           ║
║    GET  /api/artifacts/:id - Get test artifacts             ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
