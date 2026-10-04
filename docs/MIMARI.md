# CAL bup — Mimari

Statik bir tek sayfa uygulaması (Vite + TypeScript + React). Sunucu yok: Excel dosyaları tarayıcıda
okunur ve yazılır. GitHub Pages'te yayınlanır.

## Katmanlar ve bağımlılık yönü

```
arayuz/      ekranlar, bileşenler, tema            → raporlar, platform
raporlar/    saf rapor planı + dosya iş akışı → cekirdek, kaynaklar, hedef, platform
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
        └─ raporlar/depoKontrol/dosyaIslemleri.ts  ──  motorYukle() → motor.ts (ExcelJS'e dokunan her şey, ayrı paket parçası)
                            platform/: dosya seçme/kaydetme, IndexedDB (yedek, geçmiş, son dosya)
```

- Önizleme ile kayıt aynı planı kullanır; kayıtta dosya baştan açılıp plan yeniden uygulanır, önizlemedeki
  kitaba dokunulmaz.
- Dosyanın üzerine yazmadan önce: diskteki dosya açıldıktan sonra değiştiyse durulur; değişmediyse eski
  hâli IndexedDB'ye yedeklenir (son 10). Dosya Excel'de açıksa anlaşılır hata verilir.
- Depo kontrol ekranı başka sayfaya geçince de bağlı kalır (`hidden`), yüklenen dosyalar kaybolmaz.

## Yeni rapor eklemek

Sanal POS bir rapor değildir: ayrı rota ve şifreli yerel profil kullanır. Cari/kart bilgisi rapor/Drive
geçmişine karışmaz. `cekirdek/posKart`, `posProfil` ve `posKartFotografi` saf doğrulama/birleştirme kurallarıdır.
`platform/posProfilDeposu` atomik IndexedDB, nesil denetimi ve eski kasa geçişini yönetir;
`posProfilSifreleme` Web Crypto sınırıdır. React akışı `arayuz/sayfalar/pos/usePosProfili` üzerinden
bu depoyu çağırır. `posKartOkuma` isteğe bağlı ayrı OCR worker’ını yükler; Vite `tools/ocrVarliklari`
ile worker/WASM/modeli kendi yayınına koyar. CDN veya fotoğrafı dışarı gönderen servis yoktur.
Veri sınırları ve sağlayıcı entegrasyonunun mevcut sınırı: [SANAL_POS.md](SANAL_POS.md).

1.6.0 `cekirdek/posAktarimi` saf aktarım/alan şemasını tanımlar; `platform/posYardimcisi` tek istek
kimlikli mesaj portudur. `eklenti/` yalnızca dar MV3/DOM adaptörlerini içerir: seri arka plan kuyruğu,
sekme/cari eşleşmesi ve kullanıcı alan tanıtımı. Çekirdek eklentiye bağlanamaz (ESLint).
`tools/posEklentisi` ana derlemeden sonra aynı sürümlü üç bağımsız betik/manifest/ZIP üretir.
Ödeme alanlarına erişim uygulama içinde veya varsayılan seçicilerle yapılmaz.
[POS_YARDIMCISI.md](POS_YARDIMCISI.md) veri yaşam döngüsü, test ve gerçek sağlayıcı kabul sınırıdır.

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
- Derlenen sayfaya CSP eklenir (`vite.config.ts`): kendi kaynakları, Google kimlik kitaplığının
  `accounts.google.com/gsi/` uçları ve Drive REST için `www.googleapis.com` izinlidir. Joker alan adı yoktur.
  Form gönderimine yalnızca POS sağlayıcısının HTTPS `/login.aspx` adresinde izin verilir; kullanıcı
  “POS’u aç” dediğinde giriş bilgileri yeni sekmeye POST edilir, sonuç uygulamadan okunmaz.
- Google kitaplığı yalnızca kullanıcı Drive bağlantısını hazırladığında yüklenir. Normal rapor
  akışında dış bağlantı yoktur. Analitik ve takip çerezi eklenmez.
