/**
 * Canonical fixture shared by every validation adapter.
 *
 * Shape covered for each adapter:
 * - nested object (`user.name`, minimum length 2)
 * - array of strings (`tags`, min 1 item, each min 2 chars)
 * - nullable field (`note`, string | null)
 * - default value (`score`, defaults to 5)
 * - error paths for invalid data
 */
export type FixtureData = {
	user: { name: string };
	tags: string[];
	note: string | null;
	score: number;
};

/**
 * Most adapters validate nested plain objects directly. class-validator (via
 * @typeschema) does not transform nested values, so its fixture overrides the
 * user expectations to a top-level string field.
 */
export const canonicalDefaults: FixtureData = {
	user: { name: 'Unknown' },
	tags: [],
	note: null,
	score: 5
};

export const validData: FixtureData = {
	user: { name: 'Alice' },
	tags: ['ab', 'cd'],
	note: 'ok',
	score: 10
};

export const validDataNullable: FixtureData = {
	user: { name: 'Bob' },
	tags: ['ab'],
	note: null,
	score: 0
};

/** Leaves out `score` to exercise schema-level default application. */
export const partialData = {
	user: { name: 'Carol' },
	tags: ['ab'],
	note: null
};

export const invalidData = {
	user: { name: 'A' },
	tags: ['ok', 'x'],
	note: 42,
	score: -1
};

export const expectedErrorPaths = ['user.name', 'tags[1]', 'note', 'score'] as const;

/**
 * Fixture overrides for adapters whose host library cannot express or
 * validate part of the canonical shape. Keep these explicit per adapter so
 * the canonical fixture itself never silently weakens.
 */
export type FixtureOverrides = {
	defaults?: unknown;
	valid?: unknown;
	validNullable?: unknown;
	partial?: unknown;
	invalid?: unknown;
	expectedErrorPaths?: readonly string[];
};

export const flatUserOverrides: FixtureOverrides = {
	defaults: { user: 'Unknown', tags: [], note: null, score: 5 },
	valid: { user: 'Alice', tags: ['ab', 'cd'], note: 'ok', score: 10 },
	validNullable: { user: 'Bob', tags: ['ab'], note: null, score: 0 },
	partial: { user: 'Carol', tags: ['ab'], note: null },
	invalid: { user: 'A', tags: ['ok', 'x'], note: 42, score: -1 },
	expectedErrorPaths: ['user', 'tags', 'note', 'score']
};
