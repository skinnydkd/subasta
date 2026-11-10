import { chromium } from '@playwright/test';

// The in-memory database is built from every seed on the first query, which
// only happens at the first sign-in, and Vite may re-optimise dependencies
// (reloading the page). Do one real sign-in so no test pays for any of that.
export default async function globalSetup() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 120_000 });
	await page.getByPlaceholder('Pau').fill('Warmup');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.getByRole('button', { name: 'Crear sala' }).waitFor({ timeout: 120_000 });
	await browser.close();
}
