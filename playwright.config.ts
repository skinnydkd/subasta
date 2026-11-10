import { defineConfig } from '@playwright/test';

// Runs against `vite dev`: with DATABASE_URL empty the server uses the in-memory
// Postgres (src/lib/server/db.local.ts), so e2e needs no external database.
export default defineConfig({
	webServer: {
		command: 'npm run dev -- --port 5174 --strictPort',
		port: 5174,
		reuseExistingServer: true
	},
	use: { baseURL: 'http://localhost:5174', actionTimeout: 10_000 },
	testMatch: '**/*.e2e.{ts,js}'
});
