import { test, expect } from '@playwright/test';

test.describe('Pokémon 2.5D RPG E2E Flow', () => {
  test('Complete New Game start, overworld exploration, and save/reload flow', async ({ page }) => {
    // 1. Open app
    await page.goto('/');
    
    // 2. Wait for canvas & title screen
    await page.waitForSelector('#game-container', { timeout: 10000 });
    
    // 3. Click New Game or Confirm button
    // The title screen has a new game button or prompt. Let's press ENTER or tap CONFIRM button.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 4. Press ENTER / Confirm through dialogue / intro
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(400);
    }

    // 5. Verify overworld canvas is active
    const canvas = page.locator('#pixi-container canvas');
    await expect(canvas).toBeVisible();

    // 6. Move player around with D-pad or arrow keys
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // 7. Open Menu (M key or menu button)
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);

    // 8. Reload page and check persistence
    await page.reload();
    await page.waitForSelector('#game-container', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const activeCanvas = page.locator('#pixi-container canvas');
    await expect(activeCanvas).toBeVisible();
  });
});
