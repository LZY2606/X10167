/**
 * Shared fixtures for the adapter verification matrix.
 *
 * Every discovered adapter must provide a fixture here. All fixtures use the
 * same data shapes and expectations so server and client results can be
 * compared structurally across validation libraries.
 *
 * Schema contract implemented by every fixture:
 * - user:      nested object { name: string min 3, nick: nullable string, optional }
 * - tags:      array of string (each min 2), at least 1 item
 * - score:     number, defaults to 42
 */

import type { ClientValidationAdapter, ValidationAdapter } from '$lib/adapters/adapters.js';

// Adapter factories
import { arktype, arktypeClient } from '$lib/adapters/arktype.js';
import { classvalidator, classvalidatorClient } from '$lib/adapters/classvalidator.js';
import { effect, effectClient } from '$lib/adapters/effect.js';
import { joi, joiClient } from '$lib/adapters/joi.js';
import { schemasafe, schemasafeClient } from '$lib/adapters/schemasafe.js';
import { standard, standardClient } from '$lib/adapters/standard.js';
import { superformClient } from '$lib/adapters/superform.js';
import { superstruct, superstructClient } from '$lib/adapters/superstruct.js';
import { typebox, typeboxClient } from '$lib/adapters/typebox.js';
import { valibot, valibotClient } from '$lib/adapters/valibot.js';
import { vine, vineClient } from '$lib/adapters/vine.js';
import { yup, yupClient } from '$lib/adapters/yup.js';
import { zod, zodClient } from '$lib/adapters/zod.js';
import { zod as zod4, zodClient as zod4Client } from '$lib/adapters/zod4.js';

// Validation libraries
import { type } from 'arktype';
import {
	ArrayMinSize,
	IsArray,
	IsNumber,
	IsOptional,
	IsString,
	MinLength,
	ValidateNested
} from 'class-validator';
import { Type as ClassTransformerType } from 'class-transformer';
import { Schema } from 'effect';
import Joi from 'joi';
import {
	array,
	nullable,
	number,
	object,
	optional,
	size,
	string
} from 'superstruct';
import { Type } from 'typebox';
import * as v from 'valibot';
import Vine from '@vinejs/vine';
import * as yup from 'yup';
import { z } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema } from '$lib/jsonSchema/index.js';

///// Shared fixture data /////

export const MATRIX_VALID_DATA = {
	user: { name: 'Alice', nick: null },
	tags: ['ab', 'cd']
} as const;

export const MATRIX_INVALID_DATA = {
	user: { name: 'Al', nick: null },
	tags: []
} as const;

/** Expected default values when validating with no data. */
export const MATRIX_DEFAULTS = { score: 42 } as const;

/** Error paths expected for MATRIX_INVALID_DATA (dot-joined). */
export const MATRIX_ERROR_PATHS = ['user.name', 'tags'] as const;

/** Full defaults object for adapters that require explicit defaults. */
const EXPLICIT_DEFAULTS = {
	user: { name: '', nick: null as string | null },
	tags: [] as string[],
	score: MATRIX_DEFAULTS.score
};

export type MatrixFixture = {
	/** Server adapter, undefined for client-only adapters. */
	server?: ValidationAdapter<Record<string, unknown>, Record<string, unknown>>;
	/** Client adapter (always present). */
	client: ClientValidationAdapter<Record<string, unknown>, Record<string, unknown>>;
	/** Override for expected client issue paths, when the adapter cannot report nested paths. */
	clientErrorPaths?: string[];
};

///// Schemas /////

const zodSchema = z.object({
	user: z.object({
		name: z.string().min(3),
		nick: z.string().nullable().optional()
	}),
	tags: z.array(z.string().min(2)).min(1),
	score: z.number().default(MATRIX_DEFAULTS.score)
});

const zod4Schema = z4.object({
	user: z4.object({
		name: z4.string().min(3),
		nick: z4.string().nullable().optional()
	}),
	tags: z4.array(z4.string().min(2)).min(1),
	score: z4.number().default(MATRIX_DEFAULTS.score)
});

const valibotSchema = v.object({
	user: v.object({
		name: v.pipe(v.string(), v.minLength(3)),
		nick: v.optional(v.nullable(v.string()))
	}),
	tags: v.pipe(v.array(v.pipe(v.string(), v.minLength(2))), v.minLength(1)),
	score: v.optional(v.number(), MATRIX_DEFAULTS.score)
});

const yupSchema = yup.object({
	user: yup
		.object({
			name: yup.string().min(3).required(),
			nick: yup.string().nullable()
		})
		.required(),
	tags: yup.array().of(yup.string().min(2).required()).min(1).required(),
	score: yup.number().default(MATRIX_DEFAULTS.score)
});

const joiSchema = Joi.object({
	user: Joi.object({
		name: Joi.string().min(3).required(),
		nick: Joi.string().allow(null).optional()
	}).required(),
	tags: Joi.array().items(Joi.string().min(2)).min(1).required(),
	score: Joi.number().default(MATRIX_DEFAULTS.score)
});

const arktypeSchema = type({
	user: type({
		name: type.string.atLeastLength(3),
		'nick?': 'string | null'
	}),
	tags: type.string.atLeastLength(2).array().atLeastLength(1),
	score: type.number.default(MATRIX_DEFAULTS.score)
});

