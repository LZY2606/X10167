/**
 * Package content check for the prepack stage.
 *
 * Verifies that every package.json export target exists in dist/ and is
 * non-empty, that generated adapter type definitions exist (types-exist.js),
 * and emits a sha256/size summary of every packed file. Fails (exit 1) with
 * full details when anything is missing - never reduced to existence-only
 * spot checks.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { runCommand, rootDir, tmpDir, sanitize } from './lib.mjs';

const failures = [];
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

// 1. Every export condition target must exist and be non-empty.
const exportChecks = [];
for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
	for (const [condition, target] of Object.entries(entry)) {
		if (typeof target !== 'string') continue;
		const abs = join(rootDir, target);
		const exists = existsSync(abs);
		const size = exists ? statSync(abs).size : 0;
		const ok = exists && size > 0;
		if (!ok) failures.push(`export "${subpath}" (${condition}) -> ${target}: missing or empty`);
		exportChecks.push({ subpath, condition, target, ok });
	}
}

// 2. Adapter type definitions must exist next to their js files.
const typesExist = await runCommand('node', ['types-exist.js']);
if (typesExist.code !== 0) {
	failures.push(`types-exist.js failed:\n${sanitize(typesExist.output)}`);
}

// 3. Hash and measure every file in dist/.
function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name)
	)) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const distDir = join(rootDir, 'dist');
if (!existsSync(distDir)) {
	failures.push('dist/ does not exist - run the prepack stage first');
}

const files = existsSync(distDir)
	? walk(distDir).map((file) => ({
			path: relative(rootDir, file).split('\\').join('/'),
			size: statSync(file).size,
			sha256: createHash('sha256').update(readFileSync(file)).digest('hex')
		}))
	: [];

if (files.length === 0) failures.push('dist/ contains no files');

const summary = {
	ok: failures.length === 0,
	exports: exportChecks,
	files,
	failures
};

mkdirSync(tmpDir, { recursive: true });
writeFileSync(join(tmpDir, 'pack-summary.json'), JSON.stringify(summary, null, 2));

if (failures.length > 0) {
	console.error(failures.join('\n'));
	process.exit(1);
}
console.log(`pack-check ok: ${exportChecks.length} export targets, ${files.length} packed files`);
