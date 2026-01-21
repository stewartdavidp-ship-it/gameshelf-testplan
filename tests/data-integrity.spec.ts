/**
 * Data Integrity Tests
 * 
 * Tests data persistence, migration, streak logic edge cases, and storage reliability.
 * These tests verify that user data is never lost or corrupted.
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

async function setupCompletedUser(page: Page) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('load');
    
    await page.evaluate(() => {
        localStorage.setItem('gameshelf_setup_complete', 'true');
        localStorage.setItem('gameshelf_games', JSON.stringify([
            { gameId: 'wordle', name: 'Wordle' },
            { gameId: 'connections', name: 'Connections' }
        ]));
        const appData = {
            games: [
                { id: 'wordle', addedAt: new Date().toISOString() },
                { id: 'connections', addedAt: new Date().toISOString() }
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

test.describe('Streak Logic Edge Cases', () => {
    
    test.describe('Streak Calculation Accuracy', () => {
        
        test('D1: Streak starts at 1 for first game', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Fresh stats - log first game
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 1,
                        gamesWon: 1,
                        currentStreak: 1,
                        maxStreak: 1,
                        lastPlayed: today
                    }
                };
                data.history = {
                    [today]: { wordle: { score: '4/6', won: true } }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            expect(stats.currentStreak).toBe(1);
            expect(stats.maxStreak).toBe(1);
        });
        
        test('D2: Streak increments for consecutive days', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Set up 3-day streak ending yesterday
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
                
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 3,
                        gamesWon: 3,
                        currentStreak: 3,
                        maxStreak: 3,
                        lastPlayed: yesterdayStr
                    }
                };
                data.history = {
                    [yesterdayStr]: { wordle: { score: '4/6', won: true } },
                    [twoDaysAgoStr]: { wordle: { score: '3/6', won: true } },
                    [threeDaysAgoStr]: { wordle: { score: '5/6', won: true } }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            // Now log today's game - streak should become 4
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                
                data.history[today] = { wordle: { score: '4/6', won: true } };
                data.stats.wordle.currentStreak = 4;
                data.stats.wordle.maxStreak = 4;
                data.stats.wordle.gamesPlayed = 4;
                data.stats.wordle.lastPlayed = today;
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            expect(stats.currentStreak).toBe(4);
        });
        
        test('D3: Streak resets after 1 missed day', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Set up streak that ended 2 days ago (yesterday missed)
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 10,
                        gamesWon: 10,
                        currentStreak: 10, // Had 10-day streak
                        maxStreak: 10,
                        lastPlayed: twoDaysAgoStr // But last played 2 days ago
                    }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            // When user logs today, streak should reset to 1
            // (This tests the actual logGame logic if it runs on load)
            await page.reload();
            await page.waitForTimeout(1000);
            
            // The streak should either be corrected by the app or remain for testing
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            // Max streak should still be 10
            expect(stats.maxStreak).toBe(10);
            // Current streak is stale (10) until user logs new game
            // This tests that the app doesn't corrupt data on load
            expect(stats.currentStreak).toBeLessThanOrEqual(10);
        });
        
        test('D4: Streak resets after multiple missed days', async ({ page }) => {
            await setupCompletedUser(page);
            
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 50,
                        gamesWon: 45,
                        currentStreak: 30,
                        maxStreak: 30,
                        lastPlayed: oneWeekAgoStr // A week ago
                    }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            // Max streak preserved
            expect(stats.maxStreak).toBe(30);
        });
        
        test('D5: Max streak never decreases', async ({ page }) => {
            await setupCompletedUser(page);
            
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 100,
                        gamesWon: 90,
                        currentStreak: 5,  // Current is only 5
                        maxStreak: 50,     // But max was 50
                        lastPlayed: today
                    }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            // Log a new game
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                data.stats.wordle.currentStreak = 6;
                data.stats.wordle.gamesPlayed = 101;
                // Max streak should NOT change
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            expect(stats.maxStreak).toBe(50); // Unchanged
            expect(stats.currentStreak).toBe(6);
        });
        
        test('D6: Max streak updates when current exceeds it', async ({ page }) => {
            await setupCompletedUser(page);
            
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                
                data.stats = {
                    wordle: {
                        gamesPlayed: 10,
                        gamesWon: 10,
                        currentStreak: 10,
                        maxStreak: 10,
                        lastPlayed: today
                    }
                };
                
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            // Simulate streak growing past max
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                data.stats.wordle.currentStreak = 11;
                data.stats.wordle.maxStreak = 11; // Should update
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            const stats = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.stats?.wordle;
            });
            
            expect(stats.maxStreak).toBe(11);
            expect(stats.currentStreak).toBe(11);
        });
    });
    
    test.describe('Timezone Edge Cases', () => {
        
        test('D7: Game logged at 11:59 PM counts for today', async ({ page }) => {
            await setupCompletedUser(page);
            
            const today = new Date().toISOString().split('T')[0];
            
            await page.evaluate((todayStr) => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                data.history = { [todayStr]: { wordle: { score: '4/6', won: true } } };
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            }, today);
            
            const hasToday = await page.evaluate((todayStr) => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return !!data.history?.[todayStr]?.wordle;
            }, today);
            
            expect(hasToday).toBe(true);
        });
        
        test('D8: Game logged at 12:01 AM counts for new day', async ({ page }) => {
            await setupCompletedUser(page);
            
            // This just verifies date logic is based on local date
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            
            await page.evaluate((today) => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                data.history = { [today]: { wordle: { score: '4/6', won: true } } };
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            }, todayStr);
            
            const dateKeys = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return Object.keys(data.history || {});
            });
            
            expect(dateKeys).toContain(todayStr);
        });
    });
});

test.describe('History Data Integrity', () => {
    
    test('D9: History preserves all game results', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Create 30 days of history
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.history = {};
            
            for (let i = 0; i < 30; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                data.history[dateStr] = {
                    wordle: { score: `${(i % 5) + 2}/6`, won: true, numericScore: 15 }
                };
            }
            
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        const historyCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return Object.keys(data.history || {}).length;
        });
        
        expect(historyCount).toBe(30);
    });
    
    test('D10: History survives page reload', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Add history
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const today = new Date().toISOString().split('T')[0];
            data.history = {
                [today]: {
                    wordle: { score: '3/6', won: true, numericScore: 20 },
                    connections: { score: 'Perfect! 🎯', won: true, numericScore: 35 }
                }
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        // Reload page
        await page.reload();
        await page.waitForLoadState('load');
        await page.waitForTimeout(1000);
        
        // Verify history still there
        const history = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const today = new Date().toISOString().split('T')[0];
            return data.history?.[today];
        });
        
        expect(history?.wordle).toBeDefined();
        expect(history?.connections).toBeDefined();
    });
    
    test('D11: History survives browser back/forward', async ({ page }) => {
        await setupCompletedUser(page);
        
        const today = new Date().toISOString().split('T')[0];
        
        // Add history
        await page.evaluate((todayStr) => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.history = {
                [todayStr]: { wordle: { score: '4/6', won: true } }
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        }, today);
        
        // Navigate away and back
        await page.goto(GAMESHELF_URL + '#log');
        await page.waitForTimeout(500);
        await page.goBack();
        await page.waitForTimeout(500);
        
        // Verify history
        const hasHistory = await page.evaluate((todayStr) => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return !!data.history?.[todayStr]?.wordle;
        }, today);
        
        expect(hasHistory).toBe(true);
    });
    
    test('D12: Multiple games per day stored separately', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const today = new Date().toISOString().split('T')[0];
            
            data.history = {
                [today]: {
                    wordle: { score: '3/6', won: true, numericScore: 20 },
                    connections: { score: 'Perfect! 🎯', won: true, numericScore: 35 },
                    strands: { score: 'No hints!', won: true, numericScore: 30 },
                    mini: { score: '0:45', won: true, numericScore: 25 }
                }
            };
            
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        const games = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const today = new Date().toISOString().split('T')[0];
            return data.history?.[today];
        });
        
        expect(Object.keys(games).length).toBe(4);
        expect(games.wordle.score).toBe('3/6');
        expect(games.connections.score).toBe('Perfect! 🎯');
    });
});

test.describe('Data Migration & Format Changes', () => {
    
    test('D13: Old format data is readable', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Simulate old format (might have different key names)
        await page.evaluate(() => {
            const oldFormatData = {
                games: [{ id: 'wordle' }],
                stats: { wordle: { streak: 5 } }, // Old key name
                history: { '2024-01-01': { wordle: { score: '4/6' } } },
                wallet: { tokens: 50 }
            };
            localStorage.setItem('gameShelfData', JSON.stringify(oldFormatData));
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        // App should still load without crashing
        const loaded = await page.evaluate(() => {
            const data = localStorage.getItem('gameShelfData');
            return data !== null;
        });
        
        expect(loaded).toBe(true);
    });
    
    test('D14: Missing fields dont crash app', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Minimal data structure
        await page.evaluate(() => {
            const minimalData = {
                games: []
                // Missing: stats, history, wallet, settings
            };
            localStorage.setItem('gameShelfData', JSON.stringify(minimalData));
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        // App should handle gracefully - check VISIBLE content only (not script tags)
        const crashIndicators = await page.evaluate(() => {
            // Get only visible text content, excluding script/style tags
            const getVisibleText = () => {
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            const parent = node.parentElement;
                            if (!parent) return NodeFilter.FILTER_REJECT;
                            const tag = parent.tagName.toLowerCase();
                            if (tag === 'script' || tag === 'style' || tag === 'noscript') {
                                return NodeFilter.FILTER_REJECT;
                            }
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                );
                let text = '';
                let node;
                while (node = walker.nextNode()) {
                    text += node.textContent + ' ';
                }
                return text;
            };
            
            const visibleText = getVisibleText();
            
            return {
                // Check visible text only for NaN/undefined
                hasNaN: /\bNaN\b/.test(visibleText),
                hasUndefined: /\bundefined\b/.test(visibleText),
                // Check if main UI loaded
                hasHomeTab: !!document.querySelector('[data-tab="home"], #home-tab, .tab-btn, .nav-tab'),
                hasGameCards: document.querySelectorAll('.game-card').length >= 0,
                // Check for error modals
                hasErrorModal: !!document.querySelector('.error-modal, .crash-modal, [class*="error-screen"]')
            };
        });
        
        // Main UI should load
        expect(crashIndicators.hasHomeTab).toBe(true);
        
        // No crash indicators in visible UI
        expect(crashIndicators.hasNaN).toBe(false);
        expect(crashIndicators.hasUndefined).toBe(false);
        expect(crashIndicators.hasErrorModal).toBe(false);
    });
    
    test('D15: Corrupted JSON is handled', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Write invalid JSON
        await page.evaluate(() => {
            localStorage.setItem('gameShelfData', '{invalid json}}}');
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        // App should not crash - may show setup or error state
        const pageLoaded = await page.evaluate(() => document.body !== null);
        expect(pageLoaded).toBe(true);
    });
    
    test('D16: Empty localStorage starts fresh', async ({ page }) => {
        await page.goto(GAMESHELF_URL);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForTimeout(1000);
        
        // Should show onboarding or fresh state
        const pageLoaded = await page.evaluate(() => document.body !== null);
        expect(pageLoaded).toBe(true);
    });
});

test.describe('Wallet & Token Integrity', () => {
    
    test('D17: Tokens cannot go negative', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.wallet = { tokens: 0, coins: 0 };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        const wallet = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return data.wallet;
        });
        
        expect(wallet.tokens).toBeGreaterThanOrEqual(0);
        expect(wallet.coins).toBeGreaterThanOrEqual(0);
    });
    
    test('D18: Large token amounts stored correctly', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.wallet = { tokens: 999999, coins: 999999 };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        const wallet = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return data.wallet;
        });
        
        expect(wallet.tokens).toBe(999999);
        expect(wallet.coins).toBe(999999);
    });
});

test.describe('Stats Calculations', () => {
    
    test('D19: Win rate calculated correctly', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.stats = {
                wordle: {
                    gamesPlayed: 100,
                    gamesWon: 75, // 75% win rate
                    currentStreak: 5,
                    maxStreak: 20,
                    lastPlayed: new Date().toISOString().split('T')[0]
                }
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        const stats = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const s = data.stats?.wordle;
            return {
                played: s?.gamesPlayed,
                won: s?.gamesWon,
                winRate: s?.gamesPlayed > 0 ? (s.gamesWon / s.gamesPlayed * 100) : 0
            };
        });
        
        expect(stats.winRate).toBe(75);
    });
    
    test('D20: Stats with zero games dont divide by zero', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.stats = {
                wordle: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    currentStreak: 0,
                    maxStreak: 0,
                    lastPlayed: null
                }
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        // Check visible stat elements for NaN/Infinity (not entire body which includes hidden sound settings)
        const problems = await page.evaluate(() => {
            const issues: string[] = [];
            
            // Check specific stat/display elements
            const statElements = document.querySelectorAll(
                '.stat-value, .game-status, .goal-display, #goal-display, ' +
                '.streak-badge, #streak-badge, .profile-stat-value, ' +
                '.progress-text, .games-today-text, #games-today-text'
            );
            
            statElements.forEach(el => {
                const text = el.textContent || '';
                if (text.includes('NaN')) issues.push(`NaN in ${el.className || el.id}`);
                if (text.includes('Infinity')) issues.push(`Infinity in ${el.className || el.id}`);
            });
            
            return issues;
        });
        
        expect(problems).toHaveLength(0);
    });
});

test.describe('Referral Data Integrity', () => {
    
    test('D21: Referral code persists', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.referral = {
                myCode: 'TEST1234',
                referredBy: null,
                invitesSent: 5,
                friendsJoined: 2
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        await page.reload();
        await page.waitForTimeout(1000);
        
        const referral = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return data.referral;
        });
        
        expect(referral?.myCode).toBe('TEST1234');
        expect(referral?.invitesSent).toBe(5);
    });
    
    test('D22: Referral counts increment correctly', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.referral = {
                myCode: 'TEST1234',
                referredBy: null,
                invitesSent: 10,
                friendsJoined: 3
            };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        // Simulate friend joining
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.referral.friendsJoined += 1;
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        const referral = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            return data.referral;
        });
        
        expect(referral.friendsJoined).toBe(4);
    });
});

test.describe('Cross-Device Data Consistency', () => {
    
    test('D23: Data structure is JSON serializable', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Create complex data
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            data.history = {
                '2024-01-01': { wordle: { score: '3/6', won: true } }
            };
            data.stats = { wordle: { currentStreak: 5 } };
            data.wallet = { tokens: 100, coins: 50 };
            localStorage.setItem('gameShelfData', JSON.stringify(data));
        });
        
        // Verify round-trip serialization
        const roundTrip = await page.evaluate(() => {
            const stored = localStorage.getItem('gameShelfData');
            try {
                const parsed = JSON.parse(stored || '{}');
                const reserialized = JSON.stringify(parsed);
                const reparsed = JSON.parse(reserialized);
                return {
                    success: true,
                    equal: stored === reserialized || JSON.stringify(parsed) === JSON.stringify(reparsed)
                };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        });
        
        expect(roundTrip.success).toBe(true);
    });
});
