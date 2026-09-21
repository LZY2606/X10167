/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adapter matrix verification.
 *
 * Discovers the adapters exported from $lib/adapters/index.ts (never a
 * hand-written list) and runs the same fixture - nested object, array,
 * nullable, defaults and error paths - through both the server adapter
 * (superValidate) and the client adapter (validate), comparing the
 * result shapes.
 *
 * Self-tests fail when a discovered adapter/client export has no fixture
 * builder, when a fixture builder is stale, or when a package.json export
 * points at a source file that no longer exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { superValidate } from '$lib/superValidate.js';
import { flattenErrors } from '$lib/errors.js';
import { mergePath } from '$lib/stringPath.js';
import * as adapterModule from '$lib/adapters/index.js';
import {
	arktype,
	arktypeClient,
	classvalidator,
	classvalidatorClient,
	effect,
	effectClient,
	joi,
	joiClient,
	schemasafe,
	schemasafeClient,
	standard,
	standardClient,
	superformClient,
	superstruct,
	superstructClient,
	typebox,
	typeboxClient,
	valibot,
	valibotClient,
	vine,
	vineClient,
	yup,
	yupClient,
	zod,
	zodClient,
	zod4,
	zod4Client
} from '$lib/adapters/index.js';

import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import * as vb from 'valibot';
import * as yp from 'yup';
import Joi from 'joi';
import { type } from 'arktype';
import { Type } from 'typebox';
import * as st from 'superstruct';
import { Schema as EffectSchema } from 'effect';
import Vine from '@vinejs/vine';
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

/////////////////////////////////////////////////////////////////////
// Shared fixture data
/////////////////////////////////////////////////////////////////////

const validData = {
	user: { name: 'Ab', address: { city: 'Lund' } },
	tags: ['aa', 'bb'],
	nickname: null,
	role: 'admin'
};

const invalidData = {
	user: { name: 'A', address: { city: '' } },
	tags: ['a'],
	nickname: null,
	role: ''
};

const fixtureDefaults = {
	user: { name: '', address: { city: '' } },
	tags: [] as string[],
	nickname: null as string | null,
	role: 'user'
};

const defaultErrorPaths = ['user.name', 'user.address.city', 'tags[0]'];

type AdapterFixture = {
	server?: any;
	client?: any;
	serverErrorPaths?: string[];
	clientErrorPaths?: string[];
};

/////////////////////////////////////////////////////////////////////
// Fixture builders, keyed by adapter export base name
/////////////////////////////////////////////////////////////////////

