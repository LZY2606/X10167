/**
 * verify:offline - single offline verification entry for releases.
 *
 * Runs, in order: frozen-lockfile install, typecheck, lint, unit tests,
 * the adapter matrix, the SvelteKit build, prepack + package content
 * checks and a local browser smoke suite. Produces a stable
 * artifacts/verify-manifest.json with versions, discovered adapters,
 * test/route collections, packed file digests and per-stage results.
 * The manifest contains no absolute paths and no timings, but keeps full
 * failure details. Only this script's own temp directory is cleaned
 * between runs. Exits non-zero when any stage fails.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { platform } from 'node:os';
import { rootDir, artifactsDir, tmpDir, runCommand, sanitize, tail } from './lib.mjs';

const manifestPath = join(artifactsDir, 'verify-manifest.json');

// Clean only the temp directories this entry produces.
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(artifactsDir, { recursive: true });

function rel(path) {
	return relative(rootDir, path).split('\\').join('/');
}

function collectTests() {
	const base = join(rootDir, 'src/tests');
	const tests = [];
	function walk(dir) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.test.ts')) tests.push(rel(full));
		}
	}
	if (existsSync(base)) walk(base);
	return tests.sort();
}

function stripComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function collectRoutes() {
	const base = join(rootDir, 'src/routes');
	const routes = [];
	function walk(dir) {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name)
		)) {
			const full = join(dir, entry.name);
			if (!entry.isDirectory()) continue;
			const hasPage =
				readdirSync(full).some((name) => name.startsWith('+page.')) ||
				existsSync(join(full, '+server.ts')) ||
				existsSync(join(full, '+server.js'));
			if (hasPage) routes.push(rel(full).slice('src/routes/'.length));
			walk(full);
		}
	}
	if (existsSync(base)) walk(base);
	return routes;
}

function discoverAdapters() {
	const indexSource = stripComments(
		readFileSync(join(rootDir, 'src/lib/adapters/index.ts'), 'utf8')
	);
	const names = new Set();
	for (const match of indexSource.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]/g)) {
		for (const part of match[1].split(',')) {
			const entry = part.trim();
			if (!entry || entry.startsWith('type ')) continue;
			names.add(
				entry.includes(' as ')
					? entry
							.split(/\s+as\s+/)
							.pop()
							.trim()
					: entry
			);
		}
	}
	const values = [...names].sort();
	return {
		server: values.filter((name) => !name.endsWith('Client')),
		client: values.filter((name) => name.endsWith('Client'))
	};
}

const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

const stages = [
	{ name: 'install', command: ['pnpm', ['install', '--frozen-lockfile']] },
	{ name: 'typecheck', command: ['pnpm', ['run', 'check']] },
	{ name: 'lint', command: ['pnpm', ['run', 'lint']] },
	{ name: 'unit', command: ['pnpm', ['run', 'test']] },
	{
		name: 'adapters',
		command: ['pnpm', ['exec', 'vitest', 'run', 'src/tests/adapterMatrix.test.ts']]
	},
	{ name: 'build', command: ['pnpm', ['exec', 'vite', 'build']] },
	{ name: 'prepack', command: ['pnpm', ['run', 'prepack']] },
	{
		name: 'pack',
		needs: ['prepack'],
		command: ['node', ['scripts/verify/pack-check.mjs']],
		collect: (manifest) => {
			const file = join(tmpDir, 'pack-summary.json');
			if (existsSync(file)) manifest.package = JSON.parse(readFileSync(file, 'utf8'));
		}
	},
	{
		name: 'smoke',
		needs: ['build'],
		command: ['node', ['scripts/verify/smoke.mjs']],
		collect: (manifest) => {
			const file = join(tmpDir, 'smoke-results.json');
			if (existsSync(file)) manifest.smoke = JSON.parse(readFileSync(file, 'utf8'));
		}
	}
];

const manifest = {
	tool: 'verify:offline',
	manifestVersion: 1,
	ok: false,
	environment: {
		node: process.version,
		pnpm: 'unknown',
		platform: platform(),
		packageManager: pkg.packageManager ?? null
	},
	adapters: discoverAdapters(),
	tests: collectTests(),
	routes: collectRoutes(),
	stages: []
};

async function main() {
	const pnpmVersion = await runCommand('pnpm', ['--version']);
	if (pnpmVersion.code === 0) manifest.environment.pnpm = pnpmVersion.output.trim();

	const results = new Map();

	for (const stage of stages) {
		const unmet = (stage.needs ?? []).filter((dep) => results.get(dep) !== 'passed');
		if (unmet.length > 0) {
			manifest.stages.push({
				name: stage.name,
				status: 'skipped',
				reason: `dependency stage(s) not passed: ${unmet.join(', ')}`
			});
			results.set(stage.name, 'skipped');
			console.log(`SKIP ${stage.name} (${unmet.join(', ')})`);
			continue;
		}

		const [command, args] = stage.command;
		console.log(`RUN  ${stage.name}: ${command} ${args.join(' ')}`);
		const { code, output } = await runCommand(command, args);
		const status = code === 0 ? 'passed' : 'failed';
		results.set(stage.name, status);

		const record = { name: stage.name, status, command: `${command} ${args.join(' ')}` };
		if (status === 'failed') {
			record.exitCode = code;
			record.output = tail(output, 200);
		}
		manifest.stages.push(record);
		if (stage.collect) stage.collect(manifest);
		console.log(`${status === 'passed' ? 'OK  ' : 'FAIL'} ${stage.name}`);
	}

	manifest.ok = [...results.values()].every((status) => status === 'passed');
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
	console.log(`\nmanifest: ${sanitize(manifestPath)}`);
	console.log(manifest.ok ? 'verify:offline PASSED' : 'verify:offline FAILED');
	process.exit(manifest.ok ? 0 : 1);
}

main().catch((error) => {
	manifest.stages.push({
		name: 'verify-offline',
		status: 'failed',
		output: sanitize(error?.stack ?? String(error))
	});
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
	console.error(sanitize(error?.stack ?? String(error)));
	process.exit(1);
});
