// Depo kontrol dosyasının sorumluluk notu (1.19.0, kullanıcı kararı). Rapor masa başında hazırlanır;
// depo sayımı depo sorumlusundandır. Metin kullanıcıyla birlikte yazıldı; değiştirmeden önce sorun.

import { ggAaYyyy, tarihMetni, type Tarih } from './tarih';

export const BILGI_SAYFASI = 'Bilgilendirme';
export const BILGI_BASLIGI = 'BİLGİLENDİRME';
export const KAYIT_BASLIKLARI = ['Gün', 'Sayım fişi', 'Hazırlanma'] as const;

export const BILGI_METNI: readonly string[] = [
  'Bu rapor, İzmir Bupiliç İdari Asistanı tarafından masa başında, LED sisteminden alınan kayıtlarla hazırlanmaktadır.',
  '• LED depo stoğu, LED stok kayıtlarından (D01) alınır.',
  '• Depo sayımı, depo sorumlusunun yaptığı fiziki sayımdan (LED sayım fişi) alınır. Sayım fişinde bulunmayan donuk ürünlerde LED stoğu esas alınır.',
  '• Raporu hazırlayan kişi depoda fiziki sayım yapmamaktadır. Sayım miktarlarının doğruluğu, sayımı yapan depo sorumlusuna aittir.',
  '• Rapordaki farklar kayıtlar ile sayım arasındaki farkı gösterir; nedenleri depo sayımı üzerinden incelenmelidir.',
];

/** Gün sayfasının sağ üstündeki üç satırlık kısa not. */
export function gunNotu(gun: Tarih, sayimDosyasi?: string): [string, string, string] {
  const dosya = sayimDosyasi ? ` (${sayimDosyasi})` : '';
  return [
    `Depo sayımı, depo sorumlusunun ${tarihMetni(gun)} sayımından${dosya} alınmıştır.`,
    'Hazırlayan fiziki sayım yapmamıştır.',
    `Ayrıntı: ${BILGI_SAYFASI} sayfası.`,
  ];
}

/** Notun önceki günden kopyalanmış hâli bu başlangıçlarla tanınır ve yerinde yenilenir. */
export function gunNotuMu(metin: string): boolean {
  return (
    metin.startsWith('Depo sayımı, depo sorumlusunun ') ||
    metin === 'Hazırlayan fiziki sayım yapmamıştır.' ||
    metin === `Ayrıntı: ${BILGI_SAYFASI} sayfası.`
  );
}

export function gecisMetni(sayfaAdi: string): string {
  return `Okudum, ${sayfaAdi} gün sayfasına geç →`;
}

export interface RaporKaydi {
  /** "30.09.2026" */
  gun: string;
  sayimDosyasi: string;
  /** "01.10.2026 09:12" */
  hazirlanma: string;
}

export function zamanMetni(z: Date): string {
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${iki(z.getDate())}.${iki(z.getMonth() + 1)}.${z.getFullYear()} ${iki(z.getHours())}:${iki(z.getMinutes())}`;
}

/** Aynı günün kaydı yenilenir; en yeni gün üstte. Tarihi okunamayan elle yazılmış satır sona kalır. */
export function kayitlariGuncelle(eski: readonly RaporKaydi[], yeni: RaporKaydi): RaporKaydi[] {
  const anahtar = (k: RaporKaydi) => ggAaYyyy(k.gun) ?? '';
  const liste = [yeni, ...eski.filter((k) => k.gun !== yeni.gun)];
  return liste
    .map((k, i) => ({ k, i, t: anahtar(k) }))
    .sort((a, b) => (a.t === b.t ? a.i - b.i : a.t < b.t ? 1 : -1))
    .map(({ k }) => k);
}
