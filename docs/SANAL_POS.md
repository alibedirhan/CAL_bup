# Sanal POS — 1.3.1

Bu sürüm **cari ve giriş yardımını** sağlar. Kart okuma ve ödeme işlemi yapmaz. Kullanıcı cari adını
ve vergi/TC numarasını elle kaydeder; cari arar, seçer, numarayı ve işlem sırasında türetilen POS
giriş şifresini açık düğmelerle kopyalar. Kaydedilen cari otomatik seçilir. “POS’u aç” seçilen
carinin giriş bilgilerini sabit POS adresine POST ile gönderir, yanıt yeni sekmede açılır. Giriş
kabul edilirse o cari hesabı açılır; gerçek hesapla doğrulama henüz yapılmamıştır. Mevcut POS
oturumu kapatılmaz; kullanıcı önceki cariden çıkmalı ve girişten sonra firma adı/numarasını
karşılaştırmalıdır. Kullanıcı onayı yalnızca beyanıdır, sağlayıcıdan doğrulama değildir.

## Kesin sınırlar

- Eklenti, yerel yardımcı, sunucu, iframe, bookmarklet veya tarayıcı korumasını gevşetme yoktur.
- Giriş formu yalnızca kullanıcının “POS’u aç” tıklamasıyla sabit HTTPS giriş adresine gönderilir.
  Numara vergi/TC no ve kullanıcı alanlarına, türetilen şifre giriş şifresi alanına gider. Kasa PIN’i,
  cari adı, kart veya ödeme bilgisi gönderilmez. Tek tıklamada tek gönderim; otomatik tekrar yoktur.
  “Giriş sayfasını elle aç” sadece bağlantıyı açar, giriş bilgilerini göndermez.
- URL, hash, dosya adı veya referrer içinde cari adı/numarası/parola bulunmaz.
- Kart numarası, fotoğraf, SKT, CVV, ödeme tutarı, banka doğrulama şifresi ve işlem sonucu için alan
  veya saklama yoktur. Ödeme tamamen POS/banka ekranlarında kullanıcı tarafından yapılır.
- Bakiyeden ödeme tutarı üretilmez; işlem tekrar denenmez. Ödeme geçmişi ile bu cari listesi ayrı
  kavramlardır. Ödeme sonucu otomatik okunmaz veya başarılı ilan edilmez.
- Giriş şifresinin mevcut türetme kuralı POS sağlayıcısına aittir; CAL bup bu zayıf kimlik doğrulamayı
  güçlendiremez. Numara listesi giriş sırrı gibi korunur. Gerçek numara/parola depoda bulunmaz.

## Kasa

- `cekirdek/posCari.ts`: saf cari doğrulaması, çakışma denetimi, maskeleme ve yedek birleştirme.
- `platform/posSifreleme.ts`: Web Crypto, PBKDF2-HMAC-SHA256 / 600.000 tekrar, 16 bayt rastgele salt,
  AES-256-GCM, her yazıda rastgele 12 bayt IV ve 128 bit etiket. Zarf sürüm/KDF/salt/revizyon
  bilgileri ek doğrulanan veriye bağlanır. Anahtar dışa aktarılamaz.
- `platform/posKasasi.ts`: oturum anahtarı ve şifreli zarf; IndexedDB `sanal-pos-kasa-v1` anahtarı.
  Oturum AES anahtarı veya PIN/parola kalıcı depoya girmez. POS giriş şifresi kaydedilmez.
  Yeni yerel kasa v2 biçimindedir: rastgele, dışa aktarılamayan HMAC-SHA256 cihaz anahtarı IndexedDB’de
  tutulur. PIN önce bu anahtarla HMAC işleminden geçirilir, sonuç PBKDF2’ye girer. Cihaz kimliği
  şifreli zarfın AAD’sine dahil edilir. Cihaz anahtarı ve zarf tek atomik aktarımda kaydedilir.
  Bu anahtar donanım/işletim sistemi kasası değildir; aynı tarayıcı profili ve origin kodu kullanabilir.
- `arayuz/sayfalar/pos/`: parola kilidi, elle kayıt, cari arama/seçme, giriş yardımı ve bakım.
  Rapor kaydına eklenmez; ayrı rota `#/sanal-pos`.
