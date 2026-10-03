import { kartMetni, kartNumarasi, kartTelefonu, kartSuresiGecti, type PosKart } from './posKart';
import { cariAdi, posNumarasi, type PosCari } from './posCari';
export function alanDenetle(denetimler: Record<string, () => unknown>): Record<string, string> {
  const hatalar: Record<string, string> = {};
  for (const [alan, denetle] of Object.entries(denetimler)) {
    try {
      denetle();
    } catch (e) {
      hatalar[alan] = e instanceof Error ? e.message : 'Alanı kontrol edin.';
    }
  }
  return hatalar;
}
export function kartFormunuDenetle(k: PosKart, onay: boolean): Record<string, string> {
  return alanDenetle({
    'pos-kart-ad': () => kartMetni(k.ad, 2, 80),
    'pos-kart-numara': () => kartNumarasi(k.numara),
    'pos-kart-sahibi': () => kartMetni(k.sahibi, 0, 120),
    'pos-kart-ay': () => {
      if (!/^(0[1-9]|1[0-2])$/.test(k.ay)) throw new Error('Son kullanma ayını seçin.');
    },
    'pos-kart-yil': () => {
      if (!/^20[0-9]{2}$/.test(k.yil)) throw new Error('Son kullanma yılını seçin.');
      if (kartSuresiGecti(k)) throw new Error('Kartın son kullanma tarihi geçmiş.');
    },
    'pos-kart-telefon': () => kartTelefonu(k.telefon),
    'pos-kart-onay': () => {
      if (!onay) throw new Error('Kaydetmeden önce kartı ve bağlı cariyi kontrol edip kutuyu işaretleyin.');
    },
  });
}
export function cariFormunuDenetle(c: PosCari, onay: boolean): Record<string, string> {
  return alanDenetle({
    'pos-cari-ad': () => cariAdi(c.ad),
    'pos-cari-numara': () => posNumarasi(c.numara),
    'pos-cari-onay': () => {
      if (!onay) throw new Error('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol edin.');
    },
  });
}
