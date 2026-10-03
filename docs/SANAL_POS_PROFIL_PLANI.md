# Sanal POS — cari profili ve kayıtlı kartlar planı

Tarih: 3 Ekim 2026. Bu belge ilk planı ve kabul ölçütlerini korur.
**1.4.0’da planın 1–6. uygulama adımları gerçek programa eklendi:** cari profili, elle kart yönetimi,
telefon, günlük PIN’siz şifreli depo, eski kasa geçişi, kartlı yedek ve yerel fotoğraf okuma.
Güncel davranış ve doğrulama: [SANAL_POS.md](SANAL_POS.md).
**7. adım otomatik POS kart aktarımı için sağlayıcının desteklediği sözleşme hâlâ gerekiyor.**
Kullanıcı eksik uygulama işlerinin tamamlanmasını yetkilendirdi; ilk tasarım üretim özelliğinin
kendisi değildir. Aşağıdaki gelecek zamanlı maddeler bu ilk planın tarihsel anlatımıdır.

İlk etkileşimli tasarım proje deposunun dışında, üst çalışma klasöründeki
**Sanal POS profil tasarimi.html** dosyasındadır. Tarayıcıda çevrimdışı açılır; yalnızca yapay
kart numaraları kabul eder, kalıcı depoya/panoya yazmaz ve POS’a bağlanmaz. Arama, normal/boş kart
listesi, seçim, elle ekleme/düzenleme/silme/iptal ve açık/koyu/dar görünüm denenebilir. Cari kaydı
mevcut üretim formuna bırakılmıştır; fotoğraf, gerçek şifreli kayıt, yedek/migrasyon ve otomatik
kart aktarımı bu önizlemede uygulanmış sayılmaz. Tek dosyalı çıktı da Chromium’da doğrulandı.

## Amaç ve kullanıcı kararları

Kullanıcı cari profilinde isim verdiği kartları tutmak, gerektiğinde kart bilgilerini elle eklemek,
telefon bilgisini kaydetmek ve tekrar işlem yaparken kartı seçmek istiyor. Günlük kullanımda ayrı
kasa PIN’i istemiyor. Tutarı kendisi POS’ta girecek; banka doğrulamasını orada başlatacak.
Eklentisiz, sunucusuz ve tarayıcıda yerel çalışma tercihi sürüyor.

Telefonun cari başına tek kayıt mı, kart sahibine bağlı kayıt mı olacağı kullanıcıya soruldu.
Yanıt gelene kadar tasarım **kart başına isteğe bağlı iletişim telefonu** varsayımıyla hazırlanır;
kesinleşmiş tercih diye anlatılmaz. Aynı carinin kart sahipleri farklı olabilir.

## Birbirinden bağımsız üç yetenek

1. **Cariyle POS’a giriş:** 1.3.1’de var; seçilen carinin giriş bilgilerini gönderir.
2. **Cari profili ve kayıtlı kart yönetimi:** bu planın ilk uygulanacak bölümüdür.
3. **Seçilen kartı POS alanlarına otomatik aktarma:** sağlayıcının desteklediği yöntem henüz
   doğrulanmadı. Mevcut giriş formu gönderimi kart/ödeme entegrasyonu değildir. Ödeme sayfasının
   uçlarını, alanlarını, oturum davranışını veya telefon yönlendirmesini tahmin ederek kod yazılmaz.

İlk aşamada seçilen kart bilgileri kullanıcının açık düğmesiyle gösterilebilir/kopyalanabilir.
Üretim ekranında çalışmayan bir “Kartı POS’a aktar” veya “SMS gönder” düğmesi bulunmaz.
Sağlayıcı otomatik kart aktarımını desteklerse ayrı adaptör ve ayrı doğrulama ile eklenir.
Kart seçmek giriş, ödeme veya SMS gönderimi başlatmaz. Tutar uygulamada saklanmaz/üretilmez.

## Ekran akışı

- Solda cari araması ve liste; sağda seçilen carinin **profil başlığı, kart listesi ve giriş yardımı**.
- Profil başlığında cari adı, maskeli vergi/TC numarası, düzenleme ve “POS’u aç”.
- “Kayıtlı kartlar” bölümünde isim, son dört rakam, son kullanma tarihi ve seçim durumu.
- İlk açılışta hiçbir kart ödeme için kendiliğinden seçilmez; kullanıcı açıkça seçer.
- “Kart ekle” ilk aşamada elle form açar. Cari adı formun içinde sabit görünür; başka cariye
  yanlış kayıt açılmasını azaltır. Yeni/düzenlenen alanlar kontrol onayını sıfırlar.
