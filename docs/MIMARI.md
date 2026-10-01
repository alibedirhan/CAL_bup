# Mimari

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

| Katman        | Komut                   | Neyi yakalar                                                       |
| ------------- | ----------------------- | ------------------------------------------------------------------ |
| Tip           | `npm run tip`           | TypeScript strict hataları                                         |
| Lint          | `npm run lint`          | Katman ihlalleri, React kancaları, şüpheli kod                     |
| Biçim         | `npm run bicim:kontrol` | Prettier                                                           |
| Birim         | `npm test`              | Kurallar, rota, tema, rapor kaydı                                  |
| Altın (yerel) | `npm test`              | `ornekler/` varsa gerçek LED dosyalarıyla uçtan uca; yoksa atlanır |
| Derleme       | `npm run build`         | Yayına çıkacak paket                                               |

`npm run kontrol` hepsini sırayla çalıştırır; GitHub Actions da aynısını yapar.

## Eski araçla eşdeğerlik

Kurallar eski aracın Python ikiziyle (`../bupilic-rapor-araci/ikiz/`) aynı sonucu vermek zorundadır.
`tools/ikiz_aktar.py` ikizi gerçek dosyalarla çalıştırıp girdileri ve sonucu `ornekler/ikiz.json`'a
yazar; `tests/altin/ikiz.test.ts` aynı girdilerle TypeScript kurallarını çalıştırıp satır satır
karşılaştırır. Bilinçli farklar:

- `yuvarla3` Python `round(x, 3)` ile aynıdır (`toFixed`); VBA `Round`'dan farkı yalnızca kuramsaldır.
- `tarihBul` etiketi Türkçe küçük harfe çevirerek arar (Python `lower()` "İ" harfinde konum kaydırıyordu).
- Genel durum VBA'daki gibi uyarıları da sayar (Python ikizi yalnızca Tamam/Hata veriyordu).
- Ürün adı sıralaması büyük harfe çevrilmiş adın karakter koduna göredir (ikiz gibi; VBA Türkçe
  harmanlama kullanıyordu). 30.09 verisinde aynı sonucu verir.

## Eski araçtan taşınan bilgi

LED dosya biçimleri, hedef dosya biçimi ve iş kuralları eski Excel/VBA aracında
(`../bupilic-rapor-araci/docs/MIMARI.md`, Python ikizi `ikiz/`) belgelenmiş ve 30.09.2026 gerçek
dosyalarıyla doğrulanmıştır. Bu uygulamanın kuralları o ikizle aynı sonucu vermek zorundadır.

### ExcelJS ile ilgili denenmiş notlar (2026-10-01)

- Gerçek depo kontrol dosyası (49 gün sayfası) okunup yazıldığında değerler, formüller, biçimler,
  birleşik hücreler korunuyor.
- Varsayılan genişlikteki sütunların genişlik bilgisi kayboluyor; yazmadan önce açıkça atanmalı.
- Sayfa kopyası: `yeni.model = {...kaynak.model, name, id}` biçimi ve hücreleri kopyalıyor, birleşik
  hücreleri kopyalamıyor; `kaynak.model.merges` ayrıca `mergeCells` ile uygulanmalı. Sayfa sırası
  `workbook._worksheets` dizisi ve `orderNo` ile ayarlanıyor.
