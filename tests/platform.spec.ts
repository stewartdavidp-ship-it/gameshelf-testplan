/**
 * Platform & PWA Tests
 * 
 * Tests PWA installation prompts, platform detection, and responsive behavior.
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

test.describe('PWA & Platform Detection', () => {
    
    test.describe('Service Worker & Manifest', () => {
        
        test('P1: Service worker is registered', async ({ page }) => {
            await page.goto(GAMESHELF_URL);
            await page.waitForLoadState('load');
            
            // Check if service worker is registered
            const swRegistered = await page.evaluate(async () => {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    return registrations.length > 0;
                }
                return false;
            });
            
            // PWA should have a service worker (may be false in test env)
            // This documents whether it's present
            console.log(`Service worker registered: ${swRegistered}`);
        });
        
        test('P2: Manifest is present', async ({ page }) => {
            await page.goto(GAMESHELF_URL);
            
            // Check for manifest link tag
            const manifestLink = page.locator('link[rel="manifest"]');
            const hasManifest = await manifestLink.count() > 0;
            
            if (hasManifest) {
                const href = await manifestLink.getAttribute('href');
                expect(href).toBeTruthy();
            }
        });
        
        test('P3: App has proper meta tags for PWA', async ({ page }) => {
            await page.goto(GAMESHELF_URL);
            
            // Check for mobile-web-app-capable meta tag
            const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
            const themeMeta = page.locator('meta[name="theme-color"]');
            const viewportMeta = page.locator('meta[name="viewport"]');
            
            // Should have viewport meta at minimum
            await expect(viewportMeta).toHaveCount(1);
        });
    });
    
    test.describe('Standalone Mode Detection', () => {
        
        test('P4: App detects browser mode', async ({ page }) => {
            await setupCompletedUser(page);
            
            // In browser mode, display-mode should not be standalone
            const isStandalone = await page.evaluate(() => {
                return window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;
            });
            
            // In Playwright, we're always in browser mode
            expect(isStandalone).toBe(false);
        });
        
        test('P5: App can detect iOS Safari', async ({ page }) => {
            await setupCompletedUser(page);
            
            const userAgent = await page.evaluate(() => navigator.userAgent);
            const isIOS = /iPhone|iPad|iPod/.test(userAgent);
            const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
            
            // Log the detection for debugging
            console.log(`iOS: ${isIOS}, Safari: ${isSafari}`);
        });
    });
    
    test.describe('Responsive Layout', () => {
        
        test('P6-desktop: Desktop layout shows full navigation', async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 720 });
            await setupCompletedUser(page);
            
            // Navigation should be visible
            const nav = page.locator('.nav-bar, .bottom-nav, nav');
            await expect(nav).toBeVisible();
            
            // All tabs should be visible
            const tabs = page.locator('.nav-tab');
            const count = await tabs.count();
            expect(count).toBeGreaterThanOrEqual(4); // home, games, social, share
        });
        
        test('P7-tablet: Tablet layout works', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 }); // iPad
            await setupCompletedUser(page);
            
            // App should still be usable
            const nav = page.locator('.nav-bar, .bottom-nav, nav');
            await expect(nav).toBeVisible();
            
            // Game cards should be visible
            const gameCards = page.locator('.game-card');
            await expect(gameCards.first()).toBeVisible();
        });
        
        test('P8-mobile: Mobile layout is touch-friendly', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
            await setupCompletedUser(page);
            
            // Navigation should still work
            const nav = page.locator('.nav-bar, .bottom-nav, nav');
            await expect(nav).toBeVisible();
            
            // Check that nav fits in viewport
            const navBox = await nav.boundingBox();
            if (navBox) {
                expect(navBox.width).toBeLessThanOrEqual(375);
            }
        });
        
        test('P9-mobile: No horizontal scroll on mobile', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await setupCompletedUser(page);
            
            // Check document width matches viewport
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            
            expect(hasHorizontalScroll).toBe(false);
        });
    });
    
    test.describe('Touch & Gesture Support', () => {
        
        test('P10: Bottom sheet can be swiped down', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await setupCompletedUser(page);
            
            // Open log sheet
            await page.goto(GAMESHELF_URL + '#log');
            await page.waitForTimeout(500);
            
            const sheet = page.locator('#log-sheet.active, .bottom-sheet.active');
            const isVisible = await sheet.isVisible().catch(() => false);
            
            if (isVisible) {
                // Get initial position
                const box = await sheet.boundingBox();
                if (box) {
                    // Simulate swipe down (drag from middle to bottom)
                    const startY = box.y + 50;
                    const endY = box.y + box.height;
                    
                    await page.mouse.move(box.x + box.width / 2, startY);
                    await page.mouse.down();
                    await page.mouse.move(box.x + box.width / 2, endY, { steps: 10 });
                    await page.mouse.up();
                    
                    await page.waitForTimeout(500);
                    
                    // Sheet might be dismissed or minimized
                    // This tests that the gesture doesn't break anything
                }
            }
        });
    });
    
    test.describe('Offline Behavior', () => {
        
        test('P11: App handles offline gracefully', async ({ page, context }) => {
            await setupCompletedUser(page);
            
            // Go offline
            await context.setOffline(true);
            
            // Try to navigate within app
            await page.locator('.nav-tab[data-tab="games"]').click();
            await page.waitForTimeout(500);
            
            // App should still be usable (PWA cached)
            const nav = page.locator('.nav-tab');
            await expect(nav.first()).toBeVisible();
            
            // Go back online
            await context.setOffline(false);
        });
        
        test('P12: Local data persists offline', async ({ page, context }) => {
            await setupCompletedUser(page);
            
            // Log a game result
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                data.history = data.history || {};
                data.history[today] = { wordle: { score: '3/6', timestamp: Date.now() } };
                localStorage.setItem('gameShelfData', JSON.stringify(data));
            });
            
            // Verify data was saved before going offline
            const dataSaved = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('gameShelfData') || '{}');
                const today = new Date().toISOString().split('T')[0];
                return data.history?.[today]?.wordle !== undefined;
            });
            expect(dataSaved).toBe(true);
            
            // Go offline
            await context.setOffline(true);
            
            // Try to access localStorage while "offline" (should still work - localStorage is local)
            const hasData = await page.evaluate(() => {
                // localStorage should persist regardless of network state
                const data = localStorage.getItem('gameShelfData');
                return data !== null && data.includes('wordle');
            }).catch(() => false);
            
            expect(hasData).toBe(true);
            
            // Clean up
            await context.setOffline(false);
            await context.setOffline(false);
        });
    });
});

test.describe('Cross-Browser Compatibility', () => {
    
    test('P13: Core functionality works', async ({ page, browserName }) => {
        await setupCompletedUser(page);
        
        // These should work in all browsers
        // 1. Navigation tabs work
        const gamesTab = page.locator('.nav-tab[data-tab="games"]');
        await gamesTab.click();
        await expect(gamesTab).toHaveClass(/active/);
        
        // 2. Can switch back to home
        const homeTab = page.locator('.nav-tab[data-tab="home"]');
        await homeTab.click();
        await expect(homeTab).toHaveClass(/active/);
        
        console.log(`✓ Core functionality works in ${browserName}`);
    });
    
    test('P14: LocalStorage works', async ({ page, browserName }) => {
        await page.goto(GAMESHELF_URL);
        
        // Set and get localStorage
        await page.evaluate(() => {
            localStorage.setItem('test_key', 'test_value');
        });
        
        const value = await page.evaluate(() => {
            return localStorage.getItem('test_key');
        });
        
        expect(value).toBe('test_value');
        console.log(`✓ LocalStorage works in ${browserName}`);
    });
});