- Drive adaptörü `platform/drive.ts`, OAuth oturum belleği `driveKimlik.ts`, doğrulama/birleştirme
  `cekirdek/driveOturumu.ts`, `cekirdek/gecmis.ts` ve `cekirdek/ayarBirlestir.ts` içindedir;
  `driveEsitleme.ts` bu kuralları I/O iş akışında çağırır. Arayüz `arayuz/sayfalar/drive/` altında. ExcelJS ayrı parça kalır.
- IndexedDB yazıları istek başarısında değil aktarım tamamlanınca başarılı sayılır. Geçmiş
  ekleme/birleştirme ve yedek verisi/liste/eski yedek silme tek aktarımda yapılır.
- Drive erişim belirteci kalıcı kaydedilmez; rapor ve ayar kopyaları değişmez dosyalardır. İstekler başlatıldıkları
  erişim belirteci ve bağlantı nesline bağlanır; hesap değişirse kuyruktaki/çok adımlı işlem durur. Ayrıntı: [DRIVE.md](DRIVE.md).

## Doğrulama

| Katman        | Komut                   | Neyi yakalar                                                     |
| ------------- | ----------------------- | ---------------------------------------------------------------- |
| Tip           | `npm run tip`           | TypeScript strict hataları                                       |
| Lint          | `npm run lint`          | Katman ihlalleri, React kancaları, şüpheli kod                   |
| Biçim         | `npm run bicim:kontrol` | Prettier                                                         |
| Birim         | `npm test`              | Kurallar, okuyucular, Excel yazma (sentetik), ekran durumu, tema |
| Altın (yerel) | `npm test`              | `ornekler/` varsa gerçek dosyalarla uçtan uca; yoksa atlanır     |
| Derleme       | `npm run build`         | Yayına çıkacak paket                                             |

`npm run kontrol` tablodaki kontrolleri sırayla çalıştırır. Ek olarak `npm run test:tarayici`, gerçek
Chromium/IndexedDB’de profil kaydı, cari bağı, POS formu (taklit sağlayıcı), kartlı yedek, eski kasa
geçişi, engellenmiş depo, çoklu sekme ve yerel OCR akışlarını doğrular. Ekran görüntüleri `/tmp`’dedir.
GitHub Actions iki komut başarılı olmadan yayınlamaz; gerçek ödeme isteği testlerde gönderilmez.

## Eski araçla eşdeğerlik

Kurallar eski Excel/VBA aracının Python ikiziyle aynı sonucu verir. Eski araç arşivdedir
(`github.com/alibedirhan/Bup_Excel_Rapor_Eski`, gizli, değişikliklere kapalı). Arşivin 8 commit'i
GitHub'dan yeniden indirilerek doğrulandı. Belge geçmişindeki şirket verileri temizlendi; kod geçmişi
korundu. Özgün geçmiş ve yerel dosyalar yalnızca `ornekler/eski_arac_arsivi/` içinde tutulur (git dışı).
`tools/ikiz_aktar.py` ikizi gerçek dosyalarla
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

## İşlem sonuçları ve OCR (1.5.0)

`cekirdek/islemSonucu.ts` kapsam/kimlik/kod ve tamam/doğrulama/hata/iptal/belirsiz sözleşmesidir.
`platform/islemOturumu.ts` enjekte edilen işlevlere AbortSignal verir; tek işlem, süre ve nesil denetler.
`arayuz/bilesenler/useIslem` geç sonucu bağlı olmayan/yeni kapsama uygulamaz. POS atomik depo sınıfı
mevcut CAS/nesil korumasıyla aynı saf sonuç sözleşmesini döndürür. Belirsiz yazı otomatik tekrarlanmaz.

`FormHatasi` kendi formuna odaklanır/scroll eder; `BildirimAlani` tek genel görünür duyuruyu yönetir.
`HataSiniri` ham hata/yığın günlüğü olmadan kurtarma ekranı sunar. Drive sinyalleri çok adımlı akış ve
fetch'e taşınır; iptal edilmiş OAuth yanıtı token açamaz. Dosya yazısı kapanmadan başarı sayılmaz.

