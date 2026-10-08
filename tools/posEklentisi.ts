import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { windowsPosKurulumu } from './windowsPosKurulumu.ts';
const kok = resolve(import.meta.dirname, '..');
const cikti = resolve(kok, 'dist/pos-yardimcisi');
// Yardımcının sürümü programdan bağımsızdır: yalnız eklenti kodu değişince artar. Derlenen kodun özeti
// kayıttakiyle aynı değilse derleme durur; böylece kod değişip sürüm unutulamaz.
// Özet ayrı dosyadadır: yardımcının kendi koduna girmez, yoksa her kayıt özeti yeniden değiştirirdi.
const yardimci = JSON.parse(await readFile(resolve(kok, 'src/cekirdek/posYardimciSurumu.json'), 'utf8')) as {
  surum: string;
};
const ozetDosyasi = resolve(kok, 'tools/posYardimciOzeti.json');
const kayitli = JSON.parse(await readFile(ozetDosyasi, 'utf8').catch(() => '{}')) as {
  surum?: string;
  ozet?: string;
};
await mkdir(cikti, { recursive: true });
for (const ad of ['arkaPlan', 'kopru', 'pos', 'acKapa'])
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
  version: yardimci.surum,
  description: 'Seçilen carinin kart numarası ve son kullanmasını tanıtılmış POS alanlarına doldurur.',
  minimum_chrome_version: '120',
  permissions: ['storage', 'alarms'],
  action: { default_title: 'CAL bup POS yardımcısı', default_popup: 'acKapa.html' },
  host_permissions: ['https://denizpay.bupilic.com.tr/*'],
  background: { service_worker: 'arkaPlan.js' },
  content_scripts: [
    { matches: ['https://alibedirhan.github.io/CAL_bup/*'], js: ['kopru.js'], run_at: 'document_start' },
    { matches: ['https://denizpay.bupilic.com.tr/*'], js: ['pos.js'], run_at: 'document_idle' },
  ],
  content_security_policy: {
    extension_pages:
      "default-src 'none'; script-src 'self'; style-src 'self'; object-src 'none'; connect-src 'none'",
  },
};
const aciklama =
  `CAL bup POS yardımcısı ${yardimci.surum}\n\n` +
  '1. ZIP dosyasını kendi bilgisayarınızda ayrı bir klasöre çıkarın.\n' +
  '2. Edge adres çubuğunda edge://extensions açın. Geliştirici modunu açın.\n' +
  '3. Paketlenmemiş öğe yükle ile manifest.json bulunan klasörü seçin.\n' +
  '4. Herhangi bir cariyle POS’a girin. Ödeme formunda kart bilgisi yazmadan, CAL bup panelindeki Alanları tanıt ile kutuları sırayla tıklayın. Bu bir kez yapılır; bütün cariler için geçerlidir.\n' +
  '5. CAL bup sayfasını yenileyin. Cari ve kart seçin; isterseniz CVV yazıp Seçili kartla POS’u aç düğmesini kullanın.\n\n' +
  'Yardımcı tutara, ödeme/SMS düğmelerine dokunmaz. CVV programda kayıtlıysa veya yazdıysanız yalnız o ödeme için gelir; yardımcı onu saklamaz.\n' +
  'AÇ/KAPAT: Tarayıcının sağ üstündeki uzantı (yapboz) simgesinden CAL bup POS yardımcısını sabitleyin; simgeye tıklayınca açılan anahtarla yardımcıyı kapatıp açabilirsiniz. Kapalıyken simgede OFF yazar. Aynı yerden POS sayfasındaki pencereyi de gösterip gizleyebilirsiniz; kurulumdan sonra pencere kendiliğinden açılmaz.\n' +
  'POS’ta görünen firma numarası seçilen cariyle eşleşmezse hiçbir şey doldurulmaz. Ayrı çerçevedeki kart alanları desteklenmez.\n' +
  'Kurumunuz eklenti kurulumunu engelliyorsa kurumsal politikayı aşmayın; bilgi işlemle görüşün.\n' +
  'GÜNCELLEME: Yardımcıyı kaldırmayın. Dosyaları eski klasörün üzerine çıkarın ve eklenti sayfasında Yeniden yükle deyin; alan kurulumu korunur.\n' +
  'Kaldırmak için edge://extensions sayfasını kullanın.\n';
// Araç çubuğu penceresi: yalnız aç/kapa anahtarı. Satır içi stil/betik yoktur (CSP).
const tema = await readFile(resolve(kok, 'src/arayuz/stiller/tema.css'), 'utf8');
await writeFile(
  resolve(cikti, 'acKapa.css'),
  tema + (await readFile(resolve(kok, 'src/eklenti/acKapa.css'), 'utf8')),
);
await writeFile(
  resolve(cikti, 'acKapa.html'),
  '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>CAL bup POS yardımcısı</title>' +
    '<link rel="stylesheet" href="acKapa.css"></head><body><h1>CAL bup POS yardımcısı</h1>' +
    '<label class="anahtar">Yardımcı açık<input id="anahtar" type="checkbox" role="switch" checked></label>' +
    '<p id="durum" role="status"></p>' +
    '<label class="anahtar">POS sayfasında pencereyi göster<input id="pencere" type="checkbox" role="switch"></label>' +
    '<p class="not">Kurulumdan sonra pencere kendiliğinden açılmaz. Alanları yeniden tanıtmak veya ' +
    'kurulumu silmek için açın. Önemli uyarılarda pencere yine görünür.</p>' +
    '<p id="surum"></p><script src="acKapa.js"></script></body></html>\n',
);
const kod = createHash('sha256');
for (const ad of ['arkaPlan', 'kopru', 'pos', 'acKapa', 'acKapa.html', 'acKapa.css'])
  kod.update(await readFile(resolve(cikti, ad.includes('.') ? ad : ad + '.js')));
const ozet = kod.digest('hex');
if (process.env.YARDIMCI_OZET_YAZ === '1') {
  if (kayitli.ozet && kayitli.ozet !== ozet && kayitli.surum === yardimci.surum)
    throw new Error(
      `Yardımcı kodu değişti ama sürüm hâlâ ${yardimci.surum}. Önce src/cekirdek/posYardimciSurumu.json içinde sürümü artırın.`,
    );
  await writeFile(ozetDosyasi, JSON.stringify({ surum: yardimci.surum, ozet }, null, 2) + '\n');
  console.log(`Yardımcı ${yardimci.surum} özeti kaydedildi.`);
} else if (kayitli.ozet !== ozet || kayitli.surum !== yardimci.surum)
  throw new Error(
    'POS yardımcısının kodu değişti. src/cekirdek/posYardimciSurumu.json içindeki sürümü artırıp ' +
      '`npm run yardimci:ozet` çalıştırın.',
  );
await writeFile(resolve(cikti, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(resolve(cikti, 'KURULUM.txt'), aciklama);
const zip = new JSZip();
for (const ad of [
  'manifest.json',
  'arkaPlan.js',
  'kopru.js',
  'pos.js',
  'acKapa.js',
  'acKapa.html',
  'acKapa.css',
  'KURULUM.txt',
])
  zip.file(ad, await readFile(resolve(cikti, ad)));
const zipVerisi = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
await writeFile(resolve(kok, 'dist/pos-yardimcisi.zip'), zipVerisi);
await writeFile(
  resolve(kok, 'dist/POS-Yardimcisi-Windows-Kurulum.cmd'),
  windowsPosKurulumu(yardimci.surum, createHash('sha256').update(zipVerisi).digest('hex')),
);
