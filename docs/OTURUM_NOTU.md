# 3 Ekim 2026 — 1.2.0 Sanal POS cari yardımı

Kullanıcı eklentisiz çalışmayı, cari adı/numarasını elle kaydetmeyi ve kart alanlarını gerektiğinde
elle doldurmayı seçti. İşlemlerin yapılması, denetlenmesi, sorunların düzeltilmesi ve gerekli
iyileştirmeler yetkilendirildi. Başlangıç temiz `main`, commit `63e91fa`.

- Ayrı Sanal POS sekmesi: elle cari kaydı, Türkçe arama, düzenleme/silme, aynı ad/numara çakışması.
- Parolalı yerel kasa: PBKDF2-SHA256 600.000, AES-256-GCM; kalıcı kayıtta yalnızca şifreli zarf.
- Beş dakika boşta, bölümden çıkış, kapanış ve bfcache dönüşünde kilit. Geç gelen işlem anahtarı
  tekrar açamaz. Aynı anda işlem ve iki sekme çakışmaları engellenir.
- Sabit POS giriş bağlantısı, numara ve işlemde üretilen şifreyi kullanıcı isteğiyle kopyalama,
  panoya izin verilmiyorsa elle gösterme. Doğru firma kontrolü kullanıcıya aittir.
- Şifreli `.calpos` yedeği, başka kasaya ekleme (çelişkide tamamen durur), parola değiştirme.
  Drive ve rapor kayıtlarına cari bilgisi eklenmedi.
- Kart/fotoğraf/CVV/banka şifresi/ödeme tutarı/ödeme sonucu alanı yok. Gerçek POS'a giriş veya ödeme
  yapılmadı. Kart okuma ve ödeme/hata geçmişi sonraki ayrı aşamalardır.
- IndexedDB okuma hatasını boş kasa saymayan `okuKesin`; mevcut raporların toleranslı `oku` davranışı
  korunur. Şifreli zarf boyutu yazmadan önce kontrol edilir; bozuk/ek alan/KDF maliyeti reddedilir.
- Kullanım, gizlilik ve teknik sınırlar [SANAL_POS.md](SANAL_POS.md) içinde.

Doğrulama:

- `npm run kontrol`: 21 test dosyasında **260 test**, tip/lint/biçim/derleme başarılı; yerel gerçek
  Excel/ikiz altın testleri dahil. Bağımlılık eklenmedi; `npm audit` 0 bilinen açık.
- `/tmp/cal-bup-pos-browser.mjs`: Chromium, gerçek IndexedDB/Web Crypto/pano. Elle kayıt,
  çakışma, düz metin sızıntısı denetimi, yanlış parola, rota kilidi, iki sekme, silme/yedekten ekleme,
  parola değiştirme, beş dakika kilidi, açık/koyu/dar ekran ve yatay taşma kontrolleri başarılı.
  POS bağlantısı taklit edildi; dış servis çağrısı yapılmadı. JS sayfa hatası yok.
- `/tmp/cal-bup-pos-hatalar.mjs`: engelli depo, pano izni reddi/elle giriş, sayfa dönüş kilidi ve
  bozuk kaydın korunması gerçek tarayıcıda başarılı. Saat geri alma, açarken iptal ve mevcut kasayı
  tekrar oluşturma birim testlerine eklendi.
- Görüntüler `/tmp/cal-bup-pos-acik.png`, `/tmp/cal-bup-pos-koyu.png`, `/tmp/cal-bup-pos-dar.png`;
  yapay yedek `/tmp/cal-bup-pos-yedek.calpos`. Proje/Git dışıdır.

Gerçek Windows Chrome/Edge kullanımı ve kullanıcının doğru firma kontrolü kullanıcıyla denenir;
otomatik oturum/ödeme doğrulaması yapılmış gibi anlatılmamalıdır.

# 2 Ekim 2026 — 1.1.0 geliştirme ve doğrulama

Kullanıcı yol haritasındaki uygulanabilir işleri ve genel tarama/düzeltmeleri yetkilendirdi.
Başlangıç temiz `main`, başvuru commit’i `bd6750b`; başlangıç kontrolü 155 test ile geçti.

## Yapılan işler

- Google Drive bağlantısı, kapsam doğrulama, hesap seçimi, oturumun kapanması/izin kaldırma.
- Rapor + eski hâlin ayrı Drive kopyaları; isteğe bağlı üç LED dosyası; Drive’dan yeniden açma.
- Rapor ayarları ve geçmişi eşitleme; şema ve boyut doğrulaması; inceleme ve açık geri alma seçimi.
- IndexedDB aktarım tamamlanma kontrolü, atomik geçmiş/kalıcı yedek işlemleri, yeniden açma denemesi.
- Yedek oluşturulamazsa üzerine yazmama; dosya değişikliğini içerikten de denetleme;
  üretilen kitabı kaydetmeden önce yeniden açıp kontrol etme. Geçmiş saklanamazsa kayıt sonucunu
  koruyup açıklama gösterme. Çift işlem kilidi.
- Dosya boyutunu okumadan önce denetleme, ZIP merkez dizini sınırları, kitap/sayfa sınırları.
- ExcelJS makroları korumadığından yalnızca xlsx kabulü; güvenli CSV ve doğru CSV MIME türü.
  Negatif sayısal miktarlar CSV’de sayı olarak kalır; tehlikeli metin hücreleri tek tırnakla korunur.
