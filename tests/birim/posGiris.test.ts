import { afterEach, describe, expect, it, vi } from 'vitest';
import { POS_GIRIS_ADRESI, posBilgisiniKopyala } from '../../src/platform/posGiris';

afterEach(() => vi.unstubAllGlobals());

describe('POS giriş yardımı sınırları', () => {
  it('POS bağlantısı sabittir; sorgu veya kullanıcı bilgisi içermez', () => {
    const adres = new URL(POS_GIRIS_ADRESI);
    expect(adres.origin).toBe('https://denizpay.bupilic.com.tr');
    expect(adres.pathname).toBe('/login.aspx');
    expect(adres.search).toBe('');
    expect(adres.hash).toBe('');
    expect(adres.username).toBe('');
  });
  it('yalnızca kullanıcının istediği metni panoya yazar', async () => {
    const yaz = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: yaz } });
    await posBilgisiniKopyala('yapay-deneme');
    expect(yaz).toHaveBeenCalledExactlyOnceWith('yapay-deneme');
  });
  it('pano izni yoksa sır içermeyen elle giriş mesajı verir', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async () => {
          throw new Error('hassas-metin');
        },
      },
    });
    await expect(posBilgisiniKopyala('hassas-metin')).rejects.toThrow(/elle yazabilirsiniz/);
    await expect(posBilgisiniKopyala('hassas-metin')).rejects.not.toThrow(/hassas-metin/);
  });
});
