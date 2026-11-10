/**
 * Build « hébergé dans Webflow » : un seul fichier JS (script classique, sans chunks ni import relatif) + un JSON regroupant
 * les SVG des Smufs. Les deux sont envoyés dans les assets Webflow (voir smf-kit/scripts/upload-asset.mjs) ;
 * le JS est ensuite enregistré comme script hébergé avec son SRI.
 *
 * Usage : SMF_SMUFS_URL=<URL de l'asset smufs.json> node build-hosted.mjs
 *         (sans SMF_SMUFS_URL : seul le JSON des Smufs est regénéré utilement ; le JS retombe sur jsDelivr pour les SVG)
 * Sortie : dist-hosted/smf.hosted.js, dist-hosted/smufs.json, et leurs tailles / MD5 / SRI sha384.
 */
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const smufsUrl = process.env.SMF_SMUFS_URL || '';
mkdirSync('dist-hosted', { recursive: true });

// 1. JSON des Smufs : { "<id>": "<svg>" }
const smufs = {};
for (const file of readdirSync('smufs').filter((f) => f.endsWith('.svg')).sort()) {
  smufs[file.replace(/\.svg$/, '')] = readFileSync(`smufs/${file}`, 'utf8').trim();
}
writeFileSync('dist-hosted/smufs.json', JSON.stringify(smufs));

// 2. Bundle unique (classique) : les import() locaux sont inclus dans le fichier
await esbuild.build({
  entryPoints: { 'smf.hosted': 'src/index.js' },
  outdir: 'dist-hosted',
  bundle: true,
  splitting: false,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  define: { __SMF_VERSION__: JSON.stringify(version), __SMF_SMUFS_URL__: JSON.stringify(smufsUrl), 'import.meta.url': 'undefined' },
  logLevel: 'warning',
});

for (const name of ['smf.hosted.js', 'smufs.json']) {
  const bytes = readFileSync(`dist-hosted/${name}`);
  const md5 = createHash('md5').update(bytes).digest('hex');
  const sri = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
  console.log(`${name}  ${statSync(`dist-hosted/${name}`).size} octets  md5=${md5}  ${sri}`);
}
console.log(`version ${version}  smufsUrl=${smufsUrl || '(aucune : repli jsDelivr)'}`);
