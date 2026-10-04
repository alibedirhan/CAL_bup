import { KullaniciHatasi } from './hata';
import { cariKaydet, posCarileriBirlestir, posVerisiDogrula, type PosCari } from './posCari';
import { EN_FAZLA_CARI_KARTI, kartDogrula, kartSuresiGecti, type PosKart } from './posKart';

export interface PosProfilVerisi {
  surum: 2;
  cariler: PosCari[];
  kartlar: PosKart[];
}
export const BOS_POS_PROFILI: PosProfilVerisi = { surum: 2, cariler: [], kartlar: [] };
const KART_ALANLARI = 'ad,ay,cariId,id,numara,onayTarihi,sahibi,telefon,yil';

export function posProfilDogrula(deger: unknown): PosProfilVerisi {
  const hata = () => new KullaniciHatasi('Cari ve kart kaydının biçimi geçersiz. Mevcut kayıt korunuyor.');
  if (!deger || typeof deger !== 'object' || Array.isArray(deger)) throw hata();
  const v = deger as Record<string, unknown>;
  if (
    v.surum !== 2 ||
    Object.keys(v).sort().join() !== 'cariler,kartlar,surum' ||
    !Array.isArray(v.kartlar) ||
    v.kartlar.length > 5000
  )
    throw hata();
  const cariler = posVerisiDogrula({ surum: 1, cariler: v.cariler }).cariler;
  const kimlikler = new Set<string>();
  const numaralar = new Set<string>();
  const sayilar = new Map<string, number>();
  const cariKimlikleri = new Set(cariler.map((c) => c.id));
  const kartlar = v.kartlar.map((k: unknown) => {
    if (
      !k ||
      typeof k !== 'object' ||
      Array.isArray(k) ||
      Object.keys(k).sort().join() !== KART_ALANLARI ||
      Object.values(k).some((a) => typeof a !== 'string')
    )
      throw hata();
    const kart = kartDogrula(k as PosKart);
    const numara = kart.cariId + ':' + kart.numara;
    const sayi = (sayilar.get(kart.cariId) ?? 0) + 1;
    if (
      !cariKimlikleri.has(kart.cariId) ||
      kimlikler.has(kart.id) ||
      numaralar.has(numara) ||
      sayi > EN_FAZLA_CARI_KARTI
    )
      throw hata();
    kimlikler.add(kart.id);
    numaralar.add(numara);
    sayilar.set(kart.cariId, sayi);
    return kart;
  });
  return { surum: 2, cariler, kartlar };
}
export function profilCariKaydet(veri: PosProfilVerisi, cari: PosCari): PosProfilVerisi {
  const eski = veri.cariler.find((c) => c.id === cari.id);
  if (eski && eski.numara !== cari.numara.trim() && veri.kartlar.some((k) => k.cariId === cari.id))
    throw new KullaniciHatasi(
      'Bu cariye bağlı kartlar var; vergi/TC numarası değiştirilemez. Farklı kişi için yeni cari oluşturun. Yanlış numarayı düzeltmek için önce bağlı kartları kaldırın.',
    );
  return posProfilDogrula({ ...veri, cariler: cariKaydet(veri.cariler, cari) });
}
export function profilCariSil(veri: PosProfilVerisi, cariId: string): PosProfilVerisi {
  return posProfilDogrula({
    surum: 2,
    cariler: veri.cariler.filter((c) => c.id !== cariId),
    kartlar: veri.kartlar.filter((k) => k.cariId !== cariId),
  });
}
export function profilKartKaydet(veri: PosProfilVerisi, kart: PosKart, simdi = new Date()): PosProfilVerisi {
  const k = kartDogrula(kart);
  if (kartSuresiGecti(k, simdi)) throw new KullaniciHatasi('Kartın son kullanma tarihi geçmiş.');
  const eski = veri.kartlar.find((x) => x.id === k.id);
  if (eski && eski.cariId !== k.cariId) throw new KullaniciHatasi('Kart başka cariye taşınamaz.');
  if (veri.kartlar.some((x) => x.id !== k.id && x.cariId === k.cariId && x.numara === k.numara))
    throw new KullaniciHatasi('Bu kart numarası seçilen caride zaten kayıtlı. Mevcut kartı düzenleyin.');
  if (!eski && veri.kartlar.filter((x) => x.cariId === k.cariId).length >= EN_FAZLA_CARI_KARTI)
    throw new KullaniciHatasi('Bir cariye en fazla 10 kart ekleyebilirsiniz.');
  return posProfilDogrula({ ...veri, kartlar: [...veri.kartlar.filter((x) => x.id !== k.id), k] });
}
export function profilKartSil(veri: PosProfilVerisi, cariId: string, kartId: string): PosProfilVerisi {
  return posProfilDogrula({
    ...veri,
    kartlar: veri.kartlar.filter((k) => k.id !== kartId || k.cariId !== cariId),
  });
}
export function profilBirlestir(mevcut: PosProfilVerisi, gelen: PosProfilVerisi): PosProfilVerisi {
  const a = posProfilDogrula(mevcut);
  const b = posProfilDogrula(gelen);
  const cariler = posCarileriBirlestir(a.cariler, b.cariler);
  const kartlar = [...a.kartlar];
  for (const k of b.kartlar) {
    const kaynakCari = b.cariler.find((c) => c.id === k.cariId);
    const hedefCari = cariler.find((c) => c.numara === kaynakCari?.numara);
    if (!hedefCari) throw new KullaniciHatasi('Yedekte kartın carisi bulunamadı.');
    const cariId = hedefCari.id;
    const ayni = kartlar.find((x) => x.cariId === cariId && x.numara === k.numara);
    if (
      ayni &&
      ['ad', 'sahibi', 'ay', 'yil', 'telefon'].every(
        (alan) => ayni[alan as keyof PosKart] === k[alan as keyof PosKart],
      )
    )
      continue;
    if (ayni || kartlar.some((x) => x.id === k.id))
      throw new KullaniciHatasi('Yedekte çelişen kart var. Hiçbir kayıt değiştirilmedi.');
    kartlar.push({ ...k, cariId });
  }
  return posProfilDogrula({ surum: 2, cariler, kartlar });
}
