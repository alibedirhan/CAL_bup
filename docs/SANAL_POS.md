# Sanal POS — 1.6.0

Cari profili ve isimli kart yönetimi gerçek uygulamanın Sanal POS bölümündedir. Seçilen carinin
altında “Kayıtlı kartlar / Kart ekle” görünür. Elle kart kaydı, fotoğraftan numara/tarih okuma,
düzenleme/silme, kart sahibinin isteğe bağlı iletişim telefonu, maskeli liste ve kontrollü
numara/tarih/ad gösterme-kopyalama vardır. Tutar ve banka doğrulaması POS/banka ekranında yapılır.

## Kullanım ve sınırlar

1. Sanal POS’u açın. Eski kasa varsa mevcut PIN/parolayı bir kez girerek carileri taşıyın;
   öncesinde ayrı uzun parolalı eski cari yedeği indirme seçeneği vardır. Sonraki açılışlar PIN’sizdir.
2. Cariyi seçin veya “Yeni cari” ile kaydedin. Kaydetme sonrası cari seçilir.
3. “Kart ekle” ile kart adı, numara, son kullanma, kart üzerindeki ad ve isteğe bağlı telefonu girin.
   Fotoğraf seçmek zorunlu değildir. Okunan numara/tarihi fotoğrafla karşılaştırıp açıkça uygulayın;
   gerekirse önizlemeden döndürün/kırpın. Kaydetmeden önce kart ve cari kontrol kutusunu işaretleyin.
4. Kartı açıkça seçin. Kurulu Edge yardımcısıyla “Seçili kartla POS’u aç” cari numarasını karşılaştırır,
   tanıtılmış kart numarası/S.K.T alanlarını doldurur. İlk kurulum için [POS_YARDIMCISI.md](POS_YARDIMCISI.md).
   Elle akışta “POS’u aç” ile giriş yapıp firma adı/numarasını kontrol ettiğinizi işaretleyin;
   numara gösterme/kopyalama açılır. Elle beyan sağlayıcı doğrulaması değildir.
5. Tutar, CVV ve banka doğrulaması yalnızca POS/banka ekranlarında tamamlanır.

**Numara/S.K.T doldurma ayrı, dar yetkili MV3 yardımcısıyla mümkündür; ödeme/SMS otomasyonu yoktur.**
Sağlayıcının kart API'si doğrulanmış değildir. Yardımcı kullanıcı tarafından boş alanları tanıtılmış
sayfada çalışır; görünen cari numarası zorunludur, değişmiş alanlar/iframe desteklenmez.
Mevcut cari giriş formu kart/ödeme API'si değildir. Gerçek ödeme isteği veya tahmin edilen uç eklenmedi.

- Kart seçmek giriş, ödeme veya SMS göndermez; tutar/bakiye hesaplanmaz ve saklanmaz.
- Telefon kart sahibinin **iletişim kaydıdır**; bankadaki telefon veya SMS/mobil onay hedefi değişmez.
- Vergi/TC numarası 10–11 ASCII rakam, kart numarası 12–19 ASCII rakam + Luhn. Bu kontroller sahiplik,
  aktif kart veya başarılı ödeme kanıtı değildir. Telefon Türkiye cep telefonu biçiminde normalize edilir.
- Kartın cari bağı rastgele kimliğedir; ad/liste sırası kullanılmaz. Aynı caride aynı numara tekrar
  eklenmez. Aynı kart başka cariye açıkça ayrı kayıt olarak eklenebilir; mevcut kart başka cariye taşınmaz.
- Cari değişimi ve veri yenilenmesi kart seçimini ve firma beyanını sıfırlar. Yeni POS giriş isteği ve
  farklı kart seçimi firma beyanını sıfırlar. Gizli sekmede ve iki dakika boşta tam numara/form kapanır;
  bunlar PIN doğrulaması yaratmaz, açık sağlayıcı sekmesini etkilemez.
- Süresi geçmiş kartlar okunur/düzenlenir/silinir, işlem için seçilemez veya yeni kayıt olarak kaydedilemez.
- Cari silme bağlı kartlarını aynı veri aktarımında siler; kullanıcıya kart sayısı gösterilir.
- CVV/CVC, banka PIN’i, OTP/SMS kodu, fotoğraf, ham OCR, serbest not, ödeme tutarı/sonucu kaydı yoktur.
  Şema ek alanları reddeder. Ad gibi serbest metne sır yazılması tamamen önlenebilir diye iddia edilmez.

## Şifreli yerel depo ve geçiş

