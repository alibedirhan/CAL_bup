import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POS_BOSTA_SURESI, POS_BEKLEME_SURESI, PosKasasi, posKasaVar } from '../../src/platform/posKasasi';
import {
  EN_BUYUK_POS_YEDEK,
  kasaAnahtari,
  kasaCoz,
  kasaParolasiDogrula,
  kasaSifrele,
  posYedegiOku,
  posZarfiDogrula,
  yeniTuz,
} from '../../src/platform/posSifreleme';
import type { PosCari } from '../../src/cekirdek/posCari';

const depo = vi.hoisted(() => ({
  veri: undefined as unknown,
  ek: new Map<string, unknown>(),
  hata: false,
  yazmaHatasi: false,
  sil: Symbol('sil'),
}));
vi.mock('../../src/platform/idb', () => ({
  KAYDI_SIL: depo.sil,
  okuKesin: async (anahtar: string) => {
    if (depo.hata) throw new Error('Kapalı');
    return anahtar === 'sanal-pos-kasa-v1' ? depo.veri : depo.ek.get(anahtar);
  },
  guncelle: async (anahtar: string, degistir: (onceki: unknown, d: unknown) => unknown) => {
    if (depo.yazmaHatasi) return false;
    const staged = new Map(depo.ek);
    staged.set('sanal-pos-kasa-v1', depo.veri);
    try {
      const sonraki = degistir(staged.get(anahtar), {
        put: (v: unknown, k: string) => staged.set(k, v),
        delete: (k: string) => staged.delete(k),
      });
      if (sonraki === depo.sil) staged.delete(anahtar);
      else staged.set(anahtar, sonraki);
      depo.veri = staged.get('sanal-pos-kasa-v1');
      staged.delete('sanal-pos-kasa-v1');
      depo.ek = staged;
      return true;
    } catch {
      return false;
    }
  },
}));

const parola = 'yalnizca-yapay-deneme-parolasi';
const yeniParola = 'ikinci-yapay-deneme-parolasi';
const cari: PosCari = {
  id: '11111111-1111-4111-8111-111111111111',
  ad: 'Yapay Deneme Cari',
  numara: '0123456789',
};

