import * as v from 'valibot';

export const schema = v.object({
	user: v.object({ name: v.pipe(v.string(), v.minLength(2)) }),
	tags: v.pipe(v.array(v.pipe(v.string(), v.minLength(2))), v.minLength(1)),
	note: v.optional(v.nullable(v.string()), null),
	score: v.optional(v.pipe(v.number(), v.minValue(0)), 5)
});
