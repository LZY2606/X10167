import { z } from 'zod/v3';

export const schemaA = z.object({
	name: z.string().min(3),
	tags: z.array(z.string().min(2)).min(1)
});

export const schemaB = z.object({
	city: z.string().min(2)
});
