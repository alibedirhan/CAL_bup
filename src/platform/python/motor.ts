import type { PyodideInterface } from 'pyodide';
import { KullaniciHatasi } from '../../cekirdek/hata';

interface Manifest {
  hazir: string[];
  paketler: { ad: string; dosya: string; sha256: string }[];
  dosyalar: { ad: string; sha256: string }[];
}

let motor: Promise<PyodideInterface> | undefined;

async function al(kok: URL, ad: string, sha256: string): Promise<Uint8Array> {
  const adres = new URL(ad, kok);
  adres.searchParams.set('sha256', sha256);
  const yanit = await fetch(adres, { credentials: 'omit' });
  if (!yanit.ok)
    throw new KullaniciHatasi('Dosya motoru yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.');
  const bayt = new Uint8Array(await yanit.arrayBuffer());
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bayt))]
    .map((h) => h.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== sha256)
    throw new KullaniciHatasi('Dosya motorunun bütünlüğü doğrulanamadı. Sayfayı yenileyin.');
  return bayt;
}

async function baslat(tur: 'musteri' | 'iskonto' | 'karlilik', islem?: string): Promise<PyodideInterface> {
  const kok = new URL(import.meta.env.BASE_URL + 'python/', self.location.origin);
  const cevap = await fetch(new URL('manifest.json', kok), { credentials: 'omit', cache: 'no-cache' });
  if (!cevap.ok) throw new KullaniciHatasi('Dosya motoru hazırlanamadı. Sayfayı yenileyip yeniden deneyin.');
  const manifest = (await cevap.json()) as Manifest;
  const { loadPyodide } = (await import(
    /* @vite-ignore */ new URL('pyodide.mjs', kok).href
  )) as typeof import('pyodide');
  const p = await loadPyodide({ indexURL: kok.href, stdout: () => {}, stderr: () => {} });
  const tamCikti = tur === 'iskonto' && !['yukle', 'onizle', 'gorunen'].includes(islem ?? '');
  const hazir = tamCikti
    ? manifest.hazir
    : tur === 'iskonto' && islem === 'yukle'
      ? ['cryptography', 'charset-normalizer']
      : [];
  if (hazir.length)
    await p.loadPackage(hazir, { checkIntegrity: true, messageCallback: () => {}, errorCallback: () => {} });
  // Hazır paketlerde Pyodide kilit özeti; saf wheel/kod/fontlarda kendi sabit özeti doğrulanır.
  const safPaketler = [
    'openpyxl',
    'et-xmlfile',
    'defusedxml',
    ...(tur === 'iskonto' && islem === 'yukle' ? ['pdfplumber', 'pdfminer.six'] : []),
    ...(tamCikti ? ['pdfplumber', 'pdfminer.six', 'fpdf2'] : []),
  ];
  const secilen = manifest.paketler.filter((paket) => safPaketler.includes(paket.ad));
  for (const paket of secilen) {
    const bayt = await al(kok, paket.dosya, paket.sha256);
    p.unpackArchive(bayt, 'zip', { extractDir: '/cal/site' });
  }
  await Promise.all(
    manifest.dosyalar
      .filter((d) => d.ad.endsWith('.py') || (tamCikti && d.ad.endsWith('.ttf')))
      .map(async (dosya) => {
        const bayt = await al(kok, dosya.ad, dosya.sha256);
        const hedef = dosya.ad.startsWith('bup/') ? '/cal/site/' + dosya.ad.slice(4) : '/cal/' + dosya.ad;
        p.FS.mkdirTree(hedef.slice(0, hedef.lastIndexOf('/')));
        p.FS.writeFile(hedef, bayt);
      }),
  );
  p.runPython(`
import sys, types
sys.path.insert(0, '/cal/site')
${tur === 'musteri' ? "sys.modules['pandas'] = types.SimpleNamespace(DataFrame=object)" : ''}
from pathlib import Path
fonts = Path('/usr/share/fonts/truetype/dejavu')
fonts.mkdir(parents=True, exist_ok=True)
import shutil
${tamCikti ? "shutil.copyfile('/cal/font.ttf', fonts / 'DejaVuSans.ttf'); shutil.copyfile('/cal/font-kalin.ttf', fonts / 'DejaVuSans-Bold.ttf')" : ''}
exec(Path('/cal/kopru.py').read_text(), globals())
`);
  return p;
}

export async function pythonMotoru(
  tur: 'musteri' | 'iskonto' | 'karlilik',
  islem?: string,
): Promise<PyodideInterface> {
  motor ??= baslat(tur, islem).catch((hata: unknown) => {
    motor = undefined;
    throw hata;
  });
  return motor;
}

export function pythonCalistir(p: PyodideInterface, istek: unknown): unknown {
  // İstek kod içine yerleştirilmez; yalnız JSON veri olarak Python'a aktarılır.
  p.globals.set('cal_istek', JSON.stringify(istek));
  try {
    return JSON.parse(p.runPython('cal_calistir(cal_istek)') as string) as unknown;
  } finally {
    p.globals.delete('cal_istek');
  }
}
