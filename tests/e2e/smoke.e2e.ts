import { expect, test } from '@playwright/test';

/**
 * Lobby smoke: anonymous sign-in renders the create/join controls.
 */
test('signin shows lobby controls', async ({ page }) => {
	await page.goto('/');

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

/**
 * End-to-end: two players go through lobby → drafting → voting → finished.
 *
 * Uses two parallel browser contexts simulating Pau (host) and Marta. Picks
 * the demo theme, formation 4-3-3, max_members=2, extras=0 so the auction
 * queue is exactly 22 slots. We force-advance every auction without bidding
 * to reach voting quickly; then both players vote and we check the podium.
 */
test('full game flow (host + member, demo theme)', async ({ browser }) => {
	test.setTimeout(180_000);

	const stamp = Date.now() % 1_000_000;
	const hostCtx = await browser.newContext();
	const memberCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	const member = await memberCtx.newPage();

	// --- Host signs in
	await host.goto('/');
	await host.getByPlaceholder('Pau').fill(`Host_${stamp}`);
	await host.getByRole('button', { name: 'Entrar' }).click();
	await expect(host.getByText(`Host_${stamp}`)).toBeVisible({ timeout: 15_000 });

	// --- Host opens advanced settings, picks 2 members + 0 extras
	await host.getByText('Configuració avançada').click();
	await host.locator('select[name="max_members"]').waitFor();
	// Pick demo (empty) theme — first option is whichever the dropdown has;
	// we pick by visible text containing "Demo".
	// Pick the first theme containing "Demo (tots)" by reading option labels.
	const themeOption = await host
		.locator('select[name="theme_id"] option')
		.filter({ hasText: /Demo \(tots\)/i })
		.first()
		.getAttribute('value');
	if (!themeOption) throw new Error('Demo (tots) theme not found');
	await host.locator('select[name="theme_id"]').selectOption(themeOption);
	await host.locator('select[name="formation"]').selectOption('4-3-3');
	await host.locator('input[name="max_members"]').fill('2');
	await host.locator('input[name="extras"]').fill('0');

	// --- Host creates room
	await host.getByRole('button', { name: 'Crear sala' }).click();
	await host.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15_000 });
	const roomUrl = host.url();
	const code = roomUrl.match(/\/room\/([A-Z0-9]{6})/)![1];

	// --- Member signs in + joins by code
	await member.goto('/');
	await member.getByPlaceholder('Pau').fill(`Member_${stamp}`);
	await member.getByRole('button', { name: 'Entrar' }).click();
	await expect(member.getByPlaceholder('ABC234')).toBeVisible({ timeout: 15_000 });
	await member.getByPlaceholder('ABC234').fill(code);
	await member.getByRole('button', { name: 'Entrar a la sala' }).click();
	await member.waitForURL(`**/room/${code}`, { timeout: 15_000 });

	// --- Host starts the auction
	await host.reload(); // ensure host sees the new member
	await host.getByRole('button', { name: 'Iniciar subhasta' }).click();
	await expect(host.locator('text=puja actual')).toBeVisible({ timeout: 15_000 });

	// --- Force-advance through the queue without bidding (auctions get skipped).
	// 4-3-3 × 2 + 0 extras = 22 slots → 22 advances to reach voting.
	for (let i = 0; i < 25; i++) {
		const advance = host.getByRole('button', { name: /Següent|Tancar i següent/ });
		if (!(await advance.isVisible().catch(() => false))) break;
		await advance.click();
		// Allow the page to react before next click.
		await host.waitForTimeout(200);
	}

	// --- We should now be in voting.
	await expect(host.getByText('Vota', { exact: true })).toBeVisible({ timeout: 15_000 });
	await member.reload();
	await expect(member.getByText('Vota', { exact: true })).toBeVisible({ timeout: 15_000 });

	// --- Host votes for member as Top 1; member votes for host as Top 1.
	const hostRank1 = host.locator('select[name="rank_1"]');
	await hostRank1.selectOption({ label: `Member_${stamp}` });
	await host.getByRole('button', { name: 'Enviar vot' }).click();

	const memberRank1 = member.locator('select[name="rank_1"]');
	await memberRank1.selectOption({ label: `Host_${stamp}` });
	await member.getByRole('button', { name: 'Enviar vot' }).click();

	// --- Room flips to finished. Both pages show the podium.
	await expect(host.getByText('Resultats', { exact: true })).toBeVisible({ timeout: 15_000 });
	await expect(member.getByText('Resultats', { exact: true })).toBeVisible({ timeout: 15_000 });

	await hostCtx.close();
	await memberCtx.close();
});
