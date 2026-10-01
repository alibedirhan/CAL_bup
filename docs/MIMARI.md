# CAL bup — Mimari

Statik bir tek sayfa uygulaması (Vite + TypeScript + React). Sunucu yok: Excel dosyaları tarayıcıda
okunur ve yazılır. GitHub Pages'te yayınlanır.

## Katmanlar ve bağımlılık yönü

```
arayuz/      ekranlar, bileşenler, tema            → raporlar, platform
raporlar/    rapor kaydı + her raporun hesabı (saf plan) → cekirdek, kaynaklar, hedef
kaynaklar/   LED okuyucuları ve dosya tanıma → KaynakVeri → cekirdek
             (yalnızca excel.ts ExcelJS'e bağlıdır: dosyayı Kitap biçimine çevirir)
hedef/       depo kontrol kitabına yazma            → cekirdek, ExcelJS
cekirdek/    saf kurallar: sayı, metin, tarih, ayarlar, KaynakVeri, kontrol → hiçbir şey
platform/    tarayıcıya bağlı işler: saklama, dosya seçme/kaydetme, Drive
```

- `cekirdek/` saf TypeScript'tir: React'e, ExcelJS'e, tarayıcıya bağlanmaz. ESLint bunu zorlar
  (`eslint.config.js` → `no-restricted-imports`).
- Okuyucular Excel kütüphanesini bilmez; `kaynaklar/kitap.ts`'teki `Kitap`/`Sayfa` görünümünü okur.
  Testler bu görünümü elle kurar (`tests/yardimci/sentetik.ts`), gerçek dosya `excel.ts` ile çevrilir.
- Rapor dosya biçimini bilmez, okuyucu raporu bilmez. Aradaki tek sözleşme `KaynakVeri`dir
  (eski VBA aracının `clsKaynakVeri` sınıfı).
- Rapor önce saf bir **plan** üretir (satırlar, eklenecekler, kontroller). Önizleme bu plandan çizilir,
  "Kaydet" aynı planı kitaba uygular. Ekranda görülen ile dosyaya yazılan aynıdır.

## Arayüz akışı (günlük depo kontrol)

```
useDepoKontrol (React)  ──  oturum.ts: azalt(eylem) + turet(durum) → ekranda görünen her şey
        │                    (saf; tests/birim/oturum.test.ts)
        └─ islemler.ts  ──  motorYukle() → motor.ts (ExcelJS'e dokunan her şey, ayrı paket parçası)
                            platform/: dosya seçme/kaydetme, IndexedDB (yedek, geçmiş, son dosya)
```

- Önizleme ile kayıt aynı planı kullanır; kayıtta dosya baştan açılıp plan yeniden uygulanır, önizlemedeki
  kitaba dokunulmaz.
- Dosyanın üzerine yazmadan önce: diskteki dosya açıldıktan sonra değiştiyse durulur; değişmediyse eski
  hâli IndexedDB'ye yedeklenir (son 10). Dosya Excel'de açıksa anlaşılır hata verilir.
- Depo kontrol ekranı başka sayfaya geçince de bağlı kalır (`hidden`), yüklenen dosyalar kaybolmaz.

## Yeni rapor eklemek

1. `src/raporlar/kayit.ts`'ye bir kayıt ekleyin (`durum: 'yapimda'`).
2. Gerekirse `src/kaynaklar/`'a yeni LED okuyucusu (dosyayı içeriğinden tanıyan bir `tani` işleviyle).
3. `src/raporlar/<id>/` altında `hesapla()` (saf, birim testli) ve `uygula()` (kitaba yazar).
4. Gerçek örnek dosyayla altın test (`tests/altin/`, yerel).

## Tema

Renkler, yazı tipleri ve yarıçaplar `src/arayuz/stiller/tema.css`'teki belirteçlerdir; bileşenler
başka renk kullanmaz. Koyu tema iki blokta durur (sistem ayarı ve elle seçim) ve ikisi birebir aynı
olmalıdır; `tests/birim/tema.test.ts` denetler. Yazı tipleri pakete gömülüdür (Fontsource), dışarıdan
yüklenmez.

## Güvenlik ve veri

- Depo herkese açıktır. `.gitignore` tüm Excel uzantılarını ve `ornekler/` klasörünü dışarıda tutar.
  Testlerdeki sentetik veriler gerçek ürün adı ve miktarı içermez.
