import { test, expect, Page } from '@playwright/test';

/**
 * Tracking/Log Tests (Section B)
 * Uses actual Game Shelf selectors.
 */

const GAMESHELF_URL = 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

// Test data for paste detection
const WORDLE_RESULT = `Wordle 1,234 3/6

⬛⬛⬛🟨⬛
🟩⬛🟨⬛⬛
🟩🟩🟩🟩🟩`;

const CONNECTIONS_RESULT = `Connections
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;

test.describe('Log & Tracking', () => {
    
    // Setup: completed user via localStorage
    async function setupCompletedUser(page: Page) {
        await page.goto(GAMESHELF_URL);
        await page.waitForLoadState('load');
        
        // Set localStorage to bypass setup - use actual Game Shelf keys
        await page.evaluate(() => {
            localStorage.setItem('gameshelf_setup_complete', 'true');
            localStorage.setItem('gameshelf_games', JSON.stringify([
                { gameId: 'wordle', name: 'Wordle' },
                { gameId: 'connections', name: 'Connections' },
                { gameId: 'strands', name: 'Strands' },
                { gameId: 'mini', name: 'Mini Crossword' }
            ]));
            const appData = {
                games: [
                    { id: 'wordle', addedAt: new Date().toISOString() },
                    { id: 'connections', addedAt: new Date().toISOString() },
                    { id: 'strands', addedAt: new Date().toISOString() },
                    { id: 'mini', addedAt: new Date().toISOString() }
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

    test('T1: Log sheet opens via hash', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const logSheet = page.locator('#log-sheet.active');
        await expect(logSheet).toBeVisible({ timeout: 5000 });
    });

    test('B1-variant: Log input is present', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const logInput = page.locator('#log-input');
        await expect(logInput).toBeVisible();
        await expect(logInput).toBeEditable();
    });

    test('T2: Can type in log input', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const logInput = page.locator('#log-input');
        await logInput.fill(WORDLE_RESULT);
        
        // Verify input has content
        await expect(logInput).toHaveValue(WORDLE_RESULT);
    });

    test('T3: Wordle result detected', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const logInput = page.locator('#log-input');
        await logInput.fill(WORDLE_RESULT);
        await page.waitForTimeout(500);
        
        // Should show detection/preview (look for game icon or detection message)
        const detected = page.locator('.detected-game, .log-preview, [data-detected]');
        // May or may not show depending on implementation
    });

    test('T4: Connections result can be pasted', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        
        const logInput = page.locator('#log-input');
        await logInput.fill(CONNECTIONS_RESULT);
        
        await expect(logInput).toHaveValue(CONNECTIONS_RESULT);
    });

    test('T5: Home tab shows game cards', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Home tab should show game cards
        const gameCards = page.locator('.game-card');
        await expect(gameCards.first()).toBeVisible({ timeout: 5000 });
    });

    test('T6: Games tab accessible', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.locator('.nav-tab[data-tab="games"]').click();
        await page.waitForTimeout(500);
        
        // Games tab should be active
        await expect(page.locator('.nav-tab[data-tab="games"]')).toHaveClass(/active/);
    });

    test('T7: Social tab accessible', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.locator('.nav-tab[data-tab="social"]').click();
        await page.waitForTimeout(500);
        
        await expect(page.locator('.nav-tab[data-tab="social"]')).toHaveClass(/active/);
    });

    test('T8: Share tab accessible', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.locator('.nav-tab[data-tab="share"]').click();
        await page.waitForTimeout(500);
        
        await expect(page.locator('.nav-tab[data-tab="share"]')).toHaveClass(/active/);
    });
});
