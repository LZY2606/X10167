/**
 * Shared helpers for the offline verification entry.
 * Everything here is path/duration free on output: absolute paths are
 * rewritten to <root> so the manifest is stable between machines.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const artifactsDir = join(rootDir, 'artifacts');
export const tmpDir = join(artifactsDir, '.tmp-verify');

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b[[()#;?0-9]*[a-zA-Z]/g;

export function sanitize(text) {
	if (text === undefined || text === null) return '';
	return String(text).replaceAll(rootDir, '<root>').replace(ANSI_PATTERN, '');
}

export function tail(text, lines = 80) {
	const all = sanitize(text).split('\n');
	return all.slice(Math.max(0, all.length - lines)).join('\n');
}

export function runCommand(command, args, options = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			env: { ...process.env, CI: '1', ...options.env },
			shell: false
		});
		let output = '';
		child.stdout.on('data', (chunk) => (output += chunk));
		child.stderr.on('data', (chunk) => (output += chunk));
		child.on('error', (error) => resolve({ code: 127, output: String(error) }));
		child.on('close', (code) => resolve({ code: code ?? 1, output }));
	});
}
