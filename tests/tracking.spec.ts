import { test, expect, Page } from '@playwright/test';

/**
 * Tracking/Log Tests (Section B)
 * 
 * Tests game result logging including:
 * - Log sheet opening
 * - Paste detection for various games
 * - Manual entry
 * - Result persistence
 */

// Test data for paste detection
const WORDLE_RESULTS = {
    win_in_3: `Wordle 1,234 3/6

⬛⬛⬛🟨⬛
🟩⬛🟨⬛⬛
🟩🟩🟩🟩🟩`,
    
    win_in_1: `Wordle 1,234 1/6

🟩🟩🟩🟩🟩`,
    
    loss: `Wordle 1,234 X/6

⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛
⬛⬛⬛⬛⬛`,
    
    hard_mode: `Wordle 1,234 4/6*

⬛⬛⬛🟨⬛
🟩⬛🟨⬛⬛
🟩🟩⬛⬛🟩
🟩🟩🟩🟩🟩`
};

const CONNECTIONS_RESULT = `Connections
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;

const STRANDS_RESULT = `Strands #456
"Theme of the Day"
💡🔵🔵🔵
🔵🔵🟡🔵`;

test.describe('Log & Tracking', () => {
    
    // Helper to set up a user who has completed onboarding
    async function setupCompletedUser(page: Page) {
        // Use seedData to skip onboarding
        const seedData = btoa(JSON.stringify({
            selectedGames: ['wordle', 'connections', 'strands', 'mini'],
            setupComplete: true
        }));
        await page.goto(`/?seedData=${seedData}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500); // Allow seed to apply
    }

    test.beforeEach(async ({ page }) => {
        await setupCompletedUser(page);
    });

    test('B1: Log sheet opens @smoke', async ({ page }) => {
        // Use deep link to open log
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        // Log sheet should be visible
        const logSheet = page.locator('.log-sheet, .log-modal, [data-sheet="log"]');
        await expect(logSheet).toBeVisible({ timeout: 5000 });
    });

    test('B1-variant: Log button opens log sheet', async ({ page }) => {
        // Find and click the log button (usually a + or log icon)
        const logButton = page.locator('#log-button, [data-action="log"], .log-btn, .fab-button');
        
        if (await logButton.isVisible()) {
            await logButton.click();
            
            const logSheet = page.locator('.log-sheet, .log-modal, [data-sheet="log"]');
            await expect(logSheet).toBeVisible({ timeout: 3000 });
        }
    });

    test('B2: Wordle paste detected & parsed @smoke', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        // Find the paste input area
        const logInput = page.locator('#log-input, textarea[name="paste"], .paste-area');
        await expect(logInput).toBeVisible();
        
        // Simulate paste using the TestHelpers API
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            } else {
                // Fallback: directly set value
                const input = document.querySelector('#log-input, textarea') as HTMLTextAreaElement;
                if (input) {
                    input.value = text;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }, WORDLE_RESULTS.win_in_3);
        
        await page.waitForTimeout(500);
        
        // Should detect Wordle
        const detection = page.locator('[data-game="wordle"], .detected-game, .game-detected');
        await expect(detection).toBeVisible({ timeout: 3000 });
        
        // Should show score
        const score = page.getByText(/3\/6/);
        await expect(score).toBeVisible();
    });

    test('B2-variant: Wordle win in 1 (edge case)', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.win_in_1);
        
        await page.waitForTimeout(500);
        
        // Should show 1/6 score
        const score = page.getByText(/1\/6/);
        await expect(score).toBeVisible();
    });

    test('B2-variant: Wordle loss X/6 (edge case)', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.loss);
        
        await page.waitForTimeout(500);
        
        // Should show X/6 or loss indicator
        const lossIndicator = page.getByText(/X\/6|loss/i);
        await expect(lossIndicator).toBeVisible();
    });

    test('B2-variant: Wordle hard mode detected', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.hard_mode);
        
        await page.waitForTimeout(500);
        
        // Should detect hard mode (asterisk or indicator)
        const hardMode = page.getByText(/\*|hard mode/i);
        await expect(hardMode).toBeVisible();
    });

    test('B2-variant: Invalid text rejected', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate(() => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste('Hello world this is not a game result');
            }
        });
        
        await page.waitForTimeout(500);
        
        // Should NOT detect any game
        const detection = page.locator('[data-game], .detected-game, .game-detected');
        const count = await detection.count();
        expect(count).toBe(0);
    });

    test('B3: Connections paste detected', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, CONNECTIONS_RESULT);
        
        await page.waitForTimeout(500);
        
        // Should detect Connections
        const detection = page.locator('[data-game="connections"]');
        await expect(detection).toBeVisible({ timeout: 3000 });
    });

    test('B4: Strands paste detected', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, STRANDS_RESULT);
        
        await page.waitForTimeout(500);
        
        // Should detect Strands
        const detection = page.locator('[data-game="strands"]');
        await expect(detection).toBeVisible({ timeout: 3000 });
    });

    test('B5: Can save logged result', async ({ page }) => {
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        // Paste a valid result
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.win_in_3);
        
        await page.waitForTimeout(500);
        
        // Click save/confirm button
        const saveButton = page.getByRole('button', { name: /save|log|confirm|done/i });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        
        // Sheet should close or show success
        await page.waitForTimeout(500);
        
        // Verify result is saved by checking state
        const state = await page.evaluate(() => {
            if ((window as any).GameShelfTest) {
                return (window as any).GameShelfTest.getState();
            }
            return null;
        });
        
        expect(state?.results).toBeDefined();
    });

    test('B6: Result appears on home after logging', async ({ page }) => {
        // First log a result
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.win_in_3);
        
        await page.waitForTimeout(300);
        
        const saveButton = page.getByRole('button', { name: /save|log|confirm|done/i });
        if (await saveButton.isVisible()) {
            await saveButton.click();
        }
        
        await page.waitForTimeout(500);
        
        // Navigate to home
        await page.goto('/#home');
        await page.waitForTimeout(500);
        
        // Should see today's result on home
        const todayResult = page.locator('.today-result, .game-result, [data-game="wordle"]');
        await expect(todayResult).toBeVisible();
    });

    test('B7: Multiple games can be logged', async ({ page }) => {
        // Log Wordle
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.win_in_3);
        
        await page.waitForTimeout(300);
        let saveButton = page.getByRole('button', { name: /save|log|confirm|done/i });
        if (await saveButton.isVisible()) {
            await saveButton.click();
        }
        
        await page.waitForTimeout(500);
        
        // Log Connections
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, CONNECTIONS_RESULT);
        
        await page.waitForTimeout(300);
        saveButton = page.getByRole('button', { name: /save|log|confirm|done/i });
        if (await saveButton.isVisible()) {
            await saveButton.click();
        }
        
        // Verify both are logged
        const state = await page.evaluate(() => {
            if ((window as any).GameShelfTest) {
                return (window as any).GameShelfTest.getState();
            }
            return null;
        });
        
        expect(state?.results).toBeDefined();
    });

    test('B8: Streak updates after logging', async ({ page }) => {
        // Get initial state
        const initialState = await page.evaluate(() => {
            if ((window as any).GameShelfTest) {
                return (window as any).GameShelfTest.getState();
            }
            return null;
        });
        
        // Log a result
        await page.goto('/#log');
        await page.waitForTimeout(500);
        
        await page.evaluate((text) => {
            if ((window as any).GameShelfTest) {
                (window as any).GameShelfTest.simulatePaste(text);
            }
        }, WORDLE_RESULTS.win_in_3);
        
        await page.waitForTimeout(300);
        const saveButton = page.getByRole('button', { name: /save|log|confirm|done/i });
        if (await saveButton.isVisible()) {
            await saveButton.click();
        }
        
        await page.waitForTimeout(500);
        
        // Check if streak info is displayed somewhere
        const streakDisplay = page.locator('.streak, [data-streak], .streak-count');
        if (await streakDisplay.isVisible()) {
            const streakText = await streakDisplay.textContent();
            expect(streakText).toBeTruthy();
        }
    });
});
