/**
 * Share Hub Tests
 * 
 * Tests for Share Hub functionality including:
 * - Referral link inclusion in shares
 * - Share history saving and retrieval
 * - Template selection and message generation
 * - Platform-specific sharing
 */

import { test, expect, Page } from '@playwright/test';

const GAMESHELF_URL = process.env.GAMESHELF_URL || 'https://stewartdavidp-ship-it.github.io/gameshelftest/';

// Helper to set up app with some logged games
async function setupWithGames(page: Page) {
    await page.goto(GAMESHELF_URL);
    await page.waitForLoadState('networkidle');
    
    // Set up initial data with some games logged
    await page.evaluate(() => {
        const today = new Date().toISOString().split('T')[0];
        const appData = {
            selectedGames: ['wordle', 'connections', 'mini'],
            history: {
                [today]: {
                    wordle: { score: '4/6', played: true },
                    connections: { score: '✓', played: true },
                    mini: { score: '0:45', played: true }
                }
            },
            setupComplete: true,
            shareHistory: []
        };
        localStorage.setItem('gameshelf-data', JSON.stringify(appData));
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
}

// Helper to navigate to Share tab
async function goToShareTab(page: Page) {
    await page.click('[data-tab="share"]');
    await page.waitForTimeout(300);
}

test.describe('SH: Share Hub - Referral Link', () => {
    
    test('SH1: Default message includes referral link', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        // Should include referral link
        expect(message).toContain('📲 Track your puzzles:');
        expect(message).toContain('#ref=');
    });
    
    test('SH2: Referral link checkbox toggles link inclusion', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Initially should have link (checkbox is checked by default)
        let message = await page.locator('#share-screen-message').inputValue();
        expect(message).toContain('#ref=');
        
        // Uncheck the box
        await page.click('#share-include-link');
        await page.waitForTimeout(100);
        
        // Message should regenerate without link
        message = await page.locator('#share-screen-message').inputValue();
        expect(message).not.toContain('#ref=');
        expect(message).not.toContain('Track your puzzles');
        
        // Re-check the box
        await page.click('#share-include-link');
        await page.waitForTimeout(100);
        
        // Link should be back
        message = await page.locator('#share-screen-message').inputValue();
        expect(message).toContain('#ref=');
    });
    
    test('SH3: Minimal template excludes referral link', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Select minimal template
        await page.selectOption('#share-screen-template', 'minimal');
        await page.waitForTimeout(100);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        // Minimal should NOT have referral link even if checkbox is checked
        expect(message).not.toContain('#ref=');
        expect(message).not.toContain('Track your puzzles');
        
        // Should be pipe-separated format
        expect(message).toMatch(/\|/);
    });
    
    test('SH4: Referral link uses correct base URL', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        // Should use the dynamic base URL, not hardcoded
        // The URL should include the path to the app
        expect(message).toContain('gameshelftest');
        expect(message).not.toMatch(/github\.io\/#ref=/); // Should NOT be missing the path
    });
    
    test('SH5: All templates include referral link when enabled', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const templates = ['default', 'brag', 'humble', 'streak', 'challenge'];
        
        for (const template of templates) {
            await page.selectOption('#share-screen-template', template);
            await page.waitForTimeout(100);
            
            const message = await page.locator('#share-screen-message').inputValue();
            expect(message, `Template '${template}' should include referral link`).toContain('#ref=');
        }
    });
});

