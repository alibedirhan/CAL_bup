# Sanal POS — 1.18.0

Cari profili ve isimli kart yönetimi gerçek uygulamanın Sanal POS bölümündedir. Seçilen carinin
altında “Kayıtlı kartlar / Kart ekle” görünür. Elle kart kaydı, fotoğraftan numara/tarih okuma,
düzenleme/silme, kart sahibinin isteğe bağlı iletişim telefonu, isteğe bağlı CVV ve maskeli liste vardır.
**Kart numarası ve CVV ekranda açık gösterilmez, panoya kopyalanmaz; kart yalnız POS yardımcısıyla
aktarılır** (1.18.0, kullanıcı kararı). Tutar ve banka doğrulaması POS/banka ekranında yapılır.

## Kullanım ve sınırlar

1. Sanal POS’u açın. İlk açılışta **Sanal POS parolası** belirlenir (en az 10 karakter, harf ve rakam).
   Sonraki açılışlarda, sayfa yenilenince, tarayıcı kapanınca ve 10 dakika işlem yapılmayınca parola
   sorulur. “Şimdi kilitle” ile hemen kilitlenir. 1.17 ve öncesinin parolasız kaydı ilk açılışta yeni
   parolayla yeniden şifrelenir. Eski PIN’li kasa varsa önce mevcut PIN bir kez girilir, sonra parola belirlenir.
2. Cariyi seçin veya “Yeni cari” ile kaydedin. Cari profilinin başında “Cariyi düzenle / Cariyi sil”.
3. “Kart ekle” ile kart adı, numara, son kullanma, kart üzerindeki ad, isteğe bağlı CVV ve telefonu girin.
   Fotoğraf seçmek zorunlu değildir. Okunan numara/tarihi fotoğrafla karşılaştırıp açıkça uygulayın.
4. Kartı açıkça seçin. Kurulu yardımcıyla “Seçili kartla POS’u aç” cari numarasını karşılaştırır,
   tanıtılmış alanlara kart numarası, S.K.T, Ad Soyad ve kayıtlı CVV’yi yazar. İlk kurulum:
   [POS_YARDIMCISI.md](POS_YARDIMCISI.md). Yardımcı kurulu değilse “Elle POS’a giriş” yalnız cari girişini
   yapar; kart POS’a elden yazılır.
5. Tutar ve banka doğrulaması yalnızca POS/banka ekranlarında tamamlanır.

- Kart seçmek giriş, ödeme veya SMS göndermez; tutar/bakiye hesaplanmaz ve saklanmaz.
- Telefon kart sahibinin **iletişim kaydıdır**; bankadaki telefon veya SMS/mobil onay hedefi değişmez.
- Vergi/TC numarası 10–11 ASCII rakam, kart numarası 12–19 ASCII rakam + Luhn, CVV 3–4 rakam.
- Kartın cari bağı rastgele kimliğedir. Aynı caride aynı numara tekrar eklenmez; mevcut kart başka
  cariye taşınmaz. Cari silme bağlı kartlarını aynı veri aktarımında siler (kart sayısı gösterilir).
- Süresi geçmiş kartlar okunur/düzenlenir/silinir, işlem için seçilemez veya yeni kayıt olarak kaydedilemez.
- **CVV (1.17.0):** Kullanıcı 2026-10-08'de, PCI DSS'nin CVV saklamayı yasakladığı ve kart numarası +
  tarih + CVV birlikte çalınırsa kartın her yerde kullanılabileceği anlatıldıktan sonra kalıcı kaydı seçti.
  Değer kartın isteğe bağlı `cvv` alanında, parolayla şifreli profildedir; yoksa alan hiç yazılmaz.
  Ekranda yalnız “•••”. Kartta CVV yoksa tek seferlik “CVV (bu ödeme için, kaydedilmez)” kutusu kalır.
- Banka PIN’i, OTP/SMS kodu, fotoğraf, ham OCR, serbest not, ödeme tutarı/sonucu kaydı yoktur.

## Parola kilidi ve şifreli yerel depo (1.18.0)

Kullanıcı 2026-10-08'de “bilgiler program içinde kalsın, son derece güvenli olsun; şifre unutulursa
kurtarma olmasın, yeniden başlayınca eski kayıtlar silinsin” dedi.

- Anahtar yalnız paroladan üretilir: PBKDF2-HMAC-SHA256, 600.000 tekrar, 16 bayt rastgele tuz →
  dışa aktarılamayan AES-256-GCM (`platform/posProfilSifreleme.ts → parolaAnahtari`). Zarf `kip: 'parola'`;
  her yazıda yeni IV/revizyon, biçim/kip/kimlik/revizyon/IV/tuz/tekrar AAD’ye bağlı. Anahtar **hiçbir
  depoya yazılmaz**; IndexedDB’de yalnız zarf durur (tarayıcı testi `sanal-pos-profil-anahtar-*`
  kalmadığını denetler). Tarayıcı dosyaları kopyalansa da parola olmadan açılamaz; tahmin denemesi
  KDF ile yavaşlar, bu yüzden parola en az 10 karakter, harf ve rakam ister (`cekirdek/posParola.ts`).
