import { Type } from 'typebox';

export const schema = Type.Object({
	user: Type.Object({ name: Type.String({ minLength: 2, default: 'Unknown' }) }),
	tags: Type.Array(Type.String({ minLength: 2 }), { minItems: 1 }),
	note: Type.Union([Type.String(), Type.Null()], { default: null }),
	score: Type.Number({ minimum: 0, default: 5 })
});
