import { test, expect, Page } from '@playwright/test';

/**
 * Smoke Tests - Critical Path
 * 
 * Quick verification of core functionality.
 * Uses actual Game Shelf selectors.
 */

const GAMESHELF_URL = 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

test.describe('Smoke Tests @smoke', () => {

    test.describe('Fresh User Journey', () => {
        
        test('SM1: Welcome screen shows for new user', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '?fresh=1');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Welcome screen should be visible
            const welcomeScreen = page.locator('#setup-welcome.active');
            await expect(welcomeScreen).toBeVisible({ timeout: 10000 });
            
            // Should have "Let's Go" button
            await expect(page.getByText("Let's Go →")).toBeVisible();
        });
        
        test('SM2: Complete onboarding flow', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '?fresh=1');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // 1. Click Let's Go
            await page.getByText("Let's Go →").click();
            await page.waitForTimeout(500);
            
            // 2. Select games screen should appear
            const gameScreen = page.locator('#setup-select-games.active');
            await expect(gameScreen).toBeVisible({ timeout: 5000 });
            
            // 3. Select 3 games
            const gameButtons = page.locator('.setup-game-btn');
            await gameButtons.nth(0).click();
            await page.waitForTimeout(200);
            await gameButtons.nth(1).click();
            await page.waitForTimeout(200);
            await gameButtons.nth(2).click();
            await page.waitForTimeout(300);
            
            // 4. Navigate through setup screens
            for (let i = 0; i < 15; i++) {
                if (await page.locator('.nav-tab').first().isVisible().catch(() => false)) break;
                
                const nextBtn = page.locator('#setup-btn-games-next:not([disabled])');
                const primaryBtn = page.locator('.setup-btn-primary:visible').first();
                const skipBtn = page.locator('.setup-btn-ghost:visible').first();
                const startBtn = page.getByText(/Start Using Game Shelf|Open Game Shelf/i);
                
                if (await nextBtn.isVisible().catch(() => false)) {
                    await nextBtn.click();
                } else if (await startBtn.isVisible().catch(() => false)) {
                    await startBtn.click();
                } else if (await skipBtn.isVisible().catch(() => false)) {
                    await skipBtn.click();
                } else if (await primaryBtn.isVisible().catch(() => false)) {
                    await primaryBtn.click();
                }
                
                await page.waitForTimeout(500);
            }
            
            // Main nav should be visible
            await expect(page.locator('.nav-tab').first()).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Existing User Flows', () => {
        
        // Setup: completed user via localStorage
        test.beforeEach(async ({ page }) => {
            await page.goto(GAMESHELF_URL);
            await page.waitForLoadState('load');
            
            // Set localStorage to bypass setup - use actual Game Shelf keys
            await page.evaluate(() => {
                localStorage.setItem('gameshelf_setup_complete', 'true');
                localStorage.setItem('gameshelf_games', JSON.stringify([
                    { gameId: 'wordle', name: 'Wordle' },
                    { gameId: 'connections', name: 'Connections' },
                    { gameId: 'strands', name: 'Strands' }
                ]));
                const appData = {
                    games: [
                        { id: 'wordle', addedAt: new Date().toISOString() },
                        { id: 'connections', addedAt: new Date().toISOString() },
                        { id: 'strands', addedAt: new Date().toISOString() }
                    ],
                    stats: {},
                    history: {},
                    wallet: { tokens: 100, coins: 0 },
                    settings: {}
                };
                localStorage.setItem('gameShelfData', JSON.stringify(appData));
            });
            
            await page.reload();
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
        });

        test('SM3: Home tab displays correctly', async ({ page }) => {
            // Home tab should be active
            const homeTab = page.locator('.nav-tab[data-tab="home"]');
            await expect(homeTab).toBeVisible({ timeout: 5000 });
            await expect(homeTab).toHaveClass(/active/);
        });

        test('SM4: Log sheet opens', async ({ page }) => {
            // Open log sheet via URL
            await page.goto(GAMESHELF_URL + '#log');
            await page.waitForTimeout(500);
            
            // Log sheet should be visible
            const logSheet = page.locator('#log-sheet.active');
            await expect(logSheet).toBeVisible({ timeout: 5000 });
            
            // Input should be present
            const logInput = page.locator('#log-input');
            await expect(logInput).toBeVisible();
        });

        test('SM5: Tab navigation works', async ({ page }) => {
            const tabs = ['home', 'games', 'social', 'share'];
            
            for (const tab of tabs) {
                await page.locator(`.nav-tab[data-tab="${tab}"]`).click();
                await page.waitForTimeout(300);
                
                // Tab should be active
                const activeTab = page.locator(`.nav-tab[data-tab="${tab}"]`);
                await expect(activeTab).toHaveClass(/active/);
            }
        });

        test('SM9: Menu opens via hash', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '#menu');
            await page.waitForTimeout(500);
            
            // #menu opens settings-menu
            const menu = page.locator('#settings-menu.active');
            await expect(menu).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Error Handling', () => {
        
        test('SM6: Invalid hash handled gracefully', async ({ page }) => {
            // Should not crash with invalid hash
            await page.goto(GAMESHELF_URL + '#invalid-route-12345');
            await page.waitForTimeout(1000);
            
            // Page should still load (no crash)
            const body = page.locator('body');
            await expect(body).toBeVisible();
            
            // Should either show setup or main app
            const hasContent = await page.locator('#setup-welcome, .nav-tab').first().isVisible();
            expect(hasContent).toBe(true);
        });
    });

    test.describe('Mobile Viewport', () => {
        
        test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE
        
        test('SM8: App loads on mobile viewport', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '?fresh=1');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Should show welcome or main app
            const hasContent = await page.locator('#setup-welcome, .nav-tab').first().isVisible();
            expect(hasContent).toBe(true);
        });
    });
});
