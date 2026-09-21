/**
 * Local browser smoke stage.
 *
 * Serves the production build with `vite preview` on 127.0.0.1 and drives a
 * local Chromium through five scenarios against the verify-smoke route:
 * valid submit, server error, array item add/remove, reset and two forms
 * isolated on the same page. No external network access. Each scenario gets
 * a fresh browser context so no state leaks between runs.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { rootDir, tmpDir, sanitize } from './lib.mjs';

const PORT = Number(process.env.VERIFY_SMOKE_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${PORT}`;
const route = '/v2/verify-smoke';

const results = [];
let server;

function record(name, ok, details = '') {
	results.push({ name, ok, ...(ok ? {} : { details: sanitize(details) }) });
}

async function ensureBrowser() {
	const executable = chromium.executablePath();
	if (existsSync(executable)) return;
	console.log(`Chromium not found at ${sanitize(executable)}, installing...`);
	await new Promise((resolve, reject) => {
		const child = spawn('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
			cwd: rootDir,
			stdio: 'inherit'
		});
		child.on('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`playwright install exited ${code}`))
		);
	});
}

async function startServer() {
	server = spawn(
		'pnpm',
		['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
		{ cwd: rootDir }
	);
	let serverOutput = '';
	server.stdout.on('data', (chunk) => (serverOutput += chunk));
	server.stderr.on('data', (chunk) => (serverOutput += chunk));

	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		if (server.exitCode !== null) {
			throw new Error(`preview server exited early:\n${serverOutput}`);
		}
		try {
			const response = await fetch(`${baseURL}${route}`);
			if (response.ok) return;
		} catch {
			// not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`preview server did not start:\n${serverOutput}`);
}

async function withPage(browser, fn) {
	const context = await browser.newContext({ baseURL });
	const page = await context.newPage();
	try {
		await fn(page);
	} finally {
		await context.close();
	}
}

const scenarios = [
	[
		'valid submit',
		async (page) => {
			await page.goto(route);
			await page.getByTestId('user-name').fill('Alice');
			await page.getByTestId('user-email').fill('alice@example.com');
			await page.getByTestId('user-submit').click();
			await page.getByTestId('user-message').waitFor({ timeout: 15000 });
			const text = await page.getByTestId('user-message').textContent();
			if (!text?.includes('User saved!')) throw new Error(`unexpected message: ${text}`);
		}
	],
	[
		'server error',
		async (page) => {
			await page.goto(route);
			await page.getByTestId('user-name').fill('taken');
			await page.getByTestId('user-email').fill('taken@example.com');
			await page.getByTestId('user-submit').click();
			await page.getByTestId('user-name-error').waitFor({ timeout: 15000 });
			const text = await page.getByTestId('user-name-error').textContent();
			if (!text?.includes('Name is already taken')) throw new Error(`unexpected error: ${text}`);
		}
	],
	[
		'array item add/remove',
		async (page) => {
			await page.goto(route);
			if ((await page.locator('[data-testid^="user-tag-"]').count()) !== 0) {
				throw new Error('expected no initial tag inputs');
			}
			await page.getByTestId('add-tag').click();
			await page.getByTestId('user-tag-0').waitFor();
			await page.getByTestId('add-tag').click();
			await page.getByTestId('user-tag-1').waitFor();
			await page.getByTestId('remove-tag-0').click();
			await page.getByTestId('user-tag-1').waitFor({ state: 'detached' });
			if ((await page.locator('[data-testid^="user-tag-"]').count()) !== 1) {
				throw new Error('expected exactly one tag input after remove');
			}
		}
	],
	[
		'reset restores initial data',
		async (page) => {
			await page.goto(route);
			await page.getByTestId('user-name').fill('Changed');
			await page.getByTestId('user-reset').click();
			const value = await page.getByTestId('user-name').inputValue();
			if (value !== '') throw new Error(`expected empty name after reset, got "${value}"`);
		}
	],
	[
		'two forms on one page stay isolated',
		async (page) => {
			await page.goto(route);
			await page.getByTestId('note-title').fill('My note');
			await page.getByTestId('user-name').fill('Alice');
			await page.getByTestId('user-email').fill('alice@example.com');
			await page.getByTestId('user-submit').click();
			await page.getByTestId('user-message').waitFor({ timeout: 15000 });
			const noteValue = await page.getByTestId('note-title').inputValue();
			if (noteValue !== 'My note') {
				throw new Error(`note form lost its value after user submit: "${noteValue}"`);
			}
			if ((await page.getByTestId('note-message').count()) !== 0) {
				throw new Error('note form showed a message meant for the user form');
			}
		}
	]
];

let exitCode = 0;
try {
	await ensureBrowser();
	await startServer();
	const browser = await chromium.launch();
	try {
		for (const [name, scenario] of scenarios) {
			try {
				await withPage(browser, scenario);
				record(name, true);
				console.log(`ok - ${name}`);
			} catch (error) {
				record(name, false, error?.stack ?? String(error));
				exitCode = 1;
				console.error(`FAIL - ${name}: ${sanitize(error?.message ?? String(error))}`);
			}
		}
	} finally {
		await browser.close();
	}
} catch (error) {
	record('smoke setup', false, error?.stack ?? String(error));
	exitCode = 1;
	console.error(sanitize(error?.stack ?? String(error)));
} finally {
	if (server && server.exitCode === null) server.kill('SIGTERM');
	mkdirSync(tmpDir, { recursive: true });
	writeFileSync(
		join(tmpDir, 'smoke-results.json'),
		JSON.stringify({ ok: exitCode === 0, scenarios: results }, null, 2)
	);
}
process.exit(exitCode);
