import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import paketler from '../vendor/python/paketler.json' with { type: 'json' };
import kaynak from '../vendor/python/kaynak.json' with { type: 'json' };

export function pythonVarliklari(): Plugin {
  const dosyalar = new Map<string, string>();
  for (const ad of [
    'pyodide.mjs',
    'pyodide.asm.mjs',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
  ])
    dosyalar.set(ad, join('node_modules/pyodide', ad));
  for (const p of paketler.paketler) dosyalar.set(p.dosya, join('node_modules/.cache/cal-python', p.dosya));
  function ekle(klasor: string) {
    for (const girdi of readdirSync(klasor, { withFileTypes: true })) {
      const yol = join(klasor, girdi.name);
      if (girdi.isDirectory()) ekle(yol);
      else if (girdi.name.endsWith('.py'))
        dosyalar.set('bup/' + relative('vendor/python/bup', yol).replaceAll('\\', '/'), yol);
    }
  }
  ekle('vendor/python/bup');
  dosyalar.set('kopru.py', 'vendor/python/kopru.py');
  dosyalar.set('font.ttf', 'vendor/python/font.ttf');
  dosyalar.set('font-kalin.ttf', 'vendor/python/font-kalin.ttf');
  dosyalar.set('FONT-LICENSE', 'vendor/python/FONT-LICENSE');
  dosyalar.set('PYODIDE-LICENSE', 'vendor/python/PYODIDE-LICENSE');
  const manifest = () => {
    for (const [ad, sha] of Object.entries(kaynak.dosyalar)) {
      if (typeof sha !== 'string') continue;
      if (
        createHash('sha256')
          .update(readFileSync(join('vendor/python/bup', ad)))
          .digest('hex') !== sha
      )
        throw new Error(`Masaüstü kaynak dosyası değişti; başvuru yenilenmeli: ${ad}`);
    }
    return JSON.stringify({
      ...paketler,
      dosyalar: [...dosyalar].map(([ad, yol]) => ({
        ad,
        sha256: createHash('sha256').update(readFileSync(yol)).digest('hex'),
      })),
    });
  };
  return {
    name: 'yerel-python-motoru',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'python/manifest.json', source: manifest() });
      for (const [ad, yol] of dosyalar)
        this.emitFile({ type: 'asset', fileName: 'python/' + ad, source: readFileSync(yol) });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ad = req.url?.split('?')[0]?.replace(/^\/CAL_bup\/python\//, '');
        if (ad === 'manifest.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(manifest());
          return;
        }
        const yol = ad ? dosyalar.get(ad) : undefined;
        if (!yol) return next();
        res.setHeader(
          'Content-Type',
          ad?.endsWith('.mjs')
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
