import { fail } from '@sveltejs/kit';
import { message, superValidate } from '$lib/index.js';
import { zod } from '$lib/adapters/zod.js';
import type { Actions, PageServerLoad } from './$types.js';
import { formASchema, formBSchema } from './schema.js';

export const load: PageServerLoad = async () => {
	return {
		formA: await superValidate({ name: '', items: [{ label: 'initial' }] }, zod(formASchema), {
			errors: false
		}),
		formB: await superValidate({ email: '' }, zod(formBSchema), { errors: false })
	};
};

export const actions: Actions = {
	formA: async ({ request }) => {
		const form = await superValidate(request, zod(formASchema));
		if (!form.valid) return fail(400, { formA: form });
		return message(form, 'A-OK');
	},
	formB: async ({ request }) => {
		const form = await superValidate(request, zod(formBSchema));
		if (!form.valid) return fail(400, { formB: form });
		return message(form, 'B-OK');
	}
};
