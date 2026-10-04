import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { tarih } from '../../src/cekirdek/tarih';
import { diziSayfa } from '../../src/kaynaklar/kitap';
import { hedefTarihleri } from '../../src/raporlar/depoKontrol/hedefTarihleri';
import { azalt, BOS_OTURUM, turet, type HedefDosya } from '../../src/raporlar/depoKontrol/oturum';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';

const bugun = tarih(2026, 10, 4);
const sayfa = (ad: string, a: string | Date | null = null, c = a) => diziSayfa(ad, [[], [], [a, null, c]]);

describe('dosya yılının kanıtı', () => {
  it('eski yıl kitabını gün başlığından okur; bugüne çekmez', () => {
    const s = hedefTarihleri([sayfa('28.09', '28.09.2023 LED'), sayfa('29.09', '29.09.2023 SAYIM')], bugun);
    expect(s.yilKaynagi).toBe('baslik');
    expect(s.gunler.at(-1)?.tarih).toBe(tarih(2023, 9, 29));
  });
  it('gerçek tarih hücresini de yıl kanıtı sayar', () => {
    expect(hedefTarihleri([sayfa('29.09', new Date(2024, 8, 29))], bugun).gunler[0]?.tarih).toBe(
      tarih(2024, 9, 29),
    );
  });
  it('başlıksız dosyada yıl tahmini açık onay bekler', () => {
    expect(hedefTarihleri([sayfa('29.09')], bugun).yilKaynagi).toBe('tahmin');
    const s = hedefTarihleri([sayfa('29.09')], bugun, 2022);
    expect(s.yilKaynagi).toBe('onay');
    expect(s.gunler[0]?.tarih).toBe(tarih(2022, 9, 29));
  });
  it('yanlış eski başlığı dosya yılı kanıtı saymaz; eski sayfayı değiştirmez', () => {
    const eski = sayfa('28.09', '28.09.2025 LED');
    const s = hedefTarihleri([eski, sayfa('29.09', '29.09.2026 LED')], bugun);
    expect(s.yilKaynagi).toBe('tahmin');
    expect(s.gunler[0]?.tarih).toBe(tarih(2026, 9, 28));
    expect(eski.hucre(3, 1)).toBe('28.09.2025 LED');
  });
  it('son günün geçerli başlık yılını elle başka yıla çevirmez', () => {
    expect(() => hedefTarihleri([sayfa('29.09', '29.09.2025 LED')], bugun, 2024)).toThrow(/başlık yılı/);
  });
  it('uyuşmayan iki başlık veya gün adı tahmine geçer', () => {
    expect(hedefTarihleri([sayfa('29.09', '29.09.2026', '29.09.2025')], bugun).yilKaynagi).toBe('tahmin');
    expect(hedefTarihleri([sayfa('29.09', '28.09.2026')], bugun).yilKaynagi).toBe('tahmin');
  });
  it('yıl geçişini kurar; bütün yılı içeren kitabın ocak sayfasını eski yıla atmaz', () => {
    const s = hedefTarihleri([sayfa('31.12'), sayfa('01.01')], bugun, 2026);
    expect(s.gunler.map((g) => g.tarih)).toEqual([tarih(2025, 12, 31), tarih(2026, 1, 1)]);
    expect(hedefTarihleri([sayfa('02.01'), sayfa('29.12')], bugun, 2025).gunler[0]?.tarih).toBe(
      tarih(2025, 1, 2),
    );
  });
  it.each([1899, 9999, 2026.5, NaN])('geçersiz son yılı reddeder: %s', (y) => {
    expect(() => hedefTarihleri([sayfa('29.09')], bugun, y)).toThrow(/Dosya yılı/);
  });
  it('artık yıl, tekrarlı gün ve ters sekme sırası korunur', () => {
    expect(hedefTarihleri([sayfa('29.02'), sayfa('29.09')], bugun)).toMatchObject({
      yilKaynagi: 'tahmin',
      gunler: [{ tarih: '2024-02-29' }, { tarih: '2024-09-29' }],
    });
    expect(() => hedefTarihleri([sayfa('29.02')], bugun, 2025)).toThrow(/geçerli değil/);
    expect(() => hedefTarihleri([sayfa('29.09'), sayfa('29.09 DEPO')], bugun, 2025)).toThrow(/aynı günü/);
    expect(() => hedefTarihleri([sayfa('29.09'), sayfa('28.09')], bugun, 2025)).toThrow(/sırası/);
  });
  it('yıl değişimi bütün eski onayları düşürür; tekrar kontrol edilmeden ilerlemez', () => {
    const sayfalar = [sayfa('28.09'), sayfa('29.09')];
    const bilgi = {
      ...hedefTarihleri(sayfalar, bugun),
      son: { ad: '29.09', tarih: tarih(2026, 9, 29) },
      oneri: tarih(2026, 9, 30),
    };
    const hedef: HedefDosya = {
      ad: 'Yapay.xlsx',
      bayt: new Uint8Array(),
      sonDegisiklik: 0,
      bilgi,
      acik: { kitap: { sayfalar, dosyaAdi: 'Yapay.xlsx', olusturulma: null }, excel: new ExcelJS.Workbook() },
    };
    let o = azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef });
    expect(turet(o, AYAR, bugun).yilOnayiGerekli).toBe(true);
    o = azalt(o, { tur: 'yilOnaylandi' });
    expect(turet(o, AYAR, bugun).tarih).toBe(tarih(2026, 9, 30));
    o = { ...o, mevcutOnayi: true, onaylananTarihler: ['D01'] };
    o = azalt(o, { tur: 'yilDegisti', girdi: '2023' });
    expect(o.mevcutOnayi).toBe(false);
    expect(o.onaylananTarihler).toEqual([]);
    expect(o.hedef?.onayliSonYil).toBeUndefined();
    expect(turet(o, AYAR, bugun).secim).toBeNull();
    o = azalt(o, { tur: 'yilOnaylandi' });
    expect(o.hedef?.onayliSonYil).toBe(2023);
    expect(turet(o, AYAR, bugun).tarih).toBe(tarih(2023, 9, 30));
  });
});
