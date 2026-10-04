# CAL bup — Genel tarama ve iyileştirme raporu

**Tarih:** 4 Ekim 2026 · **İncelenen başlangıç:** 1.6.1 (`b4b1ea1`) · **Düzeltme sürümü:** 1.7.0

## Sonuç

Sanal POS, kart/fotoğraf akışı, günlük depo kontrol, Excel okuma/yazma, Drive, ayarlar,
geçmiş/yedekler, mimari ve kullanıcı açıklamaları incelendi. Aşağıda **29 bulgu başlığı** altında
kodda giderilen sorunlar ve bunları doğrulayan kontroller var. Ayrıca gerçek hizmet, cihaz veya
örnek dosya gerektiren kabul sınırları ayrı listelendi. Bu çalışma tüm olası hataların bulunmuş
olduğuna dair garanti değildir.

Önemli sonuçlar: bekleyen kart aktarımı yanlış bağlamda devam etmiyor; kapanan profil eski
kartlarla işlem yaptırmıyor; bozuk miktarlar sessizce sıfır/kısmi sayı olmuyor; bozuk geçmiş ve
yedek listeleri yeni kayıtla ezilmiyor. Ayarlar değişince eski rapor onayları yenileniyor.
README ve gizlilik sayfası mevcut kart aktarımını doğru anlatıyor.

## İnceleme ve kanıt yöntemi

- `src/` ve `tools/` altında 128 dosyalık envanter; katman bağımlılıkları, giriş doğrulaması,
  asenkron işlem/iptal, kalıcı veri ve dış bağlantı yolları incelendi.
- POS profili/şifreleme/eski kasa geçişi, fotoğraf ve OCR worker temizliği, mesaj köprüsü,
  gerçek MV3 yardımcı, alan tanıtımı, cari eşleştirme ve tek kullanımlık teslim gözden geçirildi.
- Rapor hesabı, hedef gün seçimi, formül/satır kaydırma, dosya tanıma, yedek/kayıt sırası,
  disk içeriği denetimi ve ortak işlem denetimi incelendi.
- Hatalar sentetik regresyonlarla sınandı. İlk yeni POS iptal senaryoları ve eski tarih önerisi,
  değiştirilebilir tarih, kesirli satır ayarı, bozuk kayıt yazımı senaryoları düzeltme öncesinde
  başarısız oldu. Yalnızca kodda görülen ek sınırlar gerçek kullanıcı olayı gibi sunulmadı.
- Gerçek Excel örnekleri yalnızca Git dışındaki `ornekler/` içinde kullanıldı. Yeni test ve
  raporlara gerçek müşteri, kart, ürün veya miktar verisi alınmadı.
- POS testleri yapay kart ve dış ağa kapalı taklit POS ile yapıldı. Gerçek giriş, SMS ve ödeme
  başlatılmadı. Kullanıcının paylaştığı ekran görüntüsü aktarım panelini gösteren sınırlı bir
  gözlemdir; ödeme veya bütün sağlayıcı akışlarının kabul kanıtı değildir.

## Düzeltilen bulgular

**Yüksek:** yanlış kart/rapor veya kayıt kaybı oluşturabilecek durum. **Orta:** işlemi durduran,
eski durumu gösteren veya kullanıcıyı yanıltan durum. **Düşük:** bakım ve açıklama tutarlılığı.
Öncelikler, gerçek bir zarar yaşandığı anlamına gelmez.

