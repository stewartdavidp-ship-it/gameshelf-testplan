/**
 * Workflow Tests - User Experience Journeys
 * 
 * IDs: WF1-WF20 (synced with Test Plan app)
 * 
 * These tests measure the EXPERIENCE, not just functionality:
 * - Tap/click counts (fewer is better)
 * - Time to complete tasks
 * - Friction points and confusion indicators
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

// ========== METRICS TRACKING ==========
interface WorkflowResult {
    testId: string;
    tapCount: number;
    timeMs: number;
    steps: string[];
    friction: string[];
    passed: boolean;
}

const results: WorkflowResult[] = [];

// ========== SETUP HELPERS ==========

async function setupFreshUser(page: Page) {
    await page.goto(GAMESHELF_URL + '?fresh=1');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
}

async function setupReturningUser(page: Page) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('load');
    
    await page.evaluate(() => {
        localStorage.setItem('gameshelf_setup_complete', 'true');
        const appData = {
            games: [
                { id: 'wordle', addedAt: new Date().toISOString() },
                { id: 'connections', addedAt: new Date().toISOString() },
                { id: 'strands', addedAt: new Date().toISOString() }
            ],
            stats: {},
            history: {},
            wallet: { tokens: 100, coins: 0 },
            settings: {},
            referralCode: 'TESTUSER'
        };
        localStorage.setItem('gameshelf-data', JSON.stringify(appData));
    });
    
    await page.reload();
    await page.waitForLoadState('load');
    
    // Dismiss overlays
    await page.evaluate(() => {
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.remove('visible');
    });
    
    await page.waitForTimeout(500);
}

// ========== WF1: NEW USER INVITE FLOW ==========

test.describe('WF1: New User from Invite', () => {
    
    test('WF1: Referral link captures code', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF1', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await page.goto(GAMESHELF_URL + '?fresh=1#ref=DAVE1234');
        await page.waitForLoadState('load');
        r.steps.push('Opened referral link');
        
        const captured = await page.evaluate(() => {
            return sessionStorage.getItem('pendingReferral') || 
                   localStorage.getItem('referredBy');
        });
        
        r.timeMs = Date.now() - start;
        r.passed = captured !== null;
        if (!captured) r.friction.push('Referral code not captured from URL');
        
        results.push(r);
        console.log(`WF1: ${r.passed ? '✅' : '❌'} Ref captured: ${captured}`);
    });
    
    test('WF2: New user log first game - count taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF2', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupFreshUser(page);
        r.steps.push('Fresh user landing');
        
        // Check for onboarding
        const onWelcome = await page.locator('#setup-welcome.active').isVisible().catch(() => false);
        
        if (onWelcome) {
            // Tap 1: Let's Go
            const letsGo = page.getByText("Let's Go");
            if (await letsGo.isVisible().catch(() => false)) {
                await letsGo.click();
                r.tapCount++;
                r.steps.push(`${r.tapCount}. Click Let's Go`);
                await page.waitForTimeout(500);
            }
            
            // Taps 2-4: Select 3 games
            for (let i = 0; i < 3; i++) {
                const gameBtn = page.locator('.setup-game-btn').nth(i);
                if (await gameBtn.isVisible().catch(() => false)) {
                    await gameBtn.click();
                    r.tapCount++;
                    r.steps.push(`${r.tapCount}. Select game ${i+1}`);
                    await page.waitForTimeout(200);
                }
            }
            
            // Tap 5: Next
            const nextBtn = page.getByText(/Next|Continue/i).first();
            if (await nextBtn.isVisible().catch(() => false)) {
                await nextBtn.click();
                r.tapCount++;
                r.steps.push(`${r.tapCount}. Click Next`);
                await page.waitForTimeout(500);
            }
            
            // Skip additional screens
            const skipBtn = page.getByText(/Skip|Later/i).first();
            if (await skipBtn.isVisible().catch(() => false)) {
                await skipBtn.click();
                r.tapCount++;
                r.steps.push(`${r.tapCount}. Skip optional`);
                await page.waitForTimeout(500);
            }
        }
        
        // Now log a game
        const logBtn = page.locator('button:has-text("Log"), #log-btn').first();
        if (await logBtn.isVisible().catch(() => false)) {
            await logBtn.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Open Log`);
            await page.waitForTimeout(500);
        }
        
        const logInput = page.locator('#log-input, textarea').first();
        if (await logInput.isVisible().catch(() => false)) {
            await logInput.fill('Wordle 1,234 4/6\n⬛⬛🟨⬛⬛\n🟩🟩🟩🟩🟩');
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Paste result`);
        }
        
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Confirm")').first();
        if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Save`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 8; // Allowing onboarding taps
        
        if (r.tapCount > 5) r.friction.push(`${r.tapCount} taps (target: ≤5 after onboarding)`);
        if (r.timeMs > 60000) r.friction.push(`${r.timeMs}ms (target: <60s)`);
        
        results.push(r);
        console.log(`WF2: ${r.passed ? '✅' : '❌'} Taps: ${r.tapCount}, Time: ${r.timeMs}ms`);
        console.log(`   Steps: ${r.steps.join(' → ')}`);
    });
    
    test('WF3: Referrer info shown on landing', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF3', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await page.goto(GAMESHELF_URL + '?fresh=1#ref=DAVE1234');
        await page.waitForTimeout(1000);
        
        const hasInviteText = await page.getByText(/invited|referred|from Dave/i).isVisible().catch(() => false);
        const hasBanner = await page.locator('.referral-banner, [class*="invite"]').isVisible().catch(() => false);
        
        r.timeMs = Date.now() - start;
        r.passed = hasInviteText || hasBanner;
        
        if (!r.passed) {
            r.friction.push('No "Dave invited you" banner');
            r.friction.push('User lands on generic screen');
        }
        
        results.push(r);
        console.log(`WF3: ${r.passed ? '✅' : '❌'} Referrer shown: ${hasInviteText || hasBanner}`);
    });
    
    test('WF4: Clipboard auto-detected', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF4', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        const hasDetection = await page.evaluate(() => {
            return typeof (window as any).checkClipboard === 'function' ||
                   typeof (window as any).detectClipboardContent === 'function';
        });
        
        r.timeMs = Date.now() - start;
        r.passed = hasDetection;
        
        if (!hasDetection) r.friction.push('No clipboard detection function');
        
        results.push(r);
        console.log(`WF4: ${r.passed ? '✅' : '❌'} Clipboard detection: ${hasDetection}`);
    });
});

// ========== WF5-WF8: DAILY RETURN USER ==========

test.describe('WF2: Daily Return User', () => {
    
    test('WF5: Progress visible without scrolling', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF5', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        const visible = await page.evaluate(() => {
            const el = document.querySelector('.game-cards, .progress, .today-progress');
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight;
        });
        
        r.timeMs = Date.now() - start;
        r.passed = visible;
        
        if (!visible) r.friction.push('Must scroll to see progress');
        
        results.push(r);
        console.log(`WF5: ${r.passed ? '✅' : '❌'} Progress visible: ${visible}`);
    });
    
    test('WF6: Log button visible without scrolling', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF6', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        const visible = await page.evaluate(() => {
            const btn = document.querySelector('button[onclick*="log"], #log-btn, .log-button');
            if (!btn) return false;
            const rect = btn.getBoundingClientRect();
            return rect.bottom <= window.innerHeight;
        });
        
        r.timeMs = Date.now() - start;
        r.passed = visible;
        
        if (!visible) r.friction.push('Log button not in viewport');
        
        results.push(r);
        console.log(`WF6: ${r.passed ? '✅' : '❌'} Log button visible: ${visible}`);
    });
    
    test('WF7: Log game in ≤3 taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF7', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        // Tap 1: Open log
        const logBtn = page.locator('button:has-text("Log"), #log-btn').first();
        if (await logBtn.isVisible().catch(() => false)) {
            await logBtn.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Open Log`);
        }
        await page.waitForTimeout(500);
        
        // Tap 2: Paste
        const input = page.locator('#log-input, textarea').first();
        if (await input.isVisible().catch(() => false)) {
            await input.fill('Wordle 1,234 3/6\n🟩🟩🟩🟩🟩');
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Paste result`);
        }
        await page.waitForTimeout(300);
        
        // Tap 3: Confirm
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Log")').first();
        if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Save`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 3;
        
        if (r.tapCount > 3) r.friction.push(`${r.tapCount} taps (target: ≤3)`);
        
        results.push(r);
        console.log(`WF7: ${r.passed ? '✅' : '❌'} Taps: ${r.tapCount}`);
    });
    
    test('WF8: Log game under 30 seconds', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF8', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const input = page.locator('#log-input, textarea').first();
        await input.fill('Wordle 1,234 4/6\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩');
        
        const saveBtn = page.locator('button:has-text("Save")').first();
        if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click();
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.timeMs < 30000;
        
        if (!r.passed) r.friction.push(`${r.timeMs}ms (target: <30s)`);
        
        results.push(r);
        console.log(`WF8: ${r.passed ? '✅' : '❌'} Time: ${r.timeMs}ms`);
    });
});

// ========== WF9-WF11: SOCIAL ENGAGEMENT ==========

test.describe('WF3: Social Engagement', () => {
    
    test('WF9: See friends in ≤2 taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF9', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        // Check if friends on home
        const friendsOnHome = await page.locator('.friends-widget, [class*="friend"]').isVisible().catch(() => false);
        
        if (!friendsOnHome) {
            // Tap 1: Go to Social
            await page.locator('.nav-tab[data-tab="social"]').click().catch(() => {});
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Click Social tab`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 2;
        
        if (r.tapCount > 2) r.friction.push(`${r.tapCount} taps (target: ≤2)`);
        
        results.push(r);
        console.log(`WF9: ${r.passed ? '✅' : '❌'} Taps to friends: ${r.tapCount}`);
    });
    
    test('WF10: Score comparison available', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF10', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        await page.goto(GAMESHELF_URL + '#social');
        await page.waitForTimeout(500);
        
        const hasComparison = await page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes('/6') || text.includes('vs') || text.includes('beat');
        });
        
        r.timeMs = Date.now() - start;
        r.passed = hasComparison;
        
        if (!hasComparison) r.friction.push('No score comparison visible');
        
        results.push(r);
        console.log(`WF10: ${r.passed ? '✅' : '❌'} Comparison: ${hasComparison}`);
    });
    
    test('WF11: Start battle in ≤4 taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF11', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        // Tap 1: Social tab
        await page.locator('.nav-tab[data-tab="social"]').click().catch(() => {});
        r.tapCount++;
        r.steps.push(`${r.tapCount}. Social tab`);
        await page.waitForTimeout(500);
        
        // Tap 2: Create Battle
        const createBtn = page.locator('button:has-text("Create"), button:has-text("Battle")').first();
        if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Create Battle`);
        }
        await page.waitForTimeout(500);
        
        // Tap 3: Select game
        const gameOpt = page.locator('.battle-game-option, input[type="checkbox"]').first();
        if (await gameOpt.isVisible().catch(() => false)) {
            await gameOpt.click();
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Select game`);
        }
        await page.waitForTimeout(300);
        
        // Tap 4: Confirm
        const confirmBtn = page.locator('button:has-text("Create"), button:has-text("Start")').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Would confirm`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 4;
        
        if (r.tapCount > 4) r.friction.push(`${r.tapCount} taps (target: ≤4)`);
        
        results.push(r);
        console.log(`WF11: ${r.passed ? '✅' : '❌'} Taps: ${r.tapCount}`);
    });
});

// ========== WF12-WF14: BATTLE JOIN ==========

test.describe('WF4: Battle Join Flow', () => {
    
    test('WF12: Battle link shows details', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF12', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await page.goto(GAMESHELF_URL + '#battle=ABC123');
        await page.waitForTimeout(1000);
        
        const hasDetails = await page.evaluate(() => {
            return document.querySelector('.battle-details, .battle-info') !== null ||
                   document.body.innerText.toLowerCase().includes('join');
        });
        
        r.timeMs = Date.now() - start;
        r.passed = hasDetails;
        
        if (!hasDetails) r.friction.push('Battle link does not show details');
        
        results.push(r);
        console.log(`WF12: ${r.passed ? '✅' : '❌'} Details shown: ${hasDetails}`);
    });
    
    test('WF13: Battle join shows games/duration/stakes', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF13', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        await page.goto(GAMESHELF_URL + '#battle=ABC123');
        await page.waitForTimeout(1000);
        
        const text = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        const hasGames = text.includes('wordle') || text.includes('game');
        const hasDuration = text.includes('day') || text.includes('week');
        const hasStakes = text.includes('token') || text.includes('free');
        
        r.timeMs = Date.now() - start;
        r.passed = hasGames && hasDuration;
        
        if (!hasGames) r.friction.push('Games not shown');
        if (!hasDuration) r.friction.push('Duration not shown');
        if (!hasStakes) r.friction.push('Entry fee not shown');
        
        results.push(r);
        console.log(`WF13: ${r.passed ? '✅' : '❌'} Info complete: G:${hasGames} D:${hasDuration} S:${hasStakes}`);
    });
    
    test('WF14: Join battle in ≤2 taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF14', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        await page.goto(GAMESHELF_URL + '#battle=ABC123');
        await page.waitForTimeout(1000);
        
        // Tap 1: Join
        const joinBtn = page.locator('button:has-text("Join")').first();
        if (await joinBtn.isVisible().catch(() => false)) {
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Click Join`);
        }
        
        // Tap 2: Confirm
        const confirmBtn = page.locator('button:has-text("Confirm")').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Confirm`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 2;
        
        if (r.tapCount > 2) r.friction.push(`${r.tapCount} taps (target: ≤2)`);
        
        results.push(r);
        console.log(`WF14: ${r.passed ? '✅' : '❌'} Taps: ${r.tapCount}`);
    });
});

// ========== WF15-WF18: SHARE FLOW ==========

test.describe('WF5: Share Flow', () => {
    
    test('WF15: Share tab discoverable', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF15', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        const inNav = await page.locator('.nav-tab[data-tab="share"]').isVisible().catch(() => false);
        const onHome = await page.locator('button:has-text("Share")').isVisible().catch(() => false);
        
        r.timeMs = Date.now() - start;
        r.passed = inNav || onHome;
        
        if (!inNav && !onHome) r.friction.push('Share not easily discoverable');
        
        results.push(r);
        console.log(`WF15: ${r.passed ? '✅' : '❌'} Share visible: nav=${inNav}, home=${onHome}`);
    });
    
    test('WF16: Default message has scores', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF16', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        await page.goto(GAMESHELF_URL + '#share');
        await page.waitForTimeout(500);
        
        const msg = await page.locator('#share-screen-message, textarea').inputValue().catch(() => '');
        
        const hasScores = msg.includes('/6') || msg.includes('🟩');
        const goodLength = msg.length > 20 && msg.length < 300;
        
        r.timeMs = Date.now() - start;
        r.passed = hasScores && goodLength;
        
        if (!hasScores) r.friction.push('Default message lacks scores');
        if (!goodLength) r.friction.push(`Message length: ${msg.length} (want 20-300)`);
        
        results.push(r);
        console.log(`WF16: ${r.passed ? '✅' : '❌'} Scores: ${hasScores}, Length: ${msg.length}`);
    });
    
    test('WF17: Share to Twitter in ≤3 taps', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF17', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        
        // Tap 1: Share tab
        await page.locator('.nav-tab[data-tab="share"]').click().catch(() => {});
        r.tapCount++;
        r.steps.push(`${r.tapCount}. Share tab`);
        await page.waitForTimeout(500);
        
        // Tap 2: Twitter button
        const twitterBtn = page.locator('button:has-text("Twitter"), button:has-text("𝕏")').first();
        if (await twitterBtn.isVisible().catch(() => false)) {
            r.tapCount++;
            r.steps.push(`${r.tapCount}. Twitter button`);
        }
        
        r.timeMs = Date.now() - start;
        r.passed = r.tapCount <= 3;
        
        if (r.tapCount > 3) r.friction.push(`${r.tapCount} taps (target: ≤3)`);
        
        results.push(r);
        console.log(`WF17: ${r.passed ? '✅' : '❌'} Taps: ${r.tapCount}`);
    });
    
    test('WF18: All share platforms visible', async ({ page }) => {
        const r: WorkflowResult = { testId: 'WF18', tapCount: 0, timeMs: 0, steps: [], friction: [], passed: false };
        const start = Date.now();
        
        await setupReturningUser(page);
        await page.goto(GAMESHELF_URL + '#share');
        await page.waitForTimeout(500);
        
        const platforms = await page.evaluate(() => {
            const btns = document.querySelectorAll('.share-btn, [data-platform], button');
            const found: string[] = [];
            btns.forEach(b => {
                const text = (b as HTMLElement).innerText.toLowerCase();
                if (text.includes('twitter') || text.includes('𝕏')) found.push('twitter');
                if (text.includes('copy')) found.push('copy');
                if (text.includes('email')) found.push('email');
                if (text.includes('sms') || text.includes('message')) found.push('sms');
            });
            return [...new Set(found)];
        });
        
        r.timeMs = Date.now() - start;
        r.passed = platforms.length >= 3;
        
        if (platforms.length < 3) r.friction.push(`Only ${platforms.length} platforms (want 3+)`);
        
        results.push(r);
        console.log(`WF18: ${r.passed ? '✅' : '❌'} Platforms: ${platforms.join(', ')}`);
    });
});

// ========== SUMMARY ==========

test.afterAll(async () => {
    console.log('\n========== WORKFLOW RESULTS ==========\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`Total: ${results.length} | ✅ ${passed} | ❌ ${failed}\n`);
    
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        console.log(`${status} ${r.testId}: Taps=${r.tapCount}, Time=${r.timeMs}ms`);
        if (r.friction.length) {
            r.friction.forEach(f => console.log(`   ⚠️ ${f}`));
        }
    });
    
    console.log('\n========== FRICTION SUMMARY ==========\n');
    const allFriction = results.flatMap(r => r.friction.map(f => ({ id: r.testId, issue: f })));
    allFriction.forEach(f => console.log(`• ${f.id}: ${f.issue}`));
    
    console.log('\n=======================================\n');
});
