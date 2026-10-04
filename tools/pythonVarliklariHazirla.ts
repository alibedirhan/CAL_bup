import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import paketler from '../vendor/python/paketler.json' with { type: 'json' };

const klasor = join('node_modules', '.cache', 'cal-python');
await mkdir(klasor, { recursive: true });
// Yalnız geliştirici/CI hazırlığında ağ kullanılır. Üretimde bütün varlıklar kendi yayınımızdadır.
await Promise.all(
  paketler.paketler.map(async (paket) => {
    const yol = join(klasor, paket.dosya);
    const dogru = (bayt: Uint8Array) => createHash('sha256').update(bayt).digest('hex') === paket.sha256;
    try {
      if (dogru(await readFile(yol))) return;
    } catch {
      /* İlk kurulum. */
    }
    const yanit = await fetch(paket.url, { signal: AbortSignal.timeout(60_000) });
    if (!yanit.ok) throw new Error(`Python paketi alınamadı: ${paket.ad}`);
    const bayt = new Uint8Array(await yanit.arrayBuffer());
    if (!dogru(bayt)) throw new Error(`Python paket özeti uyuşmuyor: ${paket.ad}`);
    await writeFile(yol + '.gecici', bayt);
    await rename(yol + '.gecici', yol);
  }),
);
console.log('Sabit Python paketleri doğrulandı; çalışma sırasında dış paket kaynağı kullanılmaz.');
