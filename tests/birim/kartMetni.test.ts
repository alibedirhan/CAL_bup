import { it, expect } from 'vitest';
import { kartMetnindenAlanlar } from '../../src/cekirdek/posKartFotografi';
for (const [ad, metin] of [
  ['iki satır PAN', '4242 4242\n4242 4242\n12/35'],
  ['aynı satır tarih', '4242 4242 4242 4242 12/35'],
  ['tek rakam ay', '4242 4242 4242 4242\n1/35'],
  ['etiketli bitişik tarih', '4242 4242 4242 4242\nVALID THRU 1235'],
] as const)
  it(ad + ' bağlamı kaybetmeden ayrılır', () => {
    const s = kartMetnindenAlanlar(metin);
    expect(s.numaralar).toEqual(['4242424242424242']);
    expect(s.tarihler).toEqual([{ ay: ad === 'tek rakam ay' ? '01' : '12', yil: '2035' }]);
  });
it('etiketsiz dört rakam tarih sayılmaz; numara/CVV/telefon satırları birleştirilmez', () => {
  expect(kartMetnindenAlanlar('1235\n123\n05000000000')).toEqual({ numaralar: [], tarihler: [] });
  expect(kartMetnindenAlanlar('4242424242424241\n12/35').numaralar).toEqual([]);
});
it('farklı tarihler seçim için korunur; yinelenenler bir defa sunulur', () => {
  expect(kartMetnindenAlanlar('09/24 12 / 2035 12/35').tarihler).toEqual([
    { ay: '09', yil: '2024' },
    { ay: '12', yil: '2035' },
  ]);
});
it('PAN ve kısa güvenlik kodu birleşimi Luhn geçse de OCR kart adayı olmaz', () => {
  // Yapay PAN + 105 tesadüfen 19 haneli Luhn kontrolünü geçer; CVV çıkarılmaz.
  expect(kartMetnindenAlanlar('4242 4242 4242 4242 105\n12/35').numaralar).toEqual([]);
  expect(kartMetnindenAlanlar('4242424242424242105\n12/35').numaralar).toEqual([]);
  expect(kartMetnindenAlanlar('4242 4242 4242 4242 CVV 105\n12/35').numaralar).toEqual(['4242424242424242']);
});