| No  | Öncelik | Önceki sorun ve tetikleyici                                                                                                                                                               | 1.7.0 davranışı / kanıt                                                                                                                                                                                                                        |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Yüksek  | Bekleyen kart aktarımı varken kartı düzenlemeye/eklemeye başlamak eski aktarımı açık bırakıyordu.                                                                                         | Kart seçimi kaldırılır, aktarım bileşeni kapanır ve geçici iş iptal edilir. `genelTarama.spec.ts` düzenleme senaryosu.                                                                                                                         |
| F02 | Yüksek  | Kart aktarımı beklerken “Elle POS’a giriş” yeni giriş başlatıyor, eski kart işi beklemeye devam ediyordu.                                                                                 | Yeni giriş eski aktarım bileşenini yeniler ve işi iptal eder. Aynı dosyada elle giriş senaryosu.                                                                                                                                               |
| F03 | Yüksek  | Kartı olan carinin vergi/TC numarasını değiştirmek aynı kartları farklı numaraya bağlayabiliyordu.                                                                                        | Bağlı kart varken numara değişikliği reddedilir. Ad değişikliği mümkündür; farklı kişi için yeni cari gerekir. `genelTarama.test.ts`.                                                                                                          |
| F04 | Yüksek  | Yerel form kaydı başarısız olup depo kapandığında eski profil/kart ekranı kullanılabilir kalıyordu.                                                                                       | Profil ekranı ve formlar kapanır, hata görünür; yeniden kontrol ile kalıcı kayıt yüklenir. İki tarayıcı arıza testi.                                                                                                                           |
| F05 | Orta    | Seçili kart açık sayfada zamanla geçersizleşirse aktarım düğmesi açık görünebiliyordu; arka doğrulama reddediyordu.                                                                       | Düğme de güncel son kullanmaya göre kapanır. Sentetik saatle tarayıcı denemesi.                                                                                                                                                                |
| F06 | Yüksek  | `10 kg`, `12,3,4`, Excel hata metni ve mantıksal hücre değerleri kısmi sayı veya sıfır kabul edilebiliyordu.                                                                              | LED miktarında bütün değer doğrulanır; geçersiz satır açıklanır. Boş hücre sıfır, Türkçe sayı biçimi korunur. Birim testleri ve gerçek Excel karşılaştırması.                                                                                  |
| F07 | Yüksek  | Tek ürün veya toplamda sayısal taşma sonsuz değere dönüşüp rapora ilerleyebiliyordu.                                                                                                      | Kaynak ekleme/toplam ve hesap yuvarlama sınırlarında sonlu sayı zorunludur. Taşma regresyonları.                                                                                                                                               |
| F08 | Yüksek  | Hesaplanmış sonucu bulunmayan ürün miktarı formülü boş hücre gibi sıfır sayılabiliyordu; son ürün satırı gözden kaçabiliyordu.                                                            | Ürün formülünde hesaplanmış sonuç yoksa durulur; son satır ürün adına/formüle göre de bulunur. Dip toplam sonucu yoksa eski satır toplamı kuralı korunur. Sentetik Excel testleri.                                                             |
| F09 | Orta    | Tarih yılının ilk dört rakamı alınıyor; fazla rakam/ek metin/ek parça kabul edilebiliyordu.                                                                                               | Girilen tarihin tamamı doğrulanır; iki veya dört haneli yıl dışındaki biçim reddedilir. Dört regresyon.                                                                                                                                        |
| F10 | Yüksek  | Aynı günü gösteren iki sayfa veya ters sekme sırası yanlış önceki sayfanın seçilmesine yol açabiliyordu.                                                                                  | Yinelenen gün ve kronolojik olmayan sıra dosya açılışında açıklamayla reddedilir. Gün seçimi testleri.                                                                                                                                         |
| F11 | Yüksek  | Açık dosyada başka yılın aynı gün/ay tarihi girildiğinde önceki yılın sayfası mevcut gün sayılabiliyordu.                                                                                 | Bilinen sayfa yılı ile istenen yıl farklıysa üzerine yazma reddedilir. Yıl regresyonu. Yıl çıkarımı sınırı aşağıda ayrıca belirtilmiştir.                                                                                                      |
| F12 | Yüksek  | Açık dosyada pazar ayarı değişince öneri eski kalıyor; değiştirilmiş kurallarda önceki tarih/üzerine yazma onayı geçerli kalabiliyordu.                                                   | Öneri yenilenir, onaylar sıfırlanır, sürmekte olan işlem durdurulur ve eski sonuç kaldırılır. Oturum ve tarayıcı testleri.                                                                                                                     |
| F13 | Yüksek  | Dosya okunurken/kaydedilirken gün, kaynak ve onaylar değiştirilebiliyor; işlemle ekranda farklı bağlam oluşabiliyordu.                                                                    | Arayüz kontrolleri kapanır; aynı olay döngüsündeki değişiklikler de işlem kilidiyle engellenir. İşlem sırasında tarih denemesi.                                                                                                                |
| F14 | Yüksek  | Yazmadan önce yalnızca ürün sayısı kontrol ediliyordu; aynı uzunlukta farklı liste eski planı kabul edebiliyordu.                                                                         | Ürün adları ve sırası da karşılaştırılır; hatada yeni sayfa bile oluşturulmaz. `excelYazma.test.ts`.                                                                                                                                           |
| F15 | Yüksek  | Satır eklerken başka sayfaya ait aralığın ikinci ucu veya tablo sütun adı yerel hücre gibi kaydırılabiliyordu.                                                                            | Dış sayfa aralıkları ve köşeli parantez içindeki tablo başvuruları korunur; yerel aralık genişler. Formül regresyonu.                                                                                                                          |
| F16 | Yüksek  | Ayarlar 256 sütuna izin verirken sayımın Birim başlığı yalnızca ilk 32 sütunda aranıyordu.                                                                                                | Birim kontrolü izin verilen 256 sütunu kapsar. 33. sütunda ADET reddetme testi.                                                                                                                                                                |
| F17 | Yüksek  | Birden çok rapor türüne uyan kitap öncelik sırasına göre sessizce tanınıyordu.                                                                                                            | Belirsiz kitap otomatik sınıflanmaz; kullanıcıya rapor türlerini ayırması söylenir. Tanıma testi.                                                                                                                                              |
| F18 | Orta    | Çok sayıda dosyanın toplu okunması sınırsızdı; iptal sonrasında kalan dosyalar açılmaya devam edebiliyordu.                                                                               | Bir grupta en fazla 10 dosya/100 MB; dosyalar arasında iptal denetimi. Tek dosyada 25 MB sınırı sürer. Boyut/adet ve iptal testleri.                                                                                                           |
| F19 | Yüksek  | Bozuk geçmiş normal okuma/yeni kayıt/Drive birleştirmede boş liste kabul edilip ezilebiliyordu.                                                                                           | Eksik anahtar ile bozuk değer ayrılır; eski liste işlem içinde doğrulanır. Yeni kayıt da geçerli olmalıdır. Bozuk kayıt aynen korunur. `gecmisKoruma.test.ts`.                                                                                 |
| F20 | Yüksek  | Bozuk yedek listesi yeni yedekle ezilebiliyor; boş/yinelenen kimlik yeterince doğrulanmıyordu.                                                                                            | Liste önce doğrulanır; hata varsa bayt/liste/silme yazısı başlamaz. Kimlikler dolu ve benzersizdir. Koruma testleri.                                                                                                                           |
| F21 | Orta    | Geçmiş saat dilimi metnine göre sıralanıyor; aynı an farklı ISO biçimiyle iki kayıt olabiliyordu.                                                                                         | Gerçek zaman damgasına göre sıralama/tekilleştirme yapılır; yerel yedek bağlantısı korunur. Saat dilimi testi.                                                                                                                                 |
| F22 | Orta    | Ayrılan OAuth isteği geç yanıt veya bir dakikalık süre dolana kadar bağlantı kilidini tutabiliyordu.                                                                                      | Ayırma bekleyen isteği hemen sonlandırır; yeni bağlantı başlatılabilir, geç yanıt bağlanmaz. `drive.test.ts`.                                                                                                                                  |
| F23 | Yüksek  | Drive hesabı kontrolü yalnızca erişim belirtecini karşılaştırıyordu; yeniden bağlantıda aynı belirteç verilirse eski iş sürebiliyordu.                                                    | İstek ve çok adımlı işlemler belirteç ile bağlantı nesline birlikte bağlanır. Aynı/farklı belirteç regresyonları.                                                                                                                              |
| F24 | Orta    | Tekrarlanan boş Drive sayfaları listelemeyi sürdürebiliyor; bazı boyut/özet metaverileri biçim açısından doğrulanmıyordu.                                                                 | Tekrarlanan sayfa anahtarı ve 100 sayfa sınırı denetlenir; boyut/özet biçimi doğrulanır. Döngü ve bozuk metaveri testleri.                                                                                                                     |
| F25 | Orta    | Drive’da ilk 20 kayıt dışındakilere arayüzden erişilemiyordu; gizli rapor ekranında eski hesabın listesi/başarısı kalabiliyordu.                                                          | “Daha fazla göster” ile devamı açılır; rapor akışları bağlantı neslinde yenilenir, ayar seçimi temizlenir. Üç Drive tarayıcı testi.                                                                                                            |
| F26 | Orta    | Dosya/yedek/geçmiş iş akışı arayüz klasöründeydi; saf Drive kayıt çözme ve birleştirme platformdaydı; bağımlılık denetimi eksikti.                                                        | İş akışı `raporlar/depoKontrol/dosyaIslemleri.ts`, saf kurallar `cekirdek/` altında. ESLint çekirdekte tarayıcı globallerini, işlem katmanlarında React/arayüzü ve arayüzde statik Excel motorunu sınırlar. Tip/lint ve mevcut regresyonlar.   |
| F27 | Orta    | İlk ürün satırına `4,5` girildiğinde sessizce 5 yapılıyordu.                                                                                                                              | Tam sayı zorunludur; yanlış taslak açıklanır ve önceki ayar korunur. Tarayıcı testi.                                                                                                                                                           |
| F28 | Orta    | README ve gizlilik sayfası, uygulanmış olmasına rağmen otomatik kart aktarımı yok diyordu.                                                                                                | Yardımcının geçici veri, süre, cari kontrolü, numara/tarih doldurma ve temizleme davranışı açıklanır. Kaynak davranışıyla metin karşılaştırması.                                                                                               |
| F29 | Düşük   | Üzerine yazma açıklaması yalnızca B/D/G2 diyordu; “bütün ayarlar” yalnızca rapor ayarlarını sıfırlıyordu; OCR puanı güven oranı gibi görünüyordu; kurulum Edge ile sınırlı anlatılıyordu. | Miktar/tarih/formül ve ürün ekleme açıklandı; rapor ayarı düğmesi adlandırıldı; OCR puanının doğruluk garantisi olmadığı yazıldı; Chrome/Edge/Brave ve Linux ZIP yolu açıklandı. Hazır olmayan rapor metni ve eski kayıt yorumları düzeltildi. |

