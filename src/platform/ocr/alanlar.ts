import type { Page } from 'tesseract.js';
import {
  kartMetnindenAlanlar,
  type KartOkumaSonucu,
  type KartAlanKaniti,
} from '../../cekirdek/posKartFotografi';
/** Ham metin, sözcükler, isim/telefon/CVV dışarı çıkmaz. Sadece doğrulanmış adayların kanıtı. */
export function okumaAlanlari(data: Page, donus: number): KartOkumaSonucu {
  const s = kartMetnindenAlanlar(data.text);
  const kanitlar: KartAlanKaniti[] = [];
  const satirlar = data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines)) ?? [];
  for (const [tur, degerler] of [
    ['numara', s.numaralar],
    ['tarih', s.tarihler.map((t) => `${t.ay}/${t.yil}`)],
  ] as const)
    for (const deger of degerler) {
      const satir = satirlar.find((l) => {
        const aday = kartMetnindenAlanlar(l.text);
        return tur === 'numara'
          ? aday.numaralar.includes(deger)
          : aday.tarihler.some((t) => `${t.ay}/${t.yil}` === deger);
      });
      const bbox = satir?.bbox;
      kanitlar.push({
        tur,
        deger,
        guven: Math.max(0, Math.min(100, satir?.confidence ?? data.confidence ?? 0)),
        donus,
        ...(bbox
          ? { bolge: { x: bbox.x0, y: bbox.y0, genislik: bbox.x1 - bbox.x0, yukseklik: bbox.y1 - bbox.y0 } }
          : {}),
      });
    }
  // Kenardan kesilmiş satırlar güvenli aday değildir: eksik rakam tamamlanmaz.
  const kesilmis = kanitlar.filter((k) => k.bolge && (k.bolge.x <= 1 || k.bolge.y <= 1));
  s.numaralar = s.numaralar.filter((n) => !kesilmis.some((k) => k.tur === 'numara' && k.deger === n));
  s.tarihler = s.tarihler.filter(
    (t) => !kesilmis.some((k) => k.tur === 'tarih' && k.deger === `${t.ay}/${t.yil}`),
  );
  const gecersizNumara = /(?:[0-9][ -]?){12,19}/.test(data.text) && !s.numaralar.length;
  data.text = '';
  data.blocks = null;
  return { ...s, kanitlar: kanitlar.filter((k) => !kesilmis.includes(k)), gecersizNumara };
}