test.describe('SH: Share Hub - Share History', () => {
    
    test('SH6: Share history section exists', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // History section should exist (may be hidden if empty)
        const section = page.locator('#share-history-section');
        await expect(section).toBeAttached();
    });
    
    test('SH7: Copy saves to share history', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Ensure save to history is checked
        const saveCheckbox = page.locator('#share-save-history');
        if (!await saveCheckbox.isChecked()) {
            await saveCheckbox.click();
        }
        
        // Click copy button
        await page.click('button:has-text("Copy")');
        await page.waitForTimeout(300);
        
        // Check localStorage for saved history
        const historyData = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.shareHistory || [];
        });
        
        expect(historyData.length).toBeGreaterThan(0);
        expect(historyData[0].platform).toBe('copy');
        expect(historyData[0].message).toBeTruthy();
    });
    
    test('SH8: Share history displays after saving', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Click copy to create a history entry
        await page.click('button:has-text("Copy")');
        await page.waitForTimeout(300);
        
        // History section should now be visible
        const section = page.locator('#share-history-section');
        await expect(section).toBeVisible();
        
        // Should have at least one item
        const items = page.locator('.share-history-item');
        await expect(items).toHaveCount(1);
    });
    
    test('SH9: Share history can be expanded/collapsed', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with history
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.shareHistory = [
                { id: 1, timestamp: new Date().toISOString(), platform: 'twitter', message: 'Test message 1', template: 'default' },
                { id: 2, timestamp: new Date().toISOString(), platform: 'copy', message: 'Test message 2', template: 'brag' }
            ];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        const section = page.locator('#share-history-section');
        const list = page.locator('#share-history-list');
        
        // Initially collapsed
        await expect(section).not.toHaveClass(/expanded/);
        
        // Click to expand
        await page.click('.share-history-header');
        await page.waitForTimeout(200);
        
        await expect(section).toHaveClass(/expanded/);
        
        // Click to collapse
        await page.click('.share-history-header');
        await page.waitForTimeout(200);
        
        await expect(section).not.toHaveClass(/expanded/);
    });
    
    test('SH10: Clicking history item loads message', async ({ page }) => {
        await setupWithGames(page);
        
        const testMessage = '🏆 This is a test message from history!';
        
        // Pre-populate with history
        await page.evaluate((msg) => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.shareHistory = [
                { id: 1, timestamp: new Date().toISOString(), platform: 'twitter', message: msg, template: 'brag' }
            ];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        }, testMessage);
        
        await page.reload();
        await goToShareTab(page);
        
        // Expand history
        await page.click('.share-history-header');
        await page.waitForTimeout(200);
        
        // Click on history item
        await page.click('.share-history-item');
        await page.waitForTimeout(200);
        
        // Message should be loaded into textarea
        const message = await page.locator('#share-screen-message').inputValue();
        expect(message).toBe(testMessage);
    });
    
    test('SH11: Save to history can be disabled', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Uncheck save to history
        const saveCheckbox = page.locator('#share-save-history');
        if (await saveCheckbox.isChecked()) {
            await saveCheckbox.click();
        }
        
        // Get current history count
        const beforeCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return (data.shareHistory || []).length;
        });
        
        // Click copy
        await page.click('button:has-text("Copy")');
        await page.waitForTimeout(300);
        
        // History count should be unchanged
        const afterCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return (data.shareHistory || []).length;
        });
        
        expect(afterCount).toBe(beforeCount);
    });
    
    test('SH12: History limited to 20 entries', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with 25 entries
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.shareHistory = [];
            for (let i = 0; i < 25; i++) {
                data.shareHistory.push({
                    id: i,
                    timestamp: new Date().toISOString(),
                    platform: 'copy',
                    message: `Test message ${i}`,
                    template: 'default'
                });
            }
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Add another entry
        await page.click('button:has-text("Copy")');
        await page.waitForTimeout(300);
        
        // Should be capped at 20
        const historyCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return (data.shareHistory || []).length;
        });
        
        expect(historyCount).toBeLessThanOrEqual(20);
    });
    
    test('SH13: History template dropdown opens history section', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with history
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.shareHistory = [
                { id: 1, timestamp: new Date().toISOString(), platform: 'twitter', message: 'Test', template: 'default' }
            ];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Select "From History" option
        await page.selectOption('#share-screen-template', 'history');
        await page.waitForTimeout(200);
        
        // History section should be expanded
        const section = page.locator('#share-history-section');
        await expect(section).toHaveClass(/expanded/);
        
        // Template should reset to default (history is not a real template)
        const selectedValue = await page.locator('#share-screen-template').inputValue();
        expect(selectedValue).toBe('default');
    });
});

test.describe('SH: Share Hub - Platform Sharing', () => {
    
    test('SH14: Twitter share opens correct URL', async ({ page, context }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Listen for new page/popup
        const [popup] = await Promise.all([
            context.waitForEvent('page'),
            page.click('button:has-text("Twitter")')
        ]);
        
        const url = popup.url();
        expect(url).toContain('twitter.com/intent/tweet');
        expect(url).toContain('text=');
        
        await popup.close();
    });
    
    test('SH15: All share buttons save to history', async ({ page }) => {
        // This test verifies the history-saving is wired up correctly
        // We can't fully test external sharing but can verify history saves
        
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Clear existing history
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.shareHistory = [];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        // Click copy (doesn't open popup)
        await page.click('button:has-text("Copy")');
        await page.waitForTimeout(300);
        
        const historyCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return (data.shareHistory || []).length;
        });
        
        expect(historyCount).toBe(1);
    });
});

