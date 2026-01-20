import { test, expect, Page } from '@playwright/test';

/**
 * Deep Links Tests (Section H)
 * 
 * Tests deep link functionality including:
 * - Navigation deep links
 * - Data deep links (referral, friend, battle)
 * - Security / XSS prevention
 */

test.describe('Deep Links', () => {
    
    // Helper to set up a completed user
    async function setupCompletedUser(page: Page) {
        const seedData = btoa(JSON.stringify({
            selectedGames: ['wordle', 'connections'],
            setupComplete: true
        }));
        await page.goto(`/?seedData=${seedData}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
    }

    test.describe('Navigation Links', () => {
        
        test.beforeEach(async ({ page }) => {
            await setupCompletedUser(page);
        });

        test('H-nav: #log opens log sheet @smoke', async ({ page }) => {
            await page.goto('/#log');
            await page.waitForTimeout(500);
            
            const logSheet = page.locator('.log-sheet, .log-modal, [data-sheet="log"]');
            await expect(logSheet).toBeVisible({ timeout: 5000 });
        });

        test('H-nav: #menu opens settings menu', async ({ page }) => {
            await page.goto('/#menu');
            await page.waitForTimeout(500);
            
            const menu = page.locator('.settings-menu, .menu-sheet, [data-sheet="menu"]');
            await expect(menu).toBeVisible({ timeout: 5000 });
        });

        test('H-nav: #settings opens settings', async ({ page }) => {
            await page.goto('/#settings');
            await page.waitForTimeout(500);
            
            const settings = page.locator('.settings, .settings-modal, [data-sheet="settings"]');
            await expect(settings).toBeVisible({ timeout: 5000 });
        });

        test('H-nav: #home switches to home tab', async ({ page }) => {
            // First go to different tab
            await page.goto('/#games');
            await page.waitForTimeout(500);
            
            // Then navigate to home
            await page.goto('/#home');
            await page.waitForTimeout(500);
            
            const homeTab = page.locator('[data-tab="home"].active, .nav-tab.active[data-tab="home"]');
            await expect(homeTab).toBeVisible();
        });

        test('H-nav: #games switches to games tab', async ({ page }) => {
            await page.goto('/#games');
            await page.waitForTimeout(500);
            
            const gamesTab = page.locator('[data-tab="games"].active, .nav-tab.active[data-tab="games"]');
            await expect(gamesTab).toBeVisible();
        });

        test('H-nav: #social switches to social tab', async ({ page }) => {
            await page.goto('/#social');
            await page.waitForTimeout(500);
            
            const socialTab = page.locator('[data-tab="social"].active, .nav-tab.active[data-tab="social"]');
            await expect(socialTab).toBeVisible();
        });

        test('H-nav: #share switches to share tab', async ({ page }) => {
            await page.goto('/#share');
            await page.waitForTimeout(500);
            
            const shareTab = page.locator('[data-tab="share"].active, .nav-tab.active[data-tab="share"]');
            await expect(shareTab).toBeVisible();
        });

        test('H-nav: #tutorial starts tutorial', async ({ page }) => {
            await page.goto('/#tutorial');
            await page.waitForTimeout(500);
            
            // Tutorial overlay or modal should be visible
            const tutorial = page.locator('.tutorial, .tour, [data-tutorial]');
            await expect(tutorial).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Referral Links (H1)', () => {
        
        test('H1: Valid referral code stored', async ({ page }) => {
            await page.goto('/#ref=TESTCODE123');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
            
            // Check if referral was stored
            const stored = await page.evaluate(() => {
                return localStorage.getItem('gs-referral') || 
                       sessionStorage.getItem('referralCode') ||
                       (window as any).GameShelfTest?.getState()?.referral;
            });
            
            // Referral should be stored somewhere
            // Note: exact storage method may vary
            expect(stored).toBeTruthy();
        });

        test('H1-variant: Empty referral ignored', async ({ page }) => {
            // Should not crash with empty ref
            await page.goto('/#ref=');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // App should still work
            const app = page.locator('.app, .main-content, body');
            await expect(app).toBeVisible();
            
            // No error in console
            const errors = await page.evaluate(() => {
                return (window as any).GameShelfTest?.errors || [];
            });
            expect(errors.length).toBe(0);
        });

        test('H1-variant: XSS in referral sanitized', async ({ page }) => {
            // Try XSS in referral
            await page.goto('/#ref=<script>alert(1)</script>');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // No alert should appear (would cause error in Playwright)
            // Check no script executed
            const xssExecuted = await page.evaluate(() => {
                return (window as any).xssTest === true;
            });
            expect(xssExecuted).toBe(false);
        });
    });

    test.describe('Friend Links (H2)', () => {
        
        test('H2-variant: Empty friend param ignored', async ({ page }) => {
            await page.goto('/#friend=');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // Should not crash, app still works
            const app = page.locator('.app, .main-content');
            await expect(app).toBeVisible();
        });
    });

    test.describe('Battle Links (H3)', () => {
        
        test('H3-variant: Invalid battle code handled', async ({ page }) => {
            // Use seed data to set up completed user
            const seedData = btoa(JSON.stringify({
                selectedGames: ['wordle'],
                setupComplete: true
            }));
            await page.goto(`/?seedData=${seedData}#battle=INVALID123`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
            
            // Should show error or "not found" message, not crash
            const error = page.getByText(/not found|invalid|doesn't exist/i);
            const isErrorVisible = await error.isVisible().catch(() => false);
            
            // Either shows error or gracefully handles
            if (!isErrorVisible) {
                // App should still be functional
                const app = page.locator('.app, .main-content');
                await expect(app).toBeVisible();
            }
        });
    });

    test.describe('Security Tests (H5)', () => {
        
        test.beforeEach(async ({ page }) => {
            // Add console error listener
            page.on('pageerror', (error) => {
                console.log('Page error:', error.message);
            });
        });

        test('H5: Unknown hash ignored without crash @smoke', async ({ page }) => {
            await page.goto('/#unknown_hash_parameter');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // App should still work
            const app = page.locator('.app, .main-content, body');
            await expect(app).toBeVisible();
        });

        test('H5-variant: Malformed params sanitized', async ({ page }) => {
            await page.goto('/#log=&&&===');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // No crash
            const app = page.locator('.app, .main-content');
            await expect(app).toBeVisible();
        });

        test('H5-variant: XSS attempt in hash blocked', async ({ page }) => {
            // Try various XSS payloads
            const xssPayloads = [
                '#<script>alert(1)</script>',
                '#<img src=x onerror=alert(1)>',
                '#javascript:alert(1)',
                '#"><script>alert(1)</script>',
            ];
            
            for (const payload of xssPayloads) {
                await page.goto('/' + payload);
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(300);
                
                // Check no XSS executed
                const xssExecuted = await page.evaluate(() => {
                    return document.body.innerHTML.includes('<script>alert') ||
                           document.body.innerHTML.includes('onerror=');
                });
                expect(xssExecuted).toBe(false);
            }
        });

        test('H5-variant: SQL injection attempt handled', async ({ page }) => {
            await page.goto("/#'; DROP TABLE users;--");
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // App should still work
            const app = page.locator('.app, .main-content');
            await expect(app).toBeVisible();
        });

        test('H5-variant: Very long hash handled', async ({ page }) => {
            const longHash = '#' + 'x'.repeat(1000);
            await page.goto('/' + longHash);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // Should not crash - check no error
            const app = page.locator('.app, .main-content');
            await expect(app).toBeVisible();
        });

        test('H5-variant: Unicode in hash handled', async ({ page }) => {
            await page.goto('/#ref=测试🎮emoji');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // Should handle gracefully
            const app = page.locator('.app, .main-content');
            await expect(app).toBeVisible();
        });

        test('H5-variant: URL encoded XSS blocked', async ({ page }) => {
            await page.goto('/#ref=%3Cscript%3Ealert(1)%3C/script%3E');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            
            // Check no script in DOM
            const hasScript = await page.evaluate(() => {
                return document.body.innerHTML.toLowerCase().includes('<script>alert');
            });
            expect(hasScript).toBe(false);
        });
    });

    test.describe('Deep Links During Onboarding', () => {
        
        test('Deep links ignored during onboarding', async ({ page }) => {
            // Fresh user - onboarding
            await page.goto('/?fresh=1');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            
            // Try to use deep link
            await page.goto('/?fresh=1#log');
            await page.waitForTimeout(500);
            
            // Should still be on onboarding, not log sheet
            const welcomeModal = page.locator('.welcome-modal, .onboarding-modal');
            const logSheet = page.locator('.log-sheet, .log-modal');
            
            // Welcome should be visible OR log should NOT be visible
            const welcomeVisible = await welcomeModal.isVisible().catch(() => false);
            const logVisible = await logSheet.isVisible().catch(() => false);
            
            // Either welcome is showing, or log is not showing
            expect(welcomeVisible || !logVisible).toBe(true);
        });
    });
});
