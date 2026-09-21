import { z } from 'zod/v3';

export const formASchema = z.object({
	name: z.string().min(2),
	items: z.array(z.object({ label: z.string().min(1) })).min(1)
});

export const formBSchema = z.object({
	email: z.string().email()
});