test.describe('SH: Share Hub - Message Templates', () => {
    
    test('SH16: Default template shows game results', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        expect(message).toContain('🎮 Daily Puzzles Complete!');
        expect(message).toContain('4/6'); // Wordle score
        expect(message).toContain('0:45'); // Mini score
    });
    
    test('SH17: Brag template has celebratory tone', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        await page.selectOption('#share-screen-template', 'brag');
        await page.waitForTimeout(100);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        expect(message).toContain('🏆');
        expect(message).toContain('Crushed it');
    });
    
    test('SH18: Challenge template invites competition', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        await page.selectOption('#share-screen-template', 'challenge');
        await page.waitForTimeout(100);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        expect(message).toContain('⚔️');
        expect(message).toContain('beat my scores');
    });
    
    test('SH19: Streak template shows max streak', async ({ page }) => {
        await setupWithGames(page);
        
        // Add streak data
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.streaks = { wordle: 15 };
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        await page.selectOption('#share-screen-template', 'streak');
        await page.waitForTimeout(100);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        expect(message).toContain('🔥');
        expect(message).toContain('streak');
    });
    
    test('SH20: Emoji bar inserts emoji at cursor', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Clear textarea and type something
        await page.fill('#share-screen-message', 'Hello World');
        
        // Position cursor in middle (after "Hello ")
        await page.evaluate(() => {
            const textarea = document.getElementById('share-screen-message') as HTMLTextAreaElement;
            textarea.selectionStart = 6;
            textarea.selectionEnd = 6;
            textarea.focus();
        });
        
        // Click fire emoji
        await page.click('button:has-text("🔥")');
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        // Emoji should be inserted
        expect(message).toContain('🔥');
    });
});

test.describe('SH: Share Hub - UI Elements', () => {
    
    test('SH21: Share tab shows today\'s results', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Results section should show games
        const resultsSection = page.locator('#share-screen-results');
        await expect(resultsSection).toBeVisible();
        
        // Should have game tags
        const tags = page.locator('.share-result-tag');
        await expect(tags).toHaveCount(3); // wordle, connections, mini
    });
    
    test('SH22: Share tab shows current date', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const dateEl = page.locator('#share-screen-date');
        await expect(dateEl).toBeVisible();
        
        const dateText = await dateEl.textContent();
        // Should contain abbreviated day and month
        expect(dateText).toMatch(/\w{3}/); // e.g., "Mon", "Jan"
    });
    
    test('SH23: Quick share button exists', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const quickShareBtn = page.locator('button:has-text("Quick Share All Results")');
        await expect(quickShareBtn).toBeVisible();
    });
    
    test('SH24: All share platform buttons visible', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const platforms = ['Twitter', 'Facebook', 'LinkedIn', 'Threads', 'Reddit', 'Discord', 'BlueSky', 'Mastodon', 'Copy', 'More'];
        
        for (const platform of platforms) {
            const btn = page.locator(`.share-platform-btn:has-text("${platform}")`).first();
            await expect(btn, `${platform} button should be visible`).toBeVisible();
        }
    });
});

