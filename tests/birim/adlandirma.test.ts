import { tamam } from '../../src/cekirdek/islemSonucu';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KenarCubugu } from '../../src/arayuz/bilesenler/KenarCubugu';
import { AyarlarSayfasi } from '../../src/arayuz/sayfalar/AyarlarSayfasi';
import { kayitliTercih } from '../../src/arayuz/tema';
import { VARSAYILAN_AYARLAR } from '../../src/cekirdek/ayarlar';
import { ayarlariOku } from '../../src/platform/ayarlar';
import { gecmisDosyaAdi, gecmisListesi, yedekBaytlari, yedekListesi } from '../../src/platform/gecmis';
import { SURUM } from '../../src/surum';
import yapilandirma from '../../vite.config';

afterEach(() => vi.unstubAllGlobals());

describe('CAL bup adı ve yayın adresi', () => {
  it('sekme başlığı ve yayın yolu yeni adı kullanır', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<title>CAL bup</title>');
    expect(yapilandirma).toMatchObject({ base: '/CAL_bup/' });
  });

  it('kenar çubuğu CAL bup adını, C harfini ve güncel sürümü gösterir', () => {
    const html = renderToStaticMarkup(
      createElement(KenarCubugu, {
        rota: { tur: 'rapor', id: 'depo-kontrol' },
        tema: 'sistem',
        temaDegisti: () => {},
      }),
    );
    expect(html).toContain('CAL bup');
    expect(html).toContain('aria-hidden="true">C</span>');
    expect(html).toContain(`Sürüm ${SURUM}`);
    expect(html).not.toContain('BUP Rapor');
  });

  it('ayarlar yeni GitHub deposuna bağlantı verir', () => {
    const html = renderToStaticMarkup(
      createElement(AyarlarSayfasi, {
        tema: 'sistem',
        temaDegisti: () => {},
        ayarlar: VARSAYILAN_AYARLAR,
        ayarDegisti: () => tamam(undefined, '', { kapsam: 'ayarlar', islemId: 1 }),
      }),
    );
    expect(html).toContain('href="https://github.com/alibedirhan/CAL_bup"');
    expect(html).not.toContain('Bup_Excel_Rapor');
  });

  it('geçmiş indirmesi yeni adı ve Türkçe tarihi kullanır', () => {
    expect(gecmisDosyaAdi(new Date(2026, 9, 1))).toBe('CAL bup geçmişi 01.10.2026.csv');
  });
});

describe('ad değişikliğinde tarayıcı kayıtları', () => {
  it('eski adla saklanan tema ve ayarlar okunmaya devam eder', () => {
    const kayitlar = new Map([
      ['bup-rapor:tema', 'koyu'],
      ['bup-rapor:ayarlar', JSON.stringify({ tolerans: 0.005 })],
    ]);
    vi.stubGlobal('localStorage', { getItem: (anahtar: string) => kayitlar.get(anahtar) ?? null });
    expect(kayitliTercih()).toBe('koyu');
    expect(ayarlariOku()).toEqual({ ...VARSAYILAN_AYARLAR, tolerans: 0.005 });
  });

  it('geçmiş ve yedekler eski IndexedDB deposundan okunmaya devam eder', async () => {
    const gecmis = [
      {
        rapor: 'depo-kontrol',
        sayfa: '01.10',
        zaman: '2026-10-01T00:00:00Z',
        dosya: 'Yapay.xlsx',
        durum: 'Tamam',
        ledStogu: 0,
        depoSayimi: 0,
        gelenMal: 0,
        uyariSayisi: 0,
        aciklama: '',
        kayit: 'indirildi',
      },
    ];
    const yedekler = [
      { id: 'deneme', dosyaAdi: 'Sentetik depo kontrol.xlsx', zaman: '2026-10-01T00:00:00Z' },
    ];
    const bayt = new Uint8Array([1, 2, 3]);
    const kayitlar = new Map<string, unknown>([
      ['gecmis', gecmis],
      ['yedekler', yedekler],
      ['yedek:deneme', bayt],
    ]);
    const istek = (sonuc: unknown) => {
      const sonucIstegi = { result: sonuc, onsuccess: null as (() => void) | null };
      queueMicrotask(() => sonucIstegi.onsuccess?.());
      return sonucIstegi;
    };
    const depoAc = vi.fn(() =>
      istek({
        transaction: () => {
          const aktarim = {
            oncomplete: null as (() => void) | null,
            objectStore: () => ({ get: (anahtar: string) => istek(kayitlar.get(anahtar)) }),
          };
          queueMicrotask(() => aktarim.oncomplete?.());
          return aktarim;
        },
      }),
    );
    vi.stubGlobal('indexedDB', { open: depoAc });
    expect(await gecmisListesi()).toEqual(gecmis);
    expect(await yedekListesi()).toEqual(yedekler);
    expect(await yedekBaytlari('deneme')).toEqual(bayt);
    expect(depoAc).toHaveBeenCalledWith('bup-rapor', 1);
  });
});
