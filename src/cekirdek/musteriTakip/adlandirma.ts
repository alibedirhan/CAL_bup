import { kenarlariTemizle, metniKisalt } from './metin';
import type { Plasiyerler } from './turler';

export function depoAdi(ilkSutun: readonly unknown[]): string | null {
  for (const hucre of ilkSutun.slice(0, 10)) {
    const metin = String(hucre);
    if (!metin.includes('Cari Kategori 3')) continue;
    const eslesme = /\[(.*?)\]\s*(.*?)(?:\n|\r\n|$)/.exec(metin);
    if (eslesme?.[2]) return kenarlariTemizle(eslesme[2]);
  }
  return null;
}

const ARAC_DESENLERI = [
  /[İI][Zz][Mm][İi][Rr]\s+[Aa][Rr][Aa][ÇçĞğ]\s+(\d{1,2})/,
  /[Aa]ra[çc]\s*(\d{1,2})/,
  /[Vv]ehicle\s*(\d{1,2})/,
  /(\d{1,2})\s*[Nn]o/,
  /(?<![\p{L}\p{N}_])(\d{1,2})(?![\p{L}\p{N}_])/u,
];

export function aracNumarasi(depo: string, plasiyerler: Plasiyerler): string | null {
  for (const desen of ARAC_DESENLERI) {
    const eslesme = desen.exec(depo);
    if (!eslesme) continue;
    const no = String(Number(eslesme[1])).padStart(2, '0');
    if (Object.hasOwn(plasiyerler, no)) return no;
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
