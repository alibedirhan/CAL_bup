import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KILIT_SURESI,
  PosProfilDeposu,
  PROFIL_ANAHTAR_ONEKI,
  PROFIL_DEPO_ANAHTARI,
  PROFIL_BEKLEME_SURESI,
  posOturumuSuresiDoldu,
  posOturumunuKapat,
} from '../../src/platform/posProfilDeposu';
import {
  profilZarfiDogrula,
  profilCoz,
  yeniProfilAnahtari,
  profilSifrele,
} from '../../src/platform/posProfilSifreleme';
import { parolaBeklemesi } from '../../src/platform/posDeneme';
import { PosKasasi } from '../../src/platform/posKasasi';
import { kasaAnahtari, kasaSifrele, yeniTuz } from '../../src/platform/posSifreleme';
import type { PosProfilVerisi } from '../../src/cekirdek/posProfil';

const depo = vi.hoisted(() => ({
  veri: new Map<string, unknown>(),
  okumaHatasi: false,
  yazmaHatasi: false,
  sil: Symbol('sil'),
}));
vi.mock('../../src/platform/idb', () => ({
  KAYDI_SIL: depo.sil,
  okuKesin: async (k: string) => {
    if (depo.okumaHatasi) throw new Error('Engelli');
    return depo.veri.get(k);
  },
  guncelle: async (k: string, f: (o: unknown, d: unknown) => unknown) => {
    if (depo.yazmaHatasi) return false;
    const staged = new Map(depo.veri);
    try {
      const v = f(staged.get(k), {
        put: (v: unknown, k: string) => staged.set(k, v),
        delete: (k: string) => staged.delete(k),
      });
      if (v === depo.sil) staged.delete(k);
      else staged.set(k, v);
      depo.veri = staged;
      return true;
    } catch {
      return false;
    }
  },
}));
const parola = 'yalnizca-yapay-yedek-parolasi';
const kilit = 'Yapay-kilit-2026';
const cari = { id: '11111111-1111-4111-8111-111111111111', ad: 'Yapay Profil Carisi', numara: '0123456789' };
const veri: PosProfilVerisi = {
  surum: 2,
  cariler: [cari],
  kartlar: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      cariId: cari.id,
      ad: 'Yapay Kart',
      numara: '4242424242424242',
      sahibi: 'Örnek Sahip',
      ay: '12',
      yil: '2035',
      telefon: '+905000000000',
      onayTarihi: '2026-10-03T00:00:00.000Z',
      cvv: '987',
    },
  ],
};
beforeEach(() => {
  posOturumunuKapat();
  depo.veri.clear();
  depo.okumaHatasi = false;
  depo.yazmaHatasi = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** 1.17 ve öncesinin parolasız kaydı: anahtar aynı tarayıcıda. */
async function cihazKaydi(v: PosProfilVerisi) {
  const k = await yeniProfilAnahtari();
  const kimlik = crypto.randomUUID();
  depo.veri.set(PROFIL_ANAHTAR_ONEKI + kimlik, k);
  depo.veri.set(PROFIL_DEPO_ANAHTARI, await profilSifrele(v, k, kimlik));
}
async function parolaliDepo(v: PosProfilVerisi = veri) {
  const d = new PosProfilDeposu();
  await d.parolaBelirle(kilit, kilit);
  await d.kaydet(v);
  return d;
}

describe('Parolalı Sanal POS deposu (1.18.0)', () => {
  it('ilk açılışta parola istenir; anahtar hiçbir yere yazılmaz, zarf açık bilgi taşımaz', async () => {
    const d = new PosProfilDeposu();
    expect(await d.ac()).toEqual({ tur: 'parolaBelirle', tasima: false });
    await expect(d.parolaBelirle('kisa1', 'kisa1')).rejects.toThrow(/en az 10/);
    await expect(d.parolaBelirle('yalnizharfler', 'yalnizharfler')).rejects.toThrow(/harf ve bir rakam/);
    await expect(d.parolaBelirle(kilit, kilit + 'x')).rejects.toThrow(/aynı/);
    expect(depo.veri.size).toBe(0);
    await d.parolaBelirle(kilit, kilit);
    await d.kaydet(veri);
    const z = profilZarfiDogrula(depo.veri.get(PROFIL_DEPO_ANAHTARI));
    expect(z.kip).toBe('parola');
    expect([...depo.veri.keys()]).toEqual([PROFIL_DEPO_ANAHTARI]);
    for (const s of [cari.numara, '4242424242424242', '+905000000000', '987', kilit])
      expect(JSON.stringify(z)).not.toContain(s);
    // Aynı sekmede sayfa değişse de oturum sürer; oturum kapanınca parola gerekir.
    expect(await new PosProfilDeposu().ac()).toEqual({ tur: 'acik', veri });
    posOturumunuKapat();
    const yeni = new PosProfilDeposu();
    expect(await yeni.ac()).toEqual({ tur: 'kilitli' });
    await expect(yeni.kilidiAc('Yanlis-parola-1')).rejects.toThrow(/Parola yanlış/);
    expect(await yeni.kilidiAc(kilit)).toEqual(veri);
    expect(yeni.acik).toBe(true);
  });
  it('parolasız eski kayıt parolayla yeniden şifrelenir; eski anahtar aynı aktarımda silinir', async () => {
    await cihazKaydi(veri);
    const d = new PosProfilDeposu();
    expect(await d.ac()).toEqual({ tur: 'parolaBelirle', tasima: true });
    expect(await d.parolaBelirle(kilit, kilit)).toEqual(veri);
    expect([...depo.veri.keys()]).toEqual([PROFIL_DEPO_ANAHTARI]);
    expect(profilZarfiDogrula(depo.veri.get(PROFIL_DEPO_ANAHTARI)).kip).toBe('parola');
    posOturumunuKapat();
    expect(await new PosProfilDeposu().kilidiAc(kilit)).toEqual(veri);
  });
  it('taşıma yazılamazsa eski kayıt ve anahtarı olduğu gibi kalır', async () => {
    await cihazKaydi(veri);
    const onceki = new Map(depo.veri);
    depo.yazmaHatasi = true;
    await expect(new PosProfilDeposu().parolaBelirle(kilit, kilit)).rejects.toThrow(/kaydedilemedi/);
    expect(depo.veri).toEqual(onceki);
  });
  it('5 yanlış denemeden sonra doğru parola da beklemeye takılır; bekleme katlanarak artar', async () => {
    await parolaliDepo();
    posOturumunuKapat();
    const d = new PosProfilDeposu();
    for (let i = 0; i < 5; i++) await expect(d.kilidiAc(`Yanlis-parola-${i}`)).rejects.toThrow(/yanlış/);
    await expect(d.kilidiAc(kilit)).rejects.toThrow(/saniye bekleyip/);
    expect(d.acik).toBe(false);
    expect([0, 4, 5, 6, 20].map(parolaBeklemesi)).toEqual([0, 0, 30_000, 60_000, 15 * 60_000]);
  });
  it('10 dakika işlem yapılmazsa oturum silinir ve kayıt kilitlenir', async () => {
    await parolaliDepo();
    expect(posOturumuSuresiDoldu(Date.now() + KILIT_SURESI - 1000)).toBe(false);
    expect(posOturumuSuresiDoldu(Date.now() + KILIT_SURESI + 1)).toBe(true);
    expect(await new PosProfilDeposu().ac()).toEqual({ tur: 'kilitli' });
  });
  it('“Kilitle” yalnız bu sekmenin oturumunu siler; kayıt değişmez', async () => {
    const d = await parolaliDepo();
    const onceki = new Map(depo.veri);
    d.kilitle();
    expect(d.acik).toBe(false);
    expect(await new PosProfilDeposu().ac()).toEqual({ tur: 'kilitli' });
    expect(depo.veri).toEqual(onceki);
  });
  it('parola değiştirme eski parolayı doğrular; başka oturumdaki eski anahtar geçersiz kalır', async () => {
    const d = await parolaliDepo();
    await expect(d.parolaDegistir('Yanlis-parola-1', 'Yeni-kilit-2027', 'Yeni-kilit-2027')).rejects.toThrow(
      /yanlış/,
    );
    expect(await d.parolaDegistir(kilit, 'Yeni-kilit-2027', 'Yeni-kilit-2027')).toEqual(veri);
    posOturumunuKapat();
    const yeni = new PosProfilDeposu();
    await expect(yeni.kilidiAc(kilit)).rejects.toThrow(/yanlış/);
    expect(await yeni.kilidiAc('Yeni-kilit-2027')).toEqual(veri);
  });
  it('parola unutulunca sıfırlama her şeyi siler; yeni parolayla boş başlar', async () => {
    await parolaliDepo();
    posOturumunuKapat();
    const d = new PosProfilDeposu();
    await expect(d.kilidiAc('Yanlis-parola-1')).rejects.toThrow(/yanlış/);
    await d.sifirla();
    expect(depo.veri.size).toBe(0);
    expect(await d.ac()).toEqual({ tur: 'parolaBelirle', tasima: false });
    expect(await d.parolaBelirle('Yeni-kilit-2027', 'Yeni-kilit-2027')).toEqual({
      surum: 2,
      cariler: [],
      kartlar: [],
    });
  });
  it('iki sekmede eski veri yazılamaz', async () => {
    const a = await parolaliDepo();
    const b = new PosProfilDeposu();
    await b.ac();
    await a.kaydet({ surum: 2, cariler: [], kartlar: [] });
    const onceki = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    await expect(b.kaydet(veri)).rejects.toThrow(/başka sekmede/i);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(onceki);
  });
  it('kaybolan eski anahtar, bozuk zarf veya okuma hatası mevcut veriyi sıfırlamaz', async () => {
    await cihazKaydi(veri);
    const z = profilZarfiDogrula(depo.veri.get(PROFIL_DEPO_ANAHTARI));
    depo.veri.delete(PROFIL_ANAHTAR_ONEKI + z.kimlik);
    await expect(new PosProfilDeposu().parolaBelirle(kilit, kilit)).rejects.toThrow(/anahtarı/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(z);
    depo.okumaHatasi = true;
    await expect(new PosProfilDeposu().ac()).rejects.toThrow(/okunamadı/);
    depo.okumaHatasi = false;
    depo.veri.set(PROFIL_DEPO_ANAHTARI, { ...z, cvv: 'yapay' });
    await expect(new PosProfilDeposu().ac()).rejects.toThrow(/geçersiz/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual({ ...z, cvv: 'yapay' });
  });
  it('yazma hatası başarısızdır; önceki şifreli kayıt korunur', async () => {
    const d = await parolaliDepo();
    const onceki = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    depo.yazmaHatasi = true;
    await expect(d.kaydet({ surum: 2, cariler: [], kartlar: [] })).rejects.toThrow(/tamamlanmadı/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(onceki);
    expect(d.acik).toBe(false);
  });
  it.each([1, 2])('eski v%s kasa tek doğru parolayla taşınır, ardından parola istenir', async (surum) => {
    if (surum === 1) {
      const tuz = yeniTuz();
      depo.veri.set(
        PROFIL_DEPO_ANAHTARI,
        await kasaSifrele({ surum: 1, cariler: [cari] }, await kasaAnahtari(parola, tuz), tuz),
      );
    } else {
      const old = new PosKasasi();
      await old.ac('0123', true);
      await old.kaydet([cari]);
      old.kilitle();
    }
    const oldZ = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    const d = new PosProfilDeposu();
    expect(await d.ac()).toEqual({ tur: 'eski' });
    await expect(d.eskiKasayiTasi(surum === 1 ? 'farkli-yapay-yedek-parolasi' : '9999')).rejects.toThrow();
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(oldZ);
    await d.eskiKasayiTasi(surum === 1 ? parola : '0123');
    expect([...depo.veri.keys()].some((k) => k.startsWith('sanal-pos-cihaz-'))).toBe(false);
    expect(await d.ac()).toEqual({ tur: 'parolaBelirle', tasima: true });
    expect(await d.parolaBelirle(kilit, kilit)).toEqual({ surum: 2, cariler: [cari], kartlar: [] });
  });
  it('başarısız dönüşüm eski zarfı ve cihaz anahtarını korur', async () => {
    const old = new PosKasasi();
    await old.ac('0123', true);
    await old.kaydet([cari]);
    old.kilitle();
    const onceki = new Map(depo.veri);
    depo.yazmaHatasi = true;
    await expect(new PosProfilDeposu().eskiKasayiTasi('0123')).rejects.toThrow();
    expect(depo.veri).toEqual(onceki);
  });
  it('eski uygulama yeni zarfı reddeder; yeni veriyi boş kasa diye ezemez', async () => {
    await parolaliDepo();
    const onceki = new Map(depo.veri);
    await expect(new PosKasasi().ac('0123', true)).rejects.toThrow();
    expect(depo.veri).toEqual(onceki);
  });
  it('metadata/IV/değer değiştirilince AES-GCM doğrulaması başarısızdır', async () => {
    const k = await yeniProfilAnahtari();
    const z = await profilSifrele(veri, k, crypto.randomUUID());
    await expect(profilCoz({ ...z, revizyon: crypto.randomUUID() }, k)).rejects.toThrow();
    await expect(profilCoz({ ...z, iv: btoa('x'.repeat(12)) }, k)).rejects.toThrow();
    expect(() => profilZarfiDogrula({ ...z, tekrar: 999999999 })).toThrow();
  });
  it('iptalden sonra geç gelen anahtar hiçbir kayıt oluşturamaz', async () => {
    const gercek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    let coz!: (k: CryptoKey) => void;
    const bekleyen = new Promise<CryptoKey>((r) => {
      coz = r;
    });
    vi.spyOn(crypto.subtle, 'deriveKey').mockImplementation(() => bekleyen);
    const d = new PosProfilDeposu();
    const p = d.parolaBelirle(kilit, kilit);
    const hata = expect(p).rejects.toThrow(/durduruldu/);
    await new Promise((r) => setTimeout(r, 0));
    d.kapat();
    await hata;
    coz(gercek);
    await new Promise((r) => setTimeout(r, 30));
    expect(depo.veri.size).toBe(0);
    expect(d.acik).toBe(false);
  });
  it('yanıtsız işlemin süre sınırı vardır; kullanıcı yeniden kontrol edebilir', async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto.subtle, 'deriveKey').mockImplementation(() => new Promise(() => undefined));
    const d = new PosProfilDeposu();
    const p = expect(d.parolaBelirle(kilit, kilit)).rejects.toThrow(/durduruldu/);
    await vi.advanceTimersByTimeAsync(PROFIL_BEKLEME_SURESI + 1);
    await p;
    expect(depo.veri.size).toBe(0);
  });
});
