import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { smf: 'src/index.js' },
  outdir: 'dist',
  bundle: true,
  splitting: true, // un chunk par module, chargé à la demande
  format: 'esm',
  chunkNames: 'chunks/[name]-[hash]',
  target: 'es2020',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  define: { __SMF_VERSION__: JSON.stringify(version) },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
