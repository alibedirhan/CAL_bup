import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PosProfilDeposu,
  PROFIL_ANAHTAR_ONEKI,
  PROFIL_DEPO_ANAHTARI,
  PROFIL_BEKLEME_SURESI,
} from '../../src/platform/posProfilDeposu';
import {
  profilYedeginiAc,
  profilZarfiDogrula,
  profilCoz,
  yeniProfilAnahtari,
  profilSifrele,
  EN_BUYUK_PROFIL_YEDEGI,
} from '../../src/platform/posProfilSifreleme';
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
    },
  ],
};
beforeEach(() => {
  depo.veri.clear();
  depo.okumaHatasi = false;
  depo.yazmaHatasi = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('PIN’siz gerçek şifreli profil deposu', () => {
  it('geçiş öncesi eski cari yedeği ayrı uzun parolayla alınır; yerel kasa değiştirilmez', async () => {
    const old = new PosKasasi();
    await old.ac('0123', true);
    await old.kaydet([cari]);
    old.kilitle();
    const zarf = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    const d = new PosProfilDeposu();
    const b = await d.eskiYedekle('0123', parola);
    expect(await profilYedeginiAc(b, parola)).toEqual({ surum: 2, cariler: [cari], kartlar: [] });
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(zarf);
    expect(await d.ac()).toEqual({ eski: true });
  });
  it('PIN olmadan oluşturulur/açılır; kalıcı zarf ve yedek açık numara/telefon taşımaz', async () => {
    const d = new PosProfilDeposu();
    expect((await d.ac()).eski).toBe(false);
    await d.kaydet(veri);
    const z = profilZarfiDogrula(depo.veri.get(PROFIL_DEPO_ANAHTARI));
    const k = depo.veri.get(PROFIL_ANAHTAR_ONEKI + z.kimlik) as CryptoKey;
    expect(k.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', k)).rejects.toThrow();
    const yedek = await d.yedekle(parola);
    for (const s of [cari.numara, veri.kartlar[0]?.numara ?? '', veri.kartlar[0]?.telefon ?? '', parola]) {
      expect(JSON.stringify(z)).not.toContain(s);
      expect(new TextDecoder().decode(yedek)).not.toContain(s);
    }
    d.kapat();
    expect(await new PosProfilDeposu().ac()).toEqual({ eski: false, veri });
    expect(await profilYedeginiAc(yedek, parola)).toEqual(veri);
    await expect(profilYedeginiAc(yedek, 'farkli-yapay-yedek-parolasi')).rejects.toThrow(/parola yanlış/);
  });
  it('iki sekmede eski veri yazılamaz; eski veri yedeklenemez', async () => {
    const a = new PosProfilDeposu();
    const b = new PosProfilDeposu();
    await a.ac();
    await b.ac();
    await a.kaydet(veri);
    const onceki = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    await expect(b.yedekle(parola)).rejects.toThrow(/başka sekmede/);
    await expect(b.kaydet({ surum: 2, cariler: [], kartlar: [] })).rejects.toThrow(/başka sekmede/i);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(onceki);
  });
  it('kaybolan anahtar, bozuk zarf veya okuma hatası mevcut veriyi sıfırlamaz', async () => {
    const d = new PosProfilDeposu();
    await d.ac();
    await d.kaydet(veri);
    const z = profilZarfiDogrula(depo.veri.get(PROFIL_DEPO_ANAHTARI));
    depo.veri.delete(PROFIL_ANAHTAR_ONEKI + z.kimlik);
    await expect(new PosProfilDeposu().ac()).rejects.toThrow(/anahtarı/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(z);
    depo.okumaHatasi = true;
    await expect(new PosProfilDeposu().ac()).rejects.toThrow(/okunamadı/);
    depo.okumaHatasi = false;
    depo.veri.set(PROFIL_DEPO_ANAHTARI, { ...z, cvv: 'yapay' });
    await expect(new PosProfilDeposu().ac()).rejects.toThrow(/geçersiz/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual({ ...z, cvv: 'yapay' });
  });
  it('yazma hatası başarısızdır; önceki şifreli kayıt korunur', async () => {
    const d = new PosProfilDeposu();
    await d.ac();
    const onceki = depo.veri.get(PROFIL_DEPO_ANAHTARI);
    depo.yazmaHatasi = true;
    await expect(d.kaydet(veri)).rejects.toThrow(/tamamlanmadı/);
    expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(onceki);
    expect(d.acik).toBe(false);
  });
  it.each([1, 2])(
    'eski v%s kasa tek doğru parolayla taşınır; eski cihaz anahtarı atomik silinir',
    async (surum) => {
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
      expect(await d.ac()).toEqual({ eski: true });
      await expect(d.eskiKasayiTasi(surum === 1 ? 'farkli-yapay-yedek-parolasi' : '9999')).rejects.toThrow();
      expect(depo.veri.get(PROFIL_DEPO_ANAHTARI)).toEqual(oldZ);
      expect(await d.eskiKasayiTasi(surum === 1 ? parola : '0123')).toEqual({
        surum: 2,
        cariler: [cari],
        kartlar: [],
      });
      expect([...depo.veri.keys()].some((k) => k.startsWith('sanal-pos-cihaz-'))).toBe(false);
      expect((await new PosProfilDeposu().ac()).eski).toBe(false);
    },
  );
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
    await new PosProfilDeposu().ac();
    const onceki = new Map(depo.veri);
    await expect(new PosKasasi().ac('0123', true)).rejects.toThrow();
    expect(depo.veri).toEqual(onceki);
  });
  it('taşınabilir yedek başka cihaza kartlarıyla alınır; çelişkide tüm aktarım durur', async () => {
    const a = new PosProfilDeposu();
    await a.ac();
    await a.kaydet(veri);
    const y = await a.yedekle(parola);
    depo.veri.clear();
    const b = new PosProfilDeposu();
    await b.ac();
    expect(await b.yedektenEkle(await profilYedeginiAc(y, parola))).toEqual(veri);
    const onceki = new Map(depo.veri);
    const kart = veri.kartlar[0];
    if (!kart) throw new Error('Yapay kart eksik');
    await expect(
      b.yedektenEkle({ ...veri, kartlar: [{ ...kart, ad: 'Çelişen Yapay Kart' }] }),
    ).rejects.toThrow(/çelişen/);
    expect(depo.veri).toEqual(onceki);
  });
  it('eski taşınabilir cari yedeğini okur; yerel anahtar zarfı yedek sayılmaz', async () => {
    const tuz = yeniTuz();
    const old = await kasaSifrele({ surum: 1, cariler: [cari] }, await kasaAnahtari(parola, tuz), tuz);
    expect(await profilYedeginiAc(new TextEncoder().encode(JSON.stringify(old)), parola)).toEqual({
      surum: 2,
      cariler: [cari],
      kartlar: [],
    });
    await new PosProfilDeposu().ac();
    await expect(
      profilYedeginiAc(new TextEncoder().encode(JSON.stringify(depo.veri.get(PROFIL_DEPO_ANAHTARI))), parola),
    ).rejects.toThrow(/taşınabilir/);
    await expect(profilYedeginiAc(new Uint8Array(EN_BUYUK_PROFIL_YEDEGI + 1), parola)).rejects.toThrow(
      /2 MB/,
    );
  });
  it('metadata/IV/değer değiştirilince AES-GCM doğrulaması başarısızdır', async () => {
    const k = await yeniProfilAnahtari();
    const z = await profilSifrele(veri, k, crypto.randomUUID());
    await expect(profilCoz({ ...z, revizyon: crypto.randomUUID() }, k)).rejects.toThrow();
    await expect(profilCoz({ ...z, iv: btoa('x'.repeat(12)) }, k)).rejects.toThrow();
    expect(() => profilZarfiDogrula({ ...z, tekrar: 999999999 })).toThrow();
  });
  it('iptalden sonra geç gelen anahtar hiçbir kayıt oluşturamaz', async () => {
    const gercek = await yeniProfilAnahtari();
    let coz!: (k: CryptoKey) => void;
    const bekleyen = new Promise<CryptoKey>((r) => {
      coz = r;
    });
    vi.spyOn(crypto.subtle, 'generateKey').mockImplementation(() => bekleyen);
    const d = new PosProfilDeposu();
    const p = d.ac();
    const hata = expect(p).rejects.toThrow(/durduruldu/);
    await Promise.resolve();
    d.kapat();
    await hata;
    coz(gercek);
    await new Promise((r) => setTimeout(r, 30));
    expect(depo.veri.size).toBe(0);
    expect(d.acik).toBe(false);
  });
  it('yanıtsız işlemin süre sınırı vardır; kullanıcı yeniden kontrol edebilir', async () => {
    vi.useFakeTimers();
    vi.spyOn(crypto.subtle, 'generateKey').mockImplementation(() => new Promise(() => undefined));
    const d = new PosProfilDeposu();
    const p = expect(d.ac()).rejects.toThrow(/durduruldu/);
    await vi.advanceTimersByTimeAsync(PROFIL_BEKLEME_SURESI + 1);
    await p;
    expect(depo.veri.size).toBe(0);
  });
});
