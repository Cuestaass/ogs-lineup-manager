import { cp, mkdir } from 'node:fs/promises';

const assets = ['assets', 'manifest.webmanifest', '_headers'];
await mkdir(new URL('../public-build/', import.meta.url), { recursive: true });
for (const asset of assets) {
  await cp(new URL(`../public/${asset}`, import.meta.url), new URL(`../public-build/${asset}`, import.meta.url), { recursive: true, force: true });
}