- `cekirdek/posKart.ts`: saf numara/telefon/tarih/metin/maskeleme kuralları.
- `cekirdek/posProfil.ts`: sürüm 2 şema, kimlik ilişkileri, cari/kart CRUD ve çelişkili yedek denetimi.
- `platform/posProfilSifreleme.ts`: rastgele dışa aktarılamayan AES-256-GCM cihaz anahtarı; her yazıda
  12 bayt yeni IV ve yeni revizyon, 128 bit doğrulama etiketi. Biçim/sürüm/kip/kimlik/revizyon/IV/KDF/tuz
  AAD’ye bağlıdır. Yeni zarf `cal-bup-pos-profil` biçimiyle eski sürümden açıkça ayrılır.
- `platform/posProfilDeposu.ts`: aynı `sanal-pos-kasa-v1` anahtarında sürüm değişimi; cihaz AES anahtarı
  `sanal-pos-profil-anahtar-<kimlik>` altındadır. Anahtar ve zarf oluşturma/dönüşüm tek IndexedDB aktarımıdır.
  Eski uygulama yeni zarfı geçersiz sayar; boş kasa olarak sıfırlayamaz.
- Günlük açılışta tarayıcı anahtarı kullanılır. Anahtar aynı tarayıcı/origin kodunca kullanılabilir;
  donanım kasası veya kullanıcı doğrulaması değildir. Bu tarayıcıya erişen kişi veriyi açabilir.
  Şifreleme PCI uyumluluğu kanıtı değildir. Sağlayıcının token desteği varsa tam numara yerine tercih edilir.
- Eski v1/v2 kasa mevcut PIN/parolayla `PosKasasi` üzerinden çözülür; kimlikler/numaralar korunur.
  Yeni şifreli zarf bellekte çözülerek doğrulanır; eski zarf hâlâ aynıysa anahtar/zarf değiştirilir,
  eski HMAC anahtarı ve deneme sayacı aynı aktarımda silinir. Yanlış parola/dönüşüm hatası eski kaydı korur.
  Eski şifreleme sınıfları yalnızca geçiş/yedek uyumluluğunda kalır; eski günlük kilit ekranları kaldırıldı.
- Okuma hatası/bozuk zarf/kayıp anahtar boş liste değildir. Oturumun beklenen zarfı kayıtta karşılaştırılır;
  başka sekme değiştiyse eski veri yazılmaz. BroadcastChannel varsa diğer sekme yeniden okur ve
  seçimini/formunu temizler. Kanal bulunmasa da atomik çakışma denetimi çalışır.
- Depo işlemleri en geç 45 saniyede durdurulur. İptal/rota çıkışında nesil denetimi geç sonuçları
  reddeder. Daha önce başlamış aktarım bitmiş olabilir; durdurma kesin geri alma değildir. Belirsiz
  sonuçta yeniden okuma gerekir; otomatik yeniden yazma yoktur.
- 500 cari, cari başına 10 kart; zarf/yedek en fazla 2 MiB. Bütün alanların azami doluluğu aynı anda
  sığmak zorunda değildir; toplam bayt sınırı yazmadan önce denetlenir ve aşımda kayıt reddedilir.
- Cari/kartlar rapor, Drive, URL, dosya adı, günlüklere veya hata mesajlarına eklenmez.
  Pano yalnızca açık kullanıcı düğmesinde kullanılır; pano geçmişini temizleme garantisi yoktur.

## Yedek ve geri yükleme

`.calpos` profil yedeği carileri, kart numaralarını ve telefonları içerir. İndirmeden önce bu içerik
ve en az 14 karakterlik ayrı uzun parola açıklanır. Yedek PBKDF2-HMAC-SHA256 / 600.000 + AES-GCM ile
yeniden şifrelenir; cihaz anahtarı ve kimliği taşınmaz. Yedek hazırlarken güncel zarf tekrar kontrol edilir.
Eski yalnızca-cari yedekler de eski uzun parolalarıyla okunur; yeni biçim eski uygulamada reddedilir.

Geri yükleme önce çözme, şema doğrulama ve maskeli inceleme sunar. Açık “İnceledim, kayıtları ekle”
düğmesi olmadan yazı yoktur. Numara/adı aynı cari mevcut kimliğe eşlenir; kartları o kimliğe bağlanır.
Tam aynı kart çoğaltılmaz; farklı bilgi/kimlik çelişkisi tüm işlemi durdurur. Mevcut liste sessizce ezilmez.
Tarayıcı verisi temizlenirse yedek gerekir. Silme daha önce indirilmiş yedekleri veya kullanıcının özgün
fotoğrafını silemez. Unutulan yedek/eski kasa parolasını kurtarma servisi yoktur.

## Yerel fotoğraf okuma

`cekirdek/posKartFotografi.ts` JPG/PNG/WebP başlığındaki boyutu görüntü çözülmeden denetler:
10 MiB, 20 megapiksel; hareketli WebP reddedilir. Kod/HTML/SVG görüntü diye işlenmez. Çözülen boyut
ikinci kez denetlenir. Okuma görüntüsü en uzun kenarı 2400 piksele düşürülerek geçici canvas’a çizilir.

