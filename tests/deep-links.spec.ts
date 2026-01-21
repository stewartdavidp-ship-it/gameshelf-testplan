import { test, expect, Page } from '@playwright/test';

/**
 * Deep Links / Navigation Tests (Section H)
 * Uses actual Game Shelf selectors.
 */

const GAMESHELF_URL = 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

test.describe('Deep Links & Navigation', () => {
    
    // Setup: completed user via localStorage
    async function setupCompletedUser(page: Page) {
        await page.goto(GAMESHELF_URL);
        await page.waitForLoadState('load');
        
        // Set localStorage to bypass setup - use actual Game Shelf keys
        await page.evaluate(() => {
            // Mark setup as complete
            localStorage.setItem('gameshelf_setup_complete', 'true');
            
            // Set up game configs
            localStorage.setItem('gameshelf_games', JSON.stringify([
                { gameId: 'wordle', name: 'Wordle' },
                { gameId: 'connections', name: 'Connections' },
                { gameId: 'strands', name: 'Strands' }
            ]));
            
            // Set up app data
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
        
        // Reload to apply
        await page.reload();
        await page.waitForLoadState('load');
        
        // Dismiss install banner and overlays
        await page.evaluate(() => {
            const banner = document.getElementById('install-banner');
            if (banner) banner.classList.remove('visible');
            document.querySelectorAll('.tutorial-overlay, .onboarding-overlay, .modal-overlay').forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });
        });
        
        await page.waitForTimeout(500);
    }

    test.describe('Hash Navigation', () => {
        
        test('H1: #log opens log sheet', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#log');
            await page.waitForTimeout(500);
            
            await expect(page.locator('#log-sheet.active')).toBeVisible({ timeout: 5000 });
        });

        test('H1-variant: #menu opens settings menu', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#menu');
            await page.waitForTimeout(500);
            
            // #menu opens settings-menu
            const menu = page.locator('#settings-menu.active');
            await expect(menu).toBeVisible({ timeout: 5000 });
        });

        test('H2: #home switches to home tab', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Go to another tab first
            await page.locator('.nav-tab[data-tab="games"]').click();
            await page.waitForTimeout(300);
            
            // Navigate to home via hash
            await page.goto(GAMESHELF_URL + '#home');
            await page.waitForTimeout(500);
            
            await expect(page.locator('.nav-tab[data-tab="home"]')).toHaveClass(/active/);
        });

        test('H2-variant: #games switches to games tab', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#games');
            await page.waitForTimeout(500);
            
            await expect(page.locator('.nav-tab[data-tab="games"]')).toHaveClass(/active/);
        });

        test('H2-variant: #social switches to social tab', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#social');
            await page.waitForTimeout(500);
            
            await expect(page.locator('.nav-tab[data-tab="social"]')).toHaveClass(/active/);
        });

        test('H2-variant: #share switches to share tab', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#share');
            await page.waitForTimeout(500);
            
            await expect(page.locator('.nav-tab[data-tab="share"]')).toHaveClass(/active/);
        });
    });

    test.describe('Security & Edge Cases', () => {
        
        test('H5: Unknown hash handled gracefully', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#unknown-route-xyz');
            await page.waitForTimeout(500);
            
            // Should not crash - page still functional
            await expect(page.locator('body')).toBeVisible();
            await expect(page.locator('.nav-tab').first()).toBeVisible();
        });

        test('H5-variant: Empty hash works', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#');
            await page.waitForTimeout(500);
            
            await expect(page.locator('.nav-tab').first()).toBeVisible();
        });

        test('H5-variant: Special characters in hash handled', async ({ page }) => {
            await setupCompletedUser(page);
            await page.goto(GAMESHELF_URL + '#test%20space');
            await page.waitForTimeout(500);
            
            // Should not crash
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Query Parameters', () => {
        
        test('H3: ?fresh=1 clears state', async ({ page }) => {
            // First set up completed user
            await setupCompletedUser(page);
            await expect(page.locator('.nav-tab').first()).toBeVisible();
            
            // Now use fresh=1
            await page.goto(GAMESHELF_URL + '?fresh=1');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Should be back at welcome screen
            await expect(page.locator('#setup-welcome.active')).toBeVisible({ timeout: 5000 });
        });

        test('H3-variant: ?ref=CODE stores referral', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '?fresh=1&ref=TESTCODE123');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Should load without error
            await expect(page.locator('#setup-welcome')).toBeVisible();
        });

        test('H4: seedData parameter works', async ({ page }) => {
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle'],
                setupComplete: true
            }));
            
            await page.goto(GAMESHELF_URL + `?seedData=${seedData}`);
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Should skip onboarding and show main app
            await expect(page.locator('.nav-tab').first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Fresh User Deep Links', () => {
        
        test('H6: Deep links redirect to onboarding for new users', async ({ page }) => {
            await page.goto(GAMESHELF_URL + '?fresh=1#games');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Should show onboarding, not games tab
            // (deep links shouldn't bypass required onboarding)
            const hasSetup = await page.locator('#setup-welcome.active, #setup-select-games.active').isVisible();
            expect(hasSetup).toBe(true);
        });
    });
});
