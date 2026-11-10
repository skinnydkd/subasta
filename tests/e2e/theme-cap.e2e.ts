import { expect, test, type Page } from '@playwright/test';

/** A thin theme caps the room size even when the host asks for 5 players. */
test('theme cap limits the room size', async ({ browser }) => {
	test.setTimeout(120_000);
	const signIn = async (name: string): Promise<Page> => {
		const page = await (await browser.newContext()).newPage();
		await page.goto('/', { waitUntil: 'networkidle', timeout: 120_000 });
		await page.getByPlaceholder('Pau').fill(name);
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page.getByRole('button', { name: 'Crear sala' })).toBeVisible();
		return page;
	};
	const [host, second, third] = [
		await signIn('Host'),
		await signIn('Segon'),
		await signIn('Tercer')
	];

	const theme = host.locator('select[name="theme_id"] option', { hasText: 'Barça històric' });
	await expect(theme).toContainText('màx. 2 jugadors');
	await host
		.locator('select[name="theme_id"]')
		.selectOption({ label: (await theme.textContent())!.trim() });
	await host.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
	await host.locator('input[name="max_members"]').fill('5');
	await host.getByRole('button', { name: 'Crear sala' }).click();
	await host.waitForURL(/\/room\/[A-Z0-9]{6}/);
	const code = host.url().match(/\/room\/([A-Z0-9]{6})/)![1];

	await second.getByPlaceholder('ABC234').fill(code);
	await second.getByRole('button', { name: 'Entrar a la sala' }).click();
	await second.waitForURL(`**/room/${code}`);

	await third.getByPlaceholder('ABC234').fill(code);
	await third.getByRole('button', { name: 'Entrar a la sala' }).click();
	await expect(third.getByText(/plena|full|màxim/i)).toBeVisible();
	await expect(third).not.toHaveURL(/\/room\//);
});