test.describe('SH: Share Hub - Custom Templates', () => {
    
    test('SH25: Template dropdown has optgroups', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const select = page.locator('#share-screen-template');
        
        // Check for optgroups
        const builtInGroup = select.locator('optgroup[label="Built-in Templates"]');
        const customGroup = select.locator('optgroup[label="Your Templates"]');
        const moreGroup = select.locator('optgroup[label="More Options"]');
        
        await expect(builtInGroup).toBeAttached();
        await expect(customGroup).toBeAttached();
        await expect(moreGroup).toBeAttached();
    });
    
    test('SH26: Save as Template option exists', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const select = page.locator('#share-screen-template');
        const saveOption = select.locator('option[value="save"]');
        
        await expect(saveOption).toBeAttached();
        const text = await saveOption.textContent();
        expect(text).toContain('Save as Template');
    });
    
    test('SH27: Manage Templates option exists', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        const select = page.locator('#share-screen-template');
        const manageOption = select.locator('option[value="manage"]');
        
        await expect(manageOption).toBeAttached();
        const text = await manageOption.textContent();
        expect(text).toContain('Manage Templates');
    });
    
    test('SH28: Save Template modal opens', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Select save option
        await page.selectOption('#share-screen-template', 'save');
        await page.waitForTimeout(300);
        
        // Modal should be visible
        const modal = page.locator('#save-template-modal');
        await expect(modal).toHaveClass(/active/);
        
        // Should have name input
        const nameInput = page.locator('#template-name-input');
        await expect(nameInput).toBeVisible();
        
        // Should have preview
        const preview = page.locator('#template-preview');
        await expect(preview).toBeVisible();
    });
    
    test('SH29: Save Template modal shows current message', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Get current message
        const currentMessage = await page.locator('#share-screen-message').inputValue();
        
        // Open save modal
        await page.selectOption('#share-screen-template', 'save');
        await page.waitForTimeout(300);
        
        // Preview should contain the message
        const preview = await page.locator('#template-preview').textContent();
        expect(preview).toContain('Daily Puzzles');
    });
    
    test('SH30: Can save a custom template', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Open save modal
        await page.selectOption('#share-screen-template', 'save');
        await page.waitForTimeout(300);
        
        // Enter name
        await page.fill('#template-name-input', 'My Test Template');
        
        // Click save
        await page.click('button:has-text("Save Template")');
        await page.waitForTimeout(300);
        
        // Modal should close
        const modal = page.locator('#save-template-modal');
        await expect(modal).not.toHaveClass(/active/);
        
        // Check localStorage
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates.length).toBe(1);
        expect(templates[0].name).toBe('My Test Template');
    });
    
    test('SH31: Custom template appears in dropdown', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with custom template
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_test123',
                name: 'Weekend Warrior',
                message: '🏆 Weekend mode activated!\n\n{games}',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Check dropdown for custom template
        const customOption = page.locator('#share-screen-template option[value="custom_tpl_test123"]');
        await expect(customOption).toBeAttached();
        
        const text = await customOption.textContent();
        expect(text).toContain('Weekend Warrior');
    });
    
    test('SH32: Manage Templates sheet opens', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Select manage option
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Sheet should be visible
        const sheet = page.locator('#templates-sheet');
        await expect(sheet).toHaveClass(/active/);
    });
    
    test('SH33: Manage Templates shows empty state', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Open manage sheet
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Empty state should be visible
        const emptyState = page.locator('#templates-empty');
        await expect(emptyState).toBeVisible();
        
        const emptyText = await emptyState.textContent();
        expect(emptyText).toContain('No custom templates yet');
    });
    
    test('SH34: Manage Templates lists saved templates', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with templates
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [
                { id: 'tpl_1', name: 'Template One', message: 'Message 1', createdAt: new Date().toISOString(), usedCount: 3 },
                { id: 'tpl_2', name: 'Template Two', message: 'Message 2', createdAt: new Date().toISOString(), usedCount: 0 }
            ];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Open manage sheet
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Should show template cards
        const cards = page.locator('.template-card');
        await expect(cards).toHaveCount(2);
        
        // Empty state should be hidden
        const emptyState = page.locator('#templates-empty');
        await expect(emptyState).not.toBeVisible();
    });
    
    test('SH35: Can use custom template', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with template
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_use',
                name: 'Test Template',
                message: 'Custom message here!\n\n{games}\n\nStreak: {streak}',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Select custom template from dropdown
        await page.selectOption('#share-screen-template', 'custom_tpl_use');
        await page.waitForTimeout(300);
        
        // Message should contain custom content with variables replaced
        const message = await page.locator('#share-screen-message').inputValue();
        expect(message).toContain('Custom message here!');
        expect(message).toContain('Streak:');
    });
    
    test('SH36: Template variables are replaced', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with template using all variables
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_vars',
                name: 'Variable Test',
                message: 'Games: {games}\nStreak: {streak}\nCount: {count}\nDate: {date}\nLink: {link}',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Use template
        await page.selectOption('#share-screen-template', 'custom_tpl_vars');
        await page.waitForTimeout(300);
        
        const message = await page.locator('#share-screen-message').inputValue();
        
        // Variables should be replaced, not literal
        expect(message).not.toContain('{games}');
        expect(message).not.toContain('{streak}');
        expect(message).not.toContain('{count}');
        expect(message).not.toContain('{date}');
        expect(message).not.toContain('{link}');
        
        // Should have actual content
        expect(message).toContain('🟩'); // game icon for wordle
        expect(message).toMatch(/Streak: \d+/);
        expect(message).toMatch(/Count: \d+/);
        expect(message).toContain('#ref='); // referral link
    });
    
    test('SH37: Template use count increments', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with template
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_count',
                name: 'Count Test',
                message: 'Test message',
                createdAt: new Date().toISOString(),
                usedCount: 5
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Use template
        await page.selectOption('#share-screen-template', 'custom_tpl_count');
        await page.waitForTimeout(300);
        
        // Check use count incremented
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates[0].usedCount).toBe(6);
    });
    
    test('SH38: Edit template modal opens', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_edit',
                name: 'Edit Me',
                message: 'Original message',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Open manage sheet
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Click edit button
        await page.click('.template-action-btn:has-text("✏️")');
        await page.waitForTimeout(300);
        
        // Edit modal should be visible
        const modal = page.locator('#edit-template-modal');
        await expect(modal).toHaveClass(/active/);
        
        // Should have name and message filled
        const nameValue = await page.locator('#edit-template-name').inputValue();
        expect(nameValue).toBe('Edit Me');
        
        const messageValue = await page.locator('#edit-template-message').inputValue();
        expect(messageValue).toBe('Original message');
    });
    
    test('SH39: Can update template', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_update',
                name: 'Old Name',
                message: 'Old message',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Open manage > edit
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        await page.click('.template-action-btn:has-text("✏️")');
        await page.waitForTimeout(300);
        
        // Change values
        await page.fill('#edit-template-name', 'New Name');
        await page.fill('#edit-template-message', 'New message content');
        
        // Save
        await page.click('button:has-text("Save Changes")');
        await page.waitForTimeout(300);
        
        // Check localStorage
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates[0].name).toBe('New Name');
        expect(templates[0].message).toBe('New message content');
    });
    
    test('SH40: Can delete template', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_delete',
                name: 'Delete Me',
                message: 'To be deleted',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Set up dialog handler for confirm
        page.on('dialog', dialog => dialog.accept());
        
        // Open manage
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Click delete button
        await page.click('.template-action-btn:has-text("🗑️")');
        await page.waitForTimeout(300);
        
        // Check localStorage - should be empty
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates.length).toBe(0);
    });
    
    test('SH41: Max 10 templates enforced', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with 10 templates
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = Array.from({ length: 10 }, (_, i) => ({
                id: `tpl_${i}`,
                name: `Template ${i}`,
                message: `Message ${i}`,
                createdAt: new Date().toISOString(),
                usedCount: 0
            }));
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Try to save another
        await page.selectOption('#share-screen-template', 'save');
        await page.waitForTimeout(300);
        await page.fill('#template-name-input', 'Eleventh Template');
        await page.click('button:has-text("Save Template")');
        await page.waitForTimeout(300);
        
        // Should still have only 10
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates.length).toBe(10);
    });
    
    test('SH42: Duplicate template names rejected', async ({ page }) => {
        await setupWithGames(page);
        
        // Pre-populate with one template
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            data.customTemplates = [{
                id: 'tpl_existing',
                name: 'Existing Name',
                message: 'Existing message',
                createdAt: new Date().toISOString(),
                usedCount: 0
            }];
            localStorage.setItem('gameshelf-data', JSON.stringify(data));
        });
        
        await page.reload();
        await goToShareTab(page);
        
        // Try to save with same name
        await page.selectOption('#share-screen-template', 'save');
        await page.waitForTimeout(300);
        await page.fill('#template-name-input', 'Existing Name');
        await page.click('button:has-text("Save Template")');
        await page.waitForTimeout(300);
        
        // Should still have only 1
        const templates = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('gameshelf-data') || '{}');
            return data.customTemplates || [];
        });
        
        expect(templates.length).toBe(1);
    });
    
    test('SH43: Template help section toggles', async ({ page }) => {
        await setupWithGames(page);
        await goToShareTab(page);
        
        // Open manage sheet
        await page.selectOption('#share-screen-template', 'manage');
        await page.waitForTimeout(300);
        
        // Help content initially hidden
        const helpContent = page.locator('#template-help-content');
        await expect(helpContent).not.toBeVisible();
        
        // Click to expand
        await page.click('.template-help-title');
        await page.waitForTimeout(200);
        
        // Should be visible now
        await expect(helpContent).toBeVisible();
        
        // Should show variables
        const helpText = await helpContent.textContent();
        expect(helpText).toContain('{games}');
        expect(helpText).toContain('{streak}');
    });
});
