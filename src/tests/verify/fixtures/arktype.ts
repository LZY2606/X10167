import { type } from 'arktype';

export const schema = type({
	user: { name: 'string >= 2' },
	tags: '(string >= 2)[] >= 1',
	note: 'string | null = null',
	score: 'number >= 0 = 5'
});
