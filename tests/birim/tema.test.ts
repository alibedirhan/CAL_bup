import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { temaOzniteligi, tercihCoz } from '../../src/arayuz/tema';

describe('tema tercihi', () => {
  it('geçersiz ya da boş değerde sistem ayarını izler', () => {
    expect(tercihCoz(null)).toBe('sistem');
    expect(tercihCoz('mor')).toBe('sistem');
    expect(tercihCoz('koyu')).toBe('koyu');
  });

  it('sistem seçiliyken data-theme konmaz', () => {
    expect(temaOzniteligi('sistem')).toBeNull();
    expect(temaOzniteligi('acik')).toBe('light');
    expect(temaOzniteligi('koyu')).toBe('dark');
  });
});

describe('tema.css', () => {
  const css = readFileSync(new URL('../../src/arayuz/stiller/tema.css', import.meta.url), 'utf8');

  const blok = (baslangic: string): Map<string, string> => {
    const i = css.indexOf(baslangic);
    expect(i, `${baslangic} bulunamadı`).toBeGreaterThanOrEqual(0);
    const govde = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
    return new Map(
      [...govde.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]),
    );
  };

  it('iki koyu tema bloğu birebir aynı', () => {
    expect(blok(":root:not([data-theme='light'])")).toEqual(blok(":root[data-theme='dark']"));
  });

  it('koyu temadaki her belirteç açık temada da tanımlı', () => {
    const acik = blok(':root {');
    for (const ad of blok(":root[data-theme='dark']").keys()) {
      expect(acik.has(ad), `${ad} açık temada yok`).toBe(true);
    }
  });
});
