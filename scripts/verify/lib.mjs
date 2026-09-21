import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TMP_DIR = join(ROOT, '.verify-tmp');
export const ARTIFACTS_DIR = join(ROOT, 'artifacts');

/**
 * Run a command with piped output, also capturing the tail of stdout/stderr
 * for the manifest. Failure details are never stripped.
 */
export function run(command, args, options = {}) {
	return new Promise((resolveRun) => {
		const child = spawn(command, args, {
			cwd: ROOT,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, FORCE_COLOR: '0', CI: process.env.CI ?? '1' },
			...options
		});

		const chunks = [];
		const pipe = (stream, target) => {
			stream.on('data', (data) => {
				chunks.push(data);
				target.write(data);
			});
		};
		pipe(child.stdout, process.stdout);
		pipe(child.stderr, process.stderr);

		child.on('close', (exitCode, signal) => {
			const output = Buffer.concat(chunks).toString('utf8');
			resolveRun({
				exitCode: exitCode ?? 1,
				signal,
				outputTail: output.length > 8000 ? output.slice(-8000) : output
			});
		});
		child.on('error', (error) => {
			resolveRun({ exitCode: 1, signal: null, outputTail: String(error) });
		});
	});
}

/** Extract runtime identifiers exported from an adapter entry file. */
export function discoverAdapterExports(entryPath) {
	const source = readFileSync(entryPath, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments (e.g. disabled adapters)
		.replace(/^\s*\/\/.*$/gm, ''); // strip line comments
	const identifiers = new Set();
	const re = /export\s+(type\s+)?\{([^}]*)\}\s*from/g;
	let match;
	while ((match = re.exec(source))) {
		if (match[1]) continue; // type-only re-export, no runtime binding
		for (const raw of match[2].split(',')) {
			const spec = raw.trim();
			if (!spec || spec.startsWith('type ')) continue;
			const parts = spec.split(/\s+as\s+/);
			const local = parts[0].trim();
			const exported = (parts[1] ?? local).trim();
			identifiers.add(exported);
		}
	}
	return [...identifiers].sort();
}

export async function walk(dir, predicate, base = dir) {
	if (!existsSync(dir)) return [];
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath, predicate, base)));
		} else if (predicate(fullPath, entry)) {
			files.push(relative(base, fullPath).split('\\').join('/'));
		}
	}
	return files.sort();
}

export function listTestFiles() {
	return walk(join(ROOT, 'src'), (path) => /\.(test|spec)\.(js|ts)$/.test(path));
}

export async function listRoutes() {
	const routeRoot = join(ROOT, 'src/routes');
	const files = await walk(routeRoot, (path) => path.endsWith('+page.svelte'));
	return files.map((file) => dirname(file).replace(/^\.$/, ''));
}

export function sha256(filePath) {
	const hash = createHash('sha256');
	return new Promise((resolveHash, rejectHash) => {
		const stream = createReadStream(filePath);
		stream.on('error', rejectHash);
		stream.on('data', (data) => hash.update(data));
		stream.on('end', () => resolveHash(hash.digest('hex')));
	});
}

export async function hashDirectory(dir) {
	const files = await walk(dir, () => true);
	const summary = [];
	for (const path of files) {
		const fullPath = join(dir, path);
		const s = statSync(fullPath);
		summary.push({
			path: `${relative(ROOT, dir).split('\\').join('/')}/${path}`,
			sha256: await sha256(fullPath),
			bytes: s.size
		});
	}
	return summary;
}

export function getFreePort() {
	return new Promise((resolvePort, rejectPort) => {
		const server = net.createServer();
		server.unref();
		server.on('error', rejectPort);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolvePort(port));
		});
	});
}

export function prepareDirs() {
	rmSync(TMP_DIR, { recursive: true, force: true });
	mkdirSync(TMP_DIR, { recursive: true });
	mkdirSync(ARTIFACTS_DIR, { recursive: true });
}
