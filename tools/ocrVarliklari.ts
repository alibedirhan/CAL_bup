import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/** OCR'nin worker, WASM ve modeli kendi yayınımızdan yüklenir; çalışma sırasında CDN yoktur. */
export function ocrVarliklari(): Plugin {
  const require = createRequire(import.meta.url);
  const core = dirname(require.resolve('tesseract.js-core/package.json'));
  const api = dirname(require.resolve('tesseract.js/package.json'));
  const dil = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
  const dosyalar = new Map<string, string>([
    ['worker.min.js', join(api, 'dist/worker.min.js')],
    ['eng.traineddata.gz', join(dil, '4.0.0_best_int/eng.traineddata.gz')],
    ['TESSERACT-LICENSE', join(api, 'LICENSE.md')],
    ['CORE-LICENSE', join(core, 'LICENSE')],
  ]);
  for (const ad of readdirSync(core))
    if (/^tesseract-core.*\.wasm(\.js)?$/.test(ad)) dosyalar.set(ad, join(core, ad));
  return {
    name: 'yerel-kart-ocr',
    generateBundle() {
      for (const [ad, yol] of dosyalar)
        this.emitFile({ type: 'asset', fileName: 'ocr/' + ad, source: readFileSync(yol) });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ad = req.url?.split('?')[0]?.replace(/^\/CAL_bup\/ocr\//, '');
        const yol = ad ? dosyalar.get(ad) : undefined;
        if (!yol) return next();
        res.setHeader(
          'Content-Type',
          ad?.endsWith('.js')
            ? 'application/javascript'
            : ad?.endsWith('.wasm')
              ? 'application/wasm'
              : 'application/octet-stream',
        );
        res.end(readFileSync(yol));
      });
    },
  };
}