- Derlenen sayfaya içerik güvenlik politikası (CSP) eklenir (`vite.config.ts`): sayfa kendi dosyaları
  dışında hiçbir adrese bağlanamaz. Google Drive aşamasında yalnızca gereken Google adresleri eklenecek.
- Analitik, çerez ve dış kaynak yoktur.

## Doğrulama

| Katman        | Komut                   | Neyi yakalar                                                     |
| ------------- | ----------------------- | ---------------------------------------------------------------- |
| Tip           | `npm run tip`           | TypeScript strict hataları                                       |
| Lint          | `npm run lint`          | Katman ihlalleri, React kancaları, şüpheli kod                   |
| Biçim         | `npm run bicim:kontrol` | Prettier                                                         |
| Birim         | `npm test`              | Kurallar, okuyucular, Excel yazma (sentetik), ekran durumu, tema |
| Altın (yerel) | `npm test`              | `ornekler/` varsa gerçek dosyalarla uçtan uca; yoksa atlanır     |
| Derleme       | `npm run build`         | Yayına çıkacak paket                                             |

`npm run kontrol` hepsini sırayla çalıştırır; GitHub Actions da aynısını yapar.

## Eski araçla eşdeğerlik

Kurallar eski Excel/VBA aracının Python ikiziyle aynı sonucu verir. Eski araç arşivlenecek
(`github.com/alibedirhan/Bup_Excel_Rapor_Eski`, gizli). `tools/ikiz_aktar.py` ikizi gerçek dosyalarla
çalıştırıp girdileri ve sonucu `ornekler/ikiz.json`'a yazmıştır; bu dosya artık sabit bir başvuru
çıktısıdır. `tests/altin/ikiz.test.ts` aynı girdilerle TypeScript kurallarını çalıştırıp satır satır
karşılaştırır. Bilinçli farklar:

- `yuvarla3` Python `round(x, 3)` ile aynıdır (`toFixed`); VBA `Round`'dan farkı yalnızca kuramsaldır.
- `tarihBul` etiketi Türkçe küçük harfe çevirerek arar (Python `lower()` "İ" harfinde konum kaydırıyordu).
- Genel durum VBA'daki gibi uyarıları da sayar (Python ikizi yalnızca Tamam/Hata veriyordu).
- Ürün adı sıralaması büyük harfe çevrilmiş adın karakter koduna göredir (ikiz gibi; VBA Türkçe
  harmanlama kullanıyordu). 30.09 verisinde aynı sonucu verir.

## İş kuralları

LED dosya biçimleri, hedef dosya biçimi ve rapor kuralları: `docs/IS_KURALLARI.md`.

### ExcelJS notları (denenmiş, `hedef/sayfa.ts`'te çözüldü)

ExcelJS 4.4.0 sürümüne sabitlenmiştir; yükseltirken aşağıdakileri ve altın testleri yeniden doğrulayın.

| Eksik                                                                                  | Çözüm                                                                 |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Sayfa kopyası (`model` ataması) birleşik hücreleri ve 9 genişlikli sütunları almıyor   | `sayfaKopyala` ikisini ayrıca aktarır                                 |
| Genişliği tam 9 olan sütunları "varsayılan" sayıp yazmıyor (Excel'in varsayılanı 8,43) | `kitapYaz` bunları 9,000001 olarak yazar                              |
| `insertRow` formülleri ve koşullu biçim aralıklarını kaydırmıyor                       | `satirEkle` + `formul.ts` Excel'deki gibi kaydırır                    |
| Satır ekleyince paylaşılan formüller yüzünden dosya yazılamıyor                        | `paylasilanFormulleriAc` önce açık formüle çevirir                    |
| Kopyadan sonra iki sekme birlikte seçili kalıyor (Excel'de "Grup" modu)                | `sayfaSec` yalnızca yeni sayfayı seçer                                |
| Formüllerin eski hesaplanmış sonuçları kalıyor                                         | `eskiSonuclariSil` + `fullCalcOnLoad`; bildiklerimizin sonucu yazılır |
| Sekme seçimi ve `fullCalcOnLoad` geri okunmuyor                                        | Testler `.xlsx` içindeki XML'e bakar (`tests/yardimci/xml.ts`)        |

Sayfa sırası `orderNo` ile belirlenir. ExcelJS hücre tarihlerini UTC verir; `kaynaklar/excel.ts`
aynı takvim gününü yerel saatte kurar.
