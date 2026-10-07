import { afterEach, describe, expect, it, vi } from 'vitest';
import { POS_GIRIS_ADRESI, posBilgisiniKopyala, posCariyleGirisYap } from '../../src/platform/posGiris';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function formOrtami() {
  vi.useFakeTimers();
  class Alan {
    type = '';
    name = '';
    value = '';
  }
  const form = {
    method: '',
    action: '',
    target: '',
    rel: '',
    acceptCharset: '',
    autocomplete: '',
    hidden: false,
    elements: [] as Alan[],
    append(alan: Alan) {
      this.elements.push(alan);
    },
    submit: vi.fn(),
    remove: vi.fn(),
  };
  const ekle = vi.fn();
  const olustur = vi.fn((tur: string) => (tur === 'form' ? form : new Alan()));
  vi.stubGlobal('HTMLInputElement', Alan);
  vi.stubGlobal('document', { createElement: olustur, body: { append: ekle } });
  vi.stubGlobal('window', { setTimeout });
  return { form, ekle, olustur };
}

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
  it('seçili carinin bilgilerini sabit HTTPS giriş adresine yalnızca POST gövdesinde gönderir', () => {
    const { form, ekle } = formOrtami();
    posCariyleGirisYap({ numara: '0123456789' });
    expect(form.method).toBe('post');
    expect(form.action).toBe(POS_GIRIS_ADRESI);
    expect(form.target).toBe('_blank');
    expect(form.rel).toBe('noopener noreferrer');
    expect(form.hidden).toBe(true);
    expect(Object.fromEntries(form.elements.map((a) => [a.name, a.value]))).toEqual({
      __VIEWSTATE: '',
      lvergino: '0123456789',
      lkullaniciadi: '0123456789',
      lsifre: '0189',
      btngiris: 'Giriş Yap',
    });
    expect(form.elements.every((a) => a.type === 'hidden')).toBe(true);
    expect(ekle).toHaveBeenCalledExactlyOnceWith(form);
    expect(form.submit).toHaveBeenCalledTimes(1);
    expect(form.remove).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(form.elements.every((a) => a.value === '')).toBe(true);
    expect(form.remove).toHaveBeenCalledTimes(1);
    expect(form.submit).toHaveBeenCalledTimes(1);
  });
  it('cariye özel lisans numarası ve şifre varsa onlar gönderilir', () => {
    const { form } = formOrtami();
    posCariyleGirisYap({ numara: '0123456789', girisKullanici: 'L77', girisSifresi: 'yapay' });
    expect(Object.fromEntries(form.elements.map((a) => [a.name, a.value]))).toMatchObject({
      lvergino: '0123456789',
      lkullaniciadi: 'L77',
      lsifre: 'yapay',
    });
  });
  it('geçersiz cari numarası için form oluşturmaz veya giriş denemez', () => {
    const { olustur } = formOrtami();
    expect(() => posCariyleGirisYap({ numara: '=gecersiz' })).toThrow(/numara/);
    expect(olustur).not.toHaveBeenCalled();
  });
  it('giriş başlatılamazsa geçici bilgileri temizler; ham hata ve sırları göstermez', () => {
    const { form } = formOrtami();
    form.submit.mockImplementation(() => {
      throw new Error('hassas-metin');
    });
    expect(() => posCariyleGirisYap({ numara: '00000000001' })).toThrow(/elle yazabilirsiniz/);
    expect(form.elements.every((a) => a.value === '')).toBe(true);
    expect(form.remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