- Seçilen kartta kart sahibi ve isteğe bağlı iletişim telefonu görünür. Numara varsayılan maskelidir.
- Kart bilgileri gösterme/kopyalama önce kullanıcının POS’taki firma adı ve numarayı karşılaştırdığını
  beyan etmesini ister. Bu beyan sağlayıcı doğrulaması veya POS’ta ödeme engeli değildir.
- Cari değişimi, kart numarası/sahibi değişimi ve yeni POS giriş isteği önceki firma/kart kontrolünü
  sıfırlar. Açık kart bilgileri kapanır. Başka carinin kartı seçili kalamaz.
- Kart silmede kart adı, son dört rakam ve cari adı açıkça gösterilir. Cari silmede bağlı kart
  sayısı belirtilir. İşlem tek kayıt aktarımında tamamlanır; yarım silme yoktur.
- Süresi geçmiş kartlar listede görülebilir, işlem hazırlamak için seçilemez; düzeltme/silme sunulur.
- Geniş ekranda iki sütun; dar ekranda cari listesi, profil ve kart bölümleri alt alta.
- Açık/koyu tema mevcut belirteçleri kullanır. Klavye, görünür odak, form etiketleri, açık hatalar,
  ilk/boş/silinmiş/seçili/süresi geçmiş/kayıt hatası/işlem sürüyor durumları tasarlanır.

## Veri alanları

Cari kimliği ve vergi/TC numarası mevcut kayıtlardan korunur. Yeni kart yalnızca seçilen carinin
rastgele kimliğine bağlanır; isim metninden veya liste sırasından bağ kurulmaz.

Kart kaydı:

- Rastgele kart kimliği ve bağlı cari kimliği.
- Kart adı: 2–80 karakter; kullanıcının ayırt edici etiketi.
- Kart üzerindeki ad: isteğe bağlı, en fazla 120 karakter; doluysa geçersiz/görünmeyen karakter reddedilir.
- Kart numarası: metin, boşluklar temizlenir, 12–19 ASCII rakam ve Luhn kontrolü.
- Son kullanma ayı/yılı: ay 1–12, yıl açık dört hane; içinde bulunduğumuz ayın sonuna kadar geçerli.
- İletişim telefonu: isteğe bağlı; Türkiye için 05xx / 5xx / +90 biçimleri normalize edilir.
  İlk aşamada Türkiye cep telefonu desteklenir; başka ülke numarasına açık hata verilir, sessiz kırpılmaz.
- Kullanıcının bu kartı ilgili cari altında kaydetmeyi kontrol ettiğini belirten tarih.

Luhn/telefon biçimi doğru kart sahibi, aktif kart veya SMS hedefi doğrulaması değildir.
Bir caride aynı numaraya ikinci kart açılmaz; aynı kart başka caride kullanılacaksa açıkça
yeniden bağlanır ve kullanıcıdan sahiplik kontrolü istenir. Otomatik cari ilişkilendirmesi yapılmaz.
İlk sınırlar: 500 cari, cari başına 10 kart; yeni şifreli profil yedeği en fazla 2 MiB.
Azami alan boyutlarının birlikte bu sınıra sığıp sığmadığı ölçülür; yazmadan önce toplam sınır kontrolü vardır.

**Kayıtta olmayan alanlar:** CVV/CVC, banka/kart PIN’i, SMS/tek kullanımlık şifre, fotoğraf,
serbest açıklama, ham OCR metni, ödeme tutarı/sonucu, oturum çerezi veya sağlayıcı tokenı.
Serbest açıklama alanı sırların yanlışlıkla saklanmasını kolaylaştırdığı için ilk aşamada eklenmez.
Şema ek alanları reddeder. Cari adı/kart adı gibi metin alanlarına kart numarası veya CVV yazılmasının
tamamen önlenebileceği iddia edilmez; metinlerde gereksiz sır saklanmaması kullanıcıya açıklanır.

## Telefonun anlamı

Alan adı **“Kart sahibinin iletişim telefonu”** olur. Yakınında kısa açıklama:

> Bu kayıt bankadaki telefon numarasını değiştirmez. Doğrulama SMS’inin veya mobil onayın
> gideceği yeri banka belirler.

Telefon, kart sahibiyle iletişim için yerel kayıttır. Bankada kayıtlı olduğu, kullanıcı tarafından
belirtilse bile uygulama bunu doğrulamış sayılmaz. Uygulama bu numaraya ödeme şifresi göndermez.
POS’ta bir telefon alanı varsa sağlayıcının belgelediği amacı doğrulanmadan bu alana bilgi aktarılmaz.
Bazı bankalar SMS yerine mobil onay kullanabilir; “kesin bu numaraya SMS gider” ifadesi kullanılmaz.

## PIN sormadan yerel saklama ve eski kayıtlar

