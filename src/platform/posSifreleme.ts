import { KullaniciHatasi } from '../cekirdek/hata';
import { posVerisiDogrula, type PosVerisi } from '../cekirdek/posCari';
import { kasaParolasiDogrula, kasaAcilisBilgisiDogrula } from '../cekirdek/posParola';
export { kasaParolasiDogrula } from '../cekirdek/posParola';

const TEKRAR = 600_000;
export const EN_BUYUK_POS_YEDEK = 256 * 1024;

export interface PosZarfi {
  bicim: 'cal-bup-pos';
  surum: 1 | 2;
  cihaz?: string;
  tekrar: number;
  tuz: string;
  iv: string;
  kimlik: string;
  veri: string;
}

function b64(bayt: Uint8Array): string {
  let metin = '';
  for (const b of bayt) metin += String.fromCharCode(b);
  return btoa(metin);
}

function bayt(metin: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(metin), (c) => c.charCodeAt(0));
}

export function posSifrelemeDestegi(): void {
  if (globalThis.isSecureContext === false)
    throw new KullaniciHatasi(
      'Cari kasası güvenli bağlantı gerektirir. CAL bup’ın https://alibedirhan.github.io/CAL_bup/ adresini güncel Chrome veya Edge ile açın.',
    );
  if (
    !globalThis.crypto?.subtle ||
    typeof crypto.getRandomValues !== 'function' ||
    typeof crypto.randomUUID !== 'function'
  ) {
    throw new KullaniciHatasi(
      'Bu tarayıcı şifreli cari kasasını desteklemiyor. Güncel Chrome veya Edge kullanın.',
    );
  }
}

export function posZarfiDogrula(deger: unknown): PosZarfi {
  const hata = () => new KullaniciHatasi('Şifreli cari kaydı geçersiz. Mevcut kayıt değiştirilmedi.');
  if (typeof deger !== 'object' || deger === null || Array.isArray(deger)) throw hata();
  const z = deger as Record<string, unknown>;
  if (
    Object.keys(z).sort().join() !==
      (z.surum === 2
        ? 'bicim,cihaz,iv,kimlik,surum,tekrar,tuz,veri'
        : 'bicim,iv,kimlik,surum,tekrar,tuz,veri') ||
    z.bicim !== 'cal-bup-pos' ||
    (z.surum !== 1 && z.surum !== 2) ||
    z.tekrar !== TEKRAR ||
    typeof z.kimlik !== 'string' ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(z.kimlik)
  )
    throw hata();
  if (
    z.surum === 2 &&
    (typeof z.cihaz !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(z.cihaz))
  )
    throw hata();
  for (const alan of ['tuz', 'iv', 'veri']) {
    const v = z[alan];
    if (
      typeof v !== 'string' ||
      v.length > EN_BUYUK_POS_YEDEK ||
      v.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(v)
    )
      throw hata();
  }
  const sonuc = z as unknown as PosZarfi;
  if (
    bayt(sonuc.tuz).length !== 16 ||
    bayt(sonuc.iv).length !== 12 ||
    bayt(sonuc.veri).length < 16 ||
    b64(bayt(sonuc.tuz)) !== sonuc.tuz ||
    b64(bayt(sonuc.iv)) !== sonuc.iv ||
    b64(bayt(sonuc.veri)) !== sonuc.veri
  )
    throw hata();
  return {
    bicim: 'cal-bup-pos',
    surum: sonuc.surum,
    ...(sonuc.surum === 2 && sonuc.cihaz ? { cihaz: sonuc.cihaz } : {}),
    tekrar: TEKRAR,
    tuz: sonuc.tuz,
    iv: sonuc.iv,
    kimlik: sonuc.kimlik,
    veri: sonuc.veri,
  };
}

function ekVeri(z: Omit<PosZarfi, 'veri'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `${z.bicim}|${z.surum}|${z.tekrar}|${z.tuz}|${z.kimlik}${z.surum === 2 ? `|${z.cihaz}` : ''}`,
  );
}

export function yeniTuz(): string {
  posSifrelemeDestegi();
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function kasaAnahtari(
  parola: string,
  tuz: string,
  cihazAnahtari?: CryptoKey,
): Promise<CryptoKey> {
  if (cihazAnahtari) kasaAcilisBilgisiDogrula(parola);
  else kasaParolasiDogrula(parola);
  posSifrelemeDestegi();
  const parolaBaytlari = new TextEncoder().encode(parola);
  let cihazBagli: Uint8Array<ArrayBuffer> | undefined;
  try {
    if (cihazAnahtari)
      cihazBagli = new Uint8Array(await crypto.subtle.sign('HMAC', cihazAnahtari, parolaBaytlari));
    const temel = await crypto.subtle.importKey('raw', cihazBagli ?? parolaBaytlari, 'PBKDF2', false, [
      'deriveKey',
    ]);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: TEKRAR, salt: bayt(tuz) },
      temel,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new KullaniciHatasi(
      'Tarayıcı şifreleme anahtarını hazırlayamadı. Güncel Chrome veya Edge ile yeniden deneyin.',
    );
  } finally {
    parolaBaytlari.fill(0);
    cihazBagli?.fill(0);
  }
}

export async function kasaSifrele(
  veri: PosVerisi,
  anahtar: CryptoKey,
  tuz: string,
  cihaz?: string,
): Promise<PosZarfi> {
  const z: Omit<PosZarfi, 'veri'> = {
    bicim: 'cal-bup-pos' as const,
    surum: cihaz ? 2 : 1,
    ...(cihaz ? { cihaz } : {}),
    tekrar: TEKRAR,
    tuz,
    iv: b64(crypto.getRandomValues(new Uint8Array(12))),
    kimlik: crypto.randomUUID(),
  };
  const acik = new TextEncoder().encode(JSON.stringify(posVerisiDogrula(veri)));
  try {
    const kapali = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: bayt(z.iv), additionalData: ekVeri(z), tagLength: 128 },
      anahtar,
      acik,
    );
    const sonuc = { ...z, veri: b64(new Uint8Array(kapali)) };
    if (new TextEncoder().encode(JSON.stringify(sonuc)).length > EN_BUYUK_POS_YEDEK) {
      throw new KullaniciHatasi(
        'Cari listesinin yedeği çok büyük. Cari adlarını kısaltın veya gereksiz kayıtları kaldırın.',
      );
    }
    return posZarfiDogrula(sonuc);
  } finally {
    acik.fill(0);
  }
}

export async function kasaCoz(zarf: PosZarfi, anahtar: CryptoKey): Promise<PosVerisi> {
  const z = posZarfiDogrula(zarf);
  let acik: Uint8Array | undefined;
  try {
    acik = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bayt(z.iv), additionalData: ekVeri(z), tagLength: 128 },
        anahtar,
        bayt(z.veri),
      ),
    );
    return posVerisiDogrula(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(acik)));
  } catch {
    throw new KullaniciHatasi('Parola yanlış veya şifreli kayıt bozulmuş. Mevcut kayıt korunuyor.');
  } finally {
    acik?.fill(0);
  }
}

export function posYedegiOku(baytlar: Uint8Array): PosZarfi {
  if (baytlar.byteLength > EN_BUYUK_POS_YEDEK)
    throw new KullaniciHatasi('Cari yedeği en fazla 256 KB olabilir.');
  try {
    const z = posZarfiDogrula(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(baytlar)));
    if (z.surum !== 1) throw new Error('Cihaz kaydı taşınabilir yedek değildir');
    return z;
  } catch {
    throw new KullaniciHatasi('Bu dosya geçerli bir şifreli CAL bup cari yedeği değil.');
  }
}
