import { KullaniciHatasi } from '../cekirdek/hata';
// Her çalıştırmanın kaydı (eski aracın Geçmiş sayfası) ve kaydetmeden önce alınan yedekler.

import * as idb from './idb';

export type { GecmisKaydi, Yedek } from '../cekirdek/gecmis';
import {
  gecmisGecerli,
  gecmisListesiniDogrula,
  yedekListesiniDogrula,
  type GecmisKaydi,
  type Yedek,
} from '../cekirdek/gecmis';

const GECMIS = 'gecmis';
const YEDEK_LISTESI = 'yedekler';
const EN_FAZLA_KAYIT = 500;
export const EN_FAZLA_YEDEK = 10;

export async function gecmisListesi(kesin = false): Promise<GecmisKaydi[]> {
  const k = await (kesin ? idb.okuKesin : idb.oku)<unknown>(GECMIS);
  return gecmisListesiniDogrula(k);
}

export async function gecmiseEkle(k: GecmisKaydi): Promise<boolean> {
  if (!gecmisGecerli(k)) return false;
  return idb.guncelle(GECMIS, (onceki) => [k, ...gecmisListesiniDogrula(onceki)].slice(0, EN_FAZLA_KAYIT));
}

/** Yedekler en yeniden eskiye; baytlar ayrı anahtarda durur, liste hafif kalır. */
export async function yedekListesi(kesin = false): Promise<Omit<Yedek, 'bayt'>[]> {
  const k = await (kesin ? idb.okuKesin : idb.oku)<unknown>(YEDEK_LISTESI);
  return yedekListesiniDogrula(k);
}

export async function yedekAl(dosyaAdi: string, bayt: Uint8Array): Promise<string | null> {
  const id = crypto.randomUUID();
  const kaydedildi = await idb.guncelle(YEDEK_LISTESI, (onceki, depo) => {
    const eski = yedekListesiniDogrula(onceki);
    const yeni = { id, zaman: new Date().toISOString(), dosyaAdi };
    yedekListesiniDogrula([yeni]);
    if (!bayt.byteLength) throw new KullaniciHatasi('Yedek içeriği boş.');
    const liste = [yeni, ...eski];
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
