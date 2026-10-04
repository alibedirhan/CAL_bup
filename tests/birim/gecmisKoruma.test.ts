import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gecmiseEkle, yedekAl, gecmisListesi, yedekListesi } from '../../src/platform/gecmis';
import { driveGecmisiUygula } from '../../src/platform/driveEsitleme';
import { VARSAYILAN_AYARLAR } from '../../src/cekirdek/ayarlar';
import type { GecmisKaydi } from '../../src/cekirdek/gecmis';
const taklit = vi.hoisted(() => ({ kayitlar: new Map<string, unknown>() }));
vi.mock('../../src/platform/idb', () => ({
  okuKesin: async (k: string) => taklit.kayitlar.get(k),
  oku: async (k: string) => taklit.kayitlar.get(k),
  guncelle: async (k: string, f: (v: unknown, d: unknown) => unknown) => {
    const gecici = new Map(taklit.kayitlar);
    try {
      const v = f(gecici.get(k), {
        put: (v: unknown, a: string) => gecici.set(a, v),
        delete: (a: string) => gecici.delete(a),
      });
      gecici.set(k, v);
      taklit.kayitlar = gecici;
      return true;
    } catch {
      return false;
    }
  },
}));
const K: GecmisKaydi = {
  zaman: '2026-10-04T00:00:00Z',
  rapor: 'Yapay',
  dosya: 'Yapay.xlsx',
  sayfa: '04.10',
  durum: 'Tamam',
  ledStogu: 1,
  depoSayimi: 1,
  gelenMal: 2,
  uyariSayisi: 0,
  aciklama: '',
  kayit: 'indirildi',
};
beforeEach(() => taklit.kayitlar.clear());
describe('bozuk kalıcı kayıt yeni yazıyla silinmez', () => {
  it.each([null, { bozuk: true }, [{ bozuk: true }]])(
    'geçmiş biçimi %j ise okuma ve ekleme durur',
    async (v) => {
      taklit.kayitlar.set('gecmis', v);
      await expect(gecmisListesi(true)).rejects.toThrow(/geçmiş/i);
      expect(await gecmiseEkle(K)).toBe(false);
      expect(taklit.kayitlar.get('gecmis')).toEqual(v);
      await expect(
        driveGecmisiUygula({ surum: 1, zaman: K.zaman, ayarlar: VARSAYILAN_AYARLAR, gecmis: [K] }),
      ).rejects.toThrow();
      expect(taklit.kayitlar.get('gecmis')).toEqual(v);
    },
  );
  it.each([null, { bozuk: true }, [{ id: '', zaman: K.zaman, dosyaAdi: K.dosya }]])(
    'bozuk yedek listesinde yeni yedek yazılmaz: %j',
    async (v) => {
      taklit.kayitlar.set('yedekler', v);
      await expect(yedekListesi(true)).rejects.toThrow(/yedek/i);
      expect(await yedekAl(K.dosya, new Uint8Array([1]))).toBeNull();
      expect(taklit.kayitlar.size).toBe(1);
      expect(taklit.kayitlar.get('yedekler')).toEqual(v);
    },
  );
  it('hatalı yeni geçmiş kaydı depoya yazılmaz', async () => {
    expect(await gecmiseEkle({ ...K, gelenMal: Infinity })).toBe(false);
    expect(taklit.kayitlar.size).toBe(0);
  });
});
