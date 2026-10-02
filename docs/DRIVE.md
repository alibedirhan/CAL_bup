# Google Drive — 1.1.0

Drive isteğe bağlıdır. Yerel rapor çalıştırma için Google hesabı veya kurulum gerekmez.

## İlk kurulum

1. [Google Cloud](https://console.cloud.google.com/) üzerinde kendi Google hesabınızla bir proje açın.
2. API’ler ve Hizmetler → Kitaplık → **Google Drive API** → Etkinleştir.
3. **Google Auth Platform** → Marka bilgileri: uygulama adı CAL bup, destek/iletişim için kendi
   e-posta adresiniz. Ana sayfa `https://alibedirhan.github.io/CAL_bup/`, gizlilik sayfası
   `https://alibedirhan.github.io/CAL_bup/gizlilik.html`.
4. Kitle: hesabınıza uygun tür; External/Testing seçiliyse kendi Google hesabınızı test kullanıcılarına ekleyin.
   Workspace yöneticisinin uygulama izni gerekebilir. Şirket hesabında kurumunuzun izinlerini izleyin.
5. Veri erişimi bölümüne `https://www.googleapis.com/auth/drive.file` kapsamını ekleyin.
   Tüm Drive’a erişen `drive` kapsamını kullanmayın.
6. İstemciler → İstemci oluştur → **Web uygulaması**. Yetkili JavaScript kaynağı:
   `https://alibedirhan.github.io` (sonuna `/CAL_bup/` eklenmez).
   Yerel deneme gerekirse `http://localhost:5173` veya kullanılan preview kaynağı ayrıca eklenir.
   Token modelinde yönlendirme URI’si/istemci gizli anahtarı gerekmez.
7. `.apps.googleusercontent.com` ile biten **istemci kimliğini** kopyalayın.
   CAL bup → Ayarlar → İlk bağlantı kurulumu alanına yapıştırın → **Bağlantıyı hazırla** → **Drive’a bağlan**.
8. Google penceresinde doğru hesabı seçip Drive dosya iznini verin. Diğer bilgisayarda aynı istemci
   kimliğini ve aynı Google hesabını kullanın.

İstemci kimliği herkese açık bir tanımlayıcıdır; gizli anahtar/şifre girilmez. Uygulama bunu yalnızca
bu tarayıcıda saklar, kaynak koduna veya GitHub Actions’a eklemez.
Kurulumdan sonra Google’ın gerçek izin/yükleme/ikinci cihaz denemesi hâlâ gereklidir.

## Kullanım

1. Günlük raporu her zamanki gibi dosyaya kaydedin veya indirin.
2. Sonuç kartındaki **Dosyayı ve yedeğini Drive’a kaydet** düğmesi önce eski hâli, sonra yeni kitabı
   CAL bup klasörüne yükler. LED dosyaları ayrıca işaretlenirse gönderilir.
3. Başka bilgisayarda bağlandıktan sonra **Drive’dan depo kontrol dosyası aç** ile bir kopyayı açın.
   Yeni raporu indirip tekrar Drive’a gönderebilirsiniz.
4. **Ayarları ve geçmişi eşitle** mevcut rapor ayarlarınızın kopyasını gönderir; son on Drive
   oturumunun geçmişini yerel geçmişle birleştirir. En yeni 500 kayıt saklanır. Görünüm teması ve
   yerel dosya erişim tanıtıcısı taşınmaz.
5. **Drive’daki kayıtları göster → İncele** ile seçilen oturumun zamanını/kayıt sayısını inceleyin.
   Yalnız geçmiş veya ayarlar+geçmiş açık seçimle alınır; ayarlar kendiliğinden değişmez.

Ekran listeleri en yeni 20 dosyayı gösterir; daha eski kopyalar normal Google Drive arayüzünden
indirilebilir. Geçmiş birleştirmesinde eski/bağımsız bir kopya son on oturum dışında kaldıysa o
kopyayı ayrıca inceleyip getirin. Drive kopyaları otomatik silinmez; kota yönetimi kullanıcıdadır.

## Saklama ve hata davranışı

- Google Identity Services token modeli, yalnızca `drive.file`; uygulama kişisel Drive’ı taramaz.
- Google kitaplığı **Bağlantıyı hazırla** ile yüklenir. Normal rapor kullanımında dış istek yoktur.
- Erişim belirteci bellekte tutulur; localStorage/IndexedDB’ye, dosyaya, loga yazılmaz.
  Yenilemede veya süre dolunca kullanıcı yeniden bağlanır. Hesap değiştirilirse eski işlem durur.
- Her yükleme ayrı, değişmeyen kopyadır. İki cihazın dosyaları birbirini ezmez. Başarıdan sonra
  SHA-256 içerik özetiyle aynı türdeki tekrarlar mevcut dosyayı kullanır. Ayrı cihazların tam aynı
  anda yüklemesinde Google’da iki eş kopya oluşabilir; dağıtık kilit/idempotency garantisi yoktur.
- Klasör `appProperties` işaretiyle bulunur; aynı isimli kişisel klasörlere yazılmaz. Aynı anda iki
  klasör oluşursa sonrakiler en eski kimliği seçer; diğer klasörün dosyaları Drive’da kalır.
- Upload önce metadata ile resumable oturumu başlatır, sonra tek PUT ile en fazla 25 MB gönderir.
  Dönen upload adresi HTTPS `www.googleapis.com/upload/drive/v3/files` olmalıdır. Redirect reddedilir.
  Otomatik retry yapılmaz; kullanıcı yeniden gönderir. Ağ kesilirse gönderimin bir kısmı tamamlanmış olabilir.
- Download gerçek akış boyunca sınırlıdır; HTTP boyut başlığına tek başına güvenilmez. Kaydedilen
  SHA-256 özeti uyuşmazsa dışarıda değiştirilmiş dosya otomatik açılmaz; Drive’dan indirilip incelenir.
- 401 yeniden bağlanma, 403 izin/kota kontrolü, 404 liste yenileme, 429 bekleme mesajı verir.
  İstek başına 30 saniye, Google kitaplığına 15 saniye, izin penceresine 60 saniye sınırı vardır.
- Oturum JSON’u 2 MB, şema sürümü 1; bozuk ayar, tarih ve sonlu olmayan toplamlar reddedilir.
  Yerel yedek kimlikleri diğer cihaza taşınmaz. Geçmişte zaman/rapor/dosya/sayfa/kayıt türüyle eşleme yapılır.
- Bağlantıyı kesmek açık oturumu kapatır; Google iznini kaldırmak ayrı seçenektir. Drive dosyaları silinmez.

## Doğrulama ve kaynaklar

`tests/birim/drive.test.ts`: izin, hesap değişimi, API, sayfalama, tekrar kayıt, upload adresi,
401, indirme boyutu, içerik özeti, JSON doğrulama ve geçmiş birleştirme.
Tarayıcı denemesi gerçek dosyalı yerel rapor ile, Google işlemleri ise yalnızca taklit servisle yapıldı.

Uygulama sırasında başvurulan resmi belgeler:

- [Google token modeli](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google kimlik kitaplığı ve CSP](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Drive yükleme yöntemleri](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive dosya kapsamı](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
