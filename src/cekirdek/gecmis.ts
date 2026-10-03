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
    k.uyariSayisi <= 100000
  );
}