- Ayarların sayısal/metinsel/satır/sütun sınırları; taşan metin sayılarını sonlu tutma.
- Birim sütunu olan sayımda KG doğrulama; aynı adın hazır kilogram toplamı değişmedi.
- Aynı grupta iki aynı tür dosyayı sessizce değiştirmeme. İlk motor yüklenirken dosya seçme ve
  sürükle-bırak olayındaki kullanıcı erişimini koruma.
- Dar ekranda Hakkında bölümündeki metin çakışması; Drive’a uygun gizlilik açıklamaları ve sayfası.
- ExcelJS 4.4.0 korunarak UUID 11.1.1 override’i. Güvenlik bildirimi:
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Doğrulama

- `npm ci --ignore-scripts`: temiz bağımlılık kurulumu; sonrasında standart `npm run kontrol` başarılı.
- `npm run kontrol`: tip, lint, Prettier, **18 dosyada 214 test**, derleme başarılı.
  Yerel gerçek Excel/ikiz altın testleri dahildir; CI gerçek şirket dosyaları bulunmadığı için onları atlar.
- `npm audit --json`: raporlanan açık sayısı **0** (2 Ekim 2026 taraması; gelecekte yeniden kontrol edilir).
- `git diff --check`: temiz. ExcelJS ayrı motor parçası yaklaşık 940 KB; ilk ekran motoru yüklemez.
- Chromium / `vite preview`: dört gerçek dosya tek girişte tanındı, mevcut gün onaylandı, rapor indirildi.
  İndirilen kitabın A–E ve G2 değer/formülleri altın sonuçla aynı; diğer gün sayfalarının hücreleri
  özgün kitapla aynı. **104.411 hücre** kontrol edildi. Mevcut günün F/G elle notları korunur;
  önceki günden yeniden oluşturulan altın dosyanın notlarıyla eşit olması beklenmez.
- OAuth ve REST **taklit servis**: bağlanma, ayar/geçmiş eşitleme/getirme, rapor/yedek/üç LED yükleme,
  raporu yeniden açma geçti. Gerçek dosyalar hiçbir Google sunucusuna gönderilmedi.
- Gerçek IndexedDB + taklit File System Access: bir yazma, kalıcı yedek, geçmiş/yedek bağlantısı doğrulandı.
- Açık/koyu görünüm 1440×1000, dar görünüm 390×844 incelendi; yatay taşma ve JavaScript sayfa hatası yok.

Geçici testler proje dışında:

- `/tmp/cal-bup-browser.mjs`: gerçek dosya/Drive/görünüm senaryoları.
- `/tmp/cal-bup-localwrite.mjs`: kalıcı yedek ve taklit doğrudan kayıt.
- `/tmp/cal-bup-browser-cikti.xlsx`: gerçek verili çıktı, git dışı.
- `/tmp/cal-bup-ayar-light.png`, `/tmp/cal-bup-ayar-dark.png`, `/tmp/cal-bup-ayar-mobile.png`:
  incelenmiş görüntüler. `/tmp/cal-bup-rapor-light.png` ilk boş rapor görünümü.
- `/tmp/cal-bup-kontrol-son.log`, `/tmp/cal-bup-audit-son.json`: yerel kontrol çıktıları.

## Tamamlanması dış bilgiye bağlı işler

1. Kendi Google hesabında OAuth istemci kurulumu, gerçek izin/yükleme ve ikinci bilgisayar denemesi.
   Kod ve taklit servis doğrulaması gerçek Google doğrulaması olarak sunulmamalı.
2. Adet/koli miktarı gerçekten sayım adedi ise doğrulanmış ağırlık/dönüşüm ve farklı ad eşlemesi:
   karma ambalaj örneği/yanıt henüz yok. Ağırlık tahmin edilmedi.
3. Envanter, bakiye, palet/kasa: LED örnekleri ve elle doldurulmuş beklenen kitaplar henüz yok.
4. Yeni sürümün fiziksel dosyaya kaydı ve dosya Excel’de açıkken hata davranışı Windows’ta kullanıcıyla denenir.

Drive davranışı ve sınırlamalar [DRIVE.md](DRIVE.md), hesap/giriş kuralları [IS_KURALLARI.md](IS_KURALLARI.md),
katmanlar [MIMARI.md](MIMARI.md), bir sonraki oturumun sırası [AGENTS.md](../AGENTS.md) içinde güncellendi.

## Yayın ve otomatik denetim

1.1.0 `f885182` ile yayınlandı;
[ilk denetim ve yayın](https://github.com/alibedirhan/CAL_bup/actions/runs/36961876146) başarılı.
Canlı sayfada sürüm, Drive bölümü, gizlilik sayfası ve normal kullanımın Google’a istek yapmadığı
Chromium ile doğrulandı (`/tmp/cal-bup-canli.mjs`, `/tmp/cal-bup-canli-1.1.0.png`).

Bu yayında görülen Node 20 action uyarıları nedeniyle resmi action sürümleri güncellendi:
checkout 7.0.1, setup-node 7.0.0, upload-pages-artifact 5.0.0, deploy-pages 5.0.1.
Her biri resmi release commit SHA’sına sabitlendi; checkout kimlik bilgilerini kalıcı bırakmaz.
Otomatik işletim sistemi değişikliği uyarısı için runner Ubuntu 24.04’e sabitlendi.
Uygulamanın Node sürümü `.nvmrc` üzerinden 22 olarak kaldı. Workflow değişikliği ayrı CI/yayınla doğrulanır.
Resmi başvurular: [checkout](https://github.com/actions/checkout),
[setup-node](https://github.com/actions/setup-node),
[upload-pages-artifact](https://github.com/actions/upload-pages-artifact),
[deploy-pages](https://github.com/actions/deploy-pages).
