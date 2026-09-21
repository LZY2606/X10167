import { Schema } from 'effect';

export const schema = Schema.Struct({
	user: Schema.Struct({ name: Schema.String.pipe(Schema.minLength(2)) }),
	tags: Schema.Array(Schema.String.pipe(Schema.minLength(2))).pipe(Schema.minItems(1)),
	note: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
	score: Schema.optionalWith(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), {
		default: () => 5
	})
});
