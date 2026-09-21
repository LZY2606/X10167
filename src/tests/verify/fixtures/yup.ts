import { array, number, object, string } from 'yup';

export const schema = object({
	user: object({ name: string().required().min(2) }).required(),
	tags: array().of(string().required().min(2)).min(1).required(),
	note: string().nullable().default(null),
	score: number().min(0).default(5)
});
