import { KullaniciHatasi } from '../cekirdek/hata';
import { POS_KIMLIK } from '../cekirdek/posKart';
import { posProfilDogrula, type PosProfilVerisi } from '../cekirdek/posProfil';
import { posSifrelemeDestegi } from './posSifreleme';

export const EN_BUYUK_PROFIL_YEDEGI = 2 * 1024 * 1024;
/** PBKDF2-SHA256 tekrar sayısı (OWASP 2023 önerisi). */
export const PAROLA_TEKRARI = 600_000;
/** `cihaz`: 1.17 ve öncesi, anahtar aynı tarayıcıda (parolasız). `parola`: 1.18'den beri, anahtar yalnız
 * paroladan üretilir ve hiçbir yere yazılmaz. */
export interface ProfilZarfi {
  bicim: 'cal-bup-pos-profil';
  surum: 1;
  kip: 'cihaz' | 'parola';
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
    !['cihaz', 'parola'].includes(z.kip) ||
    typeof z.kimlik !== 'string' ||
    !POS_KIMLIK.test(z.kimlik) ||
    typeof z.revizyon !== 'string' ||
    !POS_KIMLIK.test(z.revizyon) ||
    z.tekrar !== (z.kip === 'parola' ? PAROLA_TEKRARI : 0) ||
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
    (z.kip === 'parola' && bayt(z.tuz).length !== 16) ||
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
    kip: tuz ? 'parola' : 'cihaz',
    kimlik,
    revizyon: crypto.randomUUID(),
    iv: kodla(crypto.getRandomValues(new Uint8Array(12))),
    tuz,
    tekrar: tuz ? PAROLA_TEKRARI : 0,
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
    throw new KullaniciHatasi('Şifreli profil açılamadı. Kayıtlar değiştirilmedi.');
  } finally {
    acik?.fill(0);
  }
}
export function yeniParolaTuzu(): string {
  posSifrelemeDestegi();
  return kodla(crypto.getRandomValues(new Uint8Array(16)));
}
/** Paroladan AES-256-GCM anahtarı; dışa aktarılamaz, yalnız bu sekmenin belleğinde durur. */
export async function parolaAnahtari(parola: string, tuz: string): Promise<CryptoKey> {
  posSifrelemeDestegi();
  const baytlar = new TextEncoder().encode(parola);
  try {
    const temel = await crypto.subtle.importKey('raw', baytlar, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: PAROLA_TEKRARI, salt: bayt(tuz) },
      temel,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    baytlar.fill(0);
  }
}
