import { array, define, min, nullable, number, object, size, string } from 'superstruct';

const minLengthString = (length: number) =>
	define<string>(
		'min-length-string',
		(value) => typeof value === 'string' && value.length >= length
	);

export const schema = object({
	user: object({ name: minLengthString(2) }),
	tags: size(array(minLengthString(2)), 1, Infinity),
	note: nullable(string()),
	score: min(number(), 0)
});
