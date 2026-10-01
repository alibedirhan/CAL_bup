// Uygulamadaki raporların listesi. Yeni rapor eklemek için buraya bir
// kayıt eklenir; kenar çubuğu ve sayfalar bu listeden çizilir.

export type RaporDurumu = 'hazir' | 'yapimda' | 'yakinda';

export interface RaporTanimi {
  id: string;
  ad: string;
  aciklama: string;
  durum: RaporDurumu;
  /** Raporun okuduğu LED dosyaları (kullanıcıya gösterilen adlarıyla). */
  kaynaklar: readonly string[];
}

export const RAPORLAR: readonly RaporTanimi[] = [
  {
    id: 'depo-kontrol',
    ad: 'Günlük depo kontrol',
    aciklama: 'LED stoğu, depo sayımı ve gelen malı yeni gün sayfasına yazar, toplamları kontrol eder.',
    durum: 'hazir',
    kaynaklar: ['D01 Stok Giriş Çıkış Envanteri', 'Sayım fişi', 'Şube alış (önceki gün)'],
  },
  {
    id: 'envanter',
    ad: 'Envanter',
    aciklama: 'Kaynak LED dosyası henüz görülmedi.',
    durum: 'yakinda',
    kaynaklar: [],
  },
  {
    id: 'bakiye',
    ad: 'Bakiye',
    aciklama: 'Kaynak LED dosyası henüz görülmedi.',
    durum: 'yakinda',
    kaynaklar: [],
  },
  {
    id: 'palet-kasa',
    ad: 'Palet / kasa',
    aciklama: 'Haftalık palet ve kasa envanteri, günlük depo satışlarının cari adına göre toplanması.',
    durum: 'yakinda',
    kaynaklar: [],
  },
];

export function raporBul(id: string): RaporTanimi | undefined {
  return RAPORLAR.find((r) => r.id === id);
}
