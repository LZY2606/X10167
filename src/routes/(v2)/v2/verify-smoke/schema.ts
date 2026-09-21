import { z } from 'zod/v3';

export const userSchema = z.object({
	name: z.string().min(2),
	email: z.string().email(),
	tags: z.array(z.string().min(1))
});

export const noteSchema = z.object({
	title: z.string().min(2)
});
