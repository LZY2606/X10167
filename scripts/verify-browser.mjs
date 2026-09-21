/**
 * Local browser smoke for the offline verification pipeline.
 *
 * Starts `vite preview` of the already-built app on a loopback port, drives
 * Chromium via Playwright, and never leaves the loopback interface:
 * non-loopback requests are aborted before they can reach the network.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { ROOT, TMP_DIR, getFreePort } from './verify/lib.mjs';

const ROUTE = '/v2/verify-smoke';

async function waitForServer(baseUrl, timeoutMs = 60000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(baseUrl, { method: 'GET' });
			if (response.ok || response.status === 404) return;
		} catch {
			// server not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`preview server did not respond at ${baseUrl} within ${timeoutMs}ms`);
}

async function main() {
	const port = await getFreePort();
	const baseUrl = `http://127.0.0.1:${port}`;

	const server = spawn(
		process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
		['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
		{ cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0' } }
	);
	const serverLogs = [];
	server.stdout.on('data', (data) => serverLogs.push(data));
	server.stderr.on('data', (data) => serverLogs.push(data));

	const results = [];
	const browser = await chromium.launch();
	try {
		await waitForServer(baseUrl);
		const context = await browser.newContext();
		// Hard offline guarantee: block everything except loopback.
		await context.route('**/*', (route) => {
			const url = new URL(route.request().url());
			if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
			return route.abort('failed');
		});
		const page = await context.newPage();
		const consoleErrors = [];
		page.on('console', (message) => {
			if (message.type() === 'error') consoleErrors.push(message.text());
		});
		page.on('pageerror', (error) => consoleErrors.push(String(error)));

		const check = async (name, fn) => {
			try {
				await fn(page);
				results.push({ name, status: 'passed' });
				console.log(`  ✓ ${name}`);
			} catch (error) {
				results.push({ name, status: 'failed', error: String(error?.message ?? error) });
				console.error(`  ✗ ${name}: ${error?.message ?? error}`);
			}
		};

		await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });

		await check('valid submit shows success message', async () => {
			await page.fill('[data-testid="name-a"]', 'Alice');
			await page.click('[data-testid="submit-a"]');
			await page.waitForSelector('[data-testid="message-a"]', { timeout: 10000 });
			if ((await page.textContent('[data-testid="message-a"]')) !== 'A-OK') {
				throw new Error('expected A-OK message');
			}
		});

		await check('server error renders field error', async () => {
			await page.fill('[data-testid="name-a"]', 'A');
			await page.click('[data-testid="submit-a"]');
			await page.waitForSelector('[data-testid="error-name-a"]', { timeout: 10000 });
		});

		await check('array item add and remove', async () => {
			const initial = await page.locator('[data-testid="item-input"]').count();
			if (initial !== 1) throw new Error(`expected 1 initial item, got ${initial}`);
			await page.click('[data-testid="add-item"]');
			await page.waitForFunction(
				() => document.querySelectorAll('[data-testid="item-input"]').length === 2
			);
			await page.locator('[data-testid="remove-item"]').first().click();
			await page.waitForFunction(
				() => document.querySelectorAll('[data-testid="item-input"]').length === 1
			);
		});

		await check('reset restores initial values', async () => {
			await page.fill('[data-testid="name-a"]', 'Changed');
			await page.click('[data-testid="reset-a"]');
			await page.waitForFunction(
				() => document.querySelector('[data-testid="name-a"]')?.value === ''
			);
		});

		await check('two forms stay isolated on the same page', async () => {
			await page.fill('[data-testid="email-b"]', 'b@example.com');
			await page.fill('[data-testid="name-a"]', 'Alice');
			await page.click('[data-testid="submit-a"]');
			await page.waitForSelector('[data-testid="message-a"]', { timeout: 10000 });
			const email = await page.inputValue('[data-testid="email-b"]');
			if (email !== 'b@example.com') throw new Error(`form B leaked: ${email}`);
			const messageB = await page.locator('[data-testid="message-b"]').count();
			if (messageB !== 0) throw new Error('form B received a message from form A submit');
		});

		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(
			join(TMP_DIR, 'browser-report.json'),
			JSON.stringify({ results, consoleErrors }, null, 2)
		);

		const failed = results.filter((result) => result.status !== 'passed');
		if (failed.length || consoleErrors.length) {
			if (consoleErrors.length) {
				console.error(
					`\nconsole/page errors:\n${consoleErrors.map((error) => `  - ${error}`).join('\n')}`
				);
			}
			process.exitCode = 1;
		}
		await context.close();
	} finally {
		await browser.close();
		server.kill('SIGTERM');
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
