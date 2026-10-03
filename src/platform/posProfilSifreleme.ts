import { yedekParolasiDogrula } from '../cekirdek/posParola';
import { KullaniciHatasi } from '../cekirdek/hata';
import { POS_KIMLIK } from '../cekirdek/posKart';
import { posProfilDogrula, type PosProfilVerisi } from '../cekirdek/posProfil';
import { kasaAnahtari, kasaCoz, posSifrelemeDestegi, posYedegiOku, yeniTuz } from './posSifreleme';

export const EN_BUYUK_PROFIL_YEDEGI = 2 * 1024 * 1024;
export interface ProfilZarfi {
  bicim: 'cal-bup-pos-profil';
  surum: 1;
  kip: 'cihaz' | 'yedek';
  kimlik: string;
  revizyon: string;
  iv: string;
  veri: string;
  tuz: string;
  tekrar: number;
}
const kodla = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const bayt = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function profilZarfiDogrula(deger: unknown): ProfilZarfi {
  const hata = () => new KullaniciHatasi('Şifreli profil kaydı geçersiz. Kayıtlar değiştirilmedi.');
  if (!deger || typeof deger !== 'object' || Array.isArray(deger)) throw hata();
  const z = deger as ProfilZarfi;
  if (
    Object.keys(z).sort().join() !== 'bicim,iv,kimlik,kip,revizyon,surum,tekrar,tuz,veri' ||
    z.bicim !== 'cal-bup-pos-profil' ||
    z.surum !== 1 ||
    !['cihaz', 'yedek'].includes(z.kip) ||
    typeof z.kimlik !== 'string' ||
    !POS_KIMLIK.test(z.kimlik) ||
    typeof z.revizyon !== 'string' ||
    !POS_KIMLIK.test(z.revizyon) ||
    z.tekrar !== (z.kip === 'yedek' ? 600000 : 0) ||
    (z.kip === 'cihaz' && z.tuz !== '')
  )
    throw hata();
  for (const alan of ['iv', 'veri', 'tuz'] as const) {
    const v = z[alan];
    if (
      typeof v !== 'string' ||
      v.length > EN_BUYUK_PROFIL_YEDEGI ||
      v.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(v) ||
      kodla(bayt(v)) !== v
    )
      throw hata();
  }
  if (
    bayt(z.iv).length !== 12 ||
    bayt(z.veri).length < 16 ||
    (z.kip === 'yedek' && bayt(z.tuz).length !== 16) ||
    new TextEncoder().encode(JSON.stringify(z)).length > EN_BUYUK_PROFIL_YEDEGI
  )
    throw hata();
  return { ...z };
}
function ekVeri(z: Omit<ProfilZarfi, 'veri'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `${z.bicim}|${z.surum}|${z.kip}|${z.kimlik}|${z.revizyon}|${z.iv}|${z.tuz}|${z.tekrar}`,
  );
}
export function profilAnahtariDogrula(anahtar: unknown): CryptoKey {
  const k = anahtar as CryptoKey | undefined;
  if (
    !k ||
    k.type !== 'secret' ||
    k.extractable ||
    k.algorithm?.name !== 'AES-GCM' ||
    (k.algorithm as AesKeyAlgorithm).length !== 256 ||
    !k.usages.includes('encrypt') ||
    !k.usages.includes('decrypt')
  )
    throw new KullaniciHatasi('Bu tarayıcının profil anahtarı bulunamadı veya bozuk. Kayıtlar sıfırlanmadı.');
  return k;
}
export async function yeniProfilAnahtari(): Promise<CryptoKey> {
  posSifrelemeDestegi();
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function profilSifrele(
  veri: PosProfilVerisi,
  anahtar: CryptoKey,
  kimlik: string,
  tuz = '',
): Promise<ProfilZarfi> {
  const z: Omit<ProfilZarfi, 'veri'> = {
    bicim: 'cal-bup-pos-profil',
    surum: 1,
    kip: tuz ? 'yedek' : 'cihaz',
    kimlik,
    revizyon: crypto.randomUUID(),
    iv: kodla(crypto.getRandomValues(new Uint8Array(12))),
    tuz,
    tekrar: tuz ? 600000 : 0,
  };
  const acik = new TextEncoder().encode(JSON.stringify(posProfilDogrula(veri)));
  if (acik.length > EN_BUYUK_PROFIL_YEDEGI) {
    acik.fill(0);
    throw new KullaniciHatasi('Profil kaydı 2 MB sınırını aşıyor. Kayıtlar değiştirilmedi.');
  }
  try {
    const kapali = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: bayt(z.iv), additionalData: ekVeri(z), tagLength: 128 },
      anahtar,
      acik,
    );
    return profilZarfiDogrula({ ...z, veri: kodla(new Uint8Array(kapali)) });
  } finally {
    acik.fill(0);
  }
}
export async function profilCoz(zarf: ProfilZarfi, anahtar: CryptoKey): Promise<PosProfilVerisi> {
  const z = profilZarfiDogrula(zarf);
  let acik: Uint8Array | undefined;
  try {
    acik = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bayt(z.iv), additionalData: ekVeri(z), tagLength: 128 },
        anahtar,
        bayt(z.veri),
      ),
    );
    return posProfilDogrula(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(acik)));
  } catch {
    throw new KullaniciHatasi(
      'Şifreli profil açılamadı. Yedekte parola yanlış olabilir; mevcut kayıt korunuyor.',
    );
  } finally {
    acik?.fill(0);
  }
}
export async function profilYedegiOlustur(
  veri: PosProfilVerisi,
  parola: string,
): Promise<Uint8Array<ArrayBuffer>> {
  yedekParolasiDogrula(parola);
  const tuz = yeniTuz();
  const anahtar = await kasaAnahtari(parola, tuz);
  const z = await profilSifrele(veri, anahtar, crypto.randomUUID(), tuz);
  await profilCoz(z, anahtar);
  return new TextEncoder().encode(JSON.stringify(z));
}
export async function profilYedeginiAc(b: Uint8Array, parola: string): Promise<PosProfilVerisi> {
  yedekParolasiDogrula(parola);
  if (b.byteLength > EN_BUYUK_PROFIL_YEDEGI)
    throw new KullaniciHatasi('Profil yedeği en fazla 2 MB olabilir.');
  let ham: unknown;
  try {
    ham = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b));
  } catch {
    throw new KullaniciHatasi('Geçerli bir şifreli profil yedeği seçin.');
  }
  if ((ham as { bicim?: unknown } | null)?.bicim === 'cal-bup-pos') {
    const eski = posYedegiOku(b);
    const veri = await kasaCoz(eski, await kasaAnahtari(parola, eski.tuz));
    return posProfilDogrula({ surum: 2, cariler: veri.cariler, kartlar: [] });
  }
  const z = profilZarfiDogrula(ham);
  if (z.kip !== 'yedek') throw new KullaniciHatasi('Yerel cihaz kaydı taşınabilir yedek değildir.');
  return profilCoz(z, await kasaAnahtari(parola, z.tuz));
}
