import Joi from 'joi';

export const schema = Joi.object({
	user: Joi.object({ name: Joi.string().min(2).required() }).required(),
	tags: Joi.array().items(Joi.string().min(2)).min(1).required(),
	note: Joi.string().allow(null).default(null),
	score: Joi.number().min(0).default(5)
});
