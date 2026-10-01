// Excel kütüphanesine (ExcelJS, ~900 KB) dokunan her şey bu modülden geçer. Arayüz onu
// ilk dosya açılırken dinamik olarak yükler; böylece sayfa ilk açılışta hızlı açılır.

export { kitapAc } from '../../kaynaklar/excel';
export type { AcikKitap } from '../../kaynaklar/excel';
export { kitapYaz } from '../../hedef/sayfa';
export { hedefiIncele, planla, uygula } from './islem';
