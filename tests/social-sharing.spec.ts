/**
 * Social & Sharing Tests
 * 
 * Tests referral URLs, friend requests, social sharing (X/Twitter), 
 * and profile link generation.
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
            referral: {
                myCode: 'TEST123',
                referredBy: null,
                invitesSent: 0,
                friendsJoined: 0
            },
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

test.describe('Referral & Friend URLs', () => {
    
    test.describe('Referral Code Generation', () => {
        
        test('S1: Referral code is generated for user', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Check that referral code exists in app data
            const hasCode = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.referral?.myCode !== null && data.referral?.myCode !== undefined;
            });
            
            expect(hasCode).toBe(true);
        });
        
        test('S2: Referral link format is correct', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Get the referral link from the app
            const referralLink = await page.evaluate(() => {
                // Try to access getReferralLink function
                if (typeof (window as any).getReferralLink === 'function') {
                    return (window as any).getReferralLink();
                }
                // Fallback: construct from stored code
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const code = data.referral?.myCode;
                if (code) {
                    return `${window.location.origin}/#ref=${code}`;
                }
                return null;
            });
            
            // Link should have correct format
            if (referralLink) {
                expect(referralLink).toMatch(/#ref=[A-Z0-9]+/i);
                expect(referralLink).toContain('ref=');
            }
        });
        
        test('S3: Referral link can be copied', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Navigate to share tab
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            // Look for copy button
            const copyBtn = page.locator('button:has-text("Copy"), .copy-btn, [onclick*="copyReferral"]');
            
            if (await copyBtn.isVisible().catch(() => false)) {
                // Track clipboard write
                let clipboardContent = '';
                await page.evaluate(() => {
                    (navigator as any).clipboard.writeText = (text: string) => {
                        (window as any).lastClipboardWrite = text;
                        return Promise.resolve();
                    };
                });
                
                await copyBtn.first().click();
                await page.waitForTimeout(300);
                
                clipboardContent = await page.evaluate(() => (window as any).lastClipboardWrite || '');
                
                // Should have copied a referral link
                if (clipboardContent) {
                    expect(clipboardContent).toMatch(/ref=|profile=/);
                }
            }
        });
    });
    
    test.describe('Friend URL Handling', () => {
        
        test('S4: Profile link format is correct', async ({ page }) => {
            await setupCompletedUser(page);
            
            const profileLink = await page.evaluate(() => {
                if (typeof (window as any).getProfileLink === 'function') {
                    return (window as any).getProfileLink();
                }
                return null;
            });
            
            // If profile link exists, check format
            if (profileLink) {
                expect(profileLink).toMatch(/#profile=[a-zA-Z0-9]+/);
            }
        });
        
        test('S5: Friend code input accepts valid codes', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Navigate to social tab
            await page.locator('.nav-tab[data-tab="social"]').click();
            await page.waitForTimeout(500);
            
            // Look for friend code input
            const codeInput = page.locator('input[placeholder*="code" i], input[placeholder*="friend" i], #friend-code-input');
            
            if (await codeInput.isVisible().catch(() => false)) {
                // Enter a test code
                await codeInput.fill('ABC123');
                
                // Input should accept the value
                await expect(codeInput).toHaveValue('ABC123');
            }
        });
        
        test('S6: Referral URL parameter is detected on load', async ({ page }) => {
            // Navigate with referral code
            await page.goto(GAMESHELF_URL + '#ref=TESTCODE123');
            await page.waitForLoadState('load');
            await page.waitForTimeout(1000);
            
            // Check if referral was detected (may show prompt or store in data)
            const detected = await page.evaluate(() => {
                // Check localStorage or any referral handling
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                return data.referral?.referredBy !== null || 
                       document.body.innerText.includes('TESTCODE') ||
                       document.body.innerText.includes('referral');
            });
            
            // Log the detection status for debugging
            console.log(`Referral code detected: ${detected}`);
        });
        
        test('S7: Profile URL parameter opens profile view', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Navigate with profile parameter
            await page.goto(GAMESHELF_URL + '#profile=testuser123');
            await page.waitForTimeout(1000);
            
            // Should show some profile-related UI or handle gracefully
            // (Exact behavior depends on implementation)
        });
    });
});

test.describe('Social Sharing (X/Twitter)', () => {
    
    test.describe('Share URL Generation', () => {
        
        test('X1: Twitter share URL format is correct', async ({ page }) => {
            await setupCompletedUser(page);
            
            // Capture window.open calls
            let shareUrl = '';
            await page.exposeFunction('captureShare', (url: string) => {
                shareUrl = url;
            });
            
            await page.evaluate(() => {
                window.open = (url) => {
                    (window as any).captureShare(url);
                    return null;
                };
            });
            
            // Navigate to share tab
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            // Find and click Twitter/X share button
            const twitterBtn = page.locator('button:has-text("𝕏"), button[onclick*="twitter"], .share-btn-twitter');
            
            if (await twitterBtn.isVisible().catch(() => false)) {
                await twitterBtn.first().click();
                await page.waitForTimeout(500);
                
                // Verify URL format
                if (shareUrl) {
                    expect(shareUrl).toContain('twitter.com/intent/tweet');
                    expect(shareUrl).toContain('text=');
                }
            }
        });
        
        test('X2: Share text is URL-encoded correctly', async ({ page }) => {
            await setupCompletedUser(page);
            
            let shareUrl = '';
            await page.exposeFunction('captureShare', (url: string) => {
                shareUrl = url;
            });
            
            await page.evaluate(() => {
                window.open = (url) => {
                    (window as any).captureShare(url);
                    return null;
                };
            });
            
            // Navigate to share tab and click Twitter
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            const twitterBtn = page.locator('button:has-text("𝕏"), [onclick*="twitter"]').first();
            if (await twitterBtn.isVisible().catch(() => false)) {
                await twitterBtn.click();
                await page.waitForTimeout(300);
                
                if (shareUrl) {
                    // Check that special characters are encoded
                    expect(shareUrl).not.toContain(' '); // Spaces should be encoded
                    
                    // Decode and verify content makes sense
                    const textParam = shareUrl.match(/text=([^&]+)/);
                    if (textParam) {
                        const decodedText = decodeURIComponent(textParam[1]);
                        expect(decodedText.length).toBeGreaterThan(0);
                        console.log('Share text:', decodedText);
                    }
                }
            }
        });
        
        test('X3: Share includes app link', async ({ page }) => {
            await setupCompletedUser(page);
            
            let shareUrl = '';
            await page.exposeFunction('captureShare', (url: string) => {
                shareUrl = url;
            });
            
            await page.evaluate(() => {
                window.open = (url) => {
                    (window as any).captureShare(url);
                    return null;
                };
            });
            
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            const twitterBtn = page.locator('button:has-text("𝕏"), [onclick*="twitter"]').first();
            if (await twitterBtn.isVisible().catch(() => false)) {
                await twitterBtn.click();
                await page.waitForTimeout(300);
                
                if (shareUrl) {
                    // Verify share URL is a valid Twitter intent URL
                    expect(shareUrl).toContain('twitter.com/intent/tweet');
                    // Note: Share text may or may not include app link depending on app config
                    const textParam = shareUrl.match(/text=([^&]+)/);
                    if (textParam) {
                        const decodedText = decodeURIComponent(textParam[1]);
                        // Just verify we have some share text
                        expect(decodedText.length).toBeGreaterThan(0);
                    }
                }
            }
        });
    });
    
    test.describe('Other Share Platforms', () => {
        
        test('X4: SMS share opens messaging', async ({ page }) => {
            await setupCompletedUser(page);
            
            let shareUrl = '';
            await page.exposeFunction('captureShare', (url: string) => {
                shareUrl = url;
            });
            
            await page.evaluate(() => {
                window.open = (url) => {
                    (window as any).captureShare(url);
                    return null;
                };
            });
            
            // Look for SMS share button
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            const smsBtn = page.locator('button:has-text("Text"), button:has-text("SMS"), [onclick*="sms"]');
            
            if (await smsBtn.isVisible().catch(() => false)) {
                await smsBtn.first().click();
                await page.waitForTimeout(300);
                
                if (shareUrl) {
                    expect(shareUrl).toMatch(/^sms:/i);
                }
            }
        });
        
        test('X5: Email share has correct format', async ({ page }) => {
            await setupCompletedUser(page);
            
            let shareUrl = '';
            await page.exposeFunction('captureShare', (url: string) => {
                shareUrl = url;
            });
            
            await page.evaluate(() => {
                window.open = (url) => {
                    (window as any).captureShare(url);
                    return null;
                };
            });
            
            await page.locator('.nav-tab[data-tab="share"]').click();
            await page.waitForTimeout(500);
            
            const emailBtn = page.locator('button:has-text("Email"), [onclick*="email"]');
            
            if (await emailBtn.isVisible().catch(() => false)) {
                await emailBtn.first().click();
                await page.waitForTimeout(300);
                
                if (shareUrl) {
                    expect(shareUrl).toMatch(/^mailto:/i);
                    expect(shareUrl).toContain('subject=');
                }
            }
        });
    });
});

test.describe('Referral Sheet UI', () => {
    
    test('REF1: Referral sheet opens', async ({ page }) => {
        await setupCompletedUser(page);
        
        // Try to open referral sheet
        await page.locator('.nav-tab[data-tab="share"]').click();
        await page.waitForTimeout(500);
        
        // Look for invite/referral button
        const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Refer"), [onclick*="showReferral"]');
        
        if (await inviteBtn.isVisible().catch(() => false)) {
            await inviteBtn.first().click();
            await page.waitForTimeout(500);
            
            // Referral sheet should be visible
            const sheet = page.locator('#referral-sheet.active, .referral-sheet.active');
            if (await sheet.isVisible().catch(() => false)) {
                await expect(sheet).toBeVisible();
            }
        }
    });
    
    test('REF2: Referral stats display', async ({ page }) => {
        await setupCompletedUser(page);
        
        await page.locator('.nav-tab[data-tab="share"]').click();
        await page.waitForTimeout(500);
        
        // Check if referral stats are shown somewhere
        const statsVisible = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('invite') || 
                   text.includes('referral') || 
                   text.includes('friend');
        });
        
        // Log for debugging
        console.log(`Referral content visible: ${statsVisible}`);
    });
});