const builders: Record<string, () => AdapterFixture> = {
	zod: () => {
		const schema = z3.object({
			user: z3.object({
				name: z3.string().min(2),
				address: z3.object({ city: z3.string().min(1) })
			}),
			tags: z3.array(z3.string().min(2)),
			nickname: z3.string().nullable(),
			role: z3.string().default('user')
		});
		return { server: zod(schema), client: zodClient(schema) };
	},

	zod4: () => {
		const schema = z4.object({
			user: z4.object({
				name: z4.string().min(2),
				address: z4.object({ city: z4.string().min(1) })
			}),
			tags: z4.array(z4.string().min(2)),
			nickname: z4.string().nullable(),
			role: z4.string().default('user')
		});
		return { server: zod4(schema), client: zod4Client(schema) };
	},

	valibot: () => {
		const schema = vb.object({
			user: vb.object({
				name: vb.pipe(vb.string(), vb.minLength(2)),
				address: vb.object({ city: vb.pipe(vb.string(), vb.minLength(1)) })
			}),
			tags: vb.array(vb.pipe(vb.string(), vb.minLength(2))),
			nickname: vb.nullable(vb.string()),
			role: vb.optional(vb.string(), 'user')
		});
		return { server: valibot(schema), client: valibotClient(schema) };
	},

	yup: () => {
		const schema = yp.object({
			user: yp
				.object({
					name: yp.string().min(2).required(),
					address: yp.object({ city: yp.string().min(1).required() }).required()
				})
				.required(),
			tags: yp.array().of(yp.string().min(2).required()).required(),
			nickname: yp.string().nullable().defined(),
			role: yp.string().default('user')
		});
		return { server: yup(schema), client: yupClient(schema) };
	},

	joi: () => {
		const schema = Joi.object({
			user: Joi.object({
				name: Joi.string().min(2).required(),
				address: Joi.object({ city: Joi.string().min(1).required() }).required()
			}).required(),
			tags: Joi.array().items(Joi.string().min(2)).required(),
			nickname: Joi.string().allow(null).required(),
			role: Joi.string().default('user')
		});
		return { server: joi(schema), client: joiClient(schema) };
	},

	arktype: () => {
		const schema = type({
			user: {
				name: 'string>=2',
				address: { city: 'string>=1' }
			},
			tags: type('string>=2').array(),
			nickname: 'string|null',
			role: 'string = "user"'
		});
		return { server: arktype(schema), client: arktypeClient(schema) };
	},

	typebox: () => {
		const schema = Type.Object({
			user: Type.Object({
				name: Type.String({ minLength: 2 }),
				address: Type.Object({ city: Type.String({ minLength: 1 }) })
			}),
			tags: Type.Array(Type.String({ minLength: 2 })),
			nickname: Type.Union([Type.String(), Type.Null()]),
			role: Type.String({ default: 'user' })
		});
		return { server: typebox(schema), client: typeboxClient(schema) };
	},

	superstruct: () => {
		const schema = st.object({
			user: st.object({
				name: st.size(st.string(), 2, 100),
				address: st.object({ city: st.size(st.string(), 1, 100) })
			}),
			tags: st.array(st.size(st.string(), 2, 100)),
			nickname: st.nullable(st.string()),
			role: st.defaulted(st.string(), 'user')
		});
		return {
			server: superstruct(schema, { defaults: fixtureDefaults }),
			client: superstructClient(schema)
		};
	},

	classvalidator: () => {
		// The adapter assigns plain data onto a class instance, so nested
		// objects are converted back to instances through setters.
		class Address {
			@MinLength(1)
			city: string = '';
		}
		class User {
			@MinLength(2)
			name: string = '';
			#address: Address = new Address();
			@ValidateNested()
			get address(): Address {
				return this.#address;
			}
			set address(value: Address) {
				this.#address = Object.assign(new Address(), value);
			}
		}
		class Schema {
			#user: User = new User();
			@ValidateNested()
			get user(): User {
				return this.#user;
			}
			set user(value: User) {
				this.#user = Object.assign(new User(), value);
			}
			@MinLength(2, { each: true })
			tags: string[] = [];
			@IsOptional()
			@IsString()
			nickname: string | null = null;
			role: string = 'user';
		}
		// The class has private fields, making the inferred defaults type nominal.
		const options = { defaults: fixtureDefaults } as never;
		return {
			server: classvalidator(Schema, options),
			client: classvalidatorClient(Schema),
			// class-validator reports array item constraints on the property itself
			serverErrorPaths: ['user.name', 'user.address.city', 'tags._errors'],
			clientErrorPaths: ['user.name', 'user.address.city', 'tags']
		};
	},

	effect: () => {
		const schema = EffectSchema.Struct({
			user: EffectSchema.Struct({
				name: EffectSchema.String.pipe(EffectSchema.minLength(2)),
				address: EffectSchema.Struct({
					city: EffectSchema.String.pipe(EffectSchema.minLength(1))
				})
			}),
			tags: EffectSchema.Array(EffectSchema.String.pipe(EffectSchema.minLength(2))),
			nickname: EffectSchema.NullOr(EffectSchema.String),
			role: EffectSchema.String.annotations({ default: 'user' })
		});
		return { server: effect(schema), client: effectClient(schema) };
	},

	vine: () => {
		const schema = Vine.object({
			user: Vine.object({
				name: Vine.string().minLength(2),
				address: Vine.object({ city: Vine.string().minLength(1) })
			}),
			tags: Vine.array(Vine.string().minLength(2)),
			nickname: Vine.string().nullable(),
			role: Vine.string()
		});
		return { server: vine(schema, { defaults: fixtureDefaults }), client: vineClient(schema) };
	},

	schemasafe: () => {
		const schema = {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						name: { type: 'string', minLength: 2 },
						address: {
							type: 'object',
							properties: { city: { type: 'string', minLength: 1 } },
							required: ['city']
						}
					},
					required: ['name', 'address']
				},
				tags: { type: 'array', items: { type: 'string', minLength: 2 } },
				nickname: { type: ['string', 'null'] },
				role: { type: 'string', default: 'user' }
			},
			required: ['user', 'tags', 'nickname'],
			additionalProperties: false
		} as const;
		return { server: schemasafe(schema), client: schemasafeClient(schema) };
	},

	standard: () => {
		const schema = z4.object({
			user: z4.object({
				name: z4.string().min(2),
				address: z4.object({ city: z4.string().min(1) })
			}),
			tags: z4.array(z4.string().min(2)),
			nickname: z4.string().nullable(),
			role: z4.string().default('user')
		});
		return {
			server: standard(schema, { defaults: fixtureDefaults }),
			client: standardClient(schema)
		};
	},

	superform: () => ({
		// The superform adapter calls validators per data leaf, so the tags
		// validator receives each array item.
		client: superformClient<
			{
				user: { name: string; address: { city: string } };
				tags: string[];
			},
			{
				user: { name: string; address: { city: string } };
				tags: string[];
			}
		>({
			user: {
				name: (value?: string) => (!value || value.length < 2 ? 'Too short' : null),
				address: {
					city: (value?: string) => (!value ? 'Required' : null)
				}
			},
			tags: (value?: unknown) => {
				const tag = value as string | undefined;
				return !tag || tag.length < 2 ? 'Tag too short' : null;
			}
		})
	})
};