- `platform/posGiris.ts`: geçici gizli HTML formuyla `lvergino`, `lkullaniciadi`, `lsifre`,
  `btngiris` alanlarını POST gövdesinde gönderir. ASP.NET postback tanıması için boş `__VIEWSTATE`
  vardır; imzalı durum/oturum değerleri kopyalanmaz. Form yeni sekmeyi açtıktan sonra alanları
  boşaltılır ve kaldırılır. `noopener noreferrer` kullanılır; sırlar URL/referrer/panoya eklenmez.
  CSP `form-action` yalnızca sağlayıcının HTTPS `/login.aspx` adresine izin verir.
  Bu, resmi entegrasyon API’si değildir; sağlayıcı giriş formunu değiştirirse elle giriş gerekir.
- Günlük yerel açılış için 4–12 ASCII rakamlık PIN veya 14–128 karakterlik parola kabul edilir.
  Başlangıç sıfırları korunur. Yeni parolanın baş/son boşlukları reddedilir; eski v1 parola baytları
  aynen korunur. Eski v1 kasa eski uzun parolasıyla açılır; parola değişikliği atomik olarak v2’ye taşır.
  Eski cihaz anahtarı/parola deneme sayacı, yeni zarf ve anahtar yazılırken aynı aktarımda silinir.
  Beş açılış denemesi/60 saniye sınırı atomik sayaçla tarayıcı deposunda tutulur; sayfa yenilemesi
  sayacı sıfırlamaz. Başarılı açılış sayacı temizler. Depo değişikliği/zararlı aynı-origin kodu bu
  uygulama sınırını aşabilir; kısa PIN uzun parolayla eşdeğer değildir. Parola kurtarma servisi yoktur.
- Liste yalnızca bu tarayıcı profilindedir; başka bilgisayara kendiliğinden gitmez. Kasa oluşturulurken
  bile kalıcı kayıt doğrulanır. Depo okuma hatası veya bozuk zarf boş kasa sayılmaz.
- Son gerçek etkileşimden 30 dakika sonra oturum kilitlenir; gizli sekmeden dönüşte süre tekrar
  kontrol edilir. Bölümden çıkış, sayfa kapanışı ve bfcache dönüşü de kilitler. Anahtar/veri referansları
  bırakılır, açık bileşenler kaldırılır. Aynı bölümde kilit/açılış boyunca yalnızca seçilen carinin
  rastgele kimliği oturum belleğinde korunur; açınca cari yeniden seçilir, firma onayı yeniden gerekir.
  CAL bup açık POS sekmesini kapatmaz veya alanlarını silmez. Sağlayıcının kendi oturum/banka
  doğrulama süresini değiştiremez. JS/React/işletim sistemi belleğinin kesin silinmesi garanti edilmez.
- Yazı atomik karşılaştır/değiştir ile yapılır. Çözülürken okunan şifreli zarfın tamamı beklenen değer
  olarak karşılaştırılır; başka sekme değiştiyse eski liste kaydedilemez. BroadcastChannel varsa
  değişiklikte diğer sekmelerin açık kasaları kilitlenir. Kanal yoksa yazma çakışma denetimi kalır.
- Çift işleme eşzamanlı kilit; işlem sırasında kilitlenmeye nesil denetimi; geç gelen sonuç oturumu
  yeniden açamaz. Başarı, IndexedDB aktarımı tamamlandıktan sonra gösterilir.
  Depo açılışı 10 saniye, aktarımı 30 saniye, kasa alt işlemleri 45 saniyede zaman aşımına uğrar.
  Kullanıcı işlemi durdurabilir; geç sonuçlar oturumu açamaz. Daha önce başlamış aktarımın tamamlanmış
  olabileceği durumda depo yeniden okunur. Zaman aşımı keyfi bir geri alma garantisi değildir.
  Formlar yerel HTML doğrulamasına bağlı sessiz engel yerine açık hata verir; parola yöneticisinin
  doldurduğu DOM değeri de doğrulanır. Şifreleme/depo adımı ekranda görünür, hata sonrası yeniden kontrol vardır.
- Ad 2–120 karakter, numara 10/11 ASCII rakam ve metin; baştaki sıfırlar korunur. Kimlik UUID
  biçimindedir. Türkçe harf/boşluk normalleştirmesiyle aynı ad veya numara için ikinci kayıt reddedilir.
  Vergi/TC numarasının resmi doğruluğu veya kişiye aitliği doğrulanmaz; kullanıcı kontrolü gereklidir.
- En fazla 500 cari, şifreli yedek en fazla 256 KB. Değiştirilmiş KDF maliyeti, bilinmeyen sürüm ve
  ek alanlar çözmeden reddedilir. Kart/CVV/parola gibi ek alanlar açık veri şemasında da reddedilir.

