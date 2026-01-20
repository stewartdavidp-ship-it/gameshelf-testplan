#!/usr/bin/env node

/**
 * Setup script for Game Shelf Test Server
 * 
 * Copies testplan-v3.html and adds Playwright runner integration
 */

const fs = require('fs');
const path = require('path');

const testPlanPaths = [
  '../gs-complete/testing/testplan-v3.html',
  './testplan-v3.html',
  process.argv[2]
].filter(Boolean);

console.log('🔧 Game Shelf Test Server Setup\n');

// Find test plan
let testPlanPath = null;
for (const p of testPlanPaths) {
  const fullPath = path.resolve(__dirname, p);
  if (fs.existsSync(fullPath)) {
    testPlanPath = fullPath;
    break;
  }
}

if (!testPlanPath) {
  console.log('❌ Could not find testplan-v3.html');
  console.log('   Please provide path as argument:');
  console.log('   node setup.js /path/to/testplan-v3.html\n');
  process.exit(1);
}

console.log(`📄 Found test plan: ${testPlanPath}`);

// Read test plan
let html = fs.readFileSync(testPlanPath, 'utf8');

// Remove old automation-integration.js if present
if (html.includes('automation-integration.js')) {
  html = html.replace('<script src="automation-integration.js"></script>\n', '');
  console.log('🗑️  Removed old automation-integration.js');
}

// Check if playwright-runner already added
if (html.includes('playwright-runner.js')) {
  console.log('✅ Playwright runner already added');
} else {
  // Add playwright-runner script before </body>
  const scriptTag = '<script src="playwright-runner.js"></script>\n</body>';
  html = html.replace('</body>', scriptTag);
  console.log('✅ Added playwright-runner.js');
}

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write to public/index.html
const outputPath = path.join(publicDir, 'index.html');
fs.writeFileSync(outputPath, html);
console.log(`✅ Saved to ${outputPath}`);

// Check for Playwright
try {
  require.resolve('@playwright/test');
  console.log('✅ Playwright installed');
} catch {
  console.log('⚠️  Playwright not installed');
  console.log('   Run: npm install && npx playwright install chromium\n');
}

console.log('\n🎉 Setup complete!');
console.log('   Start server: npm start');
console.log('   Open: http://localhost:3000');
console.log('\n📝 The existing "🤖 Auto" tab now has a Playwright section!');
console.log('   - Use existing checkboxes to select tests');
console.log('   - Click "🎭 Run All (Playwright)" for true automation');
console.log('   - Results sync to Firebase alongside manual results\n');
