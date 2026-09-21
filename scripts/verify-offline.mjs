/**
 * Offline release verification entry point.
 *
 * `pnpm run verify:offline` runs, in order:
 *   typecheck, lint, unit tests, adapter matrix, SvelteKit build,
 *   prepack, package content check, local browser smoke
 *
 * Produces artifacts/verify-manifest.json with tool versions, discovered
 * adapters, collected test/route sets, packed-file digests and per-stage
 * results. No absolute paths and no durations are recorded, but failure
 * output is attached verbatim (tail) and the exit code stays non-zero.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
	ARTIFACTS_DIR,
	TMP_DIR,
	discoverAdapterExports,
	listRoutes,
	listTestFiles,
	prepareDirs,
	run
} from './verify/lib.mjs';

const manifest = {
	tool: 'verify-offline',
	ok: true,
	node: process.version,
	pnpm: '',
	adapters: { server: [], clientOnly: [] },
	tests: [],
	routes: [],
	package: { distFileCount: 0, distFiles: [] },
	stages: []
};

const stages = [
	{
		name: 'typecheck',
		command: ['pnpm', 'run', 'check'],
		description: 'svelte-check type checking'
	},
	{
		name: 'lint',
		command: ['pnpm', 'run', 'lint'],
		description: 'prettier and eslint'
	},
	{
		name: 'unit',
		command: ['pnpm', 'exec', 'vitest', 'run'],
		description: 'full vitest suite'
	},
	{
		name: 'adapter-matrix',
		command: ['pnpm', 'exec', 'vitest', 'run', 'src/tests/verify/matrix.test.ts'],
		description: 'adapters discovered from the export entry, canonical fixtures'
	},
	{
		name: 'build',
		command: ['pnpm', 'exec', 'vite', 'build'],
		description: 'SvelteKit production build including every example route'
	},
	{
		name: 'prepack',
		command: ['pnpm', 'run', 'prepack'],
		description: 'svelte-package + publint',
		dependsOn: ['build']
	},
	{
		name: 'package-check',
		command: ['node', 'scripts/verify-package.mjs'],
		description: 'exports resolve in dist, dist entry matches src, file digests',
		dependsOn: ['prepack']
	},
	{
		name: 'browser-smoke',
		command: ['node', 'scripts/verify-browser.mjs'],
		description: 'local chromium smoke: submit, server error, array ops, reset, isolation',
		dependsOn: ['build']
	}
];

function writeManifest() {
	writeFileSync(
		join(ARTIFACTS_DIR, 'verify-manifest.json'),
		JSON.stringify(manifest, null, 2) + '\n'
	);
}

function readJsonIfExists(path) {
	return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

async function main() {
	prepareDirs();
	writeManifest();

	const pnpm = await run('pnpm', ['--version']);
	manifest.pnpm = pnpm.outputTail.trim();

	const adapterExports = discoverAdapterExports(join(process.cwd(), 'src/lib/adapters/index.ts'));
	manifest.adapters.server = adapterExports.filter((name) => !name.endsWith('Client'));
	manifest.adapters.clientOnly = adapterExports
		.filter((name) => name.endsWith('Client'))
		.map((name) => name.slice(0, -'Client'.length))
		.filter((name) => !manifest.adapters.server.includes(name))
		.map((name) => `${name}Client`);
	manifest.tests = await listTestFiles();
	manifest.routes = await listRoutes();

	const completed = new Map();

	for (const stage of stages) {
		const unmet = (stage.dependsOn ?? []).filter((dep) => completed.get(dep) !== 'passed');
		if (unmet.length) {
			const record = {
				name: stage.name,
				status: 'skipped',
				reason: `dependency failed or skipped: ${unmet.join(', ')}`
			};
			manifest.stages.push(record);
			completed.set(stage.name, 'skipped');
			console.log(`\n⊘ ${stage.name} skipped (${record.reason})`);
			writeManifest();
			continue;
		}

		console.log(`\n=== ${stage.name}: ${stage.description} ===`);
		const [command, ...args] = stage.command;
		const result = await run(command, args);
		const record = {
			name: stage.name,
			status: result.exitCode === 0 ? 'passed' : 'failed',
			command: stage.command.join(' ')
		};
		if (result.exitCode !== 0) {
			record.exitCode = result.exitCode;
			record.outputTail = result.outputTail;
			manifest.ok = false;
		}
		manifest.stages.push(record);
		completed.set(stage.name, record.status);
		writeManifest();
	}

	const packageReport = readJsonIfExists(join(TMP_DIR, 'package-report.json'));
	if (packageReport) {
		manifest.package.distFileCount = packageReport.distFileCount;
		manifest.package.distFiles = packageReport.distFiles;
		if (packageReport.failures.length) {
			manifest.ok = false;
			manifest.package.failures = packageReport.failures;
		}
	}

	writeManifest();
	const failed = manifest.stages.filter((stage) => stage.status === 'failed');
	const skipped = manifest.stages.filter((stage) => stage.status === 'skipped');
	console.log(
		`\nverify-offline ${manifest.ok ? 'passed' : 'FAILED'}: ${manifest.stages.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`
	);
	if (!manifest.ok) process.exit(1);
}

main().catch((error) => {
	manifest.ok = false;
	manifest.stages.push({
		name: 'orchestrator',
		status: 'failed',
		error: String(error?.stack ?? error)
	});
	try {
		writeManifest();
	} catch {
		// ignore manifest write failure in crash path
	}
	console.error(error);
	process.exit(1);
});
