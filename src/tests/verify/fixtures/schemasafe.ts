export const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		user: {
			type: 'object',
			properties: {
				name: { type: 'string', minLength: 2 }
			},
			required: ['name']
		},
		tags: {
			type: 'array',
			minItems: 1,
			items: { type: 'string', minLength: 2 }
		},
		note: { type: ['string', 'null'], default: null },
		score: { type: 'number', minimum: 0, default: 5 }
	},
	required: ['user', 'tags', 'note', 'score'],
	additionalProperties: false
} as const;
