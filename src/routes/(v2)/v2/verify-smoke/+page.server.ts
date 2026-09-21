import type { Actions, PageServerLoad } from './$types.js';

import { message, setError, superValidate } from '$lib/server/index.js';
import { zod } from '$lib/adapters/zod.js';
import { fail } from '@sveltejs/kit';
import { noteSchema, userSchema } from './schema.js';

export const load: PageServerLoad = async () => {
	const userForm = await superValidate(zod(userSchema));
	const noteForm = await superValidate(zod(noteSchema));
	return { userForm, noteForm };
};

export const actions: Actions = {
	user: async ({ request }) => {
		const form = await superValidate(request, zod(userSchema));
		if (!form.valid) return fail(400, { form });

		if (form.data.name.toLowerCase() === 'taken') {
			return setError(form, 'name', 'Name is already taken', { status: 400 });
		}

		return message(form, 'User saved!');
	},

	note: async ({ request }) => {
		const form = await superValidate(request, zod(noteSchema));
		if (!form.valid) return fail(400, { form });

		return message(form, 'Note saved!');
	}
};
