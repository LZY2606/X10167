import 'reflect-metadata';
import {
	ArrayMinSize,
	IsArray,
	IsInt,
	IsOptional,
	IsString,
	Min,
	MinLength
} from 'class-validator';
import { flatUserOverrides } from './canonical.js';

// @typeschema/class-validator validates with `Object.assign(new schema(), data)`,
// so nested plain objects cannot be transformed into class instances. The user
// field is therefore a top-level string here; the flat override keeps the same
// nested-key coverage (the error path is `user` instead of `user.name`).
export class CanonicalSchema {
	@IsString()
	@MinLength(2)
	user: string = 'Unknown';

	@IsArray()
	@ArrayMinSize(1)
	@IsString({ each: true })
	@MinLength(2, { each: true })
	tags: string[] = [];

	@IsOptional()
	@IsString()
	note: string | null = null;

	@IsInt()
	@Min(0)
	score: number = 5;
}

export const schema = CanonicalSchema;
export const overrides = flatUserOverrides;
