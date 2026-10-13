// Packages src/ into dist/no-not-again-<version>.zip for store upload.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const { version } = JSON.parse(readFileSync(resolve(src, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

if (pkg.version !== version) {
    console.error(`Version mismatch: package.json ${pkg.version}, manifest.json ${version}`);
    process.exit(1);
}

const out = resolve(root, 'dist', `no-not-again-${version}.zip`);
mkdirSync(resolve(root, 'dist'), { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', out, '.', '-x', '*.DS_Store'], { cwd: src, stdio: 'inherit' });
console.log(`Created ${out}`);
