# Game Shelf Test Server

Adds real Playwright execution to the existing "🤖 Auto" tab in the test plan.

## Quick Start

```bash
npm run setup    # Install + configure
npm start        # Start server
# Open http://localhost:3000 → 🤖 Auto tab → 🎭 Playwright Runner
```

## What It Adds

The test plan's "🤖 Auto" tab already has step-through mode (opens popup, timer-based advance). This adds a **🎭 Playwright Runner** section for true automated testing:

```
🤖 Auto Tab
├── Existing: Step-Through Runner (popup + timer)
├── NEW: 🎭 Playwright Runner (real automation)
│   ├── 🎭 Run All / Run Selected / 🚀 Smoke
│   ├── Browser: Chrome/Firefox/Safari/Mobile
│   ├── Live progress in existing log
│   └── Results → Firebase (same DB as manual results)
└── Existing: Script Export (Playwright/Cypress stubs)
```

## Usage

1. `npm start` → http://localhost:3000
2. Sign in (same Google account)
3. Go to "🤖 Auto" tab
4. Use existing checkboxes to select tests
5. Click "🎭 Run All (Playwright)"
6. Watch live results in the log
7. Results sync to Firebase + show badges on test cards

## Files

```
test-server/
├── server.js              # Express server, spawns Playwright
├── public/
│   ├── index.html         # Test plan with Playwright section added
│   └── playwright-runner.js  # Injected UI + SSE client
├── tests/                 # Playwright test files
│   ├── smoke.spec.ts
│   ├── onboarding.spec.ts
│   ├── tracking.spec.ts
│   └── deep-links.spec.ts
└── playwright.config.ts
```

## Firebase Data

| Path | Source | Content |
|------|--------|---------|
| `test-results/{user}/{test}` | Manual testing | Human pass/fail |
| `automated-results/{test}` | Playwright | Auto pass/fail |
| `automated-runs/{run}` | Playwright | Run summaries |

## CLI

```bash
npm test                    # Run all Playwright tests
npx playwright test -g A1   # Run specific test
npm run test:headed         # See browser
```

## Troubleshooting

- **"Connecting..."** - Run `npm start` first
- **No tests run** - Run `npx playwright install chromium`
- **No Firebase sync** - Sign in to test plan first