OCR görüntü/motor/aday adaptörleri `platform/ocr/` içinde; `useKartFotografi` geçici okuma taslağıdır.
`FotoAdaylari` açık kontrolle PAN/tarih çiftini uygular, profil kurallarını atlamaz. Tesseract.js 7.0.0
worker protokolü sabitlenmiştir; yükseltme arıza/iptal/matris testlerini geçmelidir. Ödeme hesabı ve rapor
saf planı değişmedi. Ayrıntı ve ölçüm sınırları: [kapanış raporu](OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md).

## Yardımcı bağlantı sözleşmesi (1.6.1)

`cekirdek/posBaglantisi` saf protokol/sürüm/durum doğrulamasıdır. Platform portu doğrulanmış yanıt
döndürür; `usePosAktarimi` iptal, monotonic süre ve görünür sonucu yönetir. Bileşen yalnızca sunumdur.
Arka plan `teslim` durumunu sonuç onayından ayırır, saat geri alma/kayıp iş/başka sekmenin bekleyen işi
kontrollerini uygular. `tools/windowsPosKurulumu` sürüm/hash bağlı okunabilir CMD üretir; derleme
güncel ZIP SHA-256 özetini gömer. Tarayıcı kurulum onayı kullanıcıdadır. [Tarama](POS_YARDIMCISI_TARAMA_RAPORU.md).

## 1.7.0 katman ve durum denetimi

Dosya/yedek/geçmiş koordinasyonu React ekranında değil rapor uygulama katmanında yürür.
Saf ayar/geçmiş/Drive oturum doğrulaması çekirdektedir. Platform geriye uyumlu dışa aktarımları
korur; çekirdek platforma bağlanmaz. ESLint çekirdekte tarayıcı globallerini; platform/rapor/
okuyucu/yazıcı katmanlarında React ve arayüz bağımlılığını; arayüzde statik Excel motorunu sınırlar.

`Kitap/Sayfa` portu birleşim kaynağını ve hesaplanmamış formülü isteğe bağlı yapısal bilgi olarak
sunar; okuyucu ExcelJS türünü bilmez. Böylece birleşik grup başlığı ile hatalı ürün miktarı ayrılır.
Geçmiş/yedek listesi okuma ve atomik yazı içinde aynı saf doğrulayıcıdan geçer; bozuk değer boş
listeye dönüştürülmez. Drive bağlantı nesli rapor bileşenlerinin eski liste/başarısını da geçersiz kılar.
Ayar değişikliği rapor onaylarını sıfırlar; etkin dosya işlemi sırasında bağlam değişikliği engellenir.
İnceleme/kanıt ve gerçek ortam sınırları: [genel tarama raporu](GENEL_TARAMA_RAPORU.md).

## 1.7.1 ek doğrulama

Formül kaydırıcı Unicode ad sınırlarını, Excel'in gerçek sütun/satır sınırlarını, küçük harfli
hücreleri ve tam satır aralıklarını ayırır. Dış sayfa aralığı/tam satır/sayfa aralığı başvurusu
tek korunan parça olarak ele alınır. Sentetik kitapta satır ekle → yaz → yeniden aç regresyonu vardır.
Tam Excel ayrıştırıcısı veya üç boyutlu bağımlılık güncelleyicisi değildir.

Ana Playwright yapılandırmasındaki kapalı proxy tüm normal bağlamların dış ağını kapatır;
MV3 kalıcı bağlamı kendi daha sıkı proxy sınırını korur. Route taklidi olmayan `.invalid` isteği
proxy bağlantı hatasıyla reddedilir; yerel uygulama açık kalır. Gerçek POS/SMS/ödeme kullanılmaz.

`npm run test:performans` ayrı Playwright yapılandırmasıyla derlenmiş gerçek Excel motorunu ölçer.
Yapay dosya hazırlama ve motor yükleme ölçüm dışındadır; son hücre/sayfa/satır ve ret sonucu
denetlenir. 10 ms zamanlayıcının en uzun aralığı ana iş parçacığı beklemesi için yaklaşık göstergedir;
bellek ölçümü veya Windows hız garantisi değildir. Sonuç ve tarayıcı ekleri `/tmp/`'ta tutulur.
Altı senaryo yayın kapısına eklendi; ölçüm sürelerine makineye bağlı geçme/kalma eşiği konmadı.
