import { afterEach, it, expect, vi } from 'vitest';
import { IslemOturumu } from '../../src/platform/islemOturumu';
import { dosyayaYaz } from '../../src/platform/dosya';
import { hataSonucu, IslemHatasi } from '../../src/cekirdek/islemSonucu';
afterEach(() => vi.useRealTimers());
it('çift tıklama ikinci işi çalıştırmaz; iptal sonrasında tekrar kullanılabilir', async () => {
  const o = new IslemOturumu('yapay');
  const ilk = o.calistir(() => new Promise(() => undefined), 'hazır');
  const ikinci = vi.fn(async () => 2);
  expect(await o.calistir(ikinci, 'hazır')).toMatchObject({ kod: 'MESGUL', durum: 'dogrulama' });
  expect(ikinci).not.toHaveBeenCalled();
  o.durdur();
  expect(await ilk).toMatchObject({ durum: 'iptal', kod: 'IPTAL' });
  expect(await o.calistir(ikinci, 'hazır')).toMatchObject({ durum: 'tamam', deger: 2 });
});
it('yazı iptali başarı/geri alma sayılmaz; otomatik yeniden yazmaz', async () => {
  const o = new IslemOturumu('yapay');
  const yaz = vi.fn(() => new Promise(() => undefined));
  const p = o.calistir(yaz, 'kaydedildi', true);
  o.durdur();
  expect(await p).toMatchObject({ durum: 'belirsiz', kod: 'IPTAL' });
  expect(yaz).toHaveBeenCalledTimes(1);
});
it('zaman aşımı iptalden ayrı kod taşır ve kilidi bırakır', async () => {
  vi.useFakeTimers();
  const o = new IslemOturumu('yapay', 100);
  const p = o.calistir(() => new Promise(() => undefined), 'hazır');
  await vi.advanceTimersByTimeAsync(101);
  expect(await p).toMatchObject({ kod: 'SURE_DOLDU', durum: 'iptal' });
  expect(o.mesgul).toBe(false);
});
it('kapatılmış kapsamın geç sonucu yeni ekrana uygulanabilir kimlik taşımaz', async () => {
  const o = new IslemOturumu('yapay');
  let bitir!: (n: number) => void;
  const p = o.calistir(
    () =>
      new Promise<number>((r) => {
        bitir = r;
      }),
    'hazır',
  );
  o.kapat();
  bitir(9);
  const s = await p;
  expect(s.durum).not.toBe('tamam');
  expect(s.islemId).not.toBe(o.islemId);
});
it('ham hata ve kişisel veri sonuç metnine taşınmaz; kodlu hata bağlamını korur', () => {
  const b = { kapsam: 'yapay', islemId: 1 };
  expect(hataSonucu(new Error('4242424242424242'), b).mesaj).not.toContain('4242');
  expect(hataSonucu(new IslemHatasi('hata', 'YAPAY', 'Açıklanmış hata'), b)).toMatchObject({
    kod: 'YAPAY',
    mesaj: 'Açıklanmış hata',
  });
});
it('dosya akışı iptal edilince kapanışla kalıcı kayda geçmez', async () => {
  const c = new AbortController();
  let yazmaBitti!: () => void;
  const yazici = {
    write: vi.fn(
      () =>
        new Promise<void>((r) => {
          yazmaBitti = r;
        }),
    ),
    close: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
  const h = {
    queryPermission: async () => 'granted',
    createWritable: async () => yazici,
  } as unknown as FileSystemFileHandle;
  const p = dosyayaYaz(h, new Uint8Array([1]), c.signal);
  await vi.waitFor(() => expect(yazici.write).toHaveBeenCalled());
  c.abort();
  yazmaBitti();
  await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  expect(yazici.abort).toHaveBeenCalled();
  expect(yazici.close).not.toHaveBeenCalled();
});
