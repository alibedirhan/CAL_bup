import { KullaniciHatasi } from '../cekirdek/hata';
import { posVerisiDogrula, type PosVerisi } from '../cekirdek/posCari';

const TEKRAR = 600_000;
export const EN_BUYUK_POS_YEDEK = 256 * 1024;

export interface PosZarfi {
  bicim: 'cal-bup-pos';
  surum: 1;
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

export function kasaParolasiDogrula(parola: string): void {
  if (parola.trim().length < 14 || parola.length > 128) {
    throw new KullaniciHatasi('Kasa parolası 14–128 karakter olmalı. Uzun, size özel bir parola seçin.');
  }
}

export function posZarfiDogrula(deger: unknown): PosZarfi {
  const hata = () => new KullaniciHatasi('Şifreli cari kaydı geçersiz. Mevcut kayıt değiştirilmedi.');
  if (typeof deger !== 'object' || deger === null || Array.isArray(deger)) throw hata();
  const z = deger as Record<string, unknown>;
  if (
    Object.keys(z).sort().join() !== 'bicim,iv,kimlik,surum,tekrar,tuz,veri' ||
    z.bicim !== 'cal-bup-pos' ||
    z.surum !== 1 ||
    z.tekrar !== TEKRAR ||
    typeof z.kimlik !== 'string' ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(z.kimlik)
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
    surum: 1,
    tekrar: TEKRAR,
    tuz: sonuc.tuz,
    iv: sonuc.iv,
    kimlik: sonuc.kimlik,
    veri: sonuc.veri,
  };
}

function ekVeri(z: Omit<PosZarfi, 'veri'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${z.bicim}|${z.surum}|${z.tekrar}|${z.tuz}|${z.kimlik}`);
}

export function yeniTuz(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function kasaAnahtari(parola: string, tuz: string): Promise<CryptoKey> {
  kasaParolasiDogrula(parola);
  if (!globalThis.crypto?.subtle)
    throw new KullaniciHatasi('Şifreli kasa bu tarayıcıda açılamıyor. Güncel Chrome veya Edge kullanın.');
  const parolaBaytlari = new TextEncoder().encode(parola);
  try {
    const temel = await crypto.subtle.importKey('raw', parolaBaytlari, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: TEKRAR, salt: bayt(tuz) },
      temel,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    parolaBaytlari.fill(0);
  }
}

export async function kasaSifrele(veri: PosVerisi, anahtar: CryptoKey, tuz: string): Promise<PosZarfi> {
  const z = {
    bicim: 'cal-bup-pos' as const,
    surum: 1 as const,
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
    return posZarfiDogrula(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(baytlar)));
  } catch {
    throw new KullaniciHatasi('Bu dosya geçerli bir şifreli CAL bup cari yedeği değil.');
  }
}
