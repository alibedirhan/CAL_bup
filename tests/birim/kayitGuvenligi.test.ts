import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import { tarih } from '../../src/cekirdek/tarih';
import { kaydet, dosyalariTani } from '../../src/arayuz/sayfalar/depoKontrol/islemler';
import type { HedefDosya } from '../../src/raporlar/depoKontrol/oturum';
import type { DepoKontrolPlani } from '../../src/raporlar/depoKontrol/hesapla';
import type { GunSecimi } from '../../src/raporlar/depoKontrol/gunSecimi';
import { d01Kitap } from '../yardimci/sentetik';
const taklit = vi.hoisted(() => ({
  yedek: vi.fn(),
  gecmis: vi.fn(),
  yaz: vi.fn(),
  indir: vi.fn(),
  uygula: vi.fn(),
  ac: vi.fn(),
}));
vi.mock('../../src/platform/gecmis', () => ({ yedekAl: taklit.yedek, gecmiseEkle: taklit.gecmis }));
vi.mock('../../src/platform/dosya', async (asil) => ({
  ...(await asil<object>()),
  dosyayaYaz: taklit.yaz,
  yazmaIzni: async () => true,
  indir: taklit.indir,
}));
vi.mock('../../src/raporlar/depoKontrol/motorYukle', () => ({
  motorYukle: async () => ({
    kitapAc: taklit.ac,
    uygula: taklit.uygula,
    kitapYaz: async () => new Uint8Array([4, 5, 6]),
    hedefiIncele: () => ({}),
  }),
}));
const secim = { tur: 'yeni', ad: '02.10' } as GunSecimi;
const plan = {
  genelDurum: 'Tamam',
  bToplam: 1,
  dToplam: 1,
  gelenMal: 2,
  uyarilar: [],
  notlar: [],
} as unknown as DepoKontrolPlani;
const bugun = tarih(2026, 10, 2);
function hedef(bayt = new Uint8Array([1, 2, 3]), sonDegisiklik = 123): HedefDosya {
  return {
    ad: 'Sentetik.xlsx',
    bayt: new Uint8Array([1, 2, 3]),
    sonDegisiklik: 123,
    tanitici: { getFile: async () => new File([bayt], 'Sentetik.xlsx', { lastModified: sonDegisiklik }) },
  } as HedefDosya;
}
beforeEach(() => {
  vi.clearAllMocks();
  taklit.yedek.mockResolvedValue('yedek1');
  taklit.gecmis.mockResolvedValue(true);
  taklit.ac.mockResolvedValue({ excel: {}, kitap: d01Kitap() });
  taklit.uygula.mockReturnValue('02.10');
});
describe('dosya üzerine kayıt koruması', () => {
  it('yedek kalıcı saklanamazsa dosyanın üzerine yazmaz', async () => {
    taklit.yedek.mockResolvedValue(null);
    await expect(kaydet(hedef(), secim, plan, AYAR, bugun, 'dosyaya')).rejects.toThrow(/yedeği/);
    expect(taklit.yaz).not.toHaveBeenCalled();
  });
  it('dosya açıldıktan sonra değişmişse hesaplamadan durur', async () => {
    await expect(
      kaydet(hedef(new Uint8Array([1, 2, 3]), 124), secim, plan, AYAR, bugun, 'dosyaya'),
    ).rejects.toThrow(/değişmiş/);
    expect(taklit.uygula).not.toHaveBeenCalled();
    expect(taklit.yaz).not.toHaveBeenCalled();
  });
  it('zaman damgası aynı olsa da değişen içeriği ezmez', async () => {
    await expect(
      kaydet(hedef(new Uint8Array([1, 2, 9])), secim, plan, AYAR, bugun, 'dosyaya'),
    ).rejects.toThrow(/değişti/);
    expect(taklit.yaz).not.toHaveBeenCalled();
  });
  it('başarılı dosya kaydından sonra geçmiş kaydedilemezse dosya sonucunu korur ve uyarır', async () => {
    taklit.gecmis.mockResolvedValue(false);
    const s = await kaydet(hedef(), secim, plan, AYAR, bugun, 'dosyaya');
    expect(taklit.yaz).toHaveBeenCalledTimes(1);
    expect(s.kayit).toBe('dosyaya');
    expect(s.uyari).toMatch(/geçmiş/);
    expect(s.oncekiBayt).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('oluşan kitap yeniden açılamıyorsa yazma ve indirme yapılmaz', async () => {
    taklit.ac.mockRejectedValueOnce(new Error('Dosya bozuk'));
    await expect(kaydet(hedef(), secim, plan, AYAR, bugun, 'indir')).rejects.toThrow();
    expect(taklit.indir).not.toHaveBeenCalled();
    expect(taklit.yaz).not.toHaveBeenCalled();
  });

  it('aynı tür iki kaynak geldiğinde ilkini sessizce değiştirmez', async () => {
    const s = await dosyalariTani(
      [{ dosya: new File(['a'], 'ilk.xlsx') }, { dosya: new File(['b'], 'ikinci.xlsx') }],
      AYAR,
    );
    expect(s.kaynaklar.d01?.dosyaAdi).toBe('ilk.xlsx');
    expect(s.reddedilenler[0]?.mesaj).toMatch(/Aynı türden/);
  });
});
