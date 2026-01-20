import { test, expect, Page } from '@playwright/test';

/**
 * Smoke Tests - Critical Path
 * 
 * Quick health check covering the most important user flows.
 * Run these before every deployment.
 * 
 * Usage: npm run test:smoke
 */

// All smoke tests are tagged with @smoke for filtering
test.describe('Smoke Tests @smoke', () => {

    test.describe('Fresh User Journey', () => {
        
        test('A1: Welcome modal appears', async ({ page }) => {
            await page.goto('/?fresh=1');
            await page.waitForLoadState('networkidle');
            const welcomeModal = page.locator('.welcome-modal, .onboarding-modal');
            await expect(welcomeModal).toBeVisible({ timeout: 10000 });
        });
        
        test('A5: Complete onboarding flow', async ({ page }) => {
            // Start fresh
            await page.goto('/?fresh=1');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
            
            // 1. Welcome modal appears
            const welcomeModal = page.locator('.welcome-modal, .onboarding-modal');
            await expect(welcomeModal).toBeVisible({ timeout: 10000 });
            
            // 2. Click Get Started
            const startBtn = page.getByRole('button', { name: /get started|continue|let's go/i });
            await startBtn.click();
            
            // 3. Select games
            await page.waitForSelector('.game-option, .game-card', { timeout: 5000 });
            const games = page.locator('.game-option, .game-card');
            await games.nth(0).click();
            await games.nth(1).click();
            await games.nth(2).click();
            
            // 4. Continue
            await page.getByRole('button', { name: /continue|done|next/i }).click();
            await page.waitForTimeout(1000);
            
            // 5. Should reach main app
            // Skip tutorial if shown
            const skipBtn = page.getByRole('button', { name: /skip|later/i });
            if (await skipBtn.isVisible().catch(() => false)) {
                await skipBtn.click();
            }
            
            // Verify main app
            await page.waitForTimeout(500);
            const homeContent = page.locator('[data-tab="home"], .home-tab, .main-content');
            await expect(homeContent).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Existing User Flows', () => {
        
        // Setup: completed user
        test.beforeEach(async ({ page }) => {
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle', 'connections', 'strands'],
                setupComplete: true
            }));
            await page.goto(`/?seedData=${seedData}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
        });

        test('B1: Home tab displays correctly', async ({ page }) => {
            await page.goto('/#home');
            await page.waitForTimeout(500);
            
            // Home should show game cards or today's status
            const homeContent = page.locator('.home-content, .game-card, .today-games');
            await expect(homeContent).toBeVisible({ timeout: 5000 });
        });

        test('B2: Log sheet opens and accepts paste', async ({ page }) => {
            await page.goto('/#log');
            await page.waitForTimeout(500);
            
            // Log sheet visible
            const logSheet = page.locator('.log-sheet, .log-modal');
            await expect(logSheet).toBeVisible();
            
            // Paste input exists
            const pasteArea = page.locator('#log-input, textarea, .paste-area');
            await expect(pasteArea).toBeVisible();
        });

        test('H1: Tab navigation works', async ({ page }) => {
            const tabs = ['home', 'games', 'social', 'share'];
            
            for (const tab of tabs) {
                await page.goto(`/#${tab}`);
                await page.waitForTimeout(300);
                
                // Corresponding tab should be active
                const activeTab = page.locator(`[data-tab="${tab}"].active, .nav-tab.active`);
                await expect(activeTab).toBeVisible();
            }
        });

        test('F1: Settings menu opens', async ({ page }) => {
            await page.goto('/#menu');
            await page.waitForTimeout(500);
            
            const menu = page.locator('.settings-menu, .menu-sheet, [data-sheet="menu"]');
            await expect(menu).toBeVisible();
        });

        test('F3: Dark mode toggle works', async ({ page }) => {
            await page.goto('/#settings');
            await page.waitForTimeout(500);
            
            // Find dark mode toggle
            const darkToggle = page.locator('[data-setting="dark-mode"], .dark-mode-toggle, #dark-mode');
            
            if (await darkToggle.isVisible()) {
                // Get initial state
                const initialTheme = await page.evaluate(() => 
                    document.documentElement.dataset.theme || 
                    document.body.classList.contains('dark') ? 'dark' : 'light'
                );
                
                // Toggle
                await darkToggle.click();
                await page.waitForTimeout(300);
                
                // Theme should change
                const newTheme = await page.evaluate(() => 
                    document.documentElement.dataset.theme || 
                    document.body.classList.contains('dark') ? 'dark' : 'light'
                );
                
                expect(newTheme).not.toBe(initialTheme);
            }
        });

        test('Share tab shows preview', async ({ page }) => {
            // First seed some results
            await page.evaluate(() => {
                if ((window as any).GameShelfTest) {
                    (window as any).GameShelfTest.seedTestData({
                        results: {
                            [new Date().toISOString().split('T')[0]]: {
                                wordle: { score: '3/6', won: true }
                            }
                        }
                    });
                }
            });
            
            await page.goto('/#share');
            await page.waitForTimeout(500);
            
            // Share tab should be visible
            const shareContent = page.locator('.share-content, .share-tab, [data-tab="share"]');
            await expect(shareContent).toBeVisible();
        });
    });

    test.describe('Error Handling', () => {
        
        test('App handles invalid URL gracefully', async ({ page }) => {
            await page.goto('/#invalid_route_123');
            await page.waitForLoadState('networkidle');
            
            // Should not crash
            const app = page.locator('.app, body');
            await expect(app).toBeVisible();
        });

        test('App survives localStorage clear mid-session', async ({ page }) => {
            // Setup user
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle'],
                setupComplete: true
            }));
            await page.goto(`/?seedData=${seedData}`);
            await page.waitForTimeout(1500);
            
            // Clear localStorage
            await page.evaluate(() => {
                localStorage.clear();
            });
            
            // Reload
            await page.reload();
            await page.waitForLoadState('networkidle');
            
            // Should show onboarding (not crash)
            const welcomeOrApp = page.locator('.welcome-modal, .onboarding-modal, .app');
            await expect(welcomeOrApp).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Mobile Viewport', () => {
        
        test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE
        
        test('App renders on mobile viewport', async ({ page }) => {
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle'],
                setupComplete: true
            }));
            await page.goto(`/?seedData=${seedData}`);
            await page.waitForTimeout(1500);
            
            // Check bottom nav is visible
            const bottomNav = page.locator('.nav-bar, .bottom-nav, nav');
            await expect(bottomNav).toBeVisible();
        });

        test('Bottom navigation is tappable', async ({ page }) => {
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle'],
                setupComplete: true
            }));
            await page.goto(`/?seedData=${seedData}`);
            await page.waitForTimeout(1500);
            
            // Find nav tabs
            const navTabs = page.locator('.nav-tab, [role="tab"]');
            const count = await navTabs.count();
            
            // Should have multiple tabs
            expect(count).toBeGreaterThan(2);
            
            // Tap second tab
            if (count > 1) {
                await navTabs.nth(1).click();
                await page.waitForTimeout(300);
                
                // Tab should become active
                const activeTab = page.locator('.nav-tab.active, [role="tab"][aria-selected="true"]');
                await expect(activeTab).toBeVisible();
            }
        });
    });
});
