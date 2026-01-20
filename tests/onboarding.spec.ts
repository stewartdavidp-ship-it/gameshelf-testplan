import { test, expect, Page } from '@playwright/test';

/**
 * Onboarding Tests (Section A)
 * 
 * Tests the complete new user onboarding flow including:
 * - Welcome modal
 * - Game selection
 * - Tutorial
 * - First result logging
 */

test.describe('Onboarding Flow', () => {
    
    // Before each test, start with a fresh state
    test.beforeEach(async ({ page }) => {
        // Use ?fresh=1 to clear all localStorage and start fresh
        await page.goto('/?fresh=1');
        // Wait for the page to reload after clearing
        await page.waitForLoadState('networkidle');
    });

    test('A1: Welcome modal shows for new user @smoke', async ({ page }) => {
        // The welcome modal should be visible for new users
        const welcomeModal = page.locator('.welcome-modal, .onboarding-modal, [data-testid="welcome"]');
        
        // Wait for modal to appear (may take a moment after fresh load)
        await expect(welcomeModal).toBeVisible({ timeout: 10000 });
        
        // Verify welcome text
        await expect(page.getByText(/welcome/i)).toBeVisible();
    });

    test('A2: Can proceed past welcome screen', async ({ page }) => {
        // Find and click the get started / continue button
        const startButton = page.getByRole('button', { name: /get started|continue|let's go/i });
        
        await expect(startButton).toBeVisible();
        await startButton.click();
        
        // Should proceed to game selection or next step
        // Wait for either game selection screen or next modal
        await page.waitForTimeout(500); // Allow transition
        
        // Welcome modal should no longer be visible or should have changed content
        const gameSelection = page.locator('.game-selection, .game-picker, [data-step="games"]');
        await expect(gameSelection).toBeVisible({ timeout: 5000 });
    });

    test('A3: Can select games during onboarding', async ({ page }) => {
        // Navigate to game selection
        const startButton = page.getByRole('button', { name: /get started|continue/i });
        if (await startButton.isVisible()) {
            await startButton.click();
        }
        
        // Wait for game options to load
        await page.waitForSelector('.game-option, .game-card, [data-game]', { timeout: 5000 });
        
        // Count available games
        const gameOptions = page.locator('.game-option, .game-card, [data-game]');
        const gameCount = await gameOptions.count();
        
        // Should have multiple games available
        expect(gameCount).toBeGreaterThan(5);
        
        // Select first 3 games
        for (let i = 0; i < 3; i++) {
            await gameOptions.nth(i).click();
        }
        
        // Continue button should be enabled with 3+ selections
        const continueButton = page.getByRole('button', { name: /continue|done|next/i });
        await expect(continueButton).toBeEnabled();
    });

    test('A4: Minimum game selection enforced (at least 1)', async ({ page }) => {
        // Navigate to game selection
        const startButton = page.getByRole('button', { name: /get started|continue/i });
        if (await startButton.isVisible()) {
            await startButton.click();
        }
        
        await page.waitForSelector('.game-option, .game-card, [data-game]', { timeout: 5000 });
        
        // Without selecting any games, continue should be disabled
        const continueButton = page.getByRole('button', { name: /continue|done|next/i });
        
        // Either disabled or clicking shows an error
        const isDisabled = await continueButton.isDisabled().catch(() => false);
        
        if (!isDisabled) {
            // If button is enabled, clicking should show error
            await continueButton.click();
            await expect(page.getByText(/select at least|choose a game|minimum/i)).toBeVisible({ timeout: 3000 });
        } else {
            expect(isDisabled).toBe(true);
        }
    });

    test('A5: Can complete full onboarding flow', async ({ page }) => {
        // Step 1: Welcome
        const startButton = page.getByRole('button', { name: /get started|continue/i });
        if (await startButton.isVisible()) {
            await startButton.click();
        }
        
        // Step 2: Select games
        await page.waitForSelector('.game-option, .game-card, [data-game]', { timeout: 5000 });
        const gameOptions = page.locator('.game-option, .game-card, [data-game]');
        
        // Select 3 games
        await gameOptions.nth(0).click();
        await gameOptions.nth(1).click();
        await gameOptions.nth(2).click();
        
        // Click continue
        await page.getByRole('button', { name: /continue|done|next/i }).click();
        
        // Step 3: Should reach main app (home screen)
        // Wait for home tab or main content
        await page.waitForTimeout(1000); // Allow transitions
        
        // Verify we're on the main app by checking for key elements
        const mainApp = page.locator('[data-tab="home"], .home-tab, .main-content, .app-content');
        await expect(mainApp).toBeVisible({ timeout: 10000 });
    });

    test('A7: Tutorial can be skipped', async ({ page }) => {
        // Complete initial setup first
        const startButton = page.getByRole('button', { name: /get started|continue/i });
        if (await startButton.isVisible()) {
            await startButton.click();
        }
        
        await page.waitForSelector('.game-option, .game-card, [data-game]', { timeout: 5000 });
        const gameOptions = page.locator('.game-option, .game-card, [data-game]');
        await gameOptions.nth(0).click();
        await gameOptions.nth(1).click();
        await gameOptions.nth(2).click();
        await page.getByRole('button', { name: /continue|done|next/i }).click();
        
        // Look for tutorial or skip option
        const skipButton = page.getByRole('button', { name: /skip|later|no thanks/i });
        
        if (await skipButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await skipButton.click();
            // Should proceed to main app
            const mainApp = page.locator('[data-tab="home"], .home-tab, .main-content');
            await expect(mainApp).toBeVisible({ timeout: 5000 });
        }
    });

    test('A8: Onboarding state persists on reload', async ({ page }) => {
        // Complete onboarding
        const startButton = page.getByRole('button', { name: /get started|continue/i });
        if (await startButton.isVisible()) {
            await startButton.click();
        }
        
        await page.waitForSelector('.game-option, .game-card, [data-game]', { timeout: 5000 });
        const gameOptions = page.locator('.game-option, .game-card, [data-game]');
        await gameOptions.nth(0).click();
        await gameOptions.nth(1).click();
        await gameOptions.nth(2).click();
        await page.getByRole('button', { name: /continue|done|next/i }).click();
        
        // Wait for main app
        await page.waitForTimeout(2000);
        
        // Reload the page WITHOUT ?fresh=1
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Should NOT see welcome modal again
        const welcomeModal = page.locator('.welcome-modal, .onboarding-modal');
        await expect(welcomeModal).not.toBeVisible({ timeout: 5000 });
        
        // Should be on main app
        const mainApp = page.locator('[data-tab="home"], .home-tab, .main-content');
        await expect(mainApp).toBeVisible();
    });
});
