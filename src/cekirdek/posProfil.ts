import { KullaniciHatasi } from './hata';
import { cariKaydet, posVerisiDogrula, type PosCari } from './posCari';
import { EN_FAZLA_CARI_KARTI, kartDogrula, kartSuresiGecti, type PosKart } from './posKart';

export interface PosProfilVerisi {
  surum: 2;
  cariler: PosCari[];
  kartlar: PosKart[];
}
export const BOS_POS_PROFILI: PosProfilVerisi = { surum: 2, cariler: [], kartlar: [] };
const KART_ALANLARI = new Set([
  'ad,ay,cariId,id,numara,onayTarihi,sahibi,telefon,yil',
  'ad,ay,cariId,cvv,id,numara,onayTarihi,sahibi,telefon,yil',
]);

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
      !KART_ALANLARI.has(Object.keys(k).sort().join()) ||
      (k as PosKart).cvv === '' ||
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
/** Form açıldığındaki kaydın hâlâ aynı olduğunu denetler; başka sekmedeki değişiklik sessizce ezilmez.
 * `beklenen` verilmezse denetim yapılmaz; `null` yeni kayıt demektir. */
function beklenenKayit<T extends { id: string }>(
  kayitlar: readonly T[],
  id: string,
  beklenen: T | null | undefined,
  ad: string,
): void {
  if (beklenen === undefined) return;
  const guncel = kayitlar.find((k) => k.id === id);
  const ayni =
    beklenen === null
      ? !guncel
      : Boolean(guncel) &&
        JSON.stringify(Object.entries(guncel as T).sort()) ===
          JSON.stringify(Object.entries(beklenen).sort());
  if (!ayni)
    throw new KullaniciHatasi(
      `Bu ${ad} siz düzenlerken başka sekmede değiştirildi veya silindi. Formu kapatıp güncel kaydı yeniden açın.`,
    );
}
/** Kartlı carinin numarası yalnız `numaraDuzeltme` açık onayıyla değişir: aynı kişinin yanlış girilmiş
 * numarası (ör. VKN yerine TC) düzeltilir; kartlar cari kimliğine bağlı olduğundan yerinde kalır.
 * Farklı kişi için yeni cari açılmalıdır; bu ayrım kullanıcının onayıdır, kod tarafından bilinemez. */
export function profilCariKaydet(
  veri: PosProfilVerisi,
  cari: PosCari,
  beklenen?: PosCari | null,
  numaraDuzeltme = false,
): PosProfilVerisi {
  beklenenKayit(veri.cariler, cari.id, beklenen, 'cari');
  const eski = veri.cariler.find((c) => c.id === cari.id);
  if (
    !numaraDuzeltme &&
    eski &&
    eski.numara !== cari.numara.trim() &&
    veri.kartlar.some((k) => k.cariId === cari.id)
  )
    throw new KullaniciHatasi(
      'Bu cariye bağlı kartlar var. Numarayı yalnız aynı kişi için düzeltiyorsanız “numara düzeltmesi” kutusunu işaretleyin; farklı kişi için yeni cari oluşturun.',
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
export function profilKartKaydet(
  veri: PosProfilVerisi,
  kart: PosKart,
  simdi = new Date(),
  beklenen?: PosKart | null,
): PosProfilVerisi {
  beklenenKayit(veri.kartlar, kart.id, beklenen, 'kart');
  if (!veri.cariler.some((c) => c.id === kart.cariId))
    throw new KullaniciHatasi('Kartın carisi başka sekmede silinmiş. Kart kaydedilmedi.');
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
