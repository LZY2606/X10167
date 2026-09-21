import { fail } from '@sveltejs/kit';
import { message, setError, superValidate } from '$lib/index.js';
import { zod } from '$lib/adapters/zod.js';
import { schemaA, schemaB } from './schema.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const formA = await superValidate(zod(schemaA), {
		id: 'formA',
		defaults: { name: 'Initial', tags: ['one'] }
	});
	const formB = await superValidate(zod(schemaB), {
		id: 'formB',
		defaults: { city: 'Lund' }
	});
	return { formA, formB };
};

export const actions: Actions = {
	formA: async ({ request }) => {
		const form = await superValidate(request, zod(schemaA), { id: 'formA' });
		if (!form.valid) return fail(400, { form });
		if (form.data.name === 'serverside') {
			return setError(form, 'name', 'Rejected by server', { status: 400 });
		}
		return message(form, 'Form A posted');
	},
	formB: async ({ request }) => {
		const form = await superValidate(request, zod(schemaB), { id: 'formB' });
		if (!form.valid) return fail(400, { form });
		return message(form, 'Form B posted');
	}
};
