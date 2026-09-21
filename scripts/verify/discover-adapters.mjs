/**
 * Discovers validation adapters from the actual export entry points,
 * so the verification matrix can never drift from a hand-written list.
 *
 * Sources of truth:
 *  - src/lib/adapters/index.ts  (runtime adapter exports)
 *  - src/lib/adapters/*.ts      (adapter implementation files)
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ADAPTERS_DIR = 'src/lib/adapters';
const INDEX_FILE = join(ADAPTERS_DIR, 'index.ts');

/** Files in src/lib/adapters that are not adapter implementations. */
const NON_ADAPTER_FILES = new Set(['index.ts', 'adapters.ts', 'typeSchema.ts']);

/**
 * Parse `export { a, b as c, type D } from './mod.js'` statements.
 * @returns {{ name: string, module: string }[]} exported value names
 */
export function parseAdapterExports(indexSource) {
	// Strip comments so disabled exports (e.g. ajv) are not picked up.
	const source = indexSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
	const exports = [];
	const re = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*'\.\/([\w./-]+)\.js'/gs;
	let match;
	while ((match = re.exec(source)) !== null) {
		if (match[1]) continue; // `export type { ... }`
		const module = match[3];
		for (const rawMember of match[2].split(',')) {
			const member = rawMember.trim();
			if (!member || member.startsWith('type ')) continue;
			const aliasMatch = /^(\w+)\s+as\s+(\w+)$/.exec(member);
			exports.push({ name: aliasMatch ? aliasMatch[2] : member, module });
		}
	}
	return exports;
}

/**
 * Discover adapters from the adapters index.
 * A server adapter `foo` paired with `fooClient` forms a full adapter.
 * A `fooClient` without a `foo` is a client-only adapter.
 *
 * @returns {{ name: string, server: string|null, client: string, module: string }[]}
 */
export function discoverAdapters(root = process.cwd()) {
	const indexPath = join(root, INDEX_FILE);
	if (!existsSync(indexPath)) {
		throw new Error(`Adapter index not found: ${INDEX_FILE}`);
	}
	const exports = parseAdapterExports(readFileSync(indexPath, 'utf8'));
	const names = new Set(exports.map((e) => e.name));
	const moduleOf = new Map(exports.map((e) => [e.name, e.module]));

	const adapters = [];
	for (const name of [...names].sort()) {
		if (name.endsWith('Client')) {
			const base = name.slice(0, -'Client'.length);
			if (!names.has(base)) {
				adapters.push({ name: base, server: null, client: name, module: moduleOf.get(name) });
			}
			continue;
		}
		const client = `${name}Client`;
		if (names.has(client)) {
			adapters.push({ name, server: name, client, module: moduleOf.get(name) });
		}
	}
	return adapters;
}

/**
 * Adapter implementation files (excluding shared infrastructure).
 * @returns {string[]} module ids like 'zod', 'zod4'
 */
export function adapterSourceModules(root = process.cwd()) {
	return readdirSync(join(root, ADAPTERS_DIR))
		.filter((f) => f.endsWith('.ts') && !NON_ADAPTER_FILES.has(f))
		.map((f) => f.replace(/\.ts$/, ''))
		.sort();
}

/**
 * Self-check: discovery itself must be complete and consistent.
 * Returns a list of problems; empty means OK.
 */
export function selfCheckDiscovery(root = process.cwd()) {
	const problems = [];
	const indexPath = join(root, INDEX_FILE);
	const exports = parseAdapterExports(readFileSync(indexPath, 'utf8'));
	const exportedModules = new Set(exports.map((e) => e.module));

	// Every adapter implementation file must be re-exported from the index.
	for (const mod of adapterSourceModules(root)) {
		if (!exportedModules.has(mod)) {
			problems.push(`src/lib/adapters/${mod}.ts is not re-exported from ${INDEX_FILE}`);
		}
	}

	// Every module referenced by the index must exist on disk.
	for (const mod of exportedModules) {
		const file = join(root, ADAPTERS_DIR, `${mod}.ts`);
		if (!existsSync(file)) {
			problems.push(`${INDEX_FILE} exports from missing file src/lib/adapters/${mod}.ts`);
		}
	}

	// Every discovered adapter must be pairable (server+client or explicit client-only).
	for (const adapter of discoverAdapters(root)) {
		if (!adapter.server && !adapter.client) {
			problems.push(`Adapter "${adapter.name}" has neither server nor client export`);
		}
	}

	return problems;
}
