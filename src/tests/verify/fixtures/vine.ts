import Vine from '@vinejs/vine';

export const schema = Vine.object({
	user: Vine.object({ name: Vine.string().minLength(2) }),
	tags: Vine.array(Vine.string().minLength(2)).minLength(1),
	note: Vine.string().nullable(),
	score: Vine.number().min(0)
});
