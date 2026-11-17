import { expect, test } from '@playwright/test';

/**
 * One person against three bots: the bots must join, bid on their own while
 * the human polls, and the game must end in a simulated tournament with a champion.
 */
test('solo game against the machine ends with a tournament', async ({ page }) => {
	test.setTimeout(400_000);

	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByPlaceholder('Pau').fill('Solista');
	await page.getByRole('button', { name: 'Entrar' }).click();

	const solo = page.locator('form[action="?/createSoloRoom"]');
	await solo.locator('select[name="theme_id"]').selectOption({ label: 'Premier League 2025-26' });
	await solo.locator('select[name="bots"]').selectOption('3');
	await page.getByRole('button', { name: 'Jugar contra la màquina' }).click();
	await page.waitForURL(/\/room\/[A-Z0-9]{6}/);

	// Three bots seated, marked as bots.
	await expect(page.getByText('bot', { exact: true })).toHaveCount(3);

	// Fewer auctions for the test: no extras.
	await page.getByText('Editar configuració').click();
	await page.locator('input[name="extras"]').fill('0');
	await page.getByRole('button', { name: 'Aplicar canvis' }).click();
	await page.waitForTimeout(500);

	await page.getByRole('button', { name: 'Iniciar subhasta' }).click();
	await expect(page.getByText('puja actual')).toBeVisible();

	const heading = page.getByRole('heading', { level: 2 });
	const torneig = page.getByRole('heading', { name: 'Torneig' });
	let auctions = 0;
	while (!(await torneig.isVisible())) {
		const before = await heading
			.first()
			.textContent()
			.catch(() => null);
		// Give the bots a few polls to react, then move on.
		await page.waitForTimeout(3000);
		await page
			.getByRole('button', { name: /Següent|Tancar i següent/ })
			.click({ timeout: 5000 })
			.catch(() => {});
		await expect
			.poll(
				async () =>
					(await torneig.isVisible()) ||
					(await heading
						.first()
						.textContent()
						.catch(() => null)) !== before
			)
			.toBe(true);
		if (++auctions > 70) throw new Error('draft did not end');
	}
	console.log(`auctions played: ${auctions}`);

	// The bots spent money: at least one budget below the starting 1.000M€.
	const budgets = await page.locator('section').first().getByText(/M€$/).allTextContents();
	expect(budgets.some((b) => b !== '1.000M€')).toBe(true);

	await page.getByRole('button', { name: 'Simular torneig' }).click();
	await page.getByRole('button', { name: 'Veure-ho tot' }).click();
	await expect(page.getByText('Campió', { exact: true })).toBeVisible();
	await expect(page.getByText('Classificació')).toBeVisible();
	// With no extras, bots must not buy beyond their formation: no bench anywhere.
	await expect(page.getByText('Banqueta:')).toHaveCount(0);
	await page.screenshot({ path: 'test-results/shots/solo-torneig.png', fullPage: true });
});