Günlük açılış PIN’i kaldırılacak; bu tercih şifreleme kaldırılması anlamına gelmez. Yeni depoda
Web Crypto ile rastgele, dışa aktarılamayan AES-256-GCM anahtarı ve şifreli kayıt tutulur. Anahtar
aynı tarayıcı profilinde bulunur, uygulama açılışta kullanır. Donanım kasası veya kullanıcı doğrulaması
değildir; bu tarayıcıya erişen kişi kayıtları açabilir. Site içinde çalışan zararlı kod da anahtarı
kullanabilir. Bu sınır kullanıcıya sade şekilde açıklanır; “PIN’siz güvenli kasa” iddiası kurulmaz.

- Var olan v1/v2 kasa varsa mevcut PIN/parola **bir kez** girilerek çözülür. Unutulan parola atlanmaz.
- Önce eski cari listesinin taşınabilir yedeği teklif edilir; eski kayıt değiştirilmeden dönüşüm doğrulanır.
- Cari kimlikleri ve numaraları aynen korunur; yeni kart listeleri boş başlar.
- Yeni anahtar, sürümlü zarf ve veri atomik yazılır. Depo/şifreleme hatasında eski kayıt korunur.
- Yeni şifreli kayıt çözülüp karşılaştırılmadan dönüşüm başarılı sayılmaz. Eski anahtar/sayaçların
  silinmesi doğrulanmış dönüşümün aynı atomik işlemine bağlanır.
- Yeni veri şeması ve zarf sürümü, eski sürümlerin okuyamadığı bilgiyi sessizce atmayacak şekilde ayrılır.
- Sekmeler arası kayıt değişikliği/çakışma denetimi korunur. PIN’siz açılışta değişen veri yeniden okunur;
  eski listeyle üzerine yazılmaz. Seçili kart ve firma beyanı sıfırlanır.
- Sekmeden/rotadan çıkışta ve boşta kalınca açık tam numara/form kapatılır; bu PIN güvenliği yaratmaz.

Kart ve telefon verisi rapor/Drive kayıtlarına karışmaz; koda, günlüklere, hata mesajlarına, URL’ye,
ham dışa aktarıma veya yedek dosya adına yazılmaz. Pano yalnızca kullanıcı düğmesiyle kullanılır;
pano geçmişinin temizlenebileceği iddia edilmez.

## Yedek, geri dönüş ve silme

Taşınabilir profil yedeği ayrı uzun yedek parolasıyla yeniden şifrelenir; cihaz anahtarı yedeğe girmez.
Bu parola günlük kullanımda sorulmaz. Yeni yedek biçiminin kartları içerdiği indirmeden önce açıkça
belirtilir. Eski `.calpos` yedekleri cari bilgisi olarak içe aktarılabilir; yeni yedek eski uygulamaya
verilirse açık sürüm hatasıyla reddedilir. PIN kaldırıldı diye eski yedek parolası değişmez.

Geri yükleme önce doğrulama ve maskeli inceleme sunar. Cari veya kart çelişkisi varsa tüm aktarım
durur; telefon/kart listesi sessizce ezilmez. Yanlış parola, bozuk dosya, eksik anahtar, dolu disk,
engelli IndexedDB, iki sekme ve geç sonuçlar için anlaşılır hata/yeniden deneme vardır.
Tarayıcı verisi temizlenirse taşınabilir yedek gerekir. Bir kartın silinmesi daha önce indirilmiş
yedeklerden veya kullanıcının bilgisayarındaki özgün fotoğraftan veriyi silemez.

## Fotoğraftan okuma — ikinci aşama

Elle ekleme ilk aşamadır; fotoğraf zorunlu değildir. Yerel OCR ayrı aşamada doğrulanır.

- JPG/PNG/WebP; önerilen ilk sınır 10 MiB ve 20 megapiksel. Biçim, boyut ve çözülen piksel sayısı
  kontrol edilir; metin/HTML/SVG dosyası görüntü diye işlenmez.
- Motor/worker/model dosyaları sabitlenerek uygulamayla dağıtılır; CDN veya harici OCR servisi yoktur.
- Numara ve tarih için alan bazında adaylar çıkarılır. Eksik, çoklu, Luhn hatalı ve tarih hatalı
  sonuçlar kullanıcı düzeltmesi ister. Kart adına/telefonuna fotoğraftan tahminle değer yazılmaz.
- Fotoğraftaki CVV için alan çıkarılmaz veya saklanmaz. Ham OCR çıktısı depoya/günlüğe girmez.
- Numara/tarih kullanıcı kontrolünden geçmeden kaydedilmez. Fotoğraf kalıcı saklanmaz; iptal/kayıt,
  cari değişimi, rota çıkışı ve zaman aşımında geçici referanslar/object URL/worker temizlenir.
