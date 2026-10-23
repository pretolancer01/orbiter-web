import { build } from 'esbuild';
import { build as buildVite } from 'vite';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const [entry, outfile] of [
  ['src/main.ts', 'dist/main.cjs'],
  ['src/preload.ts', 'dist/preload.cjs'],
  ['src/server.ts', 'dist/server.cjs'],
]) {
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'ws'] });
}
await buildVite({ configFile: false, root: 'src/ui', base: './', build: { outDir: '../../dist/ui', emptyOutDir: true } });
