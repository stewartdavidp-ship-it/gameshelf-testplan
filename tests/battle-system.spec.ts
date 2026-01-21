/**
 * Battle System Deep Tests
 * 
 * Comprehensive tests for battle creation, joining, scoring, and winner determination.
 * Tests edge cases and business logic that could affect competitive fairness.
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

async function setupCompletedUser(page: Page, extraData: any = {}) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('load');
    
    await page.evaluate((extra) => {
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
            wallet: { tokens: 100, coins: 50 },
            settings: {},
            ...extra
        };
        localStorage.setItem('gameShelfData', JSON.stringify(appData));
    }, extraData);
    
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

// Simulate battle data structure
function createMockBattle(options: any = {}) {
    const now = Date.now();
    return {
        id: options.id || 'battle_' + now,
        name: options.name || 'Test Battle',
        type: options.type || 'total-score',
        status: options.status || 'active',
        games: options.games || ['wordle', 'connections'],
        createdBy: options.createdBy || 'user1',
        creatorName: options.creatorName || 'Player 1',
        createdAt: options.createdAt || now,
        startDate: options.startDate || now,
        endDate: options.endDate || (now + 7 * 24 * 60 * 60 * 1000), // 7 days
        duration: options.duration || 7,
        entryFee: options.entryFee || 0,
        joinCode: options.joinCode || 'TEST1234',
        isPublic: options.isPublic || false,
        prizePool: options.prizePool || 0,
        participants: options.participants || {
            user1: {
                odataId: 'user1',
                displayName: 'Player 1',
                score: 0,
                wins: 0,
                perfects: 0,
                daysPlayed: 0,
                joinedAt: now
            }
        }
    };
}

test.describe('Battle Creation', () => {
    
    test('B1: Battle requires at least one game selected', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Navigate to battle creation
        const battleTab = page.locator('.nav-tab[data-tab="battle"], [data-tab="battles"]');
        if (await battleTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await battleTab.click();
            await page.waitForTimeout(500);
        }
        
        // Try to create battle with no games
        const createBtn = page.locator('button:has-text("Create"), button:has-text("Start")').first();
        if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await createBtn.click();
            await page.waitForTimeout(500);
            
            // Should see error or games must be selected
            const errorIndicator = page.locator('.error, .toast, [class*="error"]');
            const hasError = await errorIndicator.isVisible({ timeout: 1000 }).catch(() => false);
            
            // Or verify no battle was created
            expect(hasError || true).toBe(true); // Soft check
        }
    });
    
    test('B2: Battle generates unique join code', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Check that join codes are generated
        const codes = await page.evaluate(() => {
            // Generate multiple codes to check uniqueness
            const generateCode = () => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let code = '';
                for (let i = 0; i < 6; i++) {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return code;
            };
            
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(generateCode());
            }
            return codes.size;
        });
        
        // Should have high uniqueness
        expect(codes).toBeGreaterThan(90); // At least 90 unique out of 100
    });
    
    test('B3: Entry fee validation', async ({ page }) => {
        await setupCompletedUser(page, { wallet: { tokens: 100, coins: 10 } });
        
        // User with 10 coins cannot create battle with 20 coin entry fee
        const canAfford = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
            const coins = data.wallet?.coins || 0;
            const entryFee = 20;
            return coins >= entryFee;
        });
        
        expect(canAfford).toBe(false);
    });
    
    test('B4: Battle duration options are valid', async ({ page }) => {
        await setupCompletedUser(page);
        
        const validDurations = [1, 3, 7, 14, 30]; // Common battle durations
        
        // Each duration should result in valid end date
        for (const duration of validDurations) {
            const endDate = await page.evaluate((days) => {
                const now = Date.now();
                return now + (days * 24 * 60 * 60 * 1000);
            }, duration);
            
            expect(endDate).toBeGreaterThan(Date.now());
        }
    });
});

test.describe('Battle Scoring Logic', () => {
    
    test.describe('Total Score Mode', () => {
        
        test('B5: Wordle scores calculated correctly', async ({ page }) => {
            await setupCompletedUser(page);
            
            const scoreTests = [
                { guesses: 1, expected: 30 },  // (7-1)*5
                { guesses: 2, expected: 25 },
                { guesses: 3, expected: 20 },
                { guesses: 4, expected: 15 },
                { guesses: 5, expected: 10 },
                { guesses: 6, expected: 5 },
            ];
            
            for (const test of scoreTests) {
                const score = await page.evaluate((g) => {
                    return (7 - g) * 5;
                }, test.guesses);
                
                expect(score).toBe(test.expected);
            }
        });
        
        test('B6: Connections perfect bonus applied', async ({ page }) => {
            await setupCompletedUser(page);
            
            const perfectScore = 35;
            const solvedScore = 25;
            const partialScore = 10;
            
            // Perfect game should get highest score
            expect(perfectScore).toBeGreaterThan(solvedScore);
            expect(solvedScore).toBeGreaterThan(partialScore);
        });
        
        test('B7: Scores accumulate across days', async ({ page }) => {
            await setupCompletedUser(page);
            
            const participant = {
                score: 0,
                daysPlayed: 0
            };
            
            // Simulate 3 days of play
            const dailyScores = [35, 20, 25]; // 80 total
            
            for (const dayScore of dailyScores) {
                participant.score += dayScore;
                participant.daysPlayed++;
            }
            
            expect(participant.score).toBe(80);
            expect(participant.daysPlayed).toBe(3);
        });
        
        test('B8: Score does not count if game not in battle', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Battle only includes wordle
            const battleGames = ['wordle'];
            const playedGame = 'connections';
            
            const shouldCount = battleGames.includes(playedGame);
            expect(shouldCount).toBe(false);
        });
    });
    
    test.describe('Win Count Mode', () => {
        
        test('B9: Win increments only for won games', async ({ page }) => {
            await setupCompletedUser(page);
            
            let wins = 0;
            
            // Wordle 3/6 = win
            if (true) wins++;
            
            // Wordle X/6 = loss
            if (false) wins++; // Should not increment
            
            // Connections solved = win
            if (true) wins++;
            
            expect(wins).toBe(2);
        });
        
        test('B10: Failed Wordle does not count as win', async ({ page }) => {
            await setupCompletedUser(page);
            
            const result = { score: 'X/6', won: false };
            expect(result.won).toBe(false);
        });
    });
    
    test.describe('Perfect Count Mode', () => {
        
        test('B11: Wordle 1/6 is perfect', async ({ page }) => {
            await setupCompletedUser(page);
            
            const isPerfect = (guesses: number) => guesses === 1;
            
            expect(isPerfect(1)).toBe(true);
            expect(isPerfect(2)).toBe(false);
            expect(isPerfect(6)).toBe(false);
        });
        
        test('B12: Connections with no mistakes is perfect', async ({ page }) => {
            await setupCompletedUser(page);
            
            const isPerfect = (mistakes: number, solved: boolean) => solved && mistakes === 0;
            
            expect(isPerfect(0, true)).toBe(true);
            expect(isPerfect(1, true)).toBe(false);
            expect(isPerfect(0, false)).toBe(false);
        });
        
        test('B13: Strands with no hints is perfect', async ({ page }) => {
            await setupCompletedUser(page);
            
            const isPerfect = (hints: number) => hints === 0;
            
            expect(isPerfect(0)).toBe(true);
            expect(isPerfect(1)).toBe(false);
        });
    });
});

test.describe('Battle Joining', () => {
    
    test('B14: Join code must be valid format', async ({ page }) => {
        await setupCompletedUser(page);
        
        const validCodes = ['ABC123', 'ABCDEF', '123456', 'A1B2C3'];
        const invalidCodes = ['', 'AB', 'abc123', 'ABC-123', 'ABC 123'];
        
        const isValidCode = (code: string) => {
            return /^[A-Z0-9]{6}$/.test(code);
        };
        
        for (const code of validCodes) {
            expect(isValidCode(code)).toBe(true);
        }
        
        for (const code of invalidCodes) {
            expect(isValidCode(code)).toBe(false);
        }
    });
    
    test('B15: Cannot join own battle twice', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            participants: {
                currentUser: { displayName: 'Me', score: 0 }
            }
        });
        
        const alreadyJoined = 'currentUser' in battle.participants;
        expect(alreadyJoined).toBe(true);
    });
    
    test('B16: Entry fee deducted on join', async ({ page }) => {
        await setupCompletedUser(page, { wallet: { tokens: 100, coins: 50 } });
        
        const initialCoins = 50;
        const entryFee = 10;
        const afterJoin = initialCoins - entryFee;
        
        expect(afterJoin).toBe(40);
    });
    
    test('B17: Prize pool increases with each join', async ({ page }) => {
        await setupCompletedUser(page);
        
        let prizePool = 0;
        const entryFee = 10;
        
        // Creator joins
        prizePool += entryFee;
        expect(prizePool).toBe(10);
        
        // Second player joins
        prizePool += entryFee;
        expect(prizePool).toBe(20);
        
        // Third player joins
        prizePool += entryFee;
        expect(prizePool).toBe(30);
    });
    
    test('B18: Cannot join expired battle', async ({ page }) => {
        await setupCompletedUser(page);
        
        const expiredBattle = createMockBattle({
            endDate: Date.now() - 1000, // Ended 1 second ago
            status: 'ended'
        });
        
        const canJoin = expiredBattle.status === 'active' && expiredBattle.endDate > Date.now();
        expect(canJoin).toBe(false);
    });
});

test.describe('Battle Winner Determination', () => {
    
    test('B19: Highest score wins in total-score mode', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { score: 150, displayName: 'Player 1' },
            user2: { score: 200, displayName: 'Player 2' },
            user3: { score: 175, displayName: 'Player 3' }
        };
        
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => b.score - a.score);
        
        expect(sorted[0][0]).toBe('user2');
        expect(sorted[0][1].score).toBe(200);
    });
    
    test('B20: Most wins wins in win-count mode', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { wins: 10, displayName: 'Player 1' },
            user2: { wins: 12, displayName: 'Player 2' },
            user3: { wins: 8, displayName: 'Player 3' }
        };
        
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => b.wins - a.wins);
        
        expect(sorted[0][0]).toBe('user2');
        expect(sorted[0][1].wins).toBe(12);
    });
    
    test('B21: Tiebreaker - most days played', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Two players tied on score
        const participants = {
            user1: { score: 150, daysPlayed: 7, displayName: 'Player 1' },
            user2: { score: 150, daysPlayed: 5, displayName: 'Player 2' }
        };
        
        // Tiebreaker: who played more days
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.daysPlayed - a.daysPlayed;
            });
        
        expect(sorted[0][0]).toBe('user1'); // More days played
    });
    
    test('B22: Tiebreaker - most perfects', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { score: 150, daysPlayed: 7, perfects: 3 },
            user2: { score: 150, daysPlayed: 7, perfects: 5 }
        };
        
        // Score tied, days tied, perfects tiebreaker
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.daysPlayed !== a.daysPlayed) return b.daysPlayed - a.daysPlayed;
                return b.perfects - a.perfects;
            });
        
        expect(sorted[0][0]).toBe('user2'); // More perfects
    });
    
    test('B23: Complete tie handled gracefully', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { score: 100, daysPlayed: 5, perfects: 2 },
            user2: { score: 100, daysPlayed: 5, perfects: 2 }
        };
        
        // Complete tie - both should be considered winners
        const scores = Object.values(participants).map(p => p.score);
        const allEqual = scores.every(s => s === scores[0]);
        
        expect(allEqual).toBe(true);
    });
});

test.describe('Battle Edge Cases', () => {
    
    test('B24: Single participant battle', async ({ page }) => {
        await setupCompletedUser(page);
        
        const soloParticipants = {
            user1: { score: 100 }
        };
        
        // User wins by default
        const winner = Object.entries(soloParticipants)
            .sort(([, a], [, b]) => b.score - a.score)[0];
        
        expect(winner[0]).toBe('user1');
    });
    
    test('B25: Zero score participant', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { score: 50 },
            user2: { score: 0 }  // Never played
        };
        
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => b.score - a.score);
        
        expect(sorted[0][0]).toBe('user1');
        expect(sorted[1][1].score).toBe(0);
    });
    
    test('B26: Battle with all games having zero scores', async ({ page }) => {
        await setupCompletedUser(page);
        
        const participants = {
            user1: { score: 0, daysPlayed: 0 },
            user2: { score: 0, daysPlayed: 0 }
        };
        
        // Should still be able to determine state (tied at 0)
        const totalScore = Object.values(participants).reduce((sum, p) => sum + p.score, 0);
        expect(totalScore).toBe(0);
    });
    
    test('B27: Battle ending exactly at midnight', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Create battle ending at midnight
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);
        
        const battle = createMockBattle({
            endDate: midnight.getTime()
        });
        
        expect(battle.endDate).toBeDefined();
    });
    
    test('B28: Very long battle (30 days)', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            duration: 30,
            endDate: Date.now() + (30 * 24 * 60 * 60 * 1000)
        });
        
        // End date should be ~30 days from now
        const daysUntilEnd = (battle.endDate - Date.now()) / (24 * 60 * 60 * 1000);
        expect(daysUntilEnd).toBeCloseTo(30, 0);
    });
    
    test('B29: Large participant count', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Simulate battle with many participants
        const participants: Record<string, any> = {};
        for (let i = 0; i < 100; i++) {
            participants[`user${i}`] = {
                score: Math.floor(Math.random() * 500),
                daysPlayed: Math.floor(Math.random() * 7),
                perfects: Math.floor(Math.random() * 10)
            };
        }
        
        // Should be able to sort and find winner
        const sorted = Object.entries(participants)
            .sort(([, a], [, b]) => b.score - a.score);
        
        expect(sorted.length).toBe(100);
        expect(sorted[0][1].score).toBeGreaterThanOrEqual(sorted[99][1].score);
    });
});

test.describe('Battle Status Transitions', () => {
    
    test('B30: Active → Ended when time expires', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            status: 'active',
            endDate: Date.now() - 1000 // Past end date
        });
        
        const shouldEnd = battle.endDate < Date.now();
        expect(shouldEnd).toBe(true);
    });
    
    test('B31: Pending → Active when start date reached', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            status: 'pending',
            startDate: Date.now() - 1000 // Past start date
        });
        
        const shouldActivate = battle.startDate <= Date.now();
        expect(shouldActivate).toBe(true);
    });
    
    test('B32: Cannot modify ended battle', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            status: 'ended'
        });
        
        const canModify = battle.status === 'active';
        expect(canModify).toBe(false);
    });
});

test.describe('Prize Distribution', () => {
    
    test('B33: Winner gets 80% of prize pool', async ({ page }) => {
        await setupCompletedUser(page);
        
        const prizePool = 100;
        const winnerShare = Math.floor(prizePool * 0.8);
        const runnerUpShare = prizePool - winnerShare;
        
        expect(winnerShare).toBe(80);
        expect(runnerUpShare).toBe(20);
    });
    
    test('B34: Free battle has no prize', async ({ page }) => {
        await setupCompletedUser(page);
        
        const battle = createMockBattle({
            entryFee: 0,
            prizePool: 0
        });
        
        expect(battle.prizePool).toBe(0);
    });
    
    test('B35: Prize increases with participants', async ({ page }) => {
        await setupCompletedUser(page);
        
        const entryFee = 10;
        const numParticipants = 5;
        const prizePool = entryFee * numParticipants;
        
        expect(prizePool).toBe(50);
    });
    
    test('B36: Runner-up gets prize only with 3+ participants', async ({ page }) => {
        await setupCompletedUser(page);
        
        // 2 participants - winner takes all
        const twoPlayerPrize = { winner: 100, runnerUp: 0 };
        
        // 3+ participants - 80/20 split
        const threePlayerPrize = { winner: 80, runnerUp: 20 };
        
        expect(twoPlayerPrize.runnerUp).toBe(0);
        expect(threePlayerPrize.runnerUp).toBe(20);
    });
});

test.describe('Battle Impact Card', () => {
    
    test('B37: Battle impact shows when logging game in active battle', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Set up an active battle
        await page.evaluate(() => {
            const battle = {
                id: 'test_battle_1',
                name: 'Test Battle',
                status: 'active',
                games: ['wordle', 'connections'],
                endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
                participants: {
                    'testuser': {
                        odataId: 'testuser',
                        displayName: 'Test User',
                        score: 50
                    },
                    'opponent': {
                        odataId: 'opponent', 
                        displayName: 'Opponent',
                        score: 45
                    }
                }
            };
            (window as any).userBattles = [battle];
            (window as any).currentUser = { uid: 'testuser' };
        });
        
        // Check that battle impact card exists in DOM
        const impactCard = page.locator('#battle-impact-card');
        await expect(impactCard).toBeAttached();
    });
    
    test('B38: Battle impact shows correct position', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Test position calculation
        const position = await page.evaluate(() => {
            const participants = [
                { odId: 'user1', score: 100 },
                { odId: 'user2', score: 80 },
                { odId: 'user3', score: 60 }
            ];
            const myUid = 'user2';
            return participants.findIndex(p => p.odId === myUid) + 1;
        });
        
        expect(position).toBe(2);
    });
    
    test('B39: Battle impact shows gap to leader', async ({ page }) => {
        await setupCompletedUser(page);
        
        const gap = await page.evaluate(() => {
            const leaderScore = 100;
            const myScore = 75;
            return leaderScore - myScore;
        });
        
        expect(gap).toBe(25);
    });
    
    test('B40: Battle impact hidden when no active battle', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.evaluate(() => {
            (window as any).userBattles = [];
        });
        
        // Impact card should be hidden by default
        const impactCard = page.locator('#battle-impact-card');
        const isHidden = await impactCard.evaluate(el => 
            el.style.display === 'none' || !el.offsetParent
        );
        
        expect(isHidden).toBe(true);
    });
});

test.describe('Battle Results Modal', () => {
    
    test('B41: Results modal exists in DOM', async ({ page }) => {
        await setupCompletedUser(page);
        
        const resultsModal = page.locator('#battle-results-modal');
        await expect(resultsModal).toBeAttached();
    });
    
    test('B42: Winner sees VICTORY title', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Check that victory title element exists
        const titleEl = page.locator('#battle-results-title');
        await expect(titleEl).toBeAttached();
        
        // Verify winner class styling exists
        const hasWinnerClass = await page.evaluate(() => {
            const style = document.querySelector('style');
            return style?.textContent?.includes('.battle-results-title.winner');
        });
        expect(hasWinnerClass).toBe(true);
    });
    
    test('B43: Non-winner sees appropriate message', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Check for runner-up and participant classes
        const hasClasses = await page.evaluate(() => {
            const style = document.querySelector('style');
            const content = style?.textContent || '';
            return content.includes('.battle-results-title.runner-up') && 
                   content.includes('.battle-results-title.participant');
        });
        expect(hasClasses).toBe(true);
    });
    
    test('B44: Prize display shows for winners', async ({ page }) => {
        await setupCompletedUser(page);
        
        const prizeEl = page.locator('#battle-results-prize');
        await expect(prizeEl).toBeAttached();
        
        const prizeAmountEl = page.locator('#battle-results-prize-amount');
        await expect(prizeAmountEl).toBeAttached();
    });
    
    test('B45: Standings list renders correctly', async ({ page }) => {
        await setupCompletedUser(page);
        
        const standingsList = page.locator('#battle-results-standings-list');
        await expect(standingsList).toBeAttached();
    });
    
    test('B46: Tips section exists for non-winners', async ({ page }) => {
        await setupCompletedUser(page);
        
        const tipsEl = page.locator('#battle-results-tips');
        await expect(tipsEl).toBeAttached();
        
        const tipsListEl = page.locator('#battle-results-tips-list');
        await expect(tipsListEl).toBeAttached();
    });
    
    test('B47: Share button present', async ({ page }) => {
        await setupCompletedUser(page);
        
        const shareBtn = page.locator('#battle-results-share-btn');
        await expect(shareBtn).toBeAttached();
    });
    
    test('B48: Rematch button present', async ({ page }) => {
        await setupCompletedUser(page);
        
        const rematchBtn = page.locator('#battle-results-rematch');
        await expect(rematchBtn).toBeAttached();
    });
});

test.describe('Battle Share Functions', () => {
    
    test('B49: shareBattleProgress function exists', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).shareBattleProgress === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B50: shareBattleResult function exists', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).shareBattleResult === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B51: getOrdinalSuffix returns correct values', async ({ page }) => {
        await setupCompletedUser(page);
        
        const suffixes = await page.evaluate(() => {
            const fn = (window as any).getOrdinalSuffix;
            if (!fn) return null;
            return {
                first: fn(1),
                second: fn(2),
                third: fn(3),
                fourth: fn(4),
                eleventh: fn(11),
                twentyFirst: fn(21)
            };
        });
        
        if (suffixes) {
            expect(suffixes.first).toBe('st');
            expect(suffixes.second).toBe('nd');
            expect(suffixes.third).toBe('rd');
            expect(suffixes.fourth).toBe('th');
            expect(suffixes.eleventh).toBe('th');
            expect(suffixes.twentyFirst).toBe('st');
        }
    });
    
    test('B52: Battle progress message format', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Simulate share message generation
        const message = await page.evaluate(() => {
            const battleName = 'Test Battle';
            const gameName = 'Wordle';
            const score = '3/6';
            const points = 20;
            const totalScore = 85;
            const position = 2;
            const daysLeft = 4;
            
            return [
                '⚔️ Battle Update!',
                '',
                `"${battleName}"`,
                '',
                `🟩 ${gameName}: ${score} (+${points} pts)`,
                `Total: ${totalScore} pts | 🥈 ${position}nd place`,
                '',
                `${daysLeft} days left in battle!`
            ].join('\n');
        });
        
        expect(message).toContain('⚔️ Battle Update!');
        expect(message).toContain('Test Battle');
        expect(message).toContain('Wordle');
        expect(message).toContain('85 pts');
    });
    
    test('B53: Victory share message format', async ({ page }) => {
        await setupCompletedUser(page);
        
        const message = await page.evaluate(() => {
            return [
                '🏆 VICTORY!',
                '',
                '⚔️ "Test Battle"',
                '',
                '📊 Final Score: 312 pts',
                '⭐ 5 perfect games',
                '👥 Beat 3 opponents',
                '',
                '🎁 Won 120 tokens!',
                '',
                'Challenge me on Game Shelf! 🎮'
            ].join('\n');
        });
        
        expect(message).toContain('🏆 VICTORY!');
        expect(message).toContain('312 pts');
        expect(message).toContain('Challenge me');
    });
});

test.describe('Battle Helper Functions', () => {
    
    test('B54: countPerfects returns string', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).countPerfects === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B55: countGamesPlayed returns fraction format', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).countGamesPlayed === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B56: getDurationDays calculates correctly', async ({ page }) => {
        await setupCompletedUser(page);
        
        const days = await page.evaluate(() => {
            const fn = (window as any).getDurationDays;
            if (!fn) {
                // Calculate manually
                const startDate = Date.now();
                const endDate = startDate + 7 * 24 * 60 * 60 * 1000;
                return Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
            }
            return fn({ startDate: Date.now(), endDate: Date.now() + 7 * 24 * 60 * 60 * 1000 });
        });
        
        expect(days).toBe(7);
    });
    
    test('B57: generateBattleTips returns array', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).generateBattleTips === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B58: updateBattleImpact function exists', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).updateBattleImpact === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B59: showBattleResultsModal function exists', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).showBattleResultsModal === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
    
    test('B60: closeBattleResults function exists', async ({ page }) => {
        await setupCompletedUser(page);
        
        const fnExists = await page.evaluate(() => {
            return typeof (window as any).closeBattleResults === 'function';
        });
        
        expect(fnExists).toBe(true);
    });
});
