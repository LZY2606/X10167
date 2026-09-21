import { z } from 'zod/v4';

export const schema = z.object({
	user: z.object({ name: z.string().min(2) }),
	tags: z.array(z.string().min(2)).min(1),
	note: z.string().nullable().default(null),
	score: z.number().min(0).default(5)
});