`platform/posKartOkuma.ts` Tesseract.js 7.0.0 modelini `platform/ocr/` adaptörüyle ayrı native
worker'da çalıştırır. Referans worker oluşturulurken alınır; kurulum/model başarısız olsa bile
iptal/90 saniye sınırı sonlandırmayı sağlar. Sürümün mesaj protokolüne bağımlı küçük adaptördür;
bağımlılık yükseltmesinde gerçek OCR ve worker/model/WASM arıza testleri gerekir.
Worker, WASM ve model kendi yayınımızdadır; CDN/harici OCR veya model önbelleği yoktur.

Dört yön, sınırlı küçük eğiklik ve kontrast dönüşümüyle beş genel deneme yapılır. PAN yoksa aynı
fotoğrafın seçilmiş yönünde dört numara şeridi denemesi eklenir; toplam en fazla dokuz/90 saniye. Tuval kenarı
2400 piksel sınırındadır; küçük görüntü en fazla iki kat büyütülür. Çıktı yalnızca Luhn geçen PAN,
tarih adayları ve bu adayların geçici güven/konum bilgisidir. Ad/telefon/CVV çıkarılmaz; ham metin
form/veri deposuna çıkmaz. Kesilen kenar adayları ve etiketsiz dört rakamlık olası CVV/tarih tahmin edilmez.

Fotoğraf form alanlarını otomatik değiştirmez. Önizlemedeki adaylar ayrı seçilir, fotoğrafla kontrol
kutusu ve “Kontrol ettiğim alanları uygula” ile PAN/tarih birlikte uygulanır. Eksik alanın boşaltılacağı
önceden açıklanır; eski tarih yeni numarayla sessiz birleşmez. Elle değişiklik eski adayları kaldırır.
Döndürme/kırpma sonrası yeniden okuma gerekir; bu kontrol kart sahipliği doğrulaması değildir.
Yalnızca tarih okunmuşsa PAN inceleme alanında elle tamamlanabilir; Luhn geçmeyen PAN uygulanamaz.
Uygulama numara girdisine odaklanır; fotoğraf alanları onaysız doldurulmaz.

İptal/form/rota/sekme çıkışında worker, canvas ve önizleme URL'si kapatılır; eski sonuç uygulanmaz.
Fotoğraf/ham OCR saklanmaz veya dışarı gönderilmez. JS/işletim sistemi belleğinin kesin silinmesi
iddia edilmez. [Üç aşama kapanış ve ölçüm raporu](OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md).

## Giriş isteği

`platform/posGiris.ts` yalnızca “POS’u aç” tıklamasında sabit
`https://denizpay.bupilic.com.tr/login.aspx` adresine geçici HTML formuyla POST yapar.
`lvergino/lkullaniciadi/lsifre/btngiris` ve boş `__VIEWSTATE` gider; kart, telefon, CVV veya tutar gönderilmez.
URL/referrer/opener içinde sır yoktur; form alanları boşaltılıp kaldırılır. Giriş sonucu/firma/ödeme
okunamaz. Kullanıcı seçilen cariyle girişin çalıştığını bildirdi; tüm hesaplar doğrulanmış sayılmaz.
Sağlayıcı giriş kuralı zayıftır; CAL bup bunu güçlendiremez. Önceki cari oturumundan kullanıcı çıkmalıdır.

## Doğrulama ve kaynaklar

`npm run kontrol` ve `npm run test:tarayici` yayın öncesinde/CI’da çalışır. Kart/depo testleri gerçek
Web Crypto; tarayıcı testleri gerçek Chromium/IndexedDB ve yerel OCR kullanır. POS taklittir; gerçek
hesaba giriş veya ödeme testi yapılmaz. Sahiplik/PCI/Windows Excel/sağlayıcı oturumu bu testlerle kanıtlanmaz.
1.6.0 MV3 paketi gerçek Chromium'a yüklenir; giriş/ödeme ekranları yapaydır ve canlı ağa kapalı
proxy ile sınırlandırılır. Güncel teknik kabul ve ilk düzeneğin yönlendirme düzeltmesi:
[POS_YARDIMCISI.md](POS_YARDIMCISI.md).

- [İlk plan ve sınırlar](SANAL_POS_PROFIL_PLANI.md).
- [Tesseract yerel dağıtım](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
- [PCI CVV saklama sınırı](https://www.pcisecuritystandards.org/faqs/1280/).
- [PCI fotoğraf kapsamı](https://www.pcisecuritystandards.org/faqs/1070/).
- [PCI şifreleme kapsamı](https://www.pcisecuritystandards.org/faqs/1086/).
- [DenizBank entegrasyon](https://www.denizbank.com/isim-icin/kurumsal-ve-ticari-bankacilik/uye-isyeri-ve-pos-islemleri/pos-urunleri/sanal).
