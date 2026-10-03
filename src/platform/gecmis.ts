import { KullaniciHatasi } from '../cekirdek/hata';
// Her çalıştırmanın kaydı (eski aracın Geçmiş sayfası) ve kaydetmeden önce alınan yedekler.

import * as idb from './idb';

export type { GecmisKaydi, Yedek } from '../cekirdek/gecmis';
import { gecmisGecerli, type GecmisKaydi, type Yedek } from '../cekirdek/gecmis';

const GECMIS = 'gecmis';
const YEDEK_LISTESI = 'yedekler';
const EN_FAZLA_KAYIT = 500;
export const EN_FAZLA_YEDEK = 10;

export async function gecmisListesi(kesin = false): Promise<GecmisKaydi[]> {
  const k = (await (kesin ? idb.okuKesin : idb.oku)<GecmisKaydi[]>(GECMIS)) ?? [];
  if (kesin && (!Array.isArray(k) || k.length > 500 || !k.every(gecmisGecerli)))
    throw new KullaniciHatasi('Geçmiş kaydının biçimi geçersiz. Mevcut kayıtlar silinmedi.');
  return k;
}

export async function gecmiseEkle(k: GecmisKaydi): Promise<boolean> {
  return idb.guncelle(GECMIS, (onceki) =>
    [k, ...(Array.isArray(onceki) ? onceki : [])].slice(0, EN_FAZLA_KAYIT),
  );
}

/** Yedekler en yeniden eskiye; baytlar ayrı anahtarda durur, liste hafif kalır. */
export async function yedekListesi(kesin = false): Promise<Omit<Yedek, 'bayt'>[]> {
  const k = (await (kesin ? idb.okuKesin : idb.oku)<Omit<Yedek, 'bayt'>[]>(YEDEK_LISTESI)) ?? [];
  if (
    kesin &&
    (!Array.isArray(k) ||
      k.length > EN_FAZLA_YEDEK ||
      !k.every(
        (y) =>
          y &&
          typeof y.id === 'string' &&
          y.id.length < 256 &&
          typeof y.dosyaAdi === 'string' &&
          y.dosyaAdi.length <= 512 &&
          Number.isFinite(Date.parse(y.zaman)),
      ))
  )
    throw new KullaniciHatasi('Yedek listesinin biçimi geçersiz. Mevcut kayıtlar silinmedi.');
  return k;
}

export async function yedekAl(dosyaAdi: string, bayt: Uint8Array): Promise<string | null> {
  const id = crypto.randomUUID();
  const kaydedildi = await idb.guncelle(YEDEK_LISTESI, (onceki, depo) => {
    const eski = Array.isArray(onceki) ? (onceki as Omit<Yedek, 'bayt'>[]) : [];
    const liste = [{ id, zaman: new Date().toISOString(), dosyaAdi }, ...eski];
    depo.put(bayt, `yedek:${id}`);
    for (const y of liste.slice(EN_FAZLA_YEDEK)) depo.delete(`yedek:${y.id}`);
    return liste.slice(0, EN_FAZLA_YEDEK);
  });
  if (!kaydedildi) return null;
  return id;
}

export async function yedekBaytlari(id: string, kesin = false): Promise<Uint8Array | null> {
  const b = (await (kesin ? idb.okuKesin : idb.oku)<Uint8Array>(`yedek:${id}`)) ?? null;
  if (kesin && (!(b instanceof Uint8Array) || !b.byteLength))
    throw new KullaniciHatasi(
      'Yedeğin dosya içeriği bulunamadı. Kayıt listesi korunuyor; başka bir yedeği deneyin.',
    );
  return b;
}

const csvHucre = (v: unknown) => {
  const metin = typeof v === 'number' ? v.toFixed(3).replace('.', ',') : String(v ?? '');
  const guvenli = typeof v === 'string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(metin) ? "'" + metin : metin;
  return `"${guvenli.replace(/"/g, '""')}"`;
};

export function gecmisDosyaAdi(tarih = new Date()): string {
  return `CAL bup geçmişi ${tarih.toLocaleDateString('tr-TR')}.csv`;
}

/** Excel'in Türkçe ayarında doğrudan açılan CSV (noktalı virgül, virgüllü ondalık). */
export function gecmisCsv(liste: readonly GecmisKaydi[]): string {
  const satirlar = [
    [
      'Zaman',
      'Rapor',
      'Dosya',
      'Sayfa',
      'Durum',
      'LED stoğu',
      'Depo sayımı',
      'Gelen mal',
      'Uyarı',
      'Açıklama',
    ],
    ...liste.map((k) => [
      new Date(k.zaman).toLocaleString('tr-TR'),
      k.rapor,
      k.dosya,
      k.sayfa,
      k.durum,
      k.ledStogu,
      k.depoSayimi,
      k.gelenMal,
      String(k.uyariSayisi),
      k.aciklama,
    ]),
  ];
  return '﻿' + satirlar.map((s) => s.map(csvHucre).join(';')).join('\r\n');
}
