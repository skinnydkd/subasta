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
 * Two-player smoke: lobby → host creates → member joins → host starts →
 * member bids → host advances. Stops short of the full 22-auction loop
 * because that runs against the real Supabase realtime + RLS pipeline and
 * is too flaky to be reliable in CI. The pieces it does cover (auth flow,
 * settings UI, room membership, bid placement, advance) are enough to
 * catch regressions in the wiring between SvelteKit, Supabase, and the
 * UI's reactive state.
 */
test('two-player flow (signin → create → join → bid → advance)', async ({ browser }) => {
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

	// --- Settings: pick demo theme, force-open every <details>, fill values.
	// Playwright's visibility checks struggle with collapsed <details> even
	// after open=true so we operate via DOM directly.
	await host.locator('select[name="theme_id"]').waitFor({ timeout: 15_000 });

	await host.evaluate(() => {
		document.querySelectorAll('details').forEach((d) => (d.open = true));
	});

	// Pick "Demo (tots)" theme by reading its option value.
	const themeOption = await host
		.locator('select[name="theme_id"] option')
		.filter({ hasText: /Demo \(tots\)/i })
		.first()
		.getAttribute('value');
	if (!themeOption) throw new Error('Demo (tots) theme not found');
	await host.locator('select[name="theme_id"]').selectOption(themeOption);

	// Force interactions on the disclosure inputs (Playwright considers
	// elements inside a freshly-opened <details> still "hidden" until the
	// next paint).
	await host.locator('select[name="formation"]').selectOption('4-3-3', { force: true });
	await host.locator('input[name="max_members"]').fill('2', { force: true });
	await host.locator('input[name="extras"]').fill('0', { force: true });

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

	// --- Host starts the auction. Reload after the click so realtime races
	// don't block the drafting render.
	await host.reload(); // ensure host sees the new member
	await host.getByRole('button', { name: 'Iniciar subhasta' }).click();
	await host.waitForTimeout(1500);
	await host.reload();
	await expect(host.getByText('puja actual')).toBeVisible({ timeout: 15_000 });

	// --- Member places a bid. Reload first so realtime races don't trip.
	await member.reload();
	await expect(member.getByText('puja actual')).toBeVisible({ timeout: 15_000 });
	await member.locator('input[name="amount"]').fill('1M');
	await member.getByRole('button', { name: 'Pujar' }).click();
	// Bid history should record it.
	await expect(member.getByText(`Member_${stamp}`).first()).toBeVisible();

	// --- Host advances once. Sequence number should bump.
	const seqBefore = await host.locator('p:has-text("· #")').first().textContent();
	await host.getByRole('button', { name: /Següent|Tancar i següent/ }).click();
	await host.waitForTimeout(800);
	await host.reload();
	const seqAfter = await host.locator('p:has-text("· #")').first().textContent();
	expect(seqAfter).not.toBe(seqBefore);

	await hostCtx.close();
	await memberCtx.close();
});
