import { expect, test, type Page } from '@playwright/test';

/**
 * Whole game with three players in separate browser contexts, no reloads:
 * every screen change has to arrive through the room page's own polling.
 * lobby → 33 auctions (4-3-3, no extras) → vote → results.
 */
// Viewport for the screenshots; run with VW=1440 VH=900 to see the desktop layout.
const VW = Number(process.env.VW ?? 375);
const VH = Number(process.env.VH ?? 844);

test('three players play a full game', async ({ browser }) => {
	test.setTimeout(300_000);

	const names = ['Anna', 'Bernat', 'Carla'];
	const pages: Page[] = [];
	for (const name of names) {
		const page = await (
			await browser.newContext({ viewport: { width: VW, height: VH } })
		).newPage();
		// Wait for hydration: a fill before it is wiped when bind:value takes over.
		await page.goto('/', { waitUntil: 'networkidle' });
		await page.getByPlaceholder('Pau').fill(name);
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page.getByRole('button', { name: 'Crear sala' })).toBeVisible();
		pages.push(page);
	}
	const [host, ...guests] = pages;

	await host.locator('select[name="theme_id"]').selectOption({ label: 'Premier League 2025-26' });
	await host.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
	await host.locator('select[name="formation"]').selectOption('3-5-2');
	await host.locator('input[name="max_members"]').fill('3');
	await host.locator('input[name="extras"]').fill('0');
	await host.getByRole('button', { name: 'Crear sala' }).click();
	await host.waitForURL(/\/room\/[A-Z0-9]{6}/);
	const code = host.url().match(/\/room\/([A-Z0-9]{6})/)![1];

	for (const guest of guests) {
		await guest.getByPlaceholder('ABC234').fill(code);
		await guest.getByRole('button', { name: 'Entrar a la sala' }).click();
		await guest.waitForURL(`**/room/${code}`);
	}

	// Host sees both guests arrive without reloading.
	for (const name of names) await expect(host.getByText(name).first()).toBeVisible();
	await host.getByRole('button', { name: 'Iniciar subhasta' }).click();
	for (const page of pages) await expect(page.getByText('puja actual')).toBeVisible();

	const seq = host.getByRole('heading', { level: 2 });
	const vota = host.getByRole('heading', { name: 'Vota' });
	let auctions = 0;
	while (!(await vota.isVisible())) {
		const before = await seq.textContent().catch(() => null);
		// Rotate the bidder; a full position or an empty wallet just leaves the bid out.
		const bidder = pages[auctions % 3];
		await bidder
			.getByRole('button', { name: /^Mín/ })
			.click({ timeout: 3000 })
			.then(() => bidder.getByRole('button', { name: 'Pujar' }).click({ timeout: 3000 }))
			.catch(() => {});
		if (auctions === 0) {
			// The host's bid reaches another player through polling alone.
			await expect(guests[0].getByText('sense pujades')).toBeHidden();
			await guests[0].screenshot({
				path: `test-results/shots/${VW}-1-subhasta.png`,
				fullPage: true
			});
		}
		await host.getByRole('button', { name: /Següent|Tancar i següent/ }).click();
		await expect
			.poll(
				async () =>
					(await vota.isVisible()) || (await seq.textContent().catch(() => null)) !== before
			)
			.toBe(true);
		if (++auctions > 80) throw new Error('draft did not end');
	}
	console.log(`auctions played: ${auctions}`);

	await expect(guests[1].getByRole('heading', { name: 'Vota' })).toBeVisible();
	await guests[1].screenshot({
		path: `test-results/shots/${VW}-2-votacio.png`,
		fullPage: true
	});
	for (const page of pages) {
		await expect(page.getByRole('heading', { name: 'Vota' })).toBeVisible();
		await page.locator('select[name="rank_1"]').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Enviar vot' }).click();
	}
	const results = host.getByRole('heading', { name: 'Resultats' });
	if (!(await results.isVisible({ timeout: 5000 }).catch(() => false))) {
		await host.getByRole('button', { name: /Forçar tancament/ }).click();
	}
	for (const page of pages) {
		await expect(page.getByRole('heading', { name: 'Resultats' })).toBeVisible();
	}
	await guests[0].screenshot({
		path: `test-results/shots/${VW}-3-resultats.png`,
		fullPage: true
	});
});
