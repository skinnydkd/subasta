import { expect, test } from '@playwright/test';

/**
 * Lobby smoke: anonymous sign-in renders the create/join controls.
 */
test('signin shows lobby controls', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });

	// Initial state: nickname form
	await expect(page.getByPlaceholder('Pau')).toBeVisible();

	// Sign in with a nickname (timestamped to avoid collisions across runs)
	const nick = `Test_${Date.now() % 100000}`;
	await page.getByPlaceholder('Pau').fill(nick);
	await page.getByRole('button', { name: 'Entrar' }).click();

	// After signin, the greeting renders and the create-room form is visible.
	await expect(page.getByText(nick)).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole('button', { name: 'Crear sala' })).toBeVisible();
	await expect(page.getByPlaceholder('ABC234')).toBeVisible();
});
