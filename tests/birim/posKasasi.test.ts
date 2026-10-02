import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POS_BOSTA_SURESI, PosKasasi, posKasaVar } from '../../src/platform/posKasasi';
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

const depo = vi.hoisted(() => ({ veri: undefined as unknown, hata: false, yazmaHatasi: false }));
vi.mock('../../src/platform/idb', () => ({
  okuKesin: async () => {
    if (depo.hata) throw new Error('Kapalı');
    return depo.veri;
  },
  guncelle: async (_: string, degistir: (onceki: unknown) => unknown) => {
    if (depo.yazmaHatasi) return false;
    try {
      depo.veri = degistir(depo.veri);
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
  depo.hata = false;
  depo.yazmaHatasi = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Sanal POS gerçek şifreleme ve kasa sınırları', () => {
  it.each(['1234', ' '.repeat(20), 'a'.repeat(129)])('kısa veya geçersiz kasa parolasını reddeder', (p) => {
    expect(() => kasaParolasiDogrula(p)).toThrow(/14–128/);
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
    const yedek = new TextDecoder().decode(kasa.yedek());
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
    for (const degisiklik of [{ tekrar: 2_000_000_000 }, { surum: 2 }, { tuz: 'x' }, { cvv: 'istenmeyen' }]) {
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
  it('beş dakika boşta kalınca anahtar kullanılamaz; etkinlik eski oturumu diriltmez', async () => {
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
    await expect(acilis).rejects.toThrow(/iptal edildi/);
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
    const yedek = kasa.yedek();
    await kasa.parolaDegistir(yeniParola);
    await expect(new PosKasasi().ac(parola, false)).rejects.toThrow(/Parola yanlış/);
    expect((await new PosKasasi().ac(yeniParola, false)).cariler).toEqual([cari]);
    expect((await kasa.yedektenEkle(yedek, parola)).cariler).toEqual([cari]);
  });
  it('yedek farklı kasaya eklenir; yedek parolası mevcut kasanın parolası olmaz', async () => {
    const a = new PosKasasi();
    await a.ac(parola, true);
    await a.kaydet([cari]);
    const yedek = a.yedek();
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
