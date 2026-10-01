// Ayarların varsayılanları. Eski aracın src/ayarlar.py dosyasının karşılığı.
// Kullanıcının değiştirdiği değerler platform katmanında saklanır ve bunların üzerine yazılır.

export interface TabloDuzeni {
  /** İlk ürün satırı (1'den başlar). */
  ilkVeriSatiri: number;
  kodSutunu: string;
  isimSutunu: string;
  miktarSutunu: string;
}

export interface Ayarlar {
  /** Önerilen tarihte pazar günü atlansın mı? */
  pazarAtla: boolean;
  /** Toplam karşılaştırmalarında kabul edilen en büyük fark (kg). */
  tolerans: number;
  /** Gün sayfasında ürün listesinin başladığı satır. */
  hedefIlkSatir: number;
  /** G1 hücresinde beklenen başlık; yanlış dosyayı doldurmayı engeller. */
  hedefKontrolBaslik: string;
  /** Bu önekle başlayan ürünler sayılmaz; sayım fişinde yoksa sayım = LED. */
  donukOnek: string;
  /** Listede olmayan ama miktarı sıfır olan ürünler de eklensin mi? */
  sifirEksikleriEkle: boolean;
  etiketBaslangicTarihi: string;
  etiketBitisTarihi: string;
  d01: TabloDuzeni & { tanim: string };
  sayim: TabloDuzeni & { sayfaAdi: string };
  subeAlis: TabloDuzeni & { tanim: string };
}

export const VARSAYILAN_AYARLAR: Ayarlar = {
  pazarAtla: true,
  tolerans: 0.001,
  hedefIlkSatir: 4,
  hedefKontrolBaslik: 'GELEN MAL',
  donukOnek: 'DON.',
  sifirEksikleriEkle: false,
  etiketBaslangicTarihi: 'Başlangıç Tarihi',
  etiketBitisTarihi: 'Bitiş Tarihi',
  d01: {
    tanim: 'D01.Stok Giriş Çıkış Envanteri',
    ilkVeriSatiri: 4,
    kodSutunu: 'A',
    isimSutunu: 'B',
    miktarSutunu: 'H',
  },
  sayim: {
    sayfaAdi: 'Sayım Fişi',
    ilkVeriSatiri: 2,
    kodSutunu: 'B',
    isimSutunu: 'C',
    miktarSutunu: 'D',
  },
  subeAlis: {
    tanim: 'Şube Alış',
    ilkVeriSatiri: 4,
    kodSutunu: 'F',
    isimSutunu: 'D',
    miktarSutunu: 'H',
  },
};

/** "A" → 1, "H" → 8, "AA" → 27 */
export function sutunNo(harf: string): number {
  let n = 0;
  for (const c of harf.trim().toUpperCase()) {
    const k = c.charCodeAt(0) - 64;
    if (k < 1 || k > 26) throw new RangeError(`Geçersiz sütun: ${harf}`);
    n = n * 26 + k;
  }
  if (n === 0) throw new RangeError('Sütun boş');
  return n;
}