beforeEach(() => {
  depo.veri = undefined;
  depo.ek.clear();
  depo.hata = false;
  depo.yazmaHatasi = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Sanal POS gerçek şifreleme ve kasa sınırları', () => {
  it.each(['1234', ' '.repeat(20), 'a'.repeat(129)])('kısa veya geçersiz kasa parolasını reddeder', (p) => {
    expect(() => kasaParolasiDogrula(p)).toThrow(/14/);
  });
  it('anahtar dışa aktarılamaz; her şifreleme farklı IV ve şifreli içerik üretir', async () => {
    const tuz = yeniTuz();
    const anahtar = await kasaAnahtari(parola, tuz);
    expect(anahtar.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', anahtar)).rejects.toThrow();
    const a = await kasaSifrele({ surum: 1, cariler: [cari] }, anahtar, tuz);
    const b = await kasaSifrele({ surum: 1, cariler: [cari] }, anahtar, tuz);
    expect(a.iv).not.toBe(b.iv);
    expect(a.veri).not.toBe(b.veri);
    expect(await kasaCoz(a, anahtar)).toEqual({ surum: 1, cariler: [cari] });
  });
  it('kalıcı kayıtta ve yedekte cari adı, numara veya parola düz metin bulunmaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    await kasa.kaydet([cari]);
    const kayit = JSON.stringify(depo.veri);
    const yedek = new TextDecoder().decode(await kasa.yedekle(parola));
    for (const sir of [cari.ad, cari.numara, parola]) {
      expect(kayit).not.toContain(sir);
      expect(yedek).not.toContain(sir);
    }
    kasa.kilitle();
    expect(kasa.acik).toBe(false);
    expect(() => kasa.yedek()).toThrow(/kilitlendi/);
    expect(await kasa.ac(parola, false)).toEqual({ surum: 1, cariler: [cari] });
  });
  it('yanlış parola ve değişmiş içerik mevcut kaydı ezmez', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    await kasa.kaydet([cari]);
    const onceki = JSON.stringify(depo.veri);
    await expect(new PosKasasi().ac(yeniParola, false)).rejects.toThrow(/Parola yanlış/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
    const z = posZarfiDogrula(depo.veri);
    const bozuk = { ...z, veri: (z.veri[0] === 'A' ? 'B' : 'A') + z.veri.slice(1) };
    depo.veri = bozuk;
    await expect(new PosKasasi().ac(parola, false)).rejects.toThrow(/bozulmuş/);
    expect(depo.veri).toEqual(bozuk);
  });
  it('dış metadata ve IV değiştirilirse doğrulama başarısız olur', async () => {
    const tuz = yeniTuz();
    const k = await kasaAnahtari(parola, tuz);
    const z = await kasaSifrele({ surum: 1, cariler: [] }, k, tuz);
    await expect(kasaCoz({ ...z, kimlik: crypto.randomUUID() }, k)).rejects.toThrow(/bozulmuş/);
    await expect(kasaCoz({ ...z, iv: btoa('x'.repeat(12)) }, k)).rejects.toThrow(/bozulmuş/);
  });
  it('depo okuma hatasını boş kasa saymaz', async () => {
    depo.hata = true;
    await expect(posKasaVar()).rejects.toThrow(/erişilemiyor/);
    await expect(new PosKasasi().ac(parola, true)).rejects.toThrow(/erişilemiyor/);
    expect(depo.veri).toBeUndefined();
  });
  it('bozuk veya desteklenmeyen zarfı korur; sıfırlamaz', async () => {
    depo.veri = { bicim: 'bilinmeyen' };
    await expect(new PosKasasi().ac(parola, true)).rejects.toThrow(/geçersiz/);
    expect(depo.veri).toEqual({ bicim: 'bilinmeyen' });
  });
  it('bozuk, büyük ve aşırı KDF maliyeti isteyen yedeği reddeder', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    const z = posZarfiDogrula(depo.veri);
    for (const degisiklik of [{ tekrar: 2_000_000_000 }, { surum: 3 }, { tuz: 'x' }, { cvv: 'istenmeyen' }]) {
      expect(() => posZarfiDogrula({ ...z, ...degisiklik })).toThrow(/geçersiz/);
    }
    expect(() => posYedegiOku(new Uint8Array(EN_BUYUK_POS_YEDEK + 1))).toThrow(/256 KB/);
    expect(() => posYedegiOku(new TextEncoder().encode('{'))).toThrow(/geçerli/);
  });
  it('başka sekmede değişmiş kayıt eski oturumdan yazılamaz', async () => {
    const a = new PosKasasi();
    const b = new PosKasasi();
    await a.ac(parola, true);
    await b.ac(parola, false);
    await a.kaydet([cari]);
    const onceki = JSON.stringify(depo.veri);
    await expect(b.kaydet([])).rejects.toThrow(/başka sekmede değişti/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
    expect(b.acik).toBe(false);
  });
  it('yazma başarısızsa başarılı saymaz; mevcut şifreli kaydı korur', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    const onceki = JSON.stringify(depo.veri);
    depo.yazmaHatasi = true;
    await expect(kasa.kaydet([cari])).rejects.toThrow(/tamamlanmadı/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
    expect(kasa.acik).toBe(false);
  });
  it('otuz dakika boşta kalınca anahtar kullanılamaz; etkinlik eski oturumu diriltmez', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    const simdi = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(simdi + POS_BOSTA_SURESI + 1);
    expect(kasa.acik).toBe(false);
    expect(kasa.suresiDoldu).toBe(true);
    expect(() => kasa.etkinlik()).toThrow(/kilitlendi/);
    await expect(kasa.kaydet([])).rejects.toThrow(/kilitlendi/);
  });
  it('kayıt devam ederken kilitlenirse geç gelen sonuç yeniden açamaz veya yazamaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    const onceki = JSON.stringify(depo.veri);
    const yazma = kasa.kaydet([cari]);
    kasa.kilitle();
    await expect(yazma).rejects.toThrow(/kilitlendi/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
    expect(kasa.acik).toBe(false);
  });
  it('saat geri alınırsa eski oturumu açık tutmaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 60_000);
    expect(kasa.acik).toBe(false);
    expect(() => kasa.yedek()).toThrow(/kilitlendi/);
  });
  it('açma işlemi sırasında kilitlenirse anahtar sonradan etkinleşmez', async () => {
    const kasa = new PosKasasi();
    const acilis = kasa.ac(parola, true);
    kasa.kilitle();
    await expect(acilis).rejects.toThrow(/kilitlendi/);
    expect(kasa.acik).toBe(false);
    expect(depo.veri).toBeUndefined();
  });
  it('var olan kasayı oluşturma isteğiyle sıfırlamaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    await kasa.kaydet([cari]);
    const onceki = JSON.stringify(depo.veri);
    await expect(new PosKasasi().ac(yeniParola, true)).rejects.toThrow(/zaten var/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
  });
  it('çift kayıt isteğinin ikincisini reddeder', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    const ilk = kasa.kaydet([cari]);
    await expect(kasa.kaydet([])).rejects.toThrow(/bitmesini bekleyin/);
    await ilk;
    expect((await new PosKasasi().ac(parola, false)).cariler).toEqual([cari]);
  });
  it('parola değişince eski parola açamaz; eski yedek eski parolayla açılır', async () => {
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    await kasa.kaydet([cari]);
    const yedek = await kasa.yedekle(parola);
    await kasa.parolaDegistir(yeniParola);
    await expect(new PosKasasi().ac(parola, false)).rejects.toThrow(/Parola yanlış/);
    expect((await new PosKasasi().ac(yeniParola, false)).cariler).toEqual([cari]);
    expect((await kasa.yedektenEkle(yedek, parola)).cariler).toEqual([cari]);
  });
  it('yedek farklı kasaya eklenir; yedek parolası mevcut kasanın parolası olmaz', async () => {
    const a = new PosKasasi();
    await a.ac(parola, true);
    await a.kaydet([cari]);
    const yedek = await a.yedekle(parola);
    depo.veri = undefined;
    const b = new PosKasasi();
    await b.ac(yeniParola, true);
    expect((await b.yedektenEkle(yedek, parola)).cariler).toEqual([cari]);
    expect((await new PosKasasi().ac(yeniParola, false)).cariler).toEqual([cari]);
    await expect(new PosKasasi().ac(parola, false)).rejects.toThrow(/Parola yanlış/);
  });
  it('çelişkili yedek ve yanlış yedek parolası listeyi değiştirmez', async () => {
    const tuz = yeniTuz();
    const k = await kasaAnahtari(parola, tuz);
    const y = await kasaSifrele({ surum: 1, cariler: [{ ...cari, ad: 'Farklı Yapay Cari' }] }, k, tuz);
    const bayt = new TextEncoder().encode(JSON.stringify(y));
    const kasa = new PosKasasi();
    await kasa.ac(parola, true);
    await kasa.kaydet([cari]);
    const onceki = JSON.stringify(depo.veri);
    await expect(kasa.yedektenEkle(bayt, yeniParola)).rejects.toThrow(/Parola yanlış/);
    await expect(kasa.yedektenEkle(bayt, parola)).rejects.toThrow(/çelişen/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
  });
});

