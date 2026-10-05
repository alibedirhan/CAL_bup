import { KullaniciHatasi } from './hata';
import { cariAdi, EN_FAZLA_POS_CARI, numaraMaskesi, type PosCari } from './posCari';
import { EN_FAZLA_CARI_KARTI, kartMaskesi, type PosKart } from './posKart';
import { posProfilDogrula, type PosProfilVerisi } from './posProfil';

/** Yedekten ekleme. Kimlik: cari için vergi/TC numarası, kart için (cari, kart numarası).
 * Aynı kayıt atlanır; farklı bilgi “çatışma” olarak listelenir ve kullanıcının açık seçimiyle
 * ya korunur ya yedektekiyle değiştirilir. Hiçbir durumda mevcut kayıt silinmez. */
export type BirlestirmeSecimi = 'koru' | 'yedek';
export interface BirlestirmeCatismasi {
  tur: 'cari' | 'kart';
  metin: string;
}
export interface BirlestirmeOzeti {
  yeniCari: number;
  yeniKart: number;
  ayniCari: number;
  ayniKart: number;
  catismalar: BirlestirmeCatismasi[];
}

const KART_ALANLARI = [
  ['ad', 'kart adı'],
  ['sahibi', 'kart sahibi'],
  ['ay', 'son kullanma'],
  ['yil', 'son kullanma'],
  ['telefon', 'telefon'],
] as const;
const adAnahtari = (ad: string) => cariAdi(ad).toLocaleLowerCase('tr-TR');

function hesapla(
  mevcut: PosProfilVerisi,
  gelen: PosProfilVerisi,
  secim: BirlestirmeSecimi,
  kimlik: () => string,
): { veri: PosProfilVerisi; ozet: BirlestirmeOzeti } {
  const a = posProfilDogrula(mevcut);
  const b = posProfilDogrula(gelen);
  const ozet: BirlestirmeOzeti = { yeniCari: 0, yeniKart: 0, ayniCari: 0, ayniKart: 0, catismalar: [] };
  const cariler: PosCari[] = a.cariler.map((c) => ({ ...c }));
  // Özet metni seçimden bağımsız olmalı: “yedektekini kullan” adları değiştirse de ilk ad gösterilir.
  const ilkAd = new Map(a.cariler.map((c) => [c.id, c.ad]));
  const harita = new Map<string, PosCari>();
  const kimlikler = new Set([...a.cariler.map((c) => c.id), ...a.kartlar.map((k) => k.id)]);
  const yeniKimlik = (id: string) => {
    let sonuc = id;
    while (kimlikler.has(sonuc)) sonuc = kimlik();
    kimlikler.add(sonuc);
    return sonuc;
  };
  for (const c of b.cariler) {
    const ayni = cariler.find((x) => x.numara === c.numara);
    const adSahibi = cariler.find((x) => x !== ayni && adAnahtari(x.ad) === adAnahtari(c.ad));
    if (ayni) {
      harita.set(c.id, ayni);
      if (adAnahtari(ayni.ad) === adAnahtari(c.ad)) {
        ozet.ayniCari++;
        continue;
      }
      ozet.catismalar.push({
        tur: 'cari',
        metin: `${numaraMaskesi(c.numara)} numaralı cari: burada “${ayni.ad}”, yedekte “${c.ad}”.`,
      });
      if (secim === 'yedek') {
        if (adSahibi)
          throw new KullaniciHatasi(
            `Yedekteki “${c.ad}” adı burada başka bir caride (${numaraMaskesi(adSahibi.numara)}) kullanılıyor. Birinin adını değiştirip yeniden deneyin.`,
          );
        ayni.ad = c.ad;
      }
      continue;
    }
    if (adSahibi)
      throw new KullaniciHatasi(
        `“${c.ad}” adı burada ${numaraMaskesi(adSahibi.numara)}, yedekte ${numaraMaskesi(c.numara)} numarasıyla kayıtlı. Karışmaması için birinin adını değiştirip yeniden deneyin.`,
      );
    const yeni = { ...c, id: yeniKimlik(c.id) };
    cariler.push(yeni);
    harita.set(c.id, yeni);
    ozet.yeniCari++;
  }
  if (cariler.length > EN_FAZLA_POS_CARI)
    throw new KullaniciHatasi(
      `Yedekle birlikte ${EN_FAZLA_POS_CARI} cari sınırı aşılıyor. Hiçbir kayıt eklenmedi.`,
    );
  const kartlar: PosKart[] = a.kartlar.map((k) => ({ ...k }));
  for (const k of b.kartlar) {
    const cari = harita.get(k.cariId);
    if (!cari) throw new KullaniciHatasi('Yedekte kartın carisi bulunamadı. Hiçbir kayıt eklenmedi.');
    const ayni = kartlar.find((x) => x.cariId === cari.id && x.numara === k.numara);
    if (!ayni) {
      kartlar.push({ ...k, id: yeniKimlik(k.id), cariId: cari.id });
      ozet.yeniKart++;
      continue;
    }
    const farklar = [...new Set(KART_ALANLARI.filter(([f]) => ayni[f] !== k[f]).map(([, ad]) => ad))];
    if (!farklar.length) {
      ozet.ayniKart++;
      continue;
    }
    ozet.catismalar.push({
      tur: 'kart',
      metin: `${ilkAd.get(cari.id) ?? cari.ad} · “${ayni.ad}” (${kartMaskesi(ayni)}): farklı ${farklar.join(', ')}.`,
    });
    if (secim === 'yedek')
      Object.assign(ayni, {
        ad: k.ad,
        sahibi: k.sahibi,
        ay: k.ay,
        yil: k.yil,
        telefon: k.telefon,
        onayTarihi: k.onayTarihi,
      });
  }
  for (const c of cariler)
    if (kartlar.filter((k) => k.cariId === c.id).length > EN_FAZLA_CARI_KARTI)
      throw new KullaniciHatasi(
        `Yedekle birlikte “${c.ad}” carisinde ${EN_FAZLA_CARI_KARTI} kart sınırı aşılıyor. Hiçbir kayıt eklenmedi.`,
      );
  cariler.sort((x, y) => x.ad.localeCompare(y.ad, 'tr-TR'));
  return { veri: posProfilDogrula({ surum: 2, cariler, kartlar }), ozet };
}

/** İnceleme ekranı için: hiçbir şeyi değiştirmez; çözülemeyen durumda açık hata verir. */
export function profilBirlestirmeOzeti(mevcut: PosProfilVerisi, gelen: PosProfilVerisi): BirlestirmeOzeti {
  return hesapla(mevcut, gelen, 'koru', () => crypto.randomUUID()).ozet;
}

/** İncelemeden sonra kayıtlar değiştiyse kullanıcı başka bir özeti onaylamış olur; bu karşılaştırılır. */
export function ozetImzasi(o: BirlestirmeOzeti): string {
  return JSON.stringify([o.yeniCari, o.yeniKart, o.ayniCari, o.ayniKart, o.catismalar]);
}

export function profilBirlestir(
  mevcut: PosProfilVerisi,
  gelen: PosProfilVerisi,
  secim: BirlestirmeSecimi,
  onaylananOzet?: string,
  kimlik: () => string = () => crypto.randomUUID(),
): PosProfilVerisi {
  const { veri, ozet } = hesapla(mevcut, gelen, secim, kimlik);
  if (onaylananOzet !== undefined && onaylananOzet !== ozetImzasi(ozet))
    throw new KullaniciHatasi(
      'Kayıtlar siz incelerken değişti. Yedeği yeniden inceleyin; hiçbir kayıt eklenmedi.',
    );
  return veri;
}
