import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe('IndexedDB bekleme ve geç sonuç sınırları', () => {
  it('açılış beklemesi biter; geç gelen bağlantı kapanır ve yeni deneme engellenmez', async () => {
    vi.useFakeTimers();
    const kapat = vi.fn();
    const istekler: { onsuccess?: () => void; result: { close: () => void } }[] = [];
    vi.stubGlobal('indexedDB', {
      open: () => {
        const istek = { result: { close: kapat } };
        istekler.push(istek);
        return istek;
      },
    });
    const idb = await import('../../src/platform/idb');
    const ilk = expect(idb.okuKesin('a')).rejects.toThrow(/zamanında/);
    await vi.advanceTimersByTimeAsync(idb.DEPO_ACILIS_SURESI);
    await ilk;
    const ikinci = expect(idb.okuKesin('a')).rejects.toThrow(/zamanında/);
    expect(istekler.length).toBe(2);
    istekler[0]?.onsuccess?.();
    expect(kapat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(idb.DEPO_ACILIS_SURESI);
    await ikinci;
  });
  it('sonuçlanmayan aktarımı iptal eder; geç başarı yazı sayılmaz', async () => {
    vi.useFakeTimers();
    const aktarim = {
      oncomplete: null as (() => void) | null,
      abort: vi.fn(),
      objectStore: () => ({ put: () => ({ result: 'a' }) }),
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const istek = { onsuccess: null as (() => void) | null, result: { transaction: () => aktarim } };
        queueMicrotask(() => istek.onsuccess?.());
        return istek;
      },
    });
    const idb = await import('../../src/platform/idb');
    const yazma = idb.yaz('a', 'b');
    await vi.advanceTimersByTimeAsync(idb.DEPO_ISLEM_SURESI + 1);
    expect(await yazma).toBe(false);
    expect(aktarim.abort).toHaveBeenCalledTimes(1);
    aktarim.oncomplete?.();
    expect(await yazma).toBe(false);
  });
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
