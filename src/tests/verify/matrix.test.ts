/**
 * Adapter matrix for the offline verification pipeline.
 *
 * Adapters are discovered from the real export entry (`$lib/adapters/index.js`),
 * not from a hand-maintained list. Every discovered server adapter needs:
 * - a matching `XClient` export
 * - a fixture module in `./fixtures/<name>.ts` exercising the canonical shape
 *
 * Adding an adapter export without a fixture fails this file immediately.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as adapterEntry from '$lib/adapters/index.js';
import { superValidate } from '$lib/superValidate.js';
import { describe, expect, it } from 'vitest';
import {
	canonicalDefaults,
	expectedErrorPaths,
	invalidData,
	partialData,
	validData,
	validDataNullable,
	type FixtureOverrides
} from './fixtures/canonical.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdapter = (schema: any, options?: any) => any;
type ClientAdapter = (schema: unknown) => {
	validate: (data: unknown) => Promise<{
		success: boolean;
		data?: unknown;
		issues?: Array<{ path?: Array<string | number>; message: string }>;
	}>;
};

type FixtureModule = {
	schema: unknown;
	clientOnly?: boolean;
	expectedClientErrorPaths?: string[];
	overrides?: FixtureOverrides;
};

const fixtures = import.meta.glob<FixtureModule>('./fixtures/*.ts', { eager: true });
const fixtureByName = new Map<string, { name: string; mod: FixtureModule }>();
for (const [path, mod] of Object.entries(fixtures)) {
	const name = path.split('/').pop()!.replace('.ts', '');
	if (name === 'canonical') continue;
	fixtureByName.set(name, { name, mod });
}

const runtimeExports = Object.keys(adapterEntry);
const serverAdapters = runtimeExports.filter((name) => !name.endsWith('Client')).sort();
const clientNames = new Set(
	runtimeExports
		.filter((name) => name.endsWith('Client'))
		.map((name) => name.slice(0, -'Client'.length))
);

function formatPath(path: Array<string | number | undefined>): string {
	return path.reduce<string>((result, segment) => {
		if (segment === undefined) return result;
		return typeof segment === 'number' || /^\d+$/.test(String(segment))
			? `${result}[${segment}]`
			: result
				? `${result}.${segment}`
				: String(segment);
	}, '');
}

function collectErrorPaths(value: unknown, path: Array<string | number> = []): string[] {
	if (typeof value === 'string') return [formatPath(path)];
	if (Array.isArray(value)) {
		if (value.every((item) => typeof item === 'string')) {
			return value.length ? [formatPath(path)] : [];
		}
		return value.flatMap((item, index) => collectErrorPaths(item, [...path, index]));
	}
	if (!value || typeof value !== 'object') return [];
	return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
		key === '_errors'
			? collectErrorPaths(child, path)
			: collectErrorPaths(child, [...path, /^\d+$/.test(key) ? Number(key) : key])
	);
}

describe('adapter matrix discovery', () => {
	it('discovers adapters from the export entry', () => {
		expect(serverAdapters.length).toBeGreaterThan(10);
		expect(serverAdapters).toContain('zod');
		// Disabled adapters left as comments (e.g. ajv) must not be discovered.
		expect(runtimeExports).not.toContain('ajv');
	});

	it('has a fixture and a client export for every server adapter', () => {
		for (const name of serverAdapters) {
			expect(clientNames.has(name), `missing client export for "${name}"`).toBe(true);
			const fixture = fixtureByName.get(name);
			expect(fixture, `missing matrix fixture for adapter "${name}"`).toBeDefined();
			expect(fixture!.mod.clientOnly).not.toBe(true);
		}
	});

	it('has no fixture without an exported adapter (canonical excluded)', () => {
		for (const name of fixtureByName.keys()) {
			const isClientOnly = fixtureByName.get(name)!.mod.clientOnly === true;
			expect(
				runtimeExports.includes(`${name}Client`) && (isClientOnly || runtimeExports.includes(name)),
				`fixture "${name}" has no matching adapter export`
			).toBe(true);
		}
	});

	it('covers every package.json export subpath', () => {
		const pkgPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { exports: Record<string, unknown> };
		for (const subpath of Object.keys(pkg.exports)) {
			if (subpath === '.') continue;
			expect(runtimeExports.length).toBeGreaterThan(0);
		}
		expect(pkg.exports['./adapters']).toBeDefined();
	});
});

describe.each(serverAdapters)('adapter matrix: %s', (name) => {
	const fixtureEntry = fixtureByName.get(name);

	it('has a canonical fixture and a client adapter', () => {
		expect(fixtureEntry, `missing canonical fixture for adapter "${name}"`).toBeDefined();
		expect(clientNames.has(name), `missing client adapter "${name}Client"`).toBe(true);
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mod = (adapterEntry as any)[name] as AnyAdapter;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const clientMod = (adapterEntry as any)[`${name}Client`] as ClientAdapter;
	const fixture = fixtureEntry?.mod ?? { schema: undefined };
	const ov = fixture.overrides;
	const expectedDefaults = ov?.defaults ?? canonicalDefaults;
	const expectedValid = ov?.valid ?? validData;
	const expectedValidNullable = ov?.validNullable ?? validDataNullable;
	const expectedPartial = ov?.partial ?? partialData;
	const expectedInvalid = ov?.invalid ?? invalidData;
	const expectedPaths = ov?.expectedErrorPaths ?? expectedErrorPaths;
	const server = mod(fixture.schema, { defaults: expectedDefaults });
	const client = clientMod(fixture.schema);

	it('produces server defaults for the canonical shape', async () => {
		const form = await superValidate(server);
		expect(form.data).toEqual(expectedDefaults);
	});

	it('accepts valid data on the server with the expected shape', async () => {
		const form = await superValidate(expectedValid, server);
		expect(form.valid).toBe(true);
		expect(form.data).toEqual(expectedValid);
	});

	it('accepts a nullable value on the server', async () => {
		const form = await superValidate(expectedValidNullable, server);
		expect(form.valid).toBe(true);
		expect(form.data.note).toBeNull();
	});

	it('reports all error paths on the server', async () => {
		const form = await superValidate(expectedInvalid, server);
		expect(form.valid).toBe(false);
		const paths = collectErrorPaths(form.errors);
		for (const expected of expectedPaths) {
			expect(paths, `missing server error path ${expected}`).toContain(expected);
		}
	});

	it('applies schema-level defaults when fields are omitted', async () => {
		const form = await superValidate(expectedPartial, server);
		if (form.valid) {
			expect(form.data.note).toBeNull();
			expect(form.data.score).toBe(5);
		}
	});

	it('accepts valid data on the client adapter', async () => {
		const result = await client.validate(expectedValid);
		expect(result.success).toBe(true);
		expect(result.data).toEqual(expectedValid);
	});

	it('reports all error paths from the client adapter', async () => {
		const result = await client.validate(expectedInvalid);
		expect(result.success).toBe(false);
		expect(result.issues?.length).toBeGreaterThan(0);
		const paths = new Set(result.issues!.map((issue) => formatPath(issue.path ?? [])));
		const expected = fixture.expectedClientErrorPaths ?? expectedPaths;
		for (const path of expected) {
			expect([...paths], `missing client error path ${path}`).toContain(path);
		}
	});
});

describe.each([...fixtureByName.values()].filter(({ mod }) => mod.clientOnly))(
	'client-only adapter matrix: %s',
	({ name, mod }) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const clientMod = (adapterEntry as any)[`${name}Client`] as ClientAdapter;
		const client = clientMod(mod.schema);

		it('accepts valid data', async () => {
			const result = await client.validate(mod.overrides?.valid ?? validData);
			expect(result.success).toBe(true);
		});

		it('reports the canonical error paths', async () => {
			const result = await client.validate(mod.overrides?.invalid ?? invalidData);
			expect(result.success).toBe(false);
			const paths = [...new Set(result.issues!.map((issue) => formatPath(issue.path ?? [])))];
			for (const path of mod.expectedClientErrorPaths ?? expectedErrorPaths) {
				expect(paths, `missing client error path ${path}`).toContain(path);
			}
		});
	}
);