/////////////////////////////////////////////////////////////////////
// Discovery of the actual adapter exports
/////////////////////////////////////////////////////////////////////

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function discoverAdapterExports(): { servers: string[]; clients: string[] } {
	const indexSource = readFileSync(join(rootDir, 'src/lib/adapters/index.ts'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|\s)\/\/.*$/gm, '$1');
	const names = new Set<string>();
	for (const match of indexSource.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]/g)) {
		for (const part of match[1].split(',')) {
			const entry = part.trim();
			if (!entry || entry.startsWith('type ')) continue;
			const exported = entry.includes(' as ')
				? entry
						.split(/\s+as\s+/)
						.pop()!
						.trim()
				: entry;
			names.add(exported);
		}
	}
	const values = [...names].filter(
		(name) => typeof (adapterModule as Record<string, unknown>)[name] === 'function'
	);
	return {
		servers: values.filter((name) => !name.endsWith('Client')).sort(),
		clients: values.filter((name) => name.endsWith('Client')).sort()
	};
}

const discovered = discoverAdapterExports();

function baseName(exportName: string): string {
	return exportName.endsWith('Client') ? exportName.slice(0, -'Client'.length) : exportName;
}

const matrix = [...new Set([...discovered.servers, ...discovered.clients].map(baseName))].sort();

/////////////////////////////////////////////////////////////////////
// Helpers
/////////////////////////////////////////////////////////////////////

function shapeOf(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(shapeOf);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, shapeOf((value as Record<string, unknown>)[key])])
		);
	}
	return typeof value;
}

function issuePaths(issues: { path: (string | number | symbol)[] }[]): string[] {
	return issues.map((issue) => mergePath(issue.path)).sort();
}

/////////////////////////////////////////////////////////////////////
// Self-tests: matrix coverage must match the real exports
/////////////////////////////////////////////////////////////////////