- Oturum (`platform/posProfilDeposu.ts`): çözülen anahtar yalnız o sekmenin belleğinde, sayfa geçişlerinde
  korunur; 10 dakika etkinlik yoksa (`KILIT_SURESI`), saat geri alınırsa, “Şimdi kilitle”de veya sekme
  kapanınca silinir. Başka sekmede parola değişirse eski oturum geçersizdir. Her sekme ayrı açılır.
- Yanlış parola (`platform/posDeneme.ts`): ilk 5 deneme serbest, sonra 30 sn’den başlayıp katlanan
  bekleme (en çok 15 dk); sayaç IndexedDB’dedir, yenileme sıfırlamaz. Bu çevrimiçi sınırdır; asıl
  koruma parolanın gücü ve KDF’dir.
- **Parola unutulursa kurtarma yoktur.** “Parolamı unuttum” → “SİL” yazılarak onay → zarf, eski anahtarlar
  ve deneme sayacı tek aktarımda silinir; yeni parolayla boş profil. POS’taki hesaplar etkilenmez.
- Parola değiştirme şu anki parolayı doğrular (yanlışlar sayılır), yeni tuzla yeniden şifreler.
- 1.17 ve öncesi `kip: 'cihaz'` kaydı: açılışta veri gösterilmeden parola istenir; cihaz anahtarıyla
  çözülüp parolayla şifrelenir, cihaz anahtarı aynı aktarımda silinir. Yazma başarısızsa eski kayıt kalır.
- Eski v1/v2 PIN kasa (`PosKasasi`) yalnız geçiş için okunur; ardından parola belirlenir.
- Okuma hatası/bozuk zarf boş liste değildir; başka sekme değişikliği ezilmez (zarf karşılaştırması,
  BroadcastChannel ile yeniden okuma). Depo işlemleri en geç 45 saniyede durdurulur.
- 500 cari, cari başına 10 kart; zarf en fazla 2 MiB.
- **Yedek/dışa aktarma yoktur** (1.18.0): şifreli yedek indirme, yedekten ekleme ve birleştirme kaldırıldı.
  Cari/kartlar rapor, Drive, URL, dosya adı, günlük veya hata mesajlarına girmez. Tarayıcı verisi
  silinirse veya bilgisayar değişirse kayıtlar yeniden girilir. Şifreleme PCI uyumluluğu kanıtı değildir.

## Yardımcı aç/kapa ve POS sayfasındaki pencere (yardımcı 2.1.0)

- Araç çubuğundaki simgeye tıklayınca küçük pencere: “Yardımcı açık” anahtarı. Kapalıyken simgede `OFF`,
  bekleyen aktarımlar durur, POS sayfasında pencere kalkar ve hiçbir şey doldurulmaz; program da kart
  göndermez (“POS yardımcısı kapalı” uyarısı). Yeni izin yoktur (`action` + `storage`).
- “POS sayfasında pencereyi göster”: seçilmemişse pencere yalnız kurulum yokken (tanıtmak için) görünür;
  kurulumdan sonra kendiliğinden açılmaz. Uyarı/hata (kart aktarılmadı, başka cariye ait eski sekme)
  pencereyi her zaman açar.

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

> Aşağıdaki sürüm kayıtları tarihseldir. Yedek, yedekten ekleme, numara gösterme/kopyalama ve firma
> beyanı kilidi 1.18.0'da kaldırıldı; güncel davranış yukarıdadır.

## 1.6.1 bağlantı/Windows kurulum düzeltmesi

Kart göndermeyen bağlantı kontrolü ve hata sonrası temizlenen bekleme durumu eklendi.
Windows kolay kurulum dosyası kendi ZIP'ini hash/sürüm ile doğrular ve klasöre hazırlar; aynı
tarayıcıda “Paketlenmemiş öğe yükle” onayı gerekir. Giriş/TTL/kayıp teslim/saat geri alma ve
eşzamanlı bekleyen iş sınırları güçlendirildi. Windows/gerçek POS kabulü yapılmış sayılmaz.
[Detaylı tarama raporu](POS_YARDIMCISI_TARAMA_RAPORU.md).

## 1.12.0 üç aşamalı düzeltme

Derin tarama bulguları ([rapor](SANAL_POS_DERIN_TARAMA_RAPORU.md)) uygulandı. Gerçek sağlayıcı
adresine hiçbir test isteği gönderilmedi; denemeler ağdan yalıtılmış taklit POS'la yapıldı.

1. **Veri kaybı ve akış.** Gizli sekme/pencere örtülmesi/iki dakika boşta açık formları kapatmaz.
   Açık tam numara ve giriş bilgileri gizlenir; kart formunda numara (`-webkit-text-security`) ve
   fotoğraf/adaylar örtülür, “Gizlenen bilgileri göster” ile açılır. Firma beyanı sekme geçişinde
   korunur; yeni POS girişi, kart değişimi ve 30 dakika sıfırlar; kutu POS'u bu sayfadan açmadan da
   işaretlenebilir. Başka sekmedeki kayıt ekran kapatılmadan yeniden okunur; düzenleme formu açılırken
   görülen kayıt (`beklenen`) depoya yazmadan önce karşılaştırılır, değişmiş/silinmiş kayıt ezilmez.
   Fotoğraftan yalnız tarih uygulanırsa numara korunur.
