import { KullaniciHatasi } from './hata';

/** `girisKullanici`/`girisSifresi` yalnız POS'ta varsayılan kurala (kullanıcı = numara, şifre = ilk 2 +
 * son 2 hane) uymayan cariler içindir; boşsa kayda hiç yazılmaz. */
export interface PosCari {
  id: string;
  ad: string;
  numara: string;
  girisKullanici?: string;
  girisSifresi?: string;
}

export interface PosVerisi {
  surum: 1;
  cariler: PosCari[];
}

export const EN_FAZLA_POS_CARI = 500;
const CARI_ANAHTARLARI = new Set([
  'ad,id,numara',
  'ad,girisKullanici,id,numara',
  'ad,girisSifresi,id,numara',
  'ad,girisKullanici,girisSifresi,id,numara',
]);

function nesne(deger: unknown): deger is Record<string, unknown> {
  return typeof deger === 'object' && deger !== null && !Array.isArray(deger);
}

export function cariAdi(ad: string): string {
  const sonuc = ad.trim().replace(/\s+/gu, ' ');
  if (sonuc.length < 2 || sonuc.length > 120 || /[\p{Cc}\p{Cf}]/u.test(sonuc)) {
    throw new KullaniciHatasi('Cari adı 2–120 karakter olmalı; görünmeyen karakter içermemeli.');
  }
  return sonuc;
}

export function posNumarasi(numara: string): string {
  const sonuc = numara.trim();
  if (!/^\d{10,11}$/.test(sonuc)) {
    throw new KullaniciHatasi('Vergi/TC numarasını boşluksuz, 10 veya 11 rakam olarak yazın.');
  }
  return sonuc;
}

export function posGirisSifresi(numara: string): string {
  const n = posNumarasi(numara);
  return n.slice(0, 2) + n.slice(-2);
}

/** POS giriş sayfasının “lisans numarası” (kullanıcı) alanı; boş metin varsayılan kural demektir. */
export function posGirisKullanicisi(deger: string): string {
  const s = deger.trim();
  if (!s) return '';
  if (!/^[\x21-\x7e]{1,40}$/.test(s))
    throw new KullaniciHatasi('POS lisans/kullanıcı numarasını boşluksuz, en fazla 40 karakter yazın.');
  return s;
}

/** Elle girilen POS şifresi olduğu gibi korunur (kırpılmaz); boş metin varsayılan kural demektir. */
export function posOzelSifre(deger: string): string {
  if (!deger) return '';
  if (deger.length > 64 || deger !== deger.trim() || /[\p{Cc}\p{Cf}]/u.test(deger))
    throw new KullaniciHatasi('POS şifresi en fazla 64 karakter olmalı; başında/sonunda boşluk olmamalı.');
  return deger;
}

export interface PosGirisBilgisi {
  vergiNo: string;
  kullanici: string;
  sifre: string;
  /** Kullanıcı veya şifre carinin kaydından geliyor (varsayılan kural değil). */
  ozel: boolean;
}

/** POS giriş formunun üç alanı. Kural tek yerde: yardımcı da program da buradan alır. */
export function posGirisBilgisi(
  c: Pick<PosCari, 'numara' | 'girisKullanici' | 'girisSifresi'>,
): PosGirisBilgisi {
  const vergiNo = posNumarasi(c.numara);
  const kullanici = posGirisKullanicisi(c.girisKullanici ?? '');
  const sifre = posOzelSifre(c.girisSifresi ?? '');
  return {
    vergiNo,
    kullanici: kullanici || vergiNo,
    sifre: sifre || posGirisSifresi(vergiNo),
    ozel: Boolean(kullanici || sifre),
  };
}

export function numaraMaskesi(numara: string): string {
  const n = posNumarasi(numara);
  return '•'.repeat(n.length - 4) + n.slice(-4);
}

function adAnahtari(ad: string): string {
  return cariAdi(ad).toLocaleLowerCase('tr-TR');
}

/** Kaydın tek biçimi: boş isteğe bağlı alanlar yazılmaz. */
export function cariBicimi(c: PosCari): PosCari {
  const girisKullanici = posGirisKullanicisi(c.girisKullanici ?? '');
  const girisSifresi = posOzelSifre(c.girisSifresi ?? '');
  return {
    id: c.id,
    ad: cariAdi(c.ad),
    numara: posNumarasi(c.numara),
    ...(girisKullanici ? { girisKullanici } : {}),
    ...(girisSifresi ? { girisSifresi } : {}),
  };
}

export function cariKaydet(cariler: readonly PosCari[], yeni: PosCari): PosCari[] {
  const kayit = cariBicimi(yeni);
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(kayit.id))
    throw new KullaniciHatasi('Cari kaydı geçersiz.');
  if (cariler.some((c) => c.id !== kayit.id && c.numara === kayit.numara)) {
    throw new KullaniciHatasi('Bu numarayla bir cari zaten kayıtlı. Mevcut kaydı düzenleyin.');
  }
  if (cariler.some((c) => c.id !== kayit.id && adAnahtari(c.ad) === adAnahtari(kayit.ad))) {
    throw new KullaniciHatasi('Bu cari adı zaten kayıtlı. Karışmaması için ayırt edici bir ad yazın.');
  }
  const sonuc = [...cariler.filter((c) => c.id !== kayit.id), kayit];
  if (sonuc.length > EN_FAZLA_POS_CARI) throw new KullaniciHatasi('En fazla 500 cari kaydedilebilir.');
  return sonuc.sort((a, b) => a.ad.localeCompare(b.ad, 'tr-TR'));
}

/** Yedek ve çözülmüş kasa yalnızca cari alanlarını kabul eder; fazladan sır alanı reddedilir. */
export function posVerisiDogrula(deger: unknown): PosVerisi {
  const hata = () => new KullaniciHatasi('Sanal POS kaydının biçimi geçersiz. Mevcut kayıt korunuyor.');
  if (
    !nesne(deger) ||
    Object.keys(deger).sort().join() !== 'cariler,surum' ||
    deger.surum !== 1 ||
    !Array.isArray(deger.cariler) ||
    deger.cariler.length > EN_FAZLA_POS_CARI
  )
    throw hata();
  let cariler: PosCari[] = [];
  const kimlikler = new Set<string>();
  for (const c of deger.cariler) {
    if (
      !nesne(c) ||
      !CARI_ANAHTARLARI.has(Object.keys(c).sort().join()) ||
      !Object.values(c).every((v) => typeof v === 'string') ||
      c.girisKullanici === '' ||
      c.girisSifresi === '' ||
      kimlikler.has(c.id as string)
    )
      throw hata();
    kimlikler.add(c.id as string);
    cariler = cariKaydet(cariler, c as unknown as PosCari);
  }
  return { surum: 1, cariler };
}

/** Aynı kayıt atlanır; çelişki varsa bütün aktarım durur, var olan liste ezilmez. */
export function posCarileriBirlestir(mevcut: readonly PosCari[], gelen: readonly PosCari[]): PosCari[] {
  let sonuc = [...mevcut];
  for (const c of gelen) {
    const ayniNumara = sonuc.find((s) => s.numara === c.numara);
    if (ayniNumara && adAnahtari(ayniNumara.ad) === adAnahtari(c.ad)) continue;
    if (ayniNumara || sonuc.some((s) => s.id === c.id)) {
      throw new KullaniciHatasi('Yedekte mevcut kayıtla çelişen bir cari var. Liste değiştirilmedi.');
    }
    sonuc = cariKaydet(sonuc, c);
  }
  return sonuc;
}
