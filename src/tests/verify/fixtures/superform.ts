export const clientOnly = true;

const stringError = (value: unknown) =>
	typeof value === 'string' && value.length >= 2 ? null : 'expected a string of length at least 2';

export const schema = {
	user: {
		name: stringError
	},
	tags: (value: unknown) => {
		// The traversal invokes this validator for the array and, with filtered
		// indices, again per element. Elements are validated as strings.
		if (typeof value === 'string') return value.length >= 2 ? null : 'tag too short';
		return Array.isArray(value) && value.length >= 1 ? null : 'at least one tag is required';
	},
	note: (value: unknown) =>
		typeof value === 'string' || value === null ? null : 'note must be a string or null',
	score: (value: unknown) => (typeof value === 'number' && value >= 0 ? null : 'score must be >= 0')
};

export const expectedClientErrorPaths = ['user.name', 'tags[1]', 'note', 'score'];
