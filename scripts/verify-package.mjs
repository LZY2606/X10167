/**
 * Package content verification for the offline pipeline.
 *
 * Runs after `prepack` and checks:
 * - every package.json `exports` / `typesVersions` target exists in dist
 *   (catches exports pointing at stale or missing files)
 * - the packed adapters entry re-exports exactly what the source entry exports
 *   (catches a new adapter export not reaching the published entry)
 * - records a content digest of every packed file
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TMP_DIR, discoverAdapterExports, hashDirectory } from './verify/lib.mjs';

mkdirSync(TMP_DIR, { recursive: true });

const failures = [];
const fail = (message) => failures.push(message);

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const collectTargets = (value, targets = []) => {
	if (typeof value === 'string') targets.push(value);
	else if (value && typeof value === 'object') {
		for (const child of Object.values(value)) collectTargets(child, targets);
	}
	return targets;
};

const exportTargets = new Set();
for (const [subpath, conditions] of Object.entries(pkg.exports)) {
	for (const target of collectTargets(conditions)) {
		if (!target.startsWith('./dist/')) {
			fail(`exports "${subpath}" points outside dist: ${target}`);
			continue;
		}
		exportTargets.add(target);
	}
}

for (const target of exportTargets) {
	const distPath = join(ROOT, target);
	if (!existsSync(distPath)) fail(`export target is missing after prepack: ${target}`);
	else if (statSync(distPath).size === 0) fail(`export target is empty: ${target}`);
}

for (const [version, map] of Object.entries(pkg.typesVersions ?? {})) {
	for (const [key, targets] of Object.entries(map)) {
		for (const target of targets) {
			if (!existsSync(join(ROOT, target))) {
				fail(`typesVersions[${version}]["${key}"] target missing: ${target}`);
			}
		}
	}
}

const sourceAdapters = discoverAdapterExports(join(ROOT, 'src/lib/adapters/index.ts'));
const distEntry = join(ROOT, 'dist/adapters/index.js');
if (!existsSync(distEntry)) fail('dist/adapters/index.js missing (prepack did not run?)');
else {
	const distSource = readFileSync(distEntry, 'utf8');
	const distAdapters = new Set(discoverAdapterExports(distEntry));
	for (const name of sourceAdapters) {
		if (!distAdapters.has(name)) {
			fail(`adapter export "${name}" exists in src but is missing from dist/adapters/index.js`);
		}
	}
	// Also catch stale exports that only exist in dist
	for (const name of distAdapters) {
		if (!sourceAdapters.includes(name)) {
			fail(`adapter export "${name}" exists in dist but not in src/lib/adapters/index.ts`);
		}
	}
	if (!distSource.includes('./')) {
		// sanity; dist re-export style check is path-based above
	}
}

const distFiles = existsSync(join(ROOT, 'dist')) ? await hashDirectory(join(ROOT, 'dist')) : [];

const report = {
	exportTargets: [...exportTargets].sort(),
	sourceAdapterExports: sourceAdapters,
	distFileCount: distFiles.length,
	distFiles,
	failures
};
writeFileSync(join(TMP_DIR, 'package-report.json'), JSON.stringify(report, null, 2));

if (distFiles.length === 0) fail('no files found in dist after prepack');

if (failures.length) {
	console.error('\npackage content verification failed:');
	for (const message of failures) console.error(`  - ${message}`);
	process.exit(1);
}

console.log(
	`\npackage content verified: ${exportTargets.size} export targets, ${distFiles.length} dist files`
);
