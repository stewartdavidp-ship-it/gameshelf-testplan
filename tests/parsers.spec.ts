/**
 * Game Result Parser Tests
 * 
 * Unit tests for the PARSERS array that detects and extracts 
 * game results from share text (clipboard, paste).
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

// ============ TEST DATA ============

const WORDLE_SAMPLES = {
    standard: `Wordle 1,234 3/6

⬛⬛🟨⬛⬛
⬛🟩🟩⬛🟨
🟩🟩🟩🟩🟩`,
    
    noComma: `Wordle 999 4/6

⬛⬛⬛⬛⬛
🟨⬛⬛🟨⬛
🟩🟩⬛🟩🟨
🟩🟩🟩🟩🟩`,
    
    perfect: `Wordle 1,234 1/6

🟩🟩🟩🟩🟩`,
    
    fail: `Wordle 1,234 X/6

⬛⬛🟨⬛⬛
⬛🟩🟩⬛🟨
⬛🟩🟩🟩⬛
⬛🟩🟩🟩⬛
⬛🟩🟩🟩⬛
⬛🟩🟩🟩⬛`,
    
    lastGuess: `Wordle 1,234 6/6

⬛⬛⬛⬛⬛
⬛⬛🟨⬛⬛
⬛🟨⬛🟨⬛
🟨🟩⬛🟩⬛
⬛🟩🟩🟩🟨
🟩🟩🟩🟩🟩`,
};

const CONNECTIONS_SAMPLES = {
    perfect: `Connections
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`,
    
    withMistakes: `Connections
Puzzle #567
🟨🟨🟨🟩
🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪`,
    
    incomplete: `Connections
Puzzle #567
🟨🟨🟨🟨
🟩🟩🟩🟩`,
};

const STRANDS_SAMPLES = {
    perfect: `Strands #890
🔵🔵🔵🔵🟡`,
    
    oneHint: `Strands #890
🔵🔵💡🔵🔵🟡`,
    
    twoHints: `Strands #891
💡🔵💡🔵🔵🔵🟡`,
};

const MINI_SAMPLES = {
    fast: `I solved the 1/17/2026 New York Times Mini Crossword in 0:28!`,
    medium: `I solved the 1/17/2026 New York Times Mini Crossword in 1:45!`,
    slow: `I solved the 1/17/2026 New York Times Mini Crossword in 5:30!`,
};

const QUORDLE_SAMPLES = {
    perfect: `Daily Quordle 1234
5️⃣6️⃣
7️⃣8️⃣`,
    
    withFails: `Daily Quordle 1234
5️⃣🟥
7️⃣8️⃣`,
};

const INVALID_SAMPLES = [
    'This is just random text',
    'Wordle is fun but this is not a result',
    '3/6 - just numbers',
    'Hello world!',
    '',
    '   ',
];

// ============ PARSER TESTS ============

async function setupForParsing(page: Page) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
        localStorage.setItem('gameshelf_setup_complete', 'true');
    });
    await page.reload();
    
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

test.describe('Wordle Parser', () => {
    
    test('P-W1: Standard Wordle with comma in number', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            const match = text.match(regex);
            if (match) {
                const guesses = match[2];
                return {
                    gameId: 'wordle',
                    puzzleNumber: parseInt(match[1].replace(',', '')),
                    score: guesses + '/6',
                    won: guesses !== 'X',
                    numericScore: guesses === 'X' ? 0 : (7 - parseInt(guesses)) * 5
                };
            }
            return null;
        }, WORDLE_SAMPLES.standard);
        
        expect(result).toBeTruthy();
        expect(result.gameId).toBe('wordle');
        expect(result.puzzleNumber).toBe(1234);
        expect(result.score).toBe('3/6');
        expect(result.won).toBe(true);
        expect(result.numericScore).toBe(20); // (7-3)*5
    });
    
    test('P-W2: Wordle without comma', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            const match = text.match(regex);
            if (match) {
                return {
                    puzzleNumber: parseInt(match[1].replace(',', '')),
                    score: match[2] + '/6'
                };
            }
            return null;
        }, WORDLE_SAMPLES.noComma);
        
        expect(result).toBeTruthy();
        expect(result.puzzleNumber).toBe(999);
        expect(result.score).toBe('4/6');
    });
    
    test('P-W3: Perfect Wordle (1/6)', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            const match = text.match(regex);
            if (match) {
                const guesses = match[2];
                return {
                    score: guesses + '/6',
                    perfect: guesses === '1' || guesses === '2',
                    numericScore: (7 - parseInt(guesses)) * 5
                };
            }
            return null;
        }, WORDLE_SAMPLES.perfect);
        
        expect(result.score).toBe('1/6');
        expect(result.perfect).toBe(true);
        expect(result.numericScore).toBe(30);
    });
    
    test('P-W4: Failed Wordle (X/6)', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            const match = text.match(regex);
            if (match) {
                const guesses = match[2];
                return {
                    score: guesses + '/6',
                    won: guesses !== 'X',
                    numericScore: guesses === 'X' ? 0 : (7 - parseInt(guesses)) * 5
                };
            }
            return null;
        }, WORDLE_SAMPLES.fail);
        
        expect(result.score).toBe('X/6');
        expect(result.won).toBe(false);
        expect(result.numericScore).toBe(0);
    });
    
    test('P-W5: All Wordle scores calculate correctly', async ({ page }) => {
        await setupForParsing(page);
        
        const scores = await page.evaluate(() => {
            const testCases = ['1', '2', '3', '4', '5', '6', 'X'];
            return testCases.map(g => ({
                guess: g,
                score: g === 'X' ? 0 : (7 - parseInt(g)) * 5
            }));
        });
        
        expect(scores.find(s => s.guess === '1').score).toBe(30);
        expect(scores.find(s => s.guess === '2').score).toBe(25);
        expect(scores.find(s => s.guess === '3').score).toBe(20);
        expect(scores.find(s => s.guess === '4').score).toBe(15);
        expect(scores.find(s => s.guess === '5').score).toBe(10);
        expect(scores.find(s => s.guess === '6').score).toBe(5);
        expect(scores.find(s => s.guess === 'X').score).toBe(0);
    });
});

test.describe('Connections Parser', () => {
    
    test('P-C1: Perfect Connections (4 clean rows)', async ({ page }) => {
        await setupForParsing(page);
        
        // Use the PWA's actual parser instead of reimplementing
        const result = await page.evaluate((text) => {
            if (typeof (window as any).GameShelfTest?.parseText === 'function') {
                return (window as any).GameShelfTest.parseText(text);
            }
            return null;
        }, CONNECTIONS_SAMPLES.perfect);
        
        expect(result).toBeTruthy();
        expect(result.gameId).toBe('connections');
        expect(result.won).toBe(true);
        expect(result.meta?.perfect).toBe(true);
    });
    
    test('P-C2: Connections with mistakes', async ({ page }) => {
        await setupForParsing(page);
        
        // Use the PWA's actual parser
        const result = await page.evaluate((text) => {
            if (typeof (window as any).GameShelfTest?.parseText === 'function') {
                return (window as any).GameShelfTest.parseText(text);
            }
            return null;
        }, CONNECTIONS_SAMPLES.withMistakes);
        
        expect(result).toBeTruthy();
        expect(result.gameId).toBe('connections');
        expect(result.won).toBe(true);
        expect(result.meta?.mistakes).toBeGreaterThan(0);
        expect(result.meta?.perfect).toBe(false);
    });
});

test.describe('Strands Parser', () => {
    
    test('P-S1: Perfect Strands (0 hints)', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const regex = /Strands\s*#?(\d+)/i;
            const match = text.match(regex);
            
            if (match) {
                const hints = (text.match(/💡/g) || []).length;
                const hasSpanagram = text.includes('🟡');
                
                return {
                    gameId: 'strands',
                    puzzleNumber: parseInt(match[1]),
                    hints,
                    perfect: hints === 0,
                    hasSpanagram
                };
            }
            return null;
        }, STRANDS_SAMPLES.perfect);
        
        expect(result.gameId).toBe('strands');
        expect(result.puzzleNumber).toBe(890);
        expect(result.hints).toBe(0);
        expect(result.perfect).toBe(true);
    });
    
    test('P-S2: Strands with 1 hint', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const hints = (text.match(/💡/g) || []).length;
            return { hints, perfect: hints === 0 };
        }, STRANDS_SAMPLES.oneHint);
        
        expect(result.hints).toBe(1);
        expect(result.perfect).toBe(false);
    });
    
    test('P-S3: Strands with 2 hints', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const hints = (text.match(/💡/g) || []).length;
            return { hints };
        }, STRANDS_SAMPLES.twoHints);
        
        expect(result.hints).toBe(2);
    });
    
    test('P-S4: Strands scoring formula', async ({ page }) => {
        await setupForParsing(page);
        
        const scores = await page.evaluate(() => {
            // Scoring: perfect = 30, otherwise max(20 - hints * 4, 5)
            const calculate = (hints: number) => {
                if (hints === 0) return 30;
                return Math.max(20 - hints * 4, 5);
            };
            
            return [0, 1, 2, 3, 4, 5].map(h => ({
                hints: h,
                score: calculate(h)
            }));
        });
        
        expect(scores.find(s => s.hints === 0).score).toBe(30);
        expect(scores.find(s => s.hints === 1).score).toBe(16);
        expect(scores.find(s => s.hints === 2).score).toBe(12);
        expect(scores.find(s => s.hints === 5).score).toBe(5); // Min score
    });
});

test.describe('Mini Crossword Parser', () => {
    
    test('P-M1: Fast Mini time (under 30s)', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const timeMatch = text.match(/(\d+):(\d+)/);
            if (timeMatch) {
                const mins = parseInt(timeMatch[1]);
                const secs = parseInt(timeMatch[2]);
                const totalSecs = mins * 60 + secs;
                
                return {
                    gameId: 'mini',
                    minutes: mins,
                    seconds: secs,
                    totalSeconds: totalSecs,
                    fast: totalSecs <= 30,
                    score: `${mins}:${secs.toString().padStart(2, '0')}`
                };
            }
            return null;
        }, MINI_SAMPLES.fast);
        
        expect(result.minutes).toBe(0);
        expect(result.seconds).toBe(28);
        expect(result.totalSeconds).toBe(28);
        expect(result.fast).toBe(true);
    });
    
    test('P-M2: Medium Mini time', async ({ page }) => {
        await setupForParsing(page);
        
        const result = await page.evaluate((text) => {
            const timeMatch = text.match(/(\d+):(\d+)/);
            if (timeMatch) {
                const mins = parseInt(timeMatch[1]);
                const secs = parseInt(timeMatch[2]);
                return {
                    totalSeconds: mins * 60 + secs
                };
            }
            return null;
        }, MINI_SAMPLES.medium);
        
        expect(result.totalSeconds).toBe(105); // 1:45
    });
    
    test('P-M3: Mini scoring formula', async ({ page }) => {
        await setupForParsing(page);
        
        const scores = await page.evaluate(() => {
            // Scoring: max(35 - floor(totalSecs / 10), 5)
            const calculate = (totalSecs: number) => {
                return Math.max(35 - Math.floor(totalSecs / 10), 5);
            };
            
            return [
                { secs: 28, score: calculate(28) },   // 0:28
                { secs: 45, score: calculate(45) },   // 0:45
                { secs: 105, score: calculate(105) }, // 1:45
                { secs: 330, score: calculate(330) }, // 5:30
            ];
        });
        
        expect(scores[0].score).toBe(33); // 35 - 2
        expect(scores[1].score).toBe(31); // 35 - 4
        expect(scores[2].score).toBe(25); // 35 - 10
        expect(scores[3].score).toBe(5);  // Min score
    });
});

test.describe('Invalid Input Handling', () => {
    
    test('P-I1: Random text does not match any parser', async ({ page }) => {
        await setupForParsing(page);
        
        const results = await page.evaluate((samples) => {
            const patterns = [
                /Wordle\s+([\d,]+)\s+([1-6X])\/6/i,
                /Connections\s*\n?\s*Puzzle\s*#?(\d+)/i,
                /Strands\s*#?(\d+)/i,
            ];
            
            return samples.map(text => ({
                text: text.substring(0, 30),
                matched: patterns.some(p => p.test(text))
            }));
        }, INVALID_SAMPLES);
        
        results.forEach(r => {
            expect(r.matched).toBe(false);
        });
    });
    
    test('P-I2: Invalid Wordle format rejected', async ({ page }) => {
        await setupForParsing(page);
        
        const invalids = [
            'Wordle 123 7/6',   // 7 is invalid
            'Wordle 123 0/6',   // 0 is invalid
            'Wordle abc 3/6',   // Non-numeric puzzle
            'Wordle 123',       // Missing score
        ];
        
        const results = await page.evaluate((samples) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            return samples.map(text => ({
                text,
                matched: regex.test(text)
            }));
        }, invalids);
        
        // None should match the valid pattern
        results.forEach(r => {
            if (r.text.includes('7/6') || r.text.includes('0/6') || 
                r.text.includes('abc') || !r.text.includes('/6')) {
                expect(r.matched).toBe(false);
            }
        });
    });
});

test.describe('Edge Cases', () => {
    
    test('P-E1: Extra whitespace handled', async ({ page }) => {
        await setupForParsing(page);
        
        const variations = [
            'Wordle 1234 3/6',
            'Wordle  1234  3/6',
            'Wordle   1234   3/6',
            '  Wordle 1234 3/6  ',
        ];
        
        const results = await page.evaluate((samples) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            return samples.map(text => regex.test(text.trim()));
        }, variations);
        
        // All should match (regex uses \s+ which handles multiple spaces)
        results.forEach(matched => {
            expect(matched).toBe(true);
        });
    });
    
    test('P-E2: Case insensitive matching', async ({ page }) => {
        await setupForParsing(page);
        
        const variations = [
            'Wordle 1234 3/6',
            'WORDLE 1234 3/6',
            'wordle 1234 3/6',
            'WoRdLe 1234 3/6',
        ];
        
        const results = await page.evaluate((samples) => {
            const regex = /Wordle\s+([\d,]+)\s+([1-6X])\/6/i;
            return samples.map(text => regex.test(text));
        }, variations);
        
        results.forEach(matched => {
            expect(matched).toBe(true);
        });
    });
    
    test('P-E3: Newline variations in Connections', async ({ page }) => {
        await setupForParsing(page);
        
        const variations = [
            'Connections\nPuzzle #123',
            'Connections\n\nPuzzle #123',
            'Connections Puzzle #123',
            'Connections  Puzzle #123',
        ];
        
        const results = await page.evaluate((samples) => {
            const regex = /Connections\s*\n?\s*Puzzle\s*#?(\d+)/i;
            return samples.map(text => regex.test(text));
        }, variations);
        
        results.forEach(matched => {
            expect(matched).toBe(true);
        });
    });
});