describe('adapter matrix self-test', () => {
	it('discovers at least one server and one client adapter', () => {
		expect(discovered.servers.length).toBeGreaterThan(0);
		expect(discovered.clients.length).toBeGreaterThan(0);
	});

	it('has a fixture builder for every discovered adapter export', () => {
		const missing = matrix.filter((name) => !(name in builders));
		expect(
			missing,
			`No fixture builder for adapter(s): ${missing.join(', ')} - add them to src/tests/adapterMatrix.test.ts`
		).toEqual([]);
	});

	it('has no stale fixture builders', () => {
		const stale = Object.keys(builders).filter((name) => !matrix.includes(name));
		expect(stale, `Stale fixture builder(s): ${stale.join(', ')}`).toEqual([]);
	});

	it('keeps package.json exports pointed at existing source files', () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
		const broken: string[] = [];
		for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
			for (const target of Object.values(entry as Record<string, string>)) {
				if (typeof target !== 'string' || !target.startsWith('./dist/')) continue;
				const rel = target.slice('./dist/'.length);
				const candidates = [
					rel,
					rel.replace(/\.svelte\.d\.ts$/, '.svelte'),
					rel.replace(/\.d\.ts$/, '.ts'),
					rel.replace(/\.js$/, '.ts')
				];
				if (!candidates.some((c) => existsSync(join(rootDir, 'src/lib', c)))) {
					broken.push(`${subpath} -> ${target}`);
				}
			}
		}
		expect(broken, `package.json exports without source: ${broken.join(', ')}`).toEqual([]);
	});
});

/////////////////////////////////////////////////////////////////////
// Matrix: same fixture through server and client adapters
/////////////////////////////////////////////////////////////////////

describe.each(matrix)('adapter matrix: %s', (name) => {
	const builder = builders[name];
	if (!builder) {
		it('has a fixture builder', () => {
			throw new Error(
				`No fixture builder for adapter "${name}" - add one to src/tests/adapterMatrix.test.ts`
			);
		});
		return;
	}
	const fixture = builder();
	const serverErrorPaths = fixture.serverErrorPaths ?? defaultErrorPaths;
	const clientErrorPaths = fixture.clientErrorPaths ?? defaultErrorPaths;

	if (fixture.server) {
		it('server: generates defaults with the expected shape', async () => {
			const form = await superValidate(fixture.server);
			const data = form.data as typeof fixtureDefaults;
			expect(form.valid).toBe(false);
			expect(data.role).toBe('user');
			expect(typeof data.user).toBe('object');
			expect(Array.isArray(data.tags)).toBe(true);
		});

		it('server: accepts the valid fixture', async () => {
			const form = await superValidate(validData, fixture.server);
			const data = form.data as typeof validData;
			expect(form.valid).toBe(true);
			expect(form.errors).toEqual({});
			expect(data.user.name).toBe('Ab');
			expect(data.tags).toHaveLength(2);
			expect(data.nickname).toBe(null);
		});

		it('server: reports the expected error paths', async () => {
			const form = await superValidate(invalidData, fixture.server);
			expect(form.valid).toBe(false);
			const paths = flattenErrors(form.errors)
				.map((e) => e.path)
				.sort();
			for (const expected of serverErrorPaths) {
				expect(paths, `missing server error path ${expected}`).toContain(expected);
			}
		});
	}

	if (fixture.client) {
		it('client: accepts the valid fixture', async () => {
			const result = await fixture.client.validate(validData);
			expect(result.issues).toBeUndefined();
			expect(result.data.user.name).toBe('Ab');
			expect(result.data.tags).toHaveLength(2);
			expect(result.data.nickname).toBe(null);
		});

		it('client: reports the expected error paths', async () => {
			const result = await fixture.client.validate(invalidData);
			expect(result.data).toBeUndefined();
			const paths = issuePaths(result.issues ?? []);
			for (const expected of clientErrorPaths) {
				expect(paths, `missing client error path ${expected}`).toContain(expected);
			}
		});
	}

	if (fixture.server && fixture.client) {
		it('server and client produce the same result shape', async () => {
			const serverForm = await superValidate(validData, fixture.server);
			const clientResult = await fixture.client.validate(validData);
			expect(serverForm.valid).toBe(true);
			expect(shapeOf(clientResult.data)).toEqual(shapeOf(serverForm.data));

			const serverErrors = await superValidate(invalidData, fixture.server);
			const clientErrors = await fixture.client.validate(invalidData);
			expect(serverErrors.valid).toBe(false);
			expect(clientErrors.issues?.length).toBeGreaterThan(0);
		});
	}
});
