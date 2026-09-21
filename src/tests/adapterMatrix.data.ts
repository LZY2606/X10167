/**
 * Shared fixtures for the adapter matrix test (adapterMatrix.test.ts).
 *
 * Every discovered adapter is validated against the same data, covering:
 * nested objects, arrays, nullable fields, default values and error paths.
 */

export type MatrixData = {
	name: string;
	age: number;
	score: number | null;
	role: string;
	tags: string[];
	address: {
		city: string;
		zip: string;
	};
};

/** Passes every fixture schema. `role` matches the schema default. */
export const matrixValidData: MatrixData = {
	name: 'Alice',
	age: 30,
	score: null,
	role: 'user',
	tags: ['alpha', 'beta'],
	address: {
		city: 'Lund',
		zip: '12345'
	}
};

/** Fails every fixture schema at exactly the paths in matrixErrorPaths. */
export const matrixInvalidData = {
	name: 'Al',
	age: 17,
	score: 'abc',
	role: 'user',
	tags: [],
	address: {
		city: '',
		zip: '123'
	}
} as const;

/** Default value that every fixture schema must provide for `role`. */
export const matrixDefaultRole = 'user';

/** Explicit defaults passed to adapters that cannot express them in a schema. */
export const matrixDefaults: MatrixData = {
	name: '',
	age: 0,
	score: null,
	role: matrixDefaultRole,
	tags: [],
	address: {
		city: '',
		zip: ''
	}
};

/** Error paths expected when validating matrixInvalidData. */
export const matrixErrorPaths = [
	'name',
	'age',
	'score',
	'tags',
	'address.city',
	'address.zip'
] as const;

/** Top-level keys every fixture schema must produce. */
export const matrixTopLevelKeys = ['name', 'age', 'score', 'role', 'tags', 'address'] as const;
