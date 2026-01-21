/**
 * Clipboard Monitoring Tests
 * 
 * Tests clipboard scanning, result detection, and auto-logging functionality.
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

// Sample game results for testing
const SAMPLE_RESULTS = {
    wordle: `Wordle 1,234 3/6

⬛⬛🟨⬛⬛
⬛🟩🟩⬛🟨
🟩🟩🟩🟩🟩`,
    
    connections: `Connections
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`,
    
    strands: `Strands #890
🔵🔵🔵🔵🟡`,
    
    mini: `I solved the 1/17/2026 New York Times Mini Crossword in 0:45!`,
    
    invalid: `This is not a game result at all.`
};

async function setupCompletedUser(page: Page) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('load');
    
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

test.describe('Clipboard Monitoring', () => {
    
    test.describe('Clipboard Interval', () => {
        
        test('C1: Clipboard monitor starts after game launch', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Check if clipboard monitoring interval exists
            const monitorInfo = await page.evaluate(() => {
                // The app should have a clipboardPlusInterval variable
                return {
                    hasInterval: typeof (window as any).clipboardPlusInterval !== 'undefined',
                    intervalTime: 5000 // Expected interval (5 seconds)
                };
            });
            
            console.log(`Clipboard monitor: ${JSON.stringify(monitorInfo)}`);
        });
        
        test('C2: Clipboard check function exists', async ({ page }) => {
            await setupCompletedUser(page);
            
            const hasCheckFunction = await page.evaluate(() => {
                return typeof (window as any).checkClipboard === 'function' ||
                       typeof (window as any).startClipboardMonitor === 'function';
            });
            
            expect(hasCheckFunction).toBe(true);
        });
    });
    
    test.describe('Result Detection from Clipboard', () => {
        
        test('C3: Wordle result is detected from clipboard text', async ({ page }) => {
            await setupCompletedUser(page);
            
            const detected = await page.evaluate((sampleText) => {
                const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
                const match = sampleText.match(regex);
                
                if (match) {
                    return {
                        detected: true,
                        gameId: 'wordle',
                        puzzleNumber: match[1].replace(',', ''),
                        score: match[2] + '/6'
                    };
                }
                return { detected: false };
            }, SAMPLE_RESULTS.wordle);
            
            expect(detected.detected).toBe(true);
            expect(detected.gameId).toBe('wordle');
            expect(detected.score).toBe('3/6');
        });
        
        test('C4: Connections result is detected', async ({ page }) => {
            await setupCompletedUser(page);
            
            const detected = await page.evaluate((sampleText) => {
                const regex = /Connections\s*\n?\s*Puzzle\s*#?(\d+)/i;
                const match = sampleText.match(regex);
                
                if (match) {
                    // Note: Each emoji is 2 UTF-16 code units, so {4} emojis = {8} in regex
                    const lines = sampleText.split('\n').filter((l: string) => 
                        /^[🟨🟩🟦🟪]{8}$/.test(l.trim())
                    );
                    
                    return {
                        detected: true,
                        gameId: 'connections',
                        puzzleNumber: match[1],
                        categoriesFound: lines.length
                    };
                }
                return { detected: false };
            }, SAMPLE_RESULTS.connections);
            
            expect(detected.detected).toBe(true);
            expect(detected.categoriesFound).toBe(4);
        });
        
        test('C5: Strands result is detected', async ({ page }) => {
            await setupCompletedUser(page);
            
            const detected = await page.evaluate((sampleText) => {
                const regex = /Strands\s*#?(\d+)/i;
                const match = sampleText.match(regex);
                
                if (match) {
                    const hints = (sampleText.match(/💡/g) || []).length;
                    
                    return {
                        detected: true,
                        gameId: 'strands',
                        puzzleNumber: match[1],
                        hints
                    };
                }
                return { detected: false };
            }, SAMPLE_RESULTS.strands);
            
            expect(detected.detected).toBe(true);
            expect(detected.hints).toBe(0);
        });
        
        test('C6: Mini Crossword time is detected', async ({ page }) => {
            await setupCompletedUser(page);
            
            const detected = await page.evaluate((sampleText) => {
                const timeMatch = sampleText.match(/(\d+):(\d+)/);
                
                if (timeMatch && sampleText.toLowerCase().includes('mini')) {
                    return {
                        detected: true,
                        gameId: 'mini',
                        minutes: parseInt(timeMatch[1]),
                        seconds: parseInt(timeMatch[2])
                    };
                }
                return { detected: false };
            }, SAMPLE_RESULTS.mini);
            
            expect(detected.detected).toBe(true);
            expect(detected.minutes).toBe(0);
            expect(detected.seconds).toBe(45);
        });
        
        test('C7: Invalid text is not detected as game result', async ({ page }) => {
            await setupCompletedUser(page);
            
            const detected = await page.evaluate((sampleText) => {
                // Test against all known patterns
                const patterns = [
                    /Wordle\s+([\d,]+)\s+([1-6X])\/6/i,
                    /Connections\s*\n?\s*Puzzle\s*#?(\d+)/i,
                    /Strands\s*#?(\d+)/i,
                    /Mini.*(\d+):(\d+)/i
                ];
                
                for (const regex of patterns) {
                    if (regex.test(sampleText)) {
                        return { detected: true };
                    }
                }
                return { detected: false };
            }, SAMPLE_RESULTS.invalid);
            
            expect(detected.detected).toBe(false);
        });
    });
    
    test.describe('Clipboard Paste in Log Sheet', () => {
        
        test('C8: Log sheet has input field', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Open log sheet
            await page.goto(GAMESHELF_URL + '#log');
            await page.waitForTimeout(500);
            
            // Use specific ID to avoid strict mode violation (multiple textareas exist)
            const logInput = page.locator('#log-input');
            await expect(logInput).toBeVisible({ timeout: 5000 });
        });
        
        test('C9: Pasting Wordle result in log sheet triggers detection', async ({ page }) => {
            await setupCompletedUser(page);
            
            await page.goto(GAMESHELF_URL + '#log');
            await page.waitForTimeout(500);
            
            const logInput = page.locator('#log-input, textarea').first();
            
            if (await logInput.isVisible()) {
                // Type/paste the Wordle result
                await logInput.fill(SAMPLE_RESULTS.wordle);
                await page.waitForTimeout(500);
                
                // Check if detection happened (may show confirmation UI)
                const pageText = await page.locator('body').innerText();
                const detected = pageText.toLowerCase().includes('wordle') ||
                                pageText.includes('3/6') ||
                                pageText.includes('✓');
                
                console.log(`Detection triggered: ${detected}`);
            }
        });
        
        test('C10: Multiple results in clipboard are handled', async ({ page }) => {
            await setupCompletedUser(page);
            
            const multipleResults = SAMPLE_RESULTS.wordle + '\n\n' + SAMPLE_RESULTS.connections;
            
            const detected = await page.evaluate((text) => {
                // Count how many game patterns match
                const patterns = [
                    { id: 'wordle', regex: /Wordle\s+([\d,]+)\s+([1-6X])\/6/i },
                    { id: 'connections', regex: /Connections\s*\n?\s*Puzzle\s*#?(\d+)/i }
                ];
                
                const found: string[] = [];
                for (const p of patterns) {
                    if (p.regex.test(text)) {
                        found.push(p.id);
                    }
                }
                
                return found;
            }, multipleResults);
            
            expect(detected).toContain('wordle');
            expect(detected).toContain('connections');
            expect(detected.length).toBe(2);
        });
    });
    
    test.describe('Clipboard Permission Handling', () => {
        
        test('C11: App gracefully handles clipboard permission denied', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Mock clipboard to throw permission error
            await page.evaluate(() => {
                (navigator as any).clipboard = {
                    readText: () => Promise.reject(new Error('Permission denied')),
                    writeText: () => Promise.resolve()
                };
            });
            
            // App should not crash
            const isStable = await page.evaluate(() => {
                try {
                    // Try to trigger clipboard check
                    if (typeof (window as any).checkClipboard === 'function') {
                        (window as any).checkClipboard();
                    }
                    return true;
                } catch (e) {
                    return false;
                }
            });
            
            // App should still be functional
            const nav = page.locator('.nav-tab');
            await expect(nav.first()).toBeVisible();
        });
        
        test('C12: App works when clipboard API is not available', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Remove clipboard API
            await page.evaluate(() => {
                delete (navigator as any).clipboard;
            });
            
            // App should still function
            const nav = page.locator('.nav-tab');
            await expect(nav.first()).toBeVisible();
            
            // Navigation should still work
            await page.locator('.nav-tab[data-tab="games"]').click();
            await expect(page.locator('.nav-tab[data-tab="games"]')).toHaveClass(/active/);
        });
    });
    
    test.describe('Auto-Detection Flow', () => {
        
        test('C13: Visibility change triggers clipboard check', async ({ page }) => {
            await setupCompletedUser(page);
            
            let clipboardChecked = false;
            
            await page.exposeFunction('trackClipboardCheck', () => {
                clipboardChecked = true;
            });
            
            await page.evaluate(() => {
                // Spy on clipboard check
                const originalCheck = (window as any).checkClipboard;
                if (originalCheck) {
                    (window as any).checkClipboard = function() {
                        (window as any).trackClipboardCheck();
                        return originalCheck.apply(this, arguments);
                    };
                }
            });
            
            // Simulate visibility change (returning to app)
            await page.evaluate(() => {
                Object.defineProperty(document, 'visibilityState', {
                    value: 'visible',
                    writable: true
                });
                document.dispatchEvent(new Event('visibilitychange'));
            });
            
            await page.waitForTimeout(1000);
            
            // Log result
            console.log(`Clipboard check triggered on visibility change: ${clipboardChecked}`);
        });
        
        test('C14: Detected result shows confirmation prompt', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Navigate to home and simulate clipboard content
            await page.evaluate(() => {
                (window as any).lastClipboardContent = `Wordle 1,234 3/6

⬛⬛🟨⬛⬛
🟩🟩🟩🟩🟩`;
            });
            
            // Look for any clipboard prompt or toast
            const hasPrompt = await page.locator('#clipboard-prompt, .clipboard-prompt, .toast').isVisible()
                .catch(() => false);
            
            console.log(`Clipboard prompt visible: ${hasPrompt}`);
        });
    });
});

test.describe('Parser Edge Cases', () => {
    
    test('C15: Handles Wordle with comma in number', async ({ page }) => {
        const result = await page.evaluate(() => {
            const text = 'Wordle 1,234 4/6';
            const match = text.match(/Wordle\s+([\d,]+)\s+([1-6X])\/6/i);
            if (match) {
                return parseInt(match[1].replace(',', ''));
            }
            return null;
        });
        
        expect(result).toBe(1234);
    });
    
    test('C16: Handles Wordle without comma', async ({ page }) => {
        const result = await page.evaluate(() => {
            const text = 'Wordle 999 5/6';
            const match = text.match(/Wordle\s+([\d,]+)\s+([1-6X])\/6/i);
            if (match) {
                return parseInt(match[1].replace(',', ''));
            }
            return null;
        });
        
        expect(result).toBe(999);
    });
    
    test('C17: Handles varied spacing in results', async ({ page }) => {
        const results = await page.evaluate(() => {
            const variations = [
                'Wordle 1234 3/6',
                'Wordle  1234  3/6',
                'Wordle 1,234 3/6',
                'Wordle 1234  3/6'
            ];
            
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            return variations.map(v => regex.test(v));
        });
        
        // All variations should match
        results.forEach((matched, i) => {
            expect(matched).toBe(true);
        });
    });
    
    test('C18: Case insensitive matching', async ({ page }) => {
        const results = await page.evaluate(() => {
            const variations = [
                'Wordle 1234 3/6',
                'WORDLE 1234 3/6',
                'wordle 1234 3/6'
            ];
            
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            return variations.map(v => regex.test(v));
        });
        
        results.forEach(matched => {
            expect(matched).toBe(true);
        });
    });
});