- Sağlanan gerçek örnek CVV içerir; üretim kodu, test, tasarım ekranı, Git veya yayın varlığına konmaz.
  Test görselleri yalnızca yapay kartlar olur. Gerçek fotoğrafın kullanıcının özgün dosyasından
  otomatik silineceği söylenmez; o dosya uygulamanın kontrolünde değildir.

## Mimari ve geliştirme sırası

POS profil işlemleri büyürken ekranlara iş kuralı/şifreleme kodu eklenmez:

- `cekirdek/`: kart, telefon, tarih, şema, çakışma ve maskeleme için saf kurallar/port sözleşmeleri.
- `sanalPos/`: profil işlem akışı ve ekran durum makinesi; depoyu porttan çağırır. Seçili cari/kart
  bağını ve kontrol beyanlarını burada yönetir; React, DOM, IndexedDB ve ExcelJS bilmez.
- `platform/`: mevcut IDB sınırlarını kullanan şifreli profil deposu, eski kayıt dönüşümü,
  yedek ve ileride yerel OCR/POS adaptörleri. Depo anahtarı değişirse eski kayıt sessizce boş sayılmaz.
- `arayuz/sayfalar/pos/`: arama, profil başlığı, kart listesi, kart formu, seçilen kart yardımı ve
  bakım bileşenleri. Her dosya yaklaşık 400 satır altında kalır.

1. Bu plan ve gerçek veri içermeyen etkileşimli tasarım.
2. Saf kart/telefon kuralları ve eski veri dönüşüm sözleşmesi; birim testleri.
3. PIN’siz şifreli depo, eski kasadan kayıpsız dönüşüm, uzun parolalı taşınabilir yedek.
4. Cari profili, elle kart ekleme/düzenleme/silme ve kontrollü gösterme/kopyalama.
5. Kalıcı tarayıcı testleri, açık/koyu/dar görünüm, yayımlama öncesi veri sızıntısı denetimi.
6. Yerel fotoğraf okuma; OCR doğruluğu/veri yaşam döngüsü ayrı doğrulanır.
7. Sağlayıcının desteklediği kart aktarımı; belgeli sözleşme olmadan ödeme uçları eklenmez.

## Kabul ölçütleri

- Eski kasadaki cariler kimlik/numara kaybetmeden dönüşür; başarısız geçiş eski kaydı korur.
- Günlük açılışta PIN sorulmaz; yeni depoda açık kart numarası/telefon metni bulunmaz.
- A carisinde seçilen kart B carisine geçince seçili/açık kalmaz. Geri yükleme/silme/düzenleme de
  seçili kart bağını yeniden denetler. Adı aynı olan listelerden veya sıradan eşleme yoktur.
- Eksik/geçersiz/süresi geçmiş numara veya tarih anlaşılır hata verir; para işlemi başlatılmaz.
- Telefonun biçimi doğrulanır; bankanın SMS hedefinin değiştiği veya doğrulandığı iddia edilmez.
- CVV/OTP/fotoğraf/ham OCR kayıt/yedek/log/API şemasına giremez; ek alanlı yedek reddedilir.
- İki sekmede eşzamanlı kayıt veriyi ezmez; depo hatası boş profil olarak yorumlanmaz.
- Yedek başka cihazda açılır; yeni biçimde kartlar kaybolmaz, çelişkide geri yükleme durur.
- Tasarım/otomatik testler yapay veriyle ve taklit POS’la çalışır; canlı hesaba veya ödeme uçlarına
  test isteği gitmez. Windows’ta cari değiştirme/önceki POS sekmesi kullanıcıyla ödemesiz denenir.
- Tüm kontroller geçer; tam kart numarası saklamak PCI uyumluluğunun kanıtı diye sunulmaz.
  Saklama gereksinimi ve kabul koşulları ödeme sağlayıcısıyla değerlendirilir. Resmi kart tokenı
  desteği varsa ham numara yerine sağlayıcı kaydı tercih edilir; destek varmış gibi davranılmaz.

## Kaynaklar

- [PCI: CVV tekrar kullanmak için saklanamaz](https://www.pcisecuritystandards.org/faqs/1280/).
- [PCI: kart fotoğrafları da kart verisidir](https://www.pcisecuritystandards.org/faqs/1070/).
- [PCI: şifreleme tek başına kapsamı ortadan kaldırmaz](https://www.pcisecuritystandards.org/faqs/1086/).
- [Garanti BBVA: kart doğrulaması ve telefon bilgisi](https://www.garantibbva.com.tr/kartlar/guvenliginiz-icin).
- [Ziraat Bankası: bankada tanımlı telefona 3D Secure SMS](https://www.ziraatbank.com.tr/tr/Bireysel-ZB/Kartlar/Documents/ZB_3D_Secure_SSS.pdf).
