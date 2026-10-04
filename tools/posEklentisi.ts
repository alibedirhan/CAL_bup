import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { windowsPosKurulumu } from './windowsPosKurulumu.ts';
const kok = resolve(import.meta.dirname, '..');
const cikti = resolve(kok, 'dist/pos-yardimcisi');
const paket = JSON.parse(await readFile(resolve(kok, 'package.json'), 'utf8')) as { version: string };
await mkdir(cikti, { recursive: true });
for (const ad of ['arkaPlan', 'kopru', 'pos'])
  await build({
    configFile: false,
    root: kok,
    logLevel: 'warn',
    build: {
      outDir: cikti,
      emptyOutDir: false,
      target: 'chrome120',
      lib: {
        entry: resolve(kok, 'src/eklenti/' + ad + '.ts'),
        name: 'CalBupPos',
        formats: ['iife'],
        fileName: () => ad + '.js',
      },
    },
  });
const manifest = {
  manifest_version: 3,
  name: 'CAL bup POS yardımcısı',
  version: paket.version,
  description: 'Seçilen carinin kart numarası ve son kullanmasını tanıtılmış POS alanlarına doldurur.',
  minimum_chrome_version: '120',
  permissions: ['storage', 'alarms'],
  host_permissions: ['https://denizpay.bupilic.com.tr/*'],
  background: { service_worker: 'arkaPlan.js' },
  content_scripts: [
    { matches: ['https://alibedirhan.github.io/CAL_bup/*'], js: ['kopru.js'], run_at: 'document_start' },
    { matches: ['https://denizpay.bupilic.com.tr/*'], js: ['pos.js'], run_at: 'document_idle' },
  ],
  content_security_policy: {
    extension_pages: "default-src 'none'; script-src 'self'; object-src 'none'; connect-src 'none'",
  },
};
const aciklama =
  `CAL bup POS yardımcısı ${paket.version}\n\n` +
  '1. ZIP dosyasını kendi bilgisayarınızda ayrı bir klasöre çıkarın.\n' +
  '2. Edge adres çubuğunda edge://extensions açın. Geliştirici modunu açın.\n' +
  '3. Paketlenmemiş öğe yükle ile manifest.json bulunan klasörü seçin.\n' +
  '4. Gerçek kart girmeden POS ödeme ekranını açın. CAL bup panelinde boş numara/tarih alanlarını ve görünen vergi/TC numarasını bir kez tanıtın.\n' +
  '5. CAL bup sayfasını yenileyin. Cari ve kart seçin; Seçili kartla POS’u aç düğmesini kullanın.\n\n' +
  'Yardımcı CVV, tutar veya ödeme/SMS düğmesini kullanmaz. Numara eşleşmezse veya alanlar değişirse doldurmaz.\n' +
  'Görünen vergi/TC numarası gereklidir. Ayrı çerçevedeki kart alanları desteklenmez. Sağlayıcı sayfası yerel olarak doğrulanmış değildir.\n' +
  'Kurumunuz eklenti kurulumunu engelliyorsa kurumsal politikayı aşmayın; bilgi işlemle görüşün.\n' +
  'Kaldırmak için edge://extensions sayfasını kullanın. Güncellemede eski klasörün üzerine dosyaları çıkarıp Yeniden yükle deyin.\n';
await writeFile(resolve(cikti, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(resolve(cikti, 'KURULUM.txt'), aciklama);
const zip = new JSZip();
for (const ad of ['manifest.json', 'arkaPlan.js', 'kopru.js', 'pos.js', 'KURULUM.txt'])
  zip.file(ad, await readFile(resolve(cikti, ad)));
const zipVerisi = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
await writeFile(resolve(kok, 'dist/pos-yardimcisi.zip'), zipVerisi);
await writeFile(
  resolve(kok, 'dist/POS-Yardimcisi-Windows-Kurulum.cmd'),
  windowsPosKurulumu(paket.version, createHash('sha256').update(zipVerisi).digest('hex')),
);