const typeboxSchema = Type.Object({
	user: Type.Object({
		name: Type.String({ minLength: 3 }),
		nick: Type.Optional(Type.Union([Type.String(), Type.Null()]))
	}),
	tags: Type.Array(Type.String({ minLength: 2 }), { minItems: 1 }),
	score: Type.Optional(Type.Number({ default: MATRIX_DEFAULTS.score }))
});

const superstructSchema = object({
	user: object({
		name: size(string(), 3, Infinity),
		nick: optional(nullable(string()))
	}),
	tags: size(array(size(string(), 2, Infinity)), 1, Infinity),
	score: optional(number())
});

const vineSchema = Vine.object({
	user: Vine.object({
		name: Vine.string().minLength(3),
		nick: Vine.string().nullable().optional()
	}),
	tags: Vine.array(Vine.string().minLength(2)).minLength(1),
	score: Vine.number().optional()
});

const effectSchema = Schema.Struct({
	user: Schema.Struct({
		name: Schema.String.pipe(Schema.minLength(3)),
		nick: Schema.optional(Schema.NullOr(Schema.String))
	}),
	tags: Schema.Array(Schema.String.pipe(Schema.minLength(2))).pipe(Schema.minItems(1)),
	score: Schema.optionalWith(Schema.Number, { default: () => MATRIX_DEFAULTS.score })
});

class MatrixUser {
	@IsString()
	@MinLength(3)
	name: string = '';

	@IsOptional()
	@IsString()
	nick: string | null = null;
}

class MatrixClassValidator {
	@ValidateNested()
	@ClassTransformerType(() => MatrixUser)
	user: MatrixUser = new MatrixUser();

	@IsArray()
	@ArrayMinSize(1)
	@MinLength(2, { each: true })
	tags: string[] = [];

	@IsOptional()
	@IsNumber()
	score: number = MATRIX_DEFAULTS.score;
}

const standardSchema: StandardSchemaV1 = {
	'~standard': {
		version: 1,
		vendor: 'superforms-matrix',
		validate(value) {
			const data = value as Record<string, unknown>;
			const issues: StandardSchemaV1.Issue[] = [];
			const user = data?.user as Record<string, unknown> | undefined;
			if (!user || typeof user.name !== 'string' || user.name.length < 3) {
				issues.push({ message: 'user.name must be a string of at least 3 characters', path: ['user', 'name'] });
			}
			if (!Array.isArray(data?.tags) || data.tags.length < 1) {
				issues.push({ message: 'tags must contain at least 1 item', path: ['tags'] });
			}
			if (issues.length) return { issues };
			return { value: { ...data, score: MATRIX_DEFAULTS.score } };
		}
	}
};

const jsonSchemaFixture = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		user: {
			type: 'object',
			properties: {
				name: { type: 'string', minLength: 3 },
				nick: { type: ['string', 'null'] }
			},
			required: ['name']
		},
		tags: {
			type: 'array',
			items: { type: 'string', minLength: 2 },
			minItems: 1
		},
		score: { type: 'number', default: MATRIX_DEFAULTS.score }
	},
	required: ['user', 'tags']
} as JSONSchema;

///// Fixture map, keyed by discovered adapter name /////

/* eslint-disable @typescript-eslint/no-explicit-any */
export const matrixFixtures: Record<string, MatrixFixture> = {
	arktype: {
		server: arktype(arktypeSchema) as any,
		client: arktypeClient(arktypeSchema) as any
	},
	classvalidator: {
		server: classvalidator(MatrixClassValidator, { defaults: EXPLICIT_DEFAULTS }) as any,
		client: classvalidatorClient(MatrixClassValidator) as any
	},
	effect: {
		server: effect(effectSchema, { defaults: EXPLICIT_DEFAULTS }) as any,
		client: effectClient(effectSchema) as any
	},
	joi: {
		server: joi(joiSchema) as any,
		client: joiClient(joiSchema) as any
	},
	schemasafe: {
		server: schemasafe(jsonSchemaFixture) as any,
		client: schemasafeClient(jsonSchemaFixture) as any
	},
	standard: {
		server: standard(standardSchema, { defaults: EXPLICIT_DEFAULTS }) as any,
		client: standardClient(standardSchema) as any
	},
	superform: {
		client: superformClient({
			user: (value: unknown) => {
				const user = value as { name?: unknown } | undefined;
				if (!user || typeof user.name !== 'string' || user.name.length < 3) {
					return 'user.name must be a string of at least 3 characters';
				}
			},
			tags: (value: unknown) => {
				if (!Array.isArray(value) || value.length < 1) return 'tags must contain at least 1 item';
			}
		}) as any,
		clientErrorPaths: ['user', 'tags']
	},
	superstruct: {
		server: superstruct(superstructSchema as any, { defaults: EXPLICIT_DEFAULTS }) as any,
		client: superstructClient(superstructSchema as any) as any
	},
	typebox: {
		server: typebox(typeboxSchema) as any,
		client: typeboxClient(typeboxSchema) as any
	},
	valibot: {
		server: valibot(valibotSchema) as any,
		client: valibotClient(valibotSchema) as any
	},
	vine: {
		server: vine(vineSchema, { defaults: EXPLICIT_DEFAULTS }) as any,
		client: vineClient(vineSchema) as any
	},
	yup: {
		server: yup(yupSchema) as any,
		client: yupClient(yupSchema) as any
	},
	zod: {
		server: zod(zodSchema) as any,
		client: zodClient(zodSchema) as any
	},
	zod4: {
		server: zod4(zod4Schema) as any,
		client: zod4Client(zod4Schema) as any
	}
};
/* eslint-enable @typescript-eslint/no-explicit-any */