## Yedek ve Drive

Kasa açıkken kullanıcı **ayrı 14–128 karakterlik uzun yedek parolası** belirler. Liste yeni salt ve
AES anahtarıyla taşınabilir v1 `.calpos` zarfına şifrelenir, çözülerek doğrulanır ve indirilir. Günlük
PIN ve cihaz anahtarı yedeğe girmez. Yerel v2 zarf tek başına taşınabilir yedek olarak kabul edilmez.
Dosya adı tarih içerir, cari bilgisi içermez. Uzun yedek parolası günlük açılışta istenmez.

Yeni bilgisayarda kullanıcı yeni PIN kasası kurar; uzun yedek parolasıyla yedekten cari ekler. Aynı
ad/numara atlanır; çelişki varsa aktarımın tümü durur ve mevcut liste korunur. Yeni kasanın PIN’i
yedeğin parolasıyla değiştirilmez. Önceki sürüm yedekleri eski uzun kasa parolasıyla kullanılabilir.
Günlük PIN/parola değişikliği mevcut yedeklerin parolasını değiştirmez. Tarayıcı site verileri veya
cihaz anahtarı kaybolursa taşınabilir yedek gerekir; unutulan PIN/uzun parola için kurtarma yoktur.

Drive eşitlemesi yalnızca mevcut rapor ayarı/geçmişi okur; POS anahtarı ve cariler dahil edilmez.
Google OAuth/Drive davranışı değiştirilmez. POS bölümü açılınca Google kitaplığı veya harici servis
yüklenmez; yalnızca giriş düğmesine basılınca bilgilerin gönderildiği POS sekmesi açılır.
Kopyalama yalnızca kullanıcı düğmesiyle tarayıcı panosuna olur; pano geçmişi/diğer programların
erişimi kontrol edilemez. Sır içeren otomatik pano temizleme okuma/yazması yapılmaz. Elle giriş alternatifi vardır.

Bu koruma depodaki veriyi şifreler; açık oturumun zararlı tarayıcı eklentisi, kötü amaçlı işletim sistemi
veya aynı sayfada çalışan zararlı kod tarafından okunmasına karşı tam koruma iddiası değildir. Bu
sürüm PCI uyumlu kart işleme sistemi olarak sunulmaz; kart işlemez.

## Doğrulama ve sonraki aşamalar

Birim testleri yapay kayıtlarla gerçek Web Crypto şifreleme, yanlış parola/tahrifat, yazma hatası,
eşzamanlı oturum, süre dolması, kilit sırasında yazma, yedek/parola dönüşümü ve çakışmayı denetler.
Tarayıcı denemeleri gerçek IndexedDB ve pano izinleriyle yapılır. Gerçek cariyle POS giriş/ödeme denenmez;
giriş kontrolünde POS isteği taklit sayfaya yönlendirilir. 1.3.1’de iki yapay cari için gerçek tarayıcının
POST gövdesi, tek gönderim, CSP, geçici form temizliği, URL/referrer/opener, kayıt sonrası seçim ve
elle giriş alternatifi doğrulandı. Sağlayıcının herkese açık giriş sayfası incelendi; kimlik bilgileri
boş form gönderimi “Lütfen Tüm Bilgileri Doldurun” yanıtı verdi. Bu yalnızca giriş olayının çalıştığını
gösterir, gerçek cari oturumu açıldığını kanıtlamaz. Gerçek giriş kullanıcıyla denenmelidir.

Fotoğraftan kart numarası/SKT okuma ve elle doğrulanan ödeme/hata geçmişi ayrı aşamalardır. İlk
sürüm kullanıcı tarafından kabul edilen elle giriş seçeneğiyle bunlara ihtiyaç duymaz. Kart fotoğrafı
gönderilmeden yerel OCR, verinin dışarı çıkmaması, okuma yanılmaları ve yaşam döngüsü ayrıca
doğrulanmalıdır. Resmi sağlayıcı entegrasyonu olmadan otomatik cari doğrulama/sonuç okuma sözü verilmez.

Teknik kaynaklar:

- [Web Crypto anahtar türetme](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
- [AES-GCM IV ve ek veri](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [OWASP parola saklama: PBKDF2 maliyeti](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Siteler arasındaki erişim sınırı](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
- [HTML form POST ve yeni sekme](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form)
- [ASP.NET postback tanıması](https://github.com/microsoft/referencesource/blob/main/System.Web/UI/Page.cs)