describe('Cihaza bağlı PIN ve taşınabilir yedek', () => {
  it('başka sekmede değişen listeyi eski oturumdan yedek olarak sunmaz', async () => {
    const a = new PosKasasi();
    const b = new PosKasasi();
    await a.ac('0274', true);
    await b.ac('0274', false);
    await a.kaydet([cari]);
    await expect(b.yedekle(parola)).rejects.toThrow(/başka sekmede değişti/);
    expect(b.acik).toBe(false);
  });
  it('güvensiz bağlantıda veya eksik Web Crypto ile boş kasa oluşturmayı sunmaz', async () => {
    vi.stubGlobal('isSecureContext', false);
    await expect(posKasaVar()).rejects.toThrow(/güvenli bağlantı/);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('crypto', undefined);
    await expect(posKasaVar()).rejects.toThrow(/desteklemiyor/);
    expect(depo.veri).toBeUndefined();
  });
  it('baştaki sıfırlı dört rakamlık PIN ile açılır; cihaz anahtarı dışa aktarılamaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac('0274', true);
    await kasa.kaydet([cari]);
    const z = posZarfiDogrula(depo.veri);
    expect(z.surum).toBe(2);
    const cihaz = depo.ek.get('sanal-pos-cihaz-' + z.cihaz) as CryptoKey;
    expect(cihaz.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', cihaz)).rejects.toThrow();
    kasa.kilitle();
    expect((await kasa.ac('0274', false)).cariler).toEqual([cari]);
    await expect(kasaAnahtari('0274', z.tuz)).rejects.toThrow(/14/);
  });
  it('cihaz anahtarı kayıpsa kasayı sıfırlamaz; kopyalanan yerel zarf yedek sayılmaz', async () => {
    const kasa = new PosKasasi();
    await kasa.ac('0274', true);
    const onceki = JSON.stringify(depo.veri);
    expect(() => posYedegiOku(new TextEncoder().encode(onceki))).toThrow(/geçerli/);
    depo.ek.clear();
    await expect(new PosKasasi().ac('0274', false)).rejects.toThrow(/anahtarı bulunamadı/);
    expect(JSON.stringify(depo.veri)).toBe(onceki);
  });
  it('yedek cihaz sırrını taşımaz; ayrı uzun parolayla başka PIN kasasına alınır', async () => {
    const kasa = new PosKasasi();
    await kasa.ac('0274', true);
    await kasa.kaydet([cari]);
    await expect(kasa.yedekle('0274')).rejects.toThrow(/14/);
    const yedek = await kasa.yedekle(parola);
    const z = posYedegiOku(yedek);
    expect(z.surum).toBe(1);
    expect(z.cihaz).toBeUndefined();
    await expect(kasaAnahtari('0274', z.tuz)).rejects.toThrow(/14/);
    depo.veri = undefined;
    depo.ek.clear();
    const ikinci = new PosKasasi();
    await ikinci.ac('7513', true);
    expect((await ikinci.yedektenEkle(yedek, parola)).cariler).toEqual([cari]);
    expect((await new PosKasasi().ac('7513', false)).cariler).toEqual([cari]);
  });
  it('eski v1 kasa ve yedek korunur; PIN değişikliği mevcut carileri v2 biçimine taşır', async () => {
    const tuz = yeniTuz();
    const k = await kasaAnahtari(parola, tuz);
    depo.veri = await kasaSifrele({ surum: 1, cariler: [cari] }, k, tuz);
    const eskiYedek = new TextEncoder().encode(JSON.stringify(depo.veri));
    const kasa = new PosKasasi();
    expect((await kasa.ac(parola, false)).cariler).toEqual([cari]);
    await kasa.parolaDegistir('0274');
    expect(posZarfiDogrula(depo.veri).surum).toBe(2);
    expect((await kasa.yedektenEkle(eskiYedek, parola)).cariler).toEqual([cari]);
    expect((await new PosKasasi().ac('0274', false)).cariler).toEqual([cari]);
  });
  it('beş yanlış denemeden sonra yeni oturum da bekler; doğru açılış sayacı temizler', async () => {
    const kasa = new PosKasasi();
    await kasa.ac('0274', true);
    const simdi = Date.now();
    const saat = vi.spyOn(Date, 'now').mockReturnValue(simdi);
    for (let i = 0; i < 5; i++)
      await expect(new PosKasasi().ac('1235', false)).rejects.toThrow(/Parola yanlış/);
    await expect(new PosKasasi().ac('0274', false)).rejects.toThrow(/Bir dakika/);
    saat.mockReturnValue(simdi + 60_001);
    await new PosKasasi().ac('0274', false);
    expect([...depo.ek.keys()].filter((k) => k.startsWith('sanal-pos-deneme-'))).toEqual([]);
  });
  it('PIN değişiminde eski cihaz anahtarı silinir; başarısız yazı ikisini de korur', async () => {
    const kasa = new PosKasasi();
    await kasa.ac('0274', true);
    const eski = posZarfiDogrula(depo.veri);
    depo.yazmaHatasi = true;
    await expect(kasa.parolaDegistir('7513')).rejects.toThrow(/tamamlanmadı/);
    expect(depo.veri).toEqual(eski);
    expect(depo.ek.has('sanal-pos-cihaz-' + eski.cihaz)).toBe(true);
    expect(depo.ek.size).toBe(1);
    depo.yazmaHatasi = false;
    await kasa.ac('0274', false);
    await kasa.parolaDegistir('7513');
    expect(depo.ek.has('sanal-pos-cihaz-' + eski.cihaz)).toBe(false);
    expect(depo.ek.size).toBe(1);
  });
  it('yanıt vermeyen şifreleme durdurulur; geç gelen anahtar kasayı oluşturamaz', async () => {
    vi.useFakeTimers();
    const gercek = crypto.subtle.deriveKey.bind(crypto.subtle);
    let sonuc!: (k: CryptoKey) => void;
    let basladi!: () => void;
    const hazir = new Promise<void>((coz) => {
      basladi = coz;
    });
    const k = await gercek(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations: 1 },
      await crypto.subtle.importKey('raw', new Uint8Array(16), 'PBKDF2', false, ['deriveKey']),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    vi.spyOn(crypto.subtle, 'deriveKey').mockImplementation(() => {
      basladi();
      return new Promise<CryptoKey>((coz) => {
        sonuc = coz;
      });
    });
    const kasa = new PosKasasi();
    const acilis = kasa.ac('0274', true);
    const reddedildi = expect(acilis).rejects.toThrow(/beklenenden uzun/);
    await hazir;
    await vi.advanceTimersByTimeAsync(POS_BEKLEME_SURESI + 1);
    await reddedildi;
    sonuc(k);
    await Promise.resolve();
    expect(kasa.acik).toBe(false);
    expect(depo.veri).toBeUndefined();
    vi.restoreAllMocks();
    vi.useRealTimers();
    await kasa.ac('0274', true);
    expect(kasa.acik).toBe(true);
  });
});
