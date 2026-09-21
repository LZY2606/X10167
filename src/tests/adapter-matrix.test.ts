/**
 * Adapter verification matrix.
 *
 * Adapters are discovered from the actual export entry
 * (src/lib/adapters/index.ts) - never from a hand-written list. Every
 * discovered adapter must have a fixture in ./adapter-matrix/fixtures.ts and
 * is validated against the same nested/array/nullable/default/error-path
 * fixture on both server and client.
 */

import { describe, expect, it } from 'vitest';
import { superValidate } from '$lib/superValidate.js';
import {
	discoverAdapters,
	selfCheckDiscovery
} from '../../scripts/verify/discover-adapters.mjs';
import {
	MATRIX_DEFAULTS,
	MATRIX_ERROR_PATHS,
	MATRIX_INVALID_DATA,
	MATRIX_VALID_DATA,
	matrixFixtures
} from './adapter-matrix/fixtures.js';

const adapters = discoverAdapters();

function issuePaths(issues: { path?: (string | number | symbol)[] }[]): string[] {
	return issues
		.filter((issue) => Array.isArray(issue.path))
		.map((issue) => (issue.path as (string | number)[]).join('.'));
}

describe('adapter discovery self-check', () => {
	it('discovers adapters from the export entry without inconsistencies', () => {
		expect(selfCheckDiscovery()).toEqual([]);
	});

	it('discovers at least one adapter', () => {
		expect(adapters.length).toBeGreaterThan(0);
	});

	it('has a fixture for every discovered adapter (new adapters fail here)', () => {
		const discovered = adapters.map((a) => a.name).sort();
		const fixtured = Object.keys(matrixFixtures).sort();
		expect(fixtured).toEqual(discovered);
	});

	it('discovers a server and client export for every paired adapter', () => {
		for (const adapter of adapters) {
			expect(adapter.client, `${adapter.name} client export`).toBeTruthy();
			const fixture = matrixFixtures[adapter.name];
			if (adapter.server) {
				expect(fixture.server, `${adapter.name} server fixture`).toBeTruthy();
			}
		}
	});
});

describe('adapter matrix', () => {
	for (const adapter of adapters) {
		describe(adapter.name, () => {
			const fixture = matrixFixtures[adapter.name];

			if (adapter.server) {
				it('server: applies defaults when validating without data', async () => {
					const form = await superValidate(fixture.server!);
					expect(form.data).toMatchObject(MATRIX_DEFAULTS);
					expect(typeof form.data.user).toBe('object');
					expect(Array.isArray(form.data.tags)).toBe(true);
				});

				it('server: accepts the valid fixture', async () => {
					const form = await superValidate(structuredClone(MATRIX_VALID_DATA), fixture.server!);
					expect(form.valid).toBe(true);
					expect(form.errors).toEqual({});
					expect(form.data.user.name).toBe('Alice');
					expect(form.data.user.nick).toBeNull();
					expect(form.data.tags).toEqual(['ab', 'cd']);
				});

				it('server: rejects the invalid fixture with nested error paths', async () => {
					const form = await superValidate(structuredClone(MATRIX_INVALID_DATA), fixture.server!);
					expect(form.valid).toBe(false);
					for (const path of MATRIX_ERROR_PATHS) {
						const [head, tail] = path.split('.');
						const branch = form.errors[head as keyof typeof form.errors] as
							| Record<string, string[] | undefined>
							| { _errors?: string[] }
							| undefined;
						expect(branch, `errors.${path}`).toBeTruthy();
						const messages = tail
							? (branch as Record<string, string[] | undefined>)[tail]
							: (branch as { _errors?: string[] })._errors;
						expect(messages, `errors.${path}`).toBeTruthy();
						expect(messages!.length).toBeGreaterThan(0);
					}
				});
			}

			it('client: accepts the valid fixture', async () => {
				const result = await fixture.client.validate(structuredClone(MATRIX_VALID_DATA));
				expect(result.success).toBe(true);
				expect(result.issues).toBeUndefined();
				const data = result.data as Record<string, unknown>;
				expect((data.user as Record<string, unknown>).name).toBe('Alice');
			});

			it('client: rejects the invalid fixture with expected issue paths', async () => {
				const result = await fixture.client.validate(structuredClone(MATRIX_INVALID_DATA));
				expect(result.success).toBe(false);
				expect(Array.isArray(result.issues)).toBe(true);
				const paths = issuePaths(result.issues!);
				for (const expected of fixture.clientErrorPaths ?? MATRIX_ERROR_PATHS) {
					expect(paths, `missing issue path "${expected}"`).toContain(expected);
				}
			});
		});
	}
});
