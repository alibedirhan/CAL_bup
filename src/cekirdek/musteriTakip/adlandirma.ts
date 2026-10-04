import { kenarlariTemizle, metniKisalt, ondalikRakamlar, kelimeKarakteri, PYTHON_BOSLUK } from './metin';
import type { Plasiyerler } from './turler';

export function depoAdi(ilkSutun: readonly unknown[]): string | null {
  for (const hucre of ilkSutun.slice(0, 10)) {
    const metin = String(hucre);
    if (!metin.includes('Cari Kategori 3')) continue;
    const eslesme = new RegExp(`\\[([^\\n]*?)\\]${PYTHON_BOSLUK}*([^\\n]*?)(?:\\n|\\r\\n|$)`).exec(metin);
    if (eslesme?.[2]) return kenarlariTemizle(eslesme[2]);
  }
  return null;
}

const ARAC_DESENLERI = [
  new RegExp(`[İI][Zz][Mm][İi][Rr]${PYTHON_BOSLUK}+[Aa][Rr][Aa][ÇçĞğ]${PYTHON_BOSLUK}+(\\d{1,2})`),
  new RegExp(`[Aa]ra[çc]${PYTHON_BOSLUK}*(\\d{1,2})`),
  new RegExp(`[Vv]ehicle${PYTHON_BOSLUK}*(\\d{1,2})`),
  new RegExp(`(\\d{1,2})${PYTHON_BOSLUK}*[Nn]o`),
];

export function aracNumarasi(depo: string, plasiyerler: Plasiyerler): string | null {
  depo = ondalikRakamlar(depo);
  for (const desen of ARAC_DESENLERI) {
    const eslesme = desen.exec(depo);
    if (!eslesme) continue;
    const no = String(Number(eslesme[1])).padStart(2, '0');
    if (Object.hasOwn(plasiyerler, no)) return no;
  }
  // Python \b, Unicode sürümüne bağlıdır; JavaScript'in yeni harfleri farklı olabilir.
  const harfler = [...depo];
  for (let i = 0; i < harfler.length; i++) {
    if (!/^[0-9]$/.test(harfler[i] ?? '') || kelimeKarakteri(harfler[i - 1])) continue;
    const ikinci = /^[0-9]$/.test(harfler[i + 1] ?? '');
    const uzunluk = ikinci ? 2 : 1;
    if (kelimeKarakteri(harfler[i + uzunluk])) continue;
    const no = harfler
      .slice(i, i + uzunluk)
      .join('')
      .padStart(2, '0');
    return Object.hasOwn(plasiyerler, no) ? no : null;
  }
  return null;
}

export function dosyaAdiTemizle(ad: string): string {
  const temiz = kenarlariTemizle(ad.replace(/[\\/*?:"<>|]/g, ''));
  return metniKisalt(temiz, 100) || 'karşılaştırma_sonucu';
}

export function sonucDosyaAdi(depo: string | null, plasiyerler: Plasiyerler): string {
  if (!depo) return 'karşılaştırma_sonucu';
  const no = aracNumarasi(depo, plasiyerler);
  return dosyaAdiTemizle(no ? `Arac_${no}_${plasiyerler[no]}` : depo);
}

export function ciktiBasligi(depo: string | null, plasiyerler: Plasiyerler): string | null {
  if (!depo) return null;
  const no = aracNumarasi(depo, plasiyerler);
  return no ? `Araç ${no} - ${plasiyerler[no]}` : depo;
}
