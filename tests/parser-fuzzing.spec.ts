/**
 * Parser Fuzzing Tests
 * 
 * Tests game parsers with hundreds of edge cases, variations, and malformed inputs.
 * Goal: Find parsing bugs that could cause false positives, false negatives, or crashes.
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

async function setupForParsing(page: Page) {
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
}

// Helper to test parsing
async function parseText(page: Page, text: string) {
    return await page.evaluate((shareText) => {
        // Try GameShelfTest.parseText first (new API), then fallback to parseShareText
        if (typeof (window as any).GameShelfTest?.parseText === 'function') {
            return (window as any).GameShelfTest.parseText(shareText);
        }
        if (typeof (window as any).parseShareText === 'function') {
            return (window as any).parseShareText(shareText);
        }
        return null;
    }, text);
}

test.describe('Wordle Parser Fuzzing', () => {
    
    test.describe('Valid Wordle Formats', () => {
        const validWordleTexts = [
            // Standard formats
            { text: 'Wordle 1,234 3/6', guesses: '3', shouldWin: true },
            { text: 'Wordle 1234 3/6', guesses: '3', shouldWin: true },
            { text: 'Wordle 123 4/6', guesses: '4', shouldWin: true },
            { text: 'Wordle 12,345 1/6', guesses: '1', shouldWin: true },
            { text: 'Wordle 1 6/6', guesses: '6', shouldWin: true },
            { text: 'Wordle 1,234 X/6', guesses: 'X', shouldWin: false },
            
            // With grid
            { text: `Wordle 1,234 3/6

⬛⬛🟨⬛⬛
⬛🟩🟩🟨⬛
🟩🟩🟩🟩🟩`, guesses: '3', shouldWin: true },
            
            // Hard mode
            { text: 'Wordle 1,234 4/6*', guesses: '4', shouldWin: true },
            
            // With extra whitespace
            { text: '  Wordle 1,234 3/6  ', guesses: '3', shouldWin: true },
            { text: 'Wordle  1,234  3/6', guesses: '3', shouldWin: true },
            
            // Case variations
            { text: 'WORDLE 1,234 3/6', guesses: '3', shouldWin: true },
            { text: 'wordle 1,234 3/6', guesses: '3', shouldWin: true },
            
            // With newlines before/after
            { text: '\nWordle 1,234 3/6\n', guesses: '3', shouldWin: true },
            { text: '\n\nWordle 1,234 3/6\n\n', guesses: '3', shouldWin: true },
        ];
        
        for (const testCase of validWordleTexts) {
            test(`Valid: "${testCase.text.slice(0, 30)}..."`, async ({ page }) => {
                await setupForParsing(page);
                const result = await parseText(page, testCase.text);
                
                expect(result).not.toBeNull();
                expect(result?.gameId).toBe('wordle');
                expect(result?.won).toBe(testCase.shouldWin);
            });
        }
    });
    
    test.describe('Invalid Wordle Formats (Should NOT Parse)', () => {
        const invalidWordleTexts = [
            'Wordle 3/6',           // Missing puzzle number
            'Wordle 1234',          // Missing score
            '1234 3/6',             // Missing "Wordle"
            'Wordle 1,234 7/6',     // Invalid score (7)
            'Wordle 1,234 0/6',     // Invalid score (0)
            'Wordle 1,234 3/5',     // Wrong denominator
            'Wordle abc 3/6',       // Non-numeric puzzle
            'WordleX 1,234 3/6',    // Extra character
            'Word 1,234 3/6',       // Truncated
            'Worldle 1,234 3/6',    // Misspelled
            '',                     // Empty
            '   ',                  // Whitespace only
        ];
        
        for (const text of invalidWordleTexts) {
            test(`Invalid: "${text || '(empty)'}"`, async ({ page }) => {
                await setupForParsing(page);
                const result = await parseText(page, text);
                
                // Should either be null or not match wordle
                expect(result?.gameId !== 'wordle' || result === null).toBe(true);
            });
        }
    });
    
    test.describe('Wordle Score Calculation', () => {
        const scoreTests = [
            { text: 'Wordle 1,234 1/6', expectedScore: 30 },  // (7-1)*5 = 30
            { text: 'Wordle 1,234 2/6', expectedScore: 25 },  // (7-2)*5 = 25
            { text: 'Wordle 1,234 3/6', expectedScore: 20 },  // (7-3)*5 = 20
            { text: 'Wordle 1,234 4/6', expectedScore: 15 },  // (7-4)*5 = 15
            { text: 'Wordle 1,234 5/6', expectedScore: 10 },  // (7-5)*5 = 10
            { text: 'Wordle 1,234 6/6', expectedScore: 5 },   // (7-6)*5 = 5
            { text: 'Wordle 1,234 X/6', expectedScore: 0 },   // Lost = 0
        ];
        
        for (const testCase of scoreTests) {
            test(`Score: ${testCase.text} → ${testCase.expectedScore}`, async ({ page }) => {
                await setupForParsing(page);
                const result = await parseText(page, testCase.text);
                
                expect(result?.numericScore).toBe(testCase.expectedScore);
            });
        }
    });
    
    test.describe('Wordle Puzzle Number Extraction', () => {
        const puzzleTests = [
            { text: 'Wordle 1 3/6', expectedNum: 1 },
            { text: 'Wordle 123 3/6', expectedNum: 123 },
            { text: 'Wordle 1,234 3/6', expectedNum: 1234 },
            { text: 'Wordle 12,345 3/6', expectedNum: 12345 },
            { text: 'Wordle 999999 3/6', expectedNum: 999999 },
        ];
        
        for (const testCase of puzzleTests) {
            test(`Puzzle #: ${testCase.text} → ${testCase.expectedNum}`, async ({ page }) => {
                await setupForParsing(page);
                const result = await parseText(page, testCase.text);
                
                expect(result?.puzzleNumber).toBe(testCase.expectedNum);
            });
        }
    });
});

test.describe('Connections Parser Fuzzing', () => {
    
    test.describe('Valid Connections Formats', () => {
        test('Perfect game (4 rows, no mistakes)', async ({ page }) => {
            await setupForParsing(page);
            const text = `Connections 
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;
            
            const result = await parseText(page, text);
            
            expect(result?.gameId).toBe('connections');
            expect(result?.puzzleNumber).toBe(567);
            expect(result?.won).toBe(true);
            expect(result?.meta?.perfect).toBe(true);
        });
        
        test('Solved with mistakes', async ({ page }) => {
            await setupForParsing(page);
            const text = `Connections 
Puzzle #567
🟨🟩🟨🟨
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;
            
            const result = await parseText(page, text);
            
            expect(result?.gameId).toBe('connections');
            expect(result?.won).toBe(true);
            expect(result?.meta?.perfect).toBe(false);
            expect(result?.meta?.mistakes).toBeGreaterThan(0);
        });
        
        test('Lost game (incomplete)', async ({ page }) => {
            await setupForParsing(page);
            const text = `Connections 
Puzzle #567
🟨🟩🟨🟨
🟨🟩🟩🟨
🟨🟩🟨🟩
🟨🟨🟨🟨`;
            
            const result = await parseText(page, text);
            
            expect(result?.gameId).toBe('connections');
            // Only 1 complete row, so not fully solved
        });
        
        test('Different puzzle number formats', async ({ page }) => {
            await setupForParsing(page);
            
            const formats = [
                'Connections\nPuzzle #123\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
                'Connections Puzzle #123\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
                'Connections\nPuzzle 123\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
            ];
            
            for (const text of formats) {
                const result = await parseText(page, text);
                expect(result?.gameId).toBe('connections');
                expect(result?.puzzleNumber).toBe(123);
            }
        });
    });
    
    test.describe('Connections Edge Cases', () => {
        test('Extra whitespace in grid lines', async ({ page }) => {
            await setupForParsing(page);
            const text = `Connections 
Puzzle #567
🟨🟨🟨🟨  
  🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪  `;
            
            const result = await parseText(page, text);
            expect(result?.gameId).toBe('connections');
        });
        
        test('Mixed case "connections"', async ({ page }) => {
            await setupForParsing(page);
            const text = `CONNECTIONS 
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;
            
            const result = await parseText(page, text);
            expect(result?.gameId).toBe('connections');
        });
        
        test('Color order variations', async ({ page }) => {
            await setupForParsing(page);
            // Player solved in different order than standard
            const text = `Connections 
Puzzle #567
🟪🟪🟪🟪
🟦🟦🟦🟦
🟩🟩🟩🟩
🟨🟨🟨🟨`;
            
            const result = await parseText(page, text);
            expect(result?.gameId).toBe('connections');
            expect(result?.won).toBe(true);
        });
    });
});

test.describe('Strands Parser Fuzzing', () => {
    
    test.describe('Valid Strands Formats', () => {
        test('Perfect (no hints)', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands #123
🟡🔵🔵
🔵🔵🔵`;
            
            const result = await parseText(page, text);
            
            expect(result?.gameId).toBe('strands');
            expect(result?.puzzleNumber).toBe(123);
            expect(result?.meta?.hints).toBe(0);
        });
        
        test('With hints', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands #123
💡🔵🔵
🟡💡🔵
🔵🔵💡`;
            
            const result = await parseText(page, text);
            
            expect(result?.gameId).toBe('strands');
            expect(result?.meta?.hints).toBe(3);
        });
        
        test('Puzzle number without #', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands 456
🟡🔵🔵`;
            
            const result = await parseText(page, text);
            expect(result?.gameId).toBe('strands');
            expect(result?.puzzleNumber).toBe(456);
        });
    });
    
    test.describe('Strands Score Calculation', () => {
        test('Perfect score (0 hints)', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands #123\n🟡🔵🔵\n🔵🔵🔵`;
            
            const result = await parseText(page, text);
            expect(result?.numericScore).toBe(30); // Perfect
        });
        
        test('Score with 1 hint', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands #123\n💡🔵🔵\n🟡🔵🔵`;
            
            const result = await parseText(page, text);
            expect(result?.meta?.hints).toBe(1);
            expect(result?.numericScore).toBeLessThan(30);
        });
        
        test('Score with many hints', async ({ page }) => {
            await setupForParsing(page);
            const text = `Strands #123\n💡💡💡\n💡💡🟡`;
            
            const result = await parseText(page, text);
            expect(result?.meta?.hints).toBe(5);
            // Should have minimum score floor
            expect(result?.numericScore).toBeGreaterThanOrEqual(5);
        });
    });
});

test.describe('Mini Crossword Parser Fuzzing', () => {
    
    test.describe('Valid Mini Formats', () => {
        const validMiniTexts = [
            { text: 'I solved the 1/17/2026 New York Times Mini Crossword in 0:45!', mins: 0, secs: 45 },
            { text: 'I solved the 1/17/2026 New York Times Mini Crossword in 1:23!', mins: 1, secs: 23 },
            { text: 'I solved the 1/17/2026 New York Times Mini Crossword in 10:05!', mins: 10, secs: 5 },
            { text: 'Mini Crossword 2:30', mins: 2, secs: 30 },
            { text: '0:15', mins: 0, secs: 15 },  // Just time might work
        ];
        
        for (let i = 0; i < validMiniTexts.length; i++) {
            const testCase = validMiniTexts[i];
            test(`Parse Mini ${i + 1}: ${testCase.mins}:${String(testCase.secs).padStart(2, '0')} time`, async ({ page }) => {
                await setupForParsing(page);
                const result = await parseText(page, testCase.text);
                
                if (result?.gameId === 'mini') {
                    expect(result.meta?.seconds).toBe(testCase.mins * 60 + testCase.secs);
                }
            });
        }
    });
    
    test.describe('Mini Score Calculation', () => {
        test('Very fast time (under 30s) gets max score', async ({ page }) => {
            await setupForParsing(page);
            const text = 'I solved the Mini Crossword in 0:15!';
            
            const result = await parseText(page, text);
            if (result?.gameId === 'mini') {
                // 15 seconds = very high score
                expect(result.numericScore).toBeGreaterThan(30);
            }
        });
        
        test('Slow time gets minimum score', async ({ page }) => {
            await setupForParsing(page);
            const text = 'I solved the Mini Crossword in 15:00!';
            
            const result = await parseText(page, text);
            if (result?.gameId === 'mini') {
                // 15 minutes = should hit floor
                expect(result.numericScore).toBeGreaterThanOrEqual(5);
            }
        });
    });
});

test.describe('Cross-Game Parser Conflicts', () => {
    
    test('Text with multiple game patterns', async ({ page }) => {
        await setupForParsing(page);
        
        // Text that contains both Wordle and Connections patterns
        const text = `My daily puzzles:
Wordle 1,234 3/6
⬛🟩🟨⬛⬛
⬛🟩🟩🟨⬛
🟩🟩🟩🟩🟩

Connections Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`;
        
        const result = await parseText(page, text);
        
        // Should match first game (Wordle)
        expect(result?.gameId).toBe('wordle');
        
        // Test parseMultipleGames if it exists
        const multiResults = await page.evaluate((shareText) => {
            if (typeof (window as any).parseMultipleGames === 'function') {
                return (window as any).parseMultipleGames(shareText);
            }
            return null;
        }, text);
        
        if (multiResults) {
            expect(multiResults.length).toBe(2);
        }
    });
    
    test('Ambiguous patterns dont cause crashes', async ({ page }) => {
        await setupForParsing(page);
        
        const ambiguousTexts = [
            '🟨🟨🟨🟨', // Could be Connections or Wordle colors
            '3/6',       // Score without game name
            '#123',      // Puzzle number without game
            '💡💡💡',    // Strands hints without context
        ];
        
        for (const text of ambiguousTexts) {
            // Should not throw
            const result = await parseText(page, text);
            // May or may not parse, but shouldn't crash
            expect(typeof result === 'object' || result === null).toBe(true);
        }
    });
});

test.describe('Malformed Input Handling', () => {
    
    test('Extremely long input', async ({ page }) => {
        await setupForParsing(page);
        
        const longText = 'Wordle 1,234 3/6\n' + '⬛'.repeat(10000);
        
        // Should not hang or crash
        const result = await parseText(page, longText);
        expect(result?.gameId).toBe('wordle');
    });
    
    test('Unicode edge cases', async ({ page }) => {
        await setupForParsing(page);
        
        const unicodeTexts = [
            'Wordle 1,234 3/6 🎉🎊✨',  // Celebration emojis
            'Wordle 1,234 3/6 你好',     // Chinese characters
            'Wordle 1,234 3/6\u200B',    // Zero-width space
            'Wordle\u00A01,234\u00A03/6', // Non-breaking spaces
        ];
        
        for (const text of unicodeTexts) {
            const result = await parseText(page, text);
            expect(result?.gameId).toBe('wordle');
        }
    });
    
    test('HTML/script injection attempts', async ({ page }) => {
        await setupForParsing(page);
        
        const injectionTexts = [
            'Wordle 1,234 3/6<script>alert("xss")</script>',
            'Wordle 1,234 3/6<img onerror="alert(1)">',
            'Wordle 1,234 3/6"; DROP TABLE games;--',
        ];
        
        for (const text of injectionTexts) {
            const result = await parseText(page, text);
            // Should parse the game, treating rest as noise
            expect(result?.gameId).toBe('wordle');
        }
    });
    
    test('Null and undefined handling', async ({ page }) => {
        await setupForParsing(page);
        
        const nullResult = await page.evaluate(() => {
            if (typeof (window as any).parseShareText === 'function') {
                try {
                    (window as any).parseShareText(null);
                    (window as any).parseShareText(undefined);
                    return 'no error';
                } catch (e) {
                    return 'error: ' + (e as Error).message;
                }
            }
            return 'function not found';
        });
        
        expect(nullResult).toBe('no error');
    });
    
    test('Number type input', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate(() => {
            if (typeof (window as any).parseShareText === 'function') {
                try {
                    return (window as any).parseShareText(12345);
                } catch (e) {
                    return 'error';
                }
            }
            return null;
        });
        
        // Should return null (not a string) rather than crash
        expect(result === null || result === 'error').toBe(true);
    });
});

test.describe('Parser Performance', () => {
    
    test('Parse 100 texts in under 1 second', async ({ page }) => {
        await setupForParsing(page);
        
        const startTime = Date.now();
        
        const results = await page.evaluate(() => {
            const texts = [
                'Wordle 1,234 3/6',
                'Connections\nPuzzle #123\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
                'Strands #456\n🟡🔵🔵',
            ];
            
            const parsed = [];
            for (let i = 0; i < 100; i++) {
                const text = texts[i % texts.length];
                if (typeof (window as any).parseShareText === 'function') {
                    parsed.push((window as any).parseShareText(text));
                }
            }
            return parsed.length;
        });
        
        const elapsed = Date.now() - startTime;
        
        expect(results).toBe(100);
        expect(elapsed).toBeLessThan(1000);
    });
});

test.describe('Real-World Share Text Variations', () => {
    
    test('Wordle with Twitter formatting', async ({ page }) => {
        await setupForParsing(page);
        
        // Sometimes people add hashtags
        const text = `Wordle 1,234 3/6

⬛⬛🟨⬛⬛
⬛🟩🟩🟨⬛
🟩🟩🟩🟩🟩

#Wordle #NYT`;
        
        const result = await parseText(page, text);
        expect(result?.gameId).toBe('wordle');
    });
    
    test('Connections with link', async ({ page }) => {
        await setupForParsing(page);
        
        const text = `Connections 
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪
https://www.nytimes.com/games/connections`;
        
        const result = await parseText(page, text);
        expect(result?.gameId).toBe('connections');
    });
    
    test('Share text copied from mobile (with different line endings)', async ({ page }) => {
        await setupForParsing(page);
        
        // Windows line endings
        const windowsText = 'Wordle 1,234 3/6\r\n\r\n⬛⬛🟨⬛⬛\r\n⬛🟩🟩🟨⬛\r\n🟩🟩🟩🟩🟩';
        
        const result = await parseText(page, windowsText);
        expect(result?.gameId).toBe('wordle');
    });
});