## Hesap uyumluluğu ve bilinçli sınırlar

Geçerli dosyanın hesabı değişmedi: aynı ürünlerin hazır kilogramı toplanır, donuk ürün kuralı,
tekrarlar, tolerans ve üç haneli yuvarlama sürer. Serbest sayı dönüştürücü tarihsel uyumluluk için
korunur; dış LED miktarı ayrı sıkı doğrulayıcıdan geçer.

Gerçek örnekler iki önemli yapıyı gösterdi: LED grup başlığı kod/ad/miktar boyunca birleşik bir
hücre olabilir; sayımın dip toplam formülünde hesaplanmış sonuç bulunmayabilir. Grup satırı ancak
birleşim yapısı doğrulanınca eski sıfır katkısıyla okunur. Sonucu olmayan dip toplam için ürün
satırları toplanır; ürünün kendisindeki sonucu olmayan miktar formülü ise reddedilir. Gerçek dosya
kabulünü bozan genel bir “metin/formül varsa hata” kuralı uygulanmadı.

Formül kaydırıcı tam Excel formül ayrıştırıcısı değildir. Yaygın yerel/dış sayfa aralıkları ve
korunan tablo başvuruları sınandı; bilinmeyen yeni formül yapıları için sentetik ve gerçek Excel
örneği gerekir. Dosya yazımı hâlâ önceki içeriği/yedeği kontrol eder; uygulama bütün Excel özelliklerini
koruyan genel bir Excel editörü olarak sunulmaz.

