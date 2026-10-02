# Sanal POS — 1.2.0

Bu sürüm **cari ve giriş yardımını** sağlar. Kart okuma ve ödeme işlemi yapmaz. Kullanıcı cari adını
ve vergi/TC numarasını elle kaydeder; cari arar, seçer, numarayı ve işlem sırasında türetilen POS
giriş şifresini açık düğmelerle kopyalar. Sabit POS giriş adresi yeni sekmede açılır. Mevcut POS
oturumu kapatılmaz; kullanıcı önceki cariden çıkmalı ve girişten sonra firma adı/numarasını
karşılaştırmalıdır. Kullanıcı onayı yalnızca beyanıdır, sağlayıcıdan doğrulama değildir.

## Kesin sınırlar

- Eklenti, yerel yardımcı, sunucu, iframe, bookmarklet veya tarayıcı korumasını gevşetme yoktur.
- POS sayfasına form/istek gönderilmez; yalnızca kullanıcı sabit giriş bağlantısını açar.
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
  Anahtar veya parola kalıcı depoya girmez. POS giriş şifresi kaydedilmez.
- `arayuz/sayfalar/pos/`: parola kilidi, elle kayıt, cari arama/seçme, giriş yardımı ve bakım.
  Rapor kaydına eklenmez; ayrı rota `#/sanal-pos`.
- Kasa parolası 14–128 karakterdir; baş/son boşlukları çıkarıldığında en az 14 karakter gerekir. Parola kurtarma servisi yoktur.
  Kullanıcı uzun ve benzersiz bir parola seçmelidir. Parola unutulursa şifreli kayıt ve yedeği açılamaz.
- Liste yalnızca bu tarayıcı profilindedir; başka bilgisayara kendiliğinden gitmez. Kasa oluşturulurken
  bile kalıcı kayıt doğrulanır. Depo okuma hatası veya bozuk zarf boş kasa sayılmaz.
- Son gerçek etkileşimden 5 dakika sonra oturum kilitlenir; gizli sekmeden dönüşte süre tekrar
  kontrol edilir. Bölümden çıkış, sayfa kapanışı ve bfcache dönüşü de kilitler. Anahtar/veri referansları
  bırakılır, açık bileşenler kaldırılır. JS/React/işletim sistemi belleğinin kesin silinmesi garanti edilmez.
- Yazı atomik karşılaştır/değiştir ile yapılır. Çözülürken okunan şifreli zarfın tamamı beklenen değer
  olarak karşılaştırılır; başka sekme değiştiyse eski liste kaydedilemez. BroadcastChannel varsa
  değişiklikte diğer sekmelerin açık kasaları kilitlenir. Kanal yoksa yazma çakışma denetimi kalır.
- Çift işleme eşzamanlı kilit; işlem sırasında kilitlenmeye nesil denetimi; geç gelen sonuç oturumu
  yeniden açamaz. Başarı, IndexedDB aktarımı tamamlandıktan sonra gösterilir.
- Ad 2–120 karakter, numara 10/11 ASCII rakam ve metin; baştaki sıfırlar korunur. Kimlik UUID
  biçimindedir. Türkçe harf/boşluk normalleştirmesiyle aynı ad veya numara için ikinci kayıt reddedilir.
  Vergi/TC numarasının resmi doğruluğu veya kişiye aitliği doğrulanmaz; kullanıcı kontrolü gereklidir.
- En fazla 500 cari, şifreli yedek en fazla 256 KB. Değiştirilmiş KDF maliyeti, bilinmeyen sürüm ve
  ek alanlar çözmeden reddedilir. Kart/CVV/parola gibi ek alanlar açık veri şemasında da reddedilir.

## Yedek ve Drive

Kasa açıkken `.calpos` dosyası yalnızca şifreli zarfı indirir. Dosya adı tarih içerir, cari bilgisi içermez.
Yeni bilgisayarda kullanıcı yeni kasa kurar; yedek parolasıyla yedekten cari ekler. Aynı ad/numara atlanır;
çelişki varsa aktarımın tümü durur ve mevcut liste korunur. Yeni kasanın parolası yedeğin parolasıyla
değiştirilmez. Parola değiştirme yeni salt ve anahtarla bütün listeyi atomik yeniden şifreler. Eski
yedekler eski parolayla açılır. Sonrasında yeni yedek gerekir.

Drive eşitlemesi yalnızca mevcut rapor ayarı/geçmişi okur; POS anahtarı ve cariler dahil edilmez.
Google OAuth/Drive davranışı değiştirilmez. POS bölümü Google kitaplığını veya harici servisi yüklemez.
Kopyalama yalnızca kullanıcı düğmesiyle tarayıcı panosuna olur; pano geçmişi/diğer programların
erişimi kontrol edilemez. Sır içeren otomatik pano temizleme okuma/yazması yapılmaz. Elle giriş alternatifi vardır.

Bu koruma depodaki veriyi şifreler; açık oturumun zararlı tarayıcı eklentisi, kötü amaçlı işletim sistemi
veya aynı sayfada çalışan zararlı kod tarafından okunmasına karşı tam koruma iddiası değildir. Bu
sürüm PCI uyumlu kart işleme sistemi olarak sunulmaz; kart işlemez.

## Doğrulama ve sonraki aşamalar

Birim testleri yapay kayıtlarla gerçek Web Crypto şifreleme, yanlış parola/tahrifat, yazma hatası,
eşzamanlı oturum, süre dolması, kilit sırasında yazma, yedek/parola dönüşümü ve çakışmayı denetler.
Tarayıcı denemeleri gerçek IndexedDB ve pano izinleriyle yapılır. Gerçek POS giriş/ödeme denenmez;
bağlantı kontrolünde POS isteği taklit sayfaya yönlendirilir.

Fotoğraftan kart numarası/SKT okuma ve elle doğrulanan ödeme/hata geçmişi ayrı aşamalardır. İlk
sürüm kullanıcı tarafından kabul edilen elle giriş seçeneğiyle bunlara ihtiyaç duymaz. Kart fotoğrafı
gönderilmeden yerel OCR, verinin dışarı çıkmaması, okuma yanılmaları ve yaşam döngüsü ayrıca
doğrulanmalıdır. Resmi sağlayıcı entegrasyonu olmadan otomatik cari doğrulama/sonuç okuma sözü verilmez.

Teknik kaynaklar:

- [Web Crypto anahtar türetme](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
- [AES-GCM IV ve ek veri](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [OWASP parola saklama: PBKDF2 maliyeti](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Siteler arasındaki erişim sınırı](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