2. **Yardımcı.** Doğrudan giriş başarı iddia etmez. Başarısız girişte sağlayıcının `lblgizleme`
   yazısı maskeli/kısaltılmış aktarılır. Girişten sonraki tanıtılmamış sayfada “ödeme sayfasına geçin”
   denir. Eşleşmeyen cari için çıkış önerilir. `AAYY`/`AA/YYYY` tek tarih alanları, yaygın ASP.NET alan
   adları; `pin` alt dizesi yerine PIN alanı kalıpları, `taksit`/`parola` engeli
   (`eklenti/alanKurallari.ts`). Panel tercihi `storage.local` `panel` anahtarındadır. Bekleme 180 sn.
   Farklı yardımcı sürümü uyarılır, engellenmez.
3. **Yedek.** `cekirdek/posBirlestirme.ts`: inceleme özeti (yeni/aynı/çatışan), açık “koru/yedek”
   seçimi, özet imzasıyla incelemeden sonra değişen kaydı reddetme. Numara ile cari araması, yedek
   hatırlatması (yalnız tarih, `localStorage`).

Kalan sınırlar değişmedi: gerçek POS girişi/ödeme sayfası, Windows/Edge kurulumu ve gerçek fotoğraf
kullanıcıyla denenmelidir. Tarayıcı depolamasının kalıcılık isteği bu turda incelenmedi.

## 1.16.0 saha testi düzeltmeleri

İş yerindeki ilk gerçek denemenin bulguları ([saha raporu](SANAL_POS_SAHA_TESTI_RAPORU.md)) uygulandı.
Gerçek sağlayıcı adresine hiçbir istek gönderilmedi; denemeler ağdan yalıtılmış taklit POS'la yapıldı.

- **Numara düzeltme:** Kartlı caride numara “aynı kişi” onay kutusuyla düzeltilir (`profilCariKaydet(…,
numaraDuzeltme)`). Giriş reddedilince programda “Cariyi düzenle” düğmesi ve 10 haneli numarada TC ipucu çıkar.
- **Cariye özel POS girişi:** Cari formunda “POS girişi bu cari için farklıysa” altında lisans numarası ve
  şifre. Elle giriş yardımı, doğrudan “POS’u aç” ve yardımcı aynı `posGirisBilgisi` kuralını kullanır.
  Yedek birleştirmede farklı giriş bilgisi çatışma olarak gösterilir (şifre metni özete girmez).
- **CVV (1.17.0'dan beri):** Kullanıcı 2026-10-08'de, PCI DSS'nin CVV saklamayı yasakladığı ve kart
  numarası + tarih + CVV birlikte çalınırsa kartın her yerde kullanılabileceği anlatıldıktan sonra,
  CVV'nin kartla birlikte **kalıcı** kaydedilmesini seçti. Kart formunda isteğe bağlı “CVV” kutusu
  (yazarken de maskeli); değer kartın `cvv` alanında şifreli profilde ve şifreli yedekte durur, yoksa alan
  hiç yazılmaz (eski kayıtlar aynen okunur). Ekranda hiçbir yerde açık gösterilmez (“CVV •••”); elle
  kopyalama düğmesi firma onayına bağlıdır. Kayıtlı CVV “Seçili kartla POS’u aç”ta yardımcıya gider.
  Kartta CVV yoksa eski tek seferlik “CVV (bu ödeme için, kaydedilmez)” kutusu kalır. Yardımcının kalıcı
  deposuna ve `localStorage`'a CVV girmez (tarayıcı testi denetler). Yedek birleştirmede farklı CVV
  çatışmadır (değer özete girmez).
- **Kurulum görünümü (1.17.0):** Programdaki kurulum kopyası varken ve yardımcı yanıt verirken
  (`useYardimci`) “✓ POS yardımcısı kurulu” satırı görünür; kurulum anlatımı “Yardımcıyı güncelle veya
  yeniden kur” altına iner, “Elle POS’a giriş” kapalı ayrıntıya döner. Yardımcı yanıt vermezse anlatım
  geri gelir. POS sayfasındaki yardımcı paneline dokunulmadı (yardımcı sürümü 2.0.0 kaldı).
- **Cari silme (1.17.0):** Cari profilinin başında “Cariyi sil” (önceden yalnız düzenleme formunun
  altındaydı ve bulunamıyordu).
- **Kurulum kopyası:** Yardımcının alan kurulumu (yalnız seçiciler/başlıklar) programda
  `localStorage` `bup-rapor:pos-yardimci-kurulumu` altında da tutulur; yardımcı kaldırılıp yeniden
  kurulursa ilk aktarımda geri verilir. Kullanıcı yardımcıda kurulumu bilerek sildiyse geri verilmez.

Yardımcı tarafı ve sürüm kuralı: [POS_YARDIMCISI.md](POS_YARDIMCISI.md#200--tek-seferlik-kurulum).