## Gerçek ortamda açık kalan kabul ve riskler

| Konu                              | Kanıt ve sınır                                                                                                                                                                                                                   | Sonraki somut adım                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sağlayıcı giriş güvenliği         | Giriş bilgileri cari numarasından sağlayıcı kuralıyla türetiliyor. Tarayıcıda dağıtılan bu kural gizli anahtar veya kullanıcı yetkilendirmesi değildir. Sağlayıcı tarafındaki güvenlik/oturum/sözleşme bu taramayla kanıtlanmaz. | Sağlayıcı/kurum yetkilisi resmi giriş ve otomasyon sınırını doğrulamalı; doğrulanmış alternatif olmadan giriş kuralı tahmin edilerek değiştirilmemeli.             |
| Gerçek POS ekranı ve ortak oturum | Görünen cari numarasını karşılaştırma, sekmeye bağlama ve boş alan kontrolü yapıldı. Sağlayıcı başka sekmelerde ortak oturumu değiştirebilir; gerçek arka uç işlemi uygulamadan okunmaz.                                         | Kurumun izin verdiği boş ekran akışında cari/alan eşleşmesi kontrol edilmeli. Kullanıcının ekranı tek başarılı aktarım gözlemidir; müşteri kartıyla test yapılmaz. |
| Windows/masaüstü Excel            | Sentetik kayıt arızaları ve gerçek dosya çıktısı doğrulandı. Linux tarayıcı testi, Windows açık Excel dosyası kilidinin veya tarayıcı kurulumunun fiili kabulü değildir.                                                         | Yapay Excel dosyasıyla Windows’ta aç/kaydet/açık dosya davranışı kontrol edilmeli. Windows CI kurulum hazırlama testi ayrıca korunuyor.                            |
| Canlı Google Drive                | OAuth/Drive taklitleri, izin, iptal, hesap değişimi, yükleme ve boyut sınırları denetlendi. Gerçek kullanıcı OAuth istemcisi kurulumu tamamlanmış sayılmaz.                                                                      | [Drive kurulumunu](DRIVE.md) kullanıcı hesabında tamamlayıp yapay dosyayı gönderme/ikinci cihazda açma kabulü yapılmalı.                                           |
| Yıl bilgisi olmayan gün sayfaları | GG.AA sayfalarının yılı bugüne göre çıkarılır; aynı gün/ay için bilinen başka yıl artık reddedilir. Tam bir eski yıl kitabının gerçek yılı yalnızca sayfa adından kesin bulunamaz.                                               | Yıllık dosyaları ayrı tutun. Çok yıllı kullanım istenirse açık yıl/şablon gereksinimi ve örneği belirlenmeli.                                                      |
| Yerel kart erişimi ve pano        | Cihaz anahtarı aynı tarayıcı profilindedir; PIN’siz kullanım kullanıcı tercihi olarak sürer. Profil erişimi, kötü amaçlı yazılım ve pano geçmişine karşı kullanıcı doğrulaması değildir.                                         | Kurumun tarayıcı/işletim sistemi profil erişimi ve taşınabilir yedek saklama düzeni uygulanmalı. Şifreleme tek başına uyumluluk belgesi değildir.                  |
| OCR                               | Yapay görüntü matrisi ve yerel worker sınandı; puan doğruluk olasılığı değildir. Gerçek kart fotoğrafıyla test yapılmadı.                                                                                                        | Her aday kullanıcı tarafından fotoğrafla karşılaştırılır; eksik rakamlar tahmin edilmez. Yeni sentetik biçimler ayrı regresyon olur.                               |
| Envanter, bakiye, palet/kasa      | Sayfalar henüz hazır değildir; hata ile eksik ürün kapsamı ayrıldı. Kolon/eşleme/dönüşüm kuralları ve kabul örnekleri yoktur.                                                                                                    | LED örneği ve elle hazırlanmış beklenen rapor sağlanmalı; uydurma dönüşüm/kolon eklenmemeli.                                                                       |
| Büyük dosya ve işlem sonucu       | Boyut/ZIP/kitap/grup sınırları riski azaltır; senkron Excel/JSON çözümlemesini çalışan anda zorla kesmek mümkün değildir. Bir dış yazı iptal edildiğinde daha önce tamamlanan kısmı geri alınmış sayılmaz.                       | Sınırda büyük sentetik dosya performansı ihtiyaç halinde ölçülmeli; belirsiz yazıdan sonra liste/dosya kontrol edilerek devam edilmeli.                            |

