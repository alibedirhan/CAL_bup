// Tarayıcı belleğine güvenli erişim. Gizli pencerede ya da engellenmiş
// site verisinde localStorage hata verebilir; uygulama yine de çalışmalı.

// CAL bup adından önce kaydedilen ayarları korumak için önek değişmez.
const ONEK = 'bup-rapor:';

export function oku(anahtar: string): string | null {
  try {
    return globalThis.localStorage?.getItem(ONEK + anahtar) ?? null;
  } catch {
    return null;
  }
}

export function yaz(anahtar: string, deger: string): void {
  try {
    globalThis.localStorage?.setItem(ONEK + anahtar, deger);
  } catch {
    // Kaydedilemezse yalnızca bu oturumda geçerli olur.
  }
}
