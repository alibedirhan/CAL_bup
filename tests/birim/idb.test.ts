import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('IndexedDB aktarım doğrulaması', () => {
  it('kesin okumada depo hatasını iletir; rapor okuması önceki toleranslı davranışı korur', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('Depo kapalı');
      },
    });
    const idb = await import('../../src/platform/idb');
    await expect(idb.okuKesin('hassas-kayit')).rejects.toThrow(/kapalı/);
    expect(await idb.oku('rapor')).toBeUndefined();
  });
  it('istek başarılı olup aktarım iptal olursa yazılmış saymaz', async () => {
    const aktarim = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: new Error('Kota'),
      objectStore: () => ({ put: () => ({ result: 'anahtar' }) }),
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const ac = {
          onsuccess: null as (() => void) | null,
          result: {
            transaction: () => {
              setTimeout(() => aktarim.onabort?.(), 0);
              return aktarim;
            },
          },
        };
        queueMicrotask(() => ac.onsuccess?.());
        return ac;
      },
    });
    const idb = await import('../../src/platform/idb');
    expect(await idb.yaz('deneme', 'veri')).toBe(false);
  });
  it('yazma ancak aktarım tamamlanınca başarılı olur', async () => {
    let tamamla = () => {};
    vi.stubGlobal('indexedDB', {
      open: () => {
        const ac = {
          onsuccess: null as (() => void) | null,
          result: {
            transaction: () => {
              const aktarim = {
                oncomplete: null as (() => void) | null,
                objectStore: () => ({ put: () => ({ result: 'anahtar' }) }),
              };
              tamamla = () => aktarim.oncomplete?.();
              return aktarim;
            },
          },
        };
        queueMicrotask(() => ac.onsuccess?.());
        return ac;
      },
    });
    const idb = await import('../../src/platform/idb');
    let bitti = false;
    const yazma = idb.yaz('a', 'b').then((s) => {
      bitti = true;
      return s;
    });
    await new Promise((coz) => setTimeout(coz, 0));
    expect(bitti).toBe(false);
    tamamla();
    expect(await yazma).toBe(true);
  });
  it('ilk açılış hata verse bile sonraki işlem yeniden açmayı dener', async () => {
    const ac = vi.fn(() => {
      throw new Error('Depo kapalı');
    });
    vi.stubGlobal('indexedDB', { open: ac });
    const idb = await import('../../src/platform/idb');
    expect(await idb.yaz('a', 1)).toBe(false);
    expect(await idb.yaz('a', 2)).toBe(false);
    expect(ac).toHaveBeenCalledTimes(2);
  });
});
