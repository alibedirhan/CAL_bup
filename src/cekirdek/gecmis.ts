import { KullaniciHatasi } from './hata';
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

const metin = (v: unknown, en = 512) => typeof v === 'string' && v.length <= en;
export function gecmisGecerli(v: unknown): v is GecmisKaydi {
  const k = v as GecmisKaydi | null;
  return (
    !!k &&
    metin(k.zaman, 40) &&
    Number.isFinite(Date.parse(k.zaman)) &&
    [k.rapor, k.dosya, k.sayfa].every((v) => metin(v)) &&
    metin(k.aciklama, 100000) &&
    ['Tamam', 'Uyarı', 'Hata'].includes(k.durum) &&
    ['dosyaya', 'indirildi'].includes(k.kayit) &&
    [k.ledStogu, k.depoSayimi, k.gelenMal].every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    Number.isInteger(k.uyariSayisi) &&
    k.uyariSayisi >= 0 &&
    k.uyariSayisi <= 100000 &&
    (k.yedekId === undefined || (metin(k.yedekId, 255) && k.yedekId.length > 0))
  );
}

export function gecmisListesiniDogrula(v: unknown, en = 500): GecmisKaydi[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > en || !v.every(gecmisGecerli))
    throw new KullaniciHatasi('Geçmiş kaydının biçimi geçersiz. Mevcut kayıtlar silinmedi.');
  return v;
}

export function yedekListesiniDogrula(v: unknown): Omit<Yedek, 'bayt'>[] {
  if (v === undefined) return [];
  if (
    !Array.isArray(v) ||
    v.length > 10 ||
    !v.every((y: unknown) => {
      const k = y as Omit<Yedek, 'bayt'> | null;
      return (
        !!k &&
        metin(k.id, 255) &&
        k.id.length > 0 &&
        metin(k.dosyaAdi) &&
        k.dosyaAdi.length > 0 &&
        metin(k.zaman, 40) &&
        Number.isFinite(Date.parse(k.zaman))
      );
    }) ||
    new Set(v.map((y: Omit<Yedek, 'bayt'>) => y.id)).size !== v.length
  )
    throw new KullaniciHatasi('Yedek listesinin biçimi geçersiz. Mevcut kayıtlar silinmedi.');
  return v as Omit<Yedek, 'bayt'>[];
}

/** Yerel yedek bağlantısı korunur; farklı saat dilimlerindeki aynı kayıt tekilleştirilir. */
export function gecmisBirlestir(a: readonly GecmisKaydi[], b: readonly GecmisKaydi[]): GecmisKaydi[] {
  const anahtar = (k: GecmisKaydi) =>
    JSON.stringify([Date.parse(k.zaman), k.rapor, k.dosya, k.sayfa, k.kayit]);
  const kayitlar = new Map<string, GecmisKaydi>();
  for (const k of [...gecmisListesiniDogrula(b, 5000), ...gecmisListesiniDogrula(a)])
    kayitlar.set(anahtar(k), k);
  return [...kayitlar.values()].sort((a, b) => Date.parse(b.zaman) - Date.parse(a.zaman)).slice(0, 500);
}