## Doğrulama kaydı

Yerel sonuç: **31 dosyada 397 kural/Excel testi ve 88 Chromium senaryosu başarılı**.
Gerçek örnekler bulunduğu için gerçek Excel/ikiz testleri de çalıştı. Tip, lint, biçim ve derleme geçti.
Açık/koyu/dar sentetik POS ekranları incelendi; yatay taşma denetimi geçti.
Yayın durumu [oturum notunda](OTURUM_NOTU.md) tutulur.

- Tip, lint, biçim, birim/gerçek Excel ve derleme: `npm run kontrol`.
- Chromium, IndexedDB, gerçek yerel OCR ve MV3 yardımcı: `npm run test:tarayici`.
- Yeni ana regresyonlar: `genelTarama.test.ts`, `gecmisKoruma.test.ts`, `genelTarama.spec.ts`,
  `driveGenelTarama.spec.ts`; ekler: `drive`, `oturum`, `kayitGuvenligi`, `excelYazma` testleri.
- 4 Ekim 2026 `npm audit`: **0 bilinen bağımlılık açığı**, 320 bağımlılık envanteri.
  Bu sonuç uygulamanın her güvenlik koşulunu karşıladığı anlamına gelmez.
- Ekran görüntüleri, hata bağlamları ve geçici çıktılar `/tmp/` içinde, şirket örnekleri
  `ornekler/` içinde Git dışındadır. Gerçek kullanıcı görüntüsü rapora/yayına kopyalanmadı.

Önceki POS/OCR raporları kendi sürümlerinin tarihsel kayıtlarıdır. Güncel kurallar için
[İş kuralları](IS_KURALLARI.md), [mimari](MIMARI.md), [Sanal POS](SANAL_POS.md) ve
[POS yardımcısı](POS_YARDIMCISI.md) belgeleri birlikte okunmalıdır.
