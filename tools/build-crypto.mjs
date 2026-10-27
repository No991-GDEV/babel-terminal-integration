import {build} from 'esbuild';
await build({entryPoints:['tools/crypto-vendor-entry.js'],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:'scripts/vendor/crypto.js',legalComments:'inline',banner:{js:'// Bundled Noble ciphers 2.4.0 / hashes 2.4.0. See LICENSE files beside this bundle.'}});
