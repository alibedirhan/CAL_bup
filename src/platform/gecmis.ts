// Her çalıştırmanın kaydı (eski aracın Geçmiş sayfası) ve kaydetmeden önce alınan yedekler.

import * as idb from './idb';

export interface GecmisKaydi {
  /** ISO zaman damgası */
  zaman: string;
  rapor: string;
  dosya: string;
  sayfa: string;
  durum: 'Tamam' | 'Uyarı' | 'Hata';
  ledStogu: number;
  depoSayimi: number;
  gelenMal: number;
  uyariSayisi: number;
  aciklama: string;
  /** Nasıl kaydedildi: dosyanın üzerine ya da indirme olarak. */
  kayit: 'dosyaya' | 'indirildi';
  yedekId?: string;
}

export interface Yedek {
  id: string;
  zaman: string;
  dosyaAdi: string;
  bayt: Uint8Array;
}

const GECMIS = 'gecmis';
const YEDEK_LISTESI = 'yedekler';
const EN_FAZLA_KAYIT = 500;
export const EN_FAZLA_YEDEK = 10;

export async function gecmisListesi(): Promise<GecmisKaydi[]> {
  return (await idb.oku<GecmisKaydi[]>(GECMIS)) ?? [];
}

export async function gecmiseEkle(k: GecmisKaydi): Promise<void> {
  const liste = await gecmisListesi();
  await idb.yaz(GECMIS, [k, ...liste].slice(0, EN_FAZLA_KAYIT));
}

/** Yedekler en yeniden eskiye; baytlar ayrı anahtarda durur, liste hafif kalır. */
export async function yedekListesi(): Promise<Omit<Yedek, 'bayt'>[]> {
  return (await idb.oku<Omit<Yedek, 'bayt'>[]>(YEDEK_LISTESI)) ?? [];
}

export async function yedekAl(dosyaAdi: string, bayt: Uint8Array): Promise<string | null> {
  const id = `${Date.now()}`;
  if (!(await idb.yaz(`yedek:${id}`, bayt))) return null;
  const liste = [{ id, zaman: new Date().toISOString(), dosyaAdi }, ...(await yedekListesi())];
  for (const eski of liste.slice(EN_FAZLA_YEDEK)) await idb.sil(`yedek:${eski.id}`);
  await idb.yaz(YEDEK_LISTESI, liste.slice(0, EN_FAZLA_YEDEK));
  return id;
}

export async function yedekBaytlari(id: string): Promise<Uint8Array | null> {
  return (await idb.oku<Uint8Array>(`yedek:${id}`)) ?? null;
}

const csvHucre = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function gecmisDosyaAdi(tarih = new Date()): string {
  return `CAL bup geçmişi ${tarih.toLocaleDateString('tr-TR')}.csv`;
}

/** Excel'in Türkçe ayarında doğrudan açılan CSV (noktalı virgül, virgüllü ondalık). */
export function gecmisCsv(liste: readonly GecmisKaydi[]): string {
  const sayi = (x: number) => x.toFixed(3).replace('.', ',');
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
      sayi(k.ledStogu),
      sayi(k.depoSayimi),
      sayi(k.gelenMal),
      k.uyariSayisi,
      k.aciklama,
    ]),
  ];
  return '﻿' + satirlar.map((s) => s.map(csvHucre).join(';')).join('\r\n');
}
