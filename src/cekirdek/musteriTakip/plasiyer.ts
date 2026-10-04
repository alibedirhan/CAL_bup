import { KullaniciHatasi } from '../hata';
import { kenarlariTemizle, metniKisalt } from './metin';
import type { Plasiyerler } from './turler';

export interface PlasiyerKaydi {
  readonly surum: 1;
  readonly nesil: number;
  readonly plasiyerler: Plasiyerler;
  readonly yedek: Plasiyerler | null;
}

export function plasiyerleriDogrula(veri: unknown): Plasiyerler {
  if (!veri || typeof veri !== 'object' || Array.isArray(veri))
    throw new KullaniciHatasi('Araç/plasiyer ayarları geçersiz.');
  const kayitlar = Object.entries(veri);
  if (kayitlar.length > 100) throw new KullaniciHatasi('En fazla 100 araç/plasiyer kaydı olabilir.');
  const sonuc: Record<string, string> = {};
  for (const [no, ad] of kayitlar) {
    if (!/^\d{2}$/.test(no) || typeof ad !== 'string' || !kenarlariTemizle(ad) || ad.length > 1000) {
      throw new KullaniciHatasi('Araç numarası iki haneli, plasiyer adı dolu olmalıdır.');
    }
    sonuc[no] = metniKisalt(kenarlariTemizle(ad), 100);
  }
  return sonuc;
}

export function plasiyerKaydiniDogrula(veri: unknown): PlasiyerKaydi {
  if (veri === undefined) return { surum: 1, nesil: 0, plasiyerler: {}, yedek: null };
  if (!veri || typeof veri !== 'object' || Array.isArray(veri) || JSON.stringify(veri).length > 65_536) {
    throw new KullaniciHatasi('Araç/plasiyer kaydı okunamadı. Mevcut kayıt değiştirilmedi.');
  }
  const r = veri as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => !['surum', 'nesil', 'plasiyerler', 'yedek'].includes(k)) ||
    r.surum !== 1 ||
    !Number.isSafeInteger(r.nesil) ||
    Number(r.nesil) < 0 ||
    Number(r.nesil) >= Number.MAX_SAFE_INTEGER
  ) {
    throw new KullaniciHatasi('Araç/plasiyer kayıt sürümü geçersiz. Mevcut kayıt değiştirilmedi.');
  }
  return {
    surum: 1,
    nesil: Number(r.nesil),
    plasiyerler: plasiyerleriDogrula(r.plasiyerler),
    yedek: r.yedek === null ? null : plasiyerleriDogrula(r.yedek),
  };
}
