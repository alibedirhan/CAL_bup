# 4 Ekim 2026 — 1.7.1 açık noktaların devamı

Başlangıç temiz `main`, `87ab1ff`, 1.7.0. Önceki yayının denetimi/yayını
[37199866103](https://github.com/alibedirhan/CAL_bup/actions/runs/37199866103) başarılıdır.
Kullanıcı rapordaki açık noktaların değerlendirilmesi, uygulanabilir iyileştirmeler ve doğrulamayı
istedi; önceki 29 düzeltme tekrar uygulanmadı. [Genel raporun devam bölümü](GENEL_TARAMA_RAPORU.md)
her açık konuya ilişkin kararı, yeni bulguları ve ölçüm sınırlarını içerir.

- Tam satır aralıkları ve küçük harfli hücreler satır eklenince kaydırılır. Türkçe tanımlı adlar,
  hücre sınırı dışındaki adlar ve sayfa aralığının adı yanlışlıkla değiştirilmez. Üç yeni regresyon
  eski kodda başarısız oldu; düzeltmeden sonra geçti. Sentetik Excel yaz/yeniden aç testi eklendi.
- Normal Playwright bağlamlarında da kapalı proxy var. Taklit route olmasa bile dış ağa
  çıkılamadığı ve yerel uygulamanın açıldığı sınandı; MV3 kendi daha sıkı sınırını korur.
- `npm run test:performans`: üretim Excel motoru Chromium'da altı büyük yapay kitapla ölçülür.
  100000 satır/256 sütun sınırları son hücre korunarak kabul edilir; 100001 satır/257 sütun/
  401 sayfa reddedilir. Yerel okuma ilk ölçümde 0,2–1,9 saniye; yoğun tabloda zamanlayıcı yaklaşık
  0,4 saniye bekleyebiliyor. Tam boyut/bellek/Windows garantisi değildir. Yayın kapısına eklendi.
- Yerel kontrol: **31 dosyada 401 kural/Excel testi**, gerçek Excel/ikiz testleri atlanmadan
  geçti; **89 Chromium senaryosu** ve **6 büyük dosya senaryosu** geçti. Tip/lint/biçim/derleme
  başarılı. Bağımlılık sürümleri, ExcelJS 4.4.0 ve yardımcı protokolü 2 korundu.
- POS denemeleri yalnızca yapay kart/fotoğraf ve dış ağa kapalı taklit ortamda yapıldı.
  Gerçek müşteri kartı/fotoğrafı, SMS, ödeme veya sağlayıcı girişi kullanılmadı.
- Gerçek Windows/Excel, kullanıcı Google kurulumu, sağlayıcı güvenliği/ortak oturum, profil
  erişim düzeni ve örneksiz yeni raporlar hâlâ dış bilgi/kullanıcı kabulü bekler. Yıl/dönüşüm/
  kolon veya ödeme kuralı uydurulmadı; tamamlandı diye sunulmaz.
- Sürüm **1.7.1**. Önceki main/yayın yetkisi sürer; yayın ana commit'in Linux, Windows kurulum
  ve tarayıcı/performans kapılarına bağlıdır. Sonuç [Actions](https://github.com/alibedirhan/CAL_bup/actions/workflows/yayin.yml)
  üzerinde aynı commit için izlenir. Ölçüm JSON'ları ve Playwright çıktıları `/tmp/` içindedir.

# 4 Ekim 2026 — 1.7.0 genel tarama ve iyileştirmeler

Kullanıcı Sanal POS dahil tüm alanların hata, mantık, mimari ve açıklamalar bakımından ayrıntılı
taranmasını ve gerekli düzeltmelerin yapılmasını istedi. [Genel tarama raporu](GENEL_TARAMA_RAPORU.md)
29 düzeltilmiş bulgu başlığı, kanıt eşlemeleri ve gerçek ortam kabul sınırlarını içerir.

- POS: kart ekleme/düzenleme ve elle yeni giriş bekleyen aktarımı iptal eder. Kartı olan carinin
  numarası değişmez. Depo kapanan kayıt arızasında eski kart/form ekranı kullanılmaz.
- Depo kontrol: sıkı sayı/tarih, taşma/formül sonucu, yinelenen/ters günler, yıl çakışması, 256 sütunda
  birim ve belirsiz dosya türü denetimi. Gerçek birleşik grup başlığı ve dip toplam uyumu korundu.
  Ayar değişimi öneriyi/onayları yeniler; işlem sırasında gün/kaynak değişmez; kayıtta liste adları da denetlenir.
- Geçmiş/yedek: bozuk değer yeni yazıyla ezilmez. Drive: OAuth iptal kilidi, aynı belirteçle yeniden
  bağlantı, liste sınırı/metaveri, 20 sonrası erişim ve eski hesabın ekran verileri düzeltildi.
- Dosya iş akışı rapor katmanında; saf Drive/ayar/geçmiş kuralları çekirdekte; lint sınırları genişletildi.
  README/gizlilik/kurulum/OCR ve üzerine yazma/sıfırlama metinleri güncellendi.
- Son yerel kontrol: **31 test dosyasında 397 test**, gerçek Excel/ikiz karşılaştırmaları atlamadan
  başarılı; **88 Chromium senaryosu** başarılı. Tip/lint/biçim/derleme geçti. Bağımlılık taraması
  320 bağımlılık envanterinde 0 bilinen açık gösterdi. Açık/koyu/390 px sentetik POS ekranları
  `/tmp/` içinde incelendi; yatay taşma denetimi geçti. Üretim dosyaları 400 satır sınırını aşmıyor.
- Kullanıcının paylaştığı Brave/Linux paneli cari eşleşmesi ve kart/tarih doldurmayı gösterdi.
  Gerçek ödeme/SMS, tüm sağlayıcı ekranları veya Windows/Google kabulü doğrulanmış sayılmaz.
  Asistan testleri yalnızca yapay kart ve dış ağa kapalı taklit POS’tadır; gerçek şirket dosyaları Git dışındadır.
- Sürüm 1.7.0. Yardımcı mesaj protokolü 2 olarak kaldı; 1.6.1 yardımcıyla sürüm eşitliği şartı yoktur.
  Site sürümü ve kurulu yardımcı sürümü farklı görünebilir. Kurulu tarayıcı eklentisi kendiliğinden
  yeni ZIP’e yükselmiş sayılmaz. Main yayın yetkisi önceki oturumdan sürüyor.

# 4 Ekim 2026 — 1.6.1 bağlantı taraması / Windows kolay kurulum

Kullanıcı doğru GitHub Pages adresini kullanıyor fakat yardımcının henüz kurulmadığını bildirdi.
1.6.0 hata sonrası “kontrol ediliyor” mesajını bırakıyordu. Bu hata ve eski yardımcıyla doğrulanmamış
başlatma iki eski sürüm regresyonuyla yeniden üretildi, düzeltildi. [Tarama raporu](POS_YARDIMCISI_TARAMA_RAPORU.md).

- Protokol/sürüm/durum sözleşmesi, kart göndermeyen bağlantı kontrolü ve adres kapsamı hatası.
- Giriş DOM/sonuç hatası, kaybolmuş iş/TTL, saat geri alma ve 5 saniyelik belirsiz teslim sonucu;
  otomatik tekrar yok. Başka sekmedeki bekleyen iş yeni aktarımı engeller.
- Panel eski kaydı yeni seçim talimatına uygulamaz; kurulum silme arızası görünürdür.
- Görsel kontrolde kart paragrafının hata rengini ezdiği bulundu; açık/koyu belirgin hata kutusu
  ve kalıcı görünüm denetimi eklendi. Dar görünümde yatay taşma yok.
- Windows CMD kendi ZIP'ini SHA-256/sürüm ile doğrular, sabit yerel klasöre çıkarır, tarayıcının
  eklenti sayfasını açar. Kullanıcı bir kez yükleme onayı verir; politika/registry değişmez.
  PowerShell sözdizimi resmi parser'la çalıştırmadan kontrol edildi; Windows fiili kurulum denenmedi.
  Yayın kapısı Windows-2022/PowerShell'de yalıtılmış dosya hazırlama testi de çalıştırır; indirme,
  tarayıcı ve pano taklittir. Gerçek iş bilgisayarı kurulum kabulü yerine geçmez.
- Yerel kontrol: 29 dosyada 349 birim testi, 78 Chromium senaryosu, tip/lint/biçim/derleme başarılı.
  Bağımlılık taraması bilinen açık 0; mevcut OCR, profil/cari ve POS güvenlik regresyonları geçti.
  Ağdan yalıtılmış taklit POS, yalnızca yapay kart; müşteri kartı/fotoğrafı ve gerçek SMS/ödeme kullanılmadı.
- Gerçek sağlayıcı boş alan tanıtımı ve Windows/Edge kabulü kullanıcıda kalır. Tüm sağlayıcı sekmelerinin
  ortak oturumu garanti edilmez; protokol kontrolü kriptografik eklenti kimlik doğrulaması değildir.
  Ayrıntılar raporda. Main yayın yetkisi önceki oturumdan sürüyor.

# 4 Ekim 2026 — 1.6.0 kart aktarımı ve numara okuma

Kullanıcı tek operatör için seçili cari/kartla POS açılışı ve numara/tarih doldurmayı istedi;
CVV ve tutarı kendisi girecek. Müşteri kartıyla test/ödeme/SMS kesinlikle yasak; tüm yeni denemeler
sentetik görüntü/kart ve taklit ödeme ekranındadır. Mimari ve sınırlar: [POS_YARDIMCISI.md](POS_YARDIMCISI.md).

- Yapay kabartma/desende yalnızca tarih okunması yeniden üretildi; sınırlı numara şeridi OCR ile
  PAN ve tarih birlikte bulundu. Okunamayan PAN incelemede elle tamamlanır, açık onayla forma geçer.
- Dar MV3 Edge/Chrome yardımcı projede geliştirildi, aynı sürümlü ZIP uygulamadan indirilir.
  Boş alanların açık tanıtımı ve görünen vergi/TC karşılaştırması gerekir. PAN/son kullanma doldurulur;
  CVV/tutar/ödeme/SMS düğmeleri ve olayları kullanılmaz. Yanlış cari veya değişmiş alan durdurur.
- Tek kullanımlık 120 saniyelik oturum kuyruğu, sekme bağlama, teslimden önce kart silme,
  seçim/rota/sekme/süre iptali, görünür kurulum/hata/başarı vardır. POS sekmesine geçiş aktarımı kesmez.
- Kullanıcı boş gerçek POS ekranını paylaştı; görünen cari numarası ve tek S.K.T alanı doğrulandı.
  Görseldeki müşteri adı/numarası/bakiye/e-posta kod/test/belgeye alınmadı; gerçek DOM denenmedi.
- Son yerel kontrol: 28 dosyada 346 test ve 66 Chromium senaryosu geçti; bilinen bağımlılık açığı 0.
  Tip/lint/biçim/derleme, MV3 manifest/ZIP, açık/koyu/dar görsel kontrol ve sahneleme veri taraması geçti.
  Ek kural: Luhn geçen uzun PAN+CVV birleşmesi olabilen OCR adayı reddedilir; elle kayıt etkilenmez.
  Yayın main gönderiminin ardından Actions'ın aynı kontrolleri geçmesine bağlıdır.
- Sağlayıcının gerçek ödeme DOM'u/Windows Edge kabulü ve otomasyon sözleşmesi kanıtlanmış değildir.
  İlk kurulum kullanıcı tarafından boş alanlarda yapılır; görünür numara/uygun alan yoksa elle akış kalır.

# 4 Ekim 2026 — 1.5.0 OCR/bildirim üç aşaması

Kullanıcı üç aşamayı sırayla uygulamayı istedi; geliştirme ve yerel kabul kapıları tamamlandı.
[Kapanış raporu](OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md) 20 bulgunun uygulama/test eşlemesini içerir.

- 1: form kapsamlı görünür/odaklı hata, tek görünür başarı, ayar kalıcılığı, geçmiş/yedek hataları,
  indirme kesinliği ve kurulum başarısız olsa da kapanan OCR worker.
- 2: geçici önizleme/kırpma/döndürme, sınırlı eğiklik/kontrast/yön denemesi, ayrı fotoğraf taslağı,
  açık numara/tarih seçimi ve uygulaması; kısmi fotoğraf eski tarihle sessiz birleşmez.
- 3: saf sonuç sözleşmesi + ortak tek işlem/iptal/süre/nesil denetimi; Drive/rapor/yedek/pano kapsamı,
  bozuk geçmiş ve React hatasında anlaşılır kurtarma; kalıcı arıza/rota/OCR testleri.
- Yerel `kontrol`: 27 dosya / 341 test; Chromium: 49 senaryo. `npm audit`: bilinen açık 0.
  17 okunabilir OCR referansında 16 tek doğru sonuç + bir iki-tarih seçimi; geniş başarı oranı değildir.
- İlk 15 örnekteki 90/270 görüntülerde rakamlar kadrajdan kesilmişti; bunlar güvenle boş bırakılır.
  Yeni dönüşüm testleri görüntü boyutunu korur. Gerçek fotoğraf/cari verisi kullanılmadı.
- Yeni sürüm 1.5.0; önceki yayın yetkisi sürüyor. Main gönderimi, Actions ve canlı izole kabul son adımdır.
  Windows/gerçek fotoğraf/Google/banka kabulü kullanıcıyla yapılır; otomatik ödeme/SMS eklenmedi.

# 3 Ekim 2026 — OCR ve işlem bildirimleri araştırması

Kullanıcı fotoğraftan okumadaki sorunları ve görünmeyen hata/başarı mesajlarını ayrıntılı araştırıp
önce rapor istedi; ardından üç aşamalı çözüm uygulanacak. Bu çalışma araştırma/rapordur:
üretim kodu/sürüm değişmedi ve yeni yayın yapılmadı. Canlı sürüm 1.4.0 (`9d18259`);
bunun önceki yayın çalışması GitHub Actions 37149340885’te başarılıdır.

- Ana rapor: [OCR_VE_BILDIRIM_ARASTIRMA_RAPORU.md](OCR_VE_BILDIRIM_ARASTIRMA_RAPORU.md).
  Kanıt: [OCR_VE_BILDIRIM_KANITLARI.md](OCR_VE_BILDIRIM_KANITLARI.md).
- 20 bulgu: 8 OCR/okuma arayüzü, 9 bildirim, 3 mimari/test eksikliği. Kanıt türü ayrı;
  kodda görülen riskler gerçek olay diye sunulmadı. 15 yapay görüntü + 8 saf metin + arıza/UI denemeleri.
- Önemli doğrulamalar: döndürülmüş resimlerde boş OCR; satır bölünmesi/yan yana tarih numarayı bozuyor;
  ikinci fotoğraf eski/yeni alanları birleştirebiliyor; model 404/erken iptalden sonra aktif worker 1.
- Yinelenen kart hatası dialog dışında/arkasında; yerel hata veya başarı ekran dışında kalıyor.
  Geçersiz ayar/saklama engeli sessiz; geçmiş depo hatası boş liste oluyor; eksik yedek indirilmiyor,
  hata da yok. Günlük kasa dili bazı yedek hatalarında kaldı.
- Baz kontrol yeniden geçti: `npm run kontrol`, 24 dosya / 325 test; 8 tarayıcı senaryosu.
  Bunlar geniş fotoğraf doğruluğu/mesajın okunabilirliği kanıtı değildir.
- Geçici scriptler, yapay ekran görüntüleri ve JSON `/tmp/cal-bup-arastirma/` içinde.
  Gerçek cari ekran görüntüsündeki ad/numara rapora alınmadı; gerçek kart fotoğrafı işlenmedi.
- Sonraki uygulama sırası: 1) işlem sonucu/bildirim/kayıt hataları + worker yaşam döngüsü, 2) denetlenebilir fotoğraf/adayı inceleme hattı, 3) bütün ekranlar/regresyon/yayın kapısı.
  Her aşama çıkış ölçütleri ana raporda; bütün bulgular henüz açık. Hedef ağır bir yeniden yazım değil.

# 3 Ekim 2026 — 1.4.0 gerçek cari profili ve kart yönetimi

Kullanıcı tasarımda kalan kart alanlarını gerçek programda göremediğini bildirdi ve tüm eksik uygulama
işlerinin tamamlanmasını istedi. Önceki yayın yetkisi sürüyor. Artık ilk örnek HTML yerine uygulamanın
Sanal POS rotasına bağlı cari profili/kart ekleme/düzenleme/silme, maskeli seçim, iletişim telefonu ve
firma kontrolü ardından numara/tarih/ad gösterme-kopyalama vardır. Tutar ve banka doğrulaması POS’tadır.

- Günlük PIN kaldırıldı; dışa aktarılamayan rastgele AES-256-GCM cihaz anahtarıyla şifreli yerel profil.
  Aynı tarayıcıya erişen kişi kayıtları açabilir; kullanıcı doğrulaması/PCI uyumu iddiası yoktur.
- Eski v1/v2 kasada PIN/parola bir kez gerekir; kimlikler korunur, atomik geçiş ve önceden eski cari
  yedeği indirme vardır. Okuma/anahtar/bozuk kayıt hatası boş profil sayılmaz. Eski günlük kilit UI kaldırıldı.
- Kartlı taşınabilir şifreli yedek ayrı uzun parola ister; eski cari yedekleri okunur. Maskeli inceleme,
  açık birleştirme onayı ve çelişkide tamamen durma vardır; telefon/kart sessizce ezilmez.
- Gerçek yerel OCR Tesseract.js 7.0.0; worker/WASM/model kendi yayınımızda, harici servis/CDN yok.
  Yalnızca numara/tarih adayları, manuel kontrol zorunlu; 10 MiB/20 MP/90 saniye sınırı ve iptal temizliği.
  Gerçek fotoğraf hiçbir teste/varlığa konmadı. CVV/OTP/fotoğraf/ham OCR depoya yazılmaz.
- Saf kart/profil/fotoğraf kuralları core’da; Web Crypto/IndexedDB/OCR platform’da; UI ayrı bileşenlerde.
  Çoklu sekme eski kaydı ezemez, geç işlem iptali/rota çıkışı nesil denetimli; gizli/boşta form kapanır.
- Kalıcı Playwright testleri ve CI tarayıcı aşaması eklendi. Sentetik Chromium’da profil kalıcılığı,
  iki cari bağı, gerçek yerel OCR ve iptal, düzenleme/silme, taşınabilir yedek, çoklu sekme, eski kasa
  geçişi/ön yedek ve engellenmiş depoda yeniden deneme vardır. Taklit POS formu gerçek ödeme yapmaz.
- Otomatik POS kart doldurma/SMS başlatma için sağlayıcı sözleşmesi bulunamadı/doğrulanmadı;
  kullanıcıya entegrasyon dokümanı soruldu, yanıt bekleniyor. Giriş POST’u kart API’si diye kullanılmadı.

Yerel doğrulama başarılı: `npm run kontrol` (24 dosya / 325 test, tip/lint/biçim/derleme),
`npm run test:tarayici` (8 senaryo), `npm audit` (bilinen açık yok), `git diff --check`.
Yayın `main` gönderiminden sonra GitHub Actions’ın aynı kontrolleri geçmesine bağlıdır.

# 3 Ekim 2026 — cari profili / kayıtlı kartlar planı ve ilk tasarım

Kullanıcı seçilen cariyle girişin çalıştığını bildirdi. Günlük kasa PIN’i istemiyor; cari profilinde
isimli kartlar, elle numara/tarih/kart sahibi ekleme, iletişim telefonu ve sonrasında fotoğraftan
okuma istedi. Önce iyi bir plan ve dikkatli tasarım talep etti. Üretim sürümü **1.3.1 olarak kaldı**;
kart saklama veya PIN kaldırma uygulanmadı/yayımlanmadı.

- Ayrıntılı plan: [SANAL_POS_PROFIL_PLANI.md](SANAL_POS_PROFIL_PLANI.md). Mevcut kasadan bir kez
  eski PIN/parola ile kayıpsız geçiş, PIN’siz yerel şifreleme, ayrı uzun parolalı yedek ve katmanlar tanımlı.
- Telefonun kart başına mı cari başına mı olacağı soruldu. Henüz yanıt yok; ilk tasarım kart başına
  isteğe bağlı iletişim telefonu varsayıyor. Bu alan bankanın SMS/mobil doğrulama hedefini değiştirmez.
- Etkileşimli önizleme `/tmp/cal-bup-pos-profil-tasarimi/` içinde; tüm veriler yapaydır. Cari arama,
  kart seçimi, elle ekleme/düzenleme/silme/iptal ve açık/koyu/dar görünüm vardır. Cari değişimi,
  yeniden POS adımı ve kart değişiminde seçim/kontrol/açık numara temizliği denendi.
  Tek dosyalı çevrimdışı çıktı üst çalışma klasöründe `Sanal POS profil tasarimi.html` olarak
  teslim edildi; gömülü varlıklar ve içerik güvenliği politikası Chromium’da ayrıca denendi.
- Önizleme depoya/panoya yazmaz, gerçek POS’a veya harici adrese bağlanmaz. Fotoğraf/OCR,
  otomatik kart aktarımı, cari kayıt formu ve gerçek şifreli depo ilk tasarımın parçası değildir.
- Sağlanan gerçek fotoğraf CVV içerir; test, kod, Git, önizleme ve yayın varlıklarında kullanılmadı.
  CVV/OTP/fotoğraf/ham OCR saklanmayacak. Sağlayıcı kart aktarım sözleşmesi henüz doğrulanmadı.
- Chromium önizleme denemeleri ve `npm run kontrol` geçti: 22 dosyada 286 test. Tasarım denemeleri
  üretimde kart güvenliğinin veya sağlayıcı entegrasyonunun doğrulanması diye sunulmaz.

Sıradaki uygulama: planın saf kart/telefon kuralları ve eski kasa dönüşüm sözleşmesi; ardından
PIN’siz şifreli depo/yedek, sonra gerçek profil ekranları. Fotoğraftan okuma ve sağlayıcının
desteklediği otomatik kart aktarımı ayrı sonraki aşamalar.

# 3 Ekim 2026 — 1.3.1 seçilen cariyle POS giriş isteği

Kullanıcı nerede kaldığımızı sordu; eksik olarak cari kaydından sonra “POS’u aç” dediğinde doğrudan
o carinin hesabının açılmasını tarif etti. Önceki düğme yalnızca boş giriş sayfasını açıyordu.
Başlangıç temiz `main`, commit `6f64719`.

- Cari kaydetme/düzenleme sonrası cari seçilir; yeniden listeden seçmek gerekmez.
- “POS’u aç” seçilen numarayı vergi/TC no ve kullanıcı, türetilen şifreyi giriş şifresi olarak sabit
  HTTPS giriş sayfasına POST eder. Giriş kabul edilirse hesap yeni sekmede açılır. Bu resmi API değildir;
  gerçek cari oturumu açıldığı henüz doğrulanmadı, uygulama POS sonucunu okuyamaz.
- Form gönderimi yalnızca tıklamayla yapılır, otomatik tekrar yoktur. Kasa PIN’i/cari adı/kart/ödeme
  verisi gönderilmez. Sırlar URL/referrer/panoya eklenmez. Yeni sekmede opener yoktur, geçici form
  alanları boşaltılıp kaldırılır. CSP yalnızca sağlayıcının HTTPS giriş adresine izin verir.
- ASP.NET isteği boş `__VIEWSTATE` ile postback olarak tanır; sağlayıcının imzalı durum alanı
  kopyalanmaz. Herkese açık giriş sayfası incelendi, gerçek tarayıcıda kimlik bilgileri boş form
  gönderimi “Lütfen Tüm Bilgileri Doldurun” yanıtı verdi. Bu, giriş olayının çalıştığını gösterir;
  gerçek cari hesabıyla giriş yapıldığı anlamına gelmez.
- Firma kontrolü kullanıcıya aittir. Önceki cari oturumundan çıkma, elle bağlantı/kopyalama alternatifi,
  30 dakikalık kasa kilidi ve PIN/yedek biçimi korunur. Kart/OCR veya ödeme geçmişi eklenmedi.
- Gizlilik, iş kuralları, mimari ve Sanal POS belgeleri güncellendi. Yeni bağımlılık yok.

Doğrulama:

- `npm run kontrol`: **22 dosyada 286 test**, tip/lint/biçim/derleme başarılı; yerel Excel altın testleri dahil.
- `/tmp/cal-bup-pos-otomatik.mjs`: gerçek Chromium/IndexedDB; iki yapay cariyle POST gövdesi, tek
  gönderim, kayıt sonrası seçim, sıfırlı numara, URL/referrer/opener, geçici form temizliği,
  kilit/açılış ve firma onayının sıfırlanması, elle GET, geniş/dar görünüm doğrulandı. Cari bilgisi
  POST’ları taklit servise gider. Yönlendirme testi yalnızca sağlayıcının herkese açık CSS dosyasına
  boş gövdeli GET yapar; giriş/ödeme yoktur.
- `/tmp/cal-bup-pos-bos-form.mjs`: gerçek sağlayıcıya yalnızca boş giriş alanları; form olayı çalıştı,
  cari/şifre kullanılmadı, hesap girişi veya ödeme yapılmadı.
- Görüntüler `/tmp/cal-bup-pos-otomatik-1440.png`, `/tmp/cal-bup-pos-otomatik-390.png` incelendi;
  yatay taşma veya JS sayfa hatası yok. `git diff --check` temiz.

Sıradaki doğrulama: Kullanıcı Windows Chrome/Edge’de önceki POS oturumundan çıkıp kendi carisini
seçerek “POS’u aç” der; açılan firma adı/numarasını kontrol eder. Giriş ekranında kalırsa sağlayıcı
yanıtı araştırılır. Gerçek giriş tamamlandı veya otomatik firma/ödeme doğrulaması var diye anlatma.

# 3 Ekim 2026 — 1.3.0 kısa PIN ve kasa oluşturma düzeltmesi

Kullanıcı kasa oluşturamadığını bildirdi; kısa sayı parolası ve müşteri banka şifresini beklerken
beş dakikalık kilidin işlemi tekrar başlatmamasını istedi. Çalışmaları bitirme, denetleme ve ardından
bilgisayarı kapatma talebi açıkça verildi. Başlangıç temiz main, commit `f29b269`.

- Canlı 1.2.0 incelemesinde uzun parola ile oluşturma çalıştı; kısa parola HTML `minLength` doğrulamasına
  takılarak React hata mesajına ulaşmıyordu. Yeni formlar açık hata verir, DOM otomatik doldurmasını da okur.
- Yeni yerel kasa cihaz anahtarlı v2: 4–12 rakamlık PIN veya uzun parola. Rastgele dışa aktarılamayan
  HMAC-SHA256 anahtarı depoda; PIN HMAC sonucu PBKDF2-SHA256/600.000 + AES-256-GCM’ye girer.
  HMAC anahtarı ve zarf tek atomik aktarımda yazılır; AES oturum anahtarı kalıcı saklanmaz.
  Bu tarayıcı profiline bağlı uygulama korumasıdır, donanım kasası veya uzun parola eşdeğeri değildir.
- Taşınabilir yedek ayrı 14–128 karakterlik uzun parola ile yeniden şifrelenen v1 `.calpos` dosyasıdır;
  PIN/cihaz anahtarı dışa aktarılmaz. Eski v1 kasa ve yedekler çalışır; parola değişimi v2’ye taşır.
- Otomatik kilit 30 dakika. Aynı bölümde yeniden açınca seçilen cari geri gelir; firma onayı sıfırlanır.
  CAL bup açık POS sekmesini kapatmaz/alanlarını silmez. Sağlayıcının kendi sürelerini değiştiremez.
- Beş deneme/60 saniye sınırı atomik kalıcı sayaçla korunur, başarılı açılışta sıfırlanır.
- Depo açılışı/aktarım ve şifreleme bekleme sınırları; görünür ilerleme, işlemi durdurma, yeniden kontrol.
  Geç sonuçlar anahtarı tekrar etkinleştiremez; başarısı belirsiz yazı sonrası kasa yeniden okunur.
- BroadcastChannel kurulamıyorsa uygulama çalışır; atomik çakışma kontrolü devam eder.
  Başka sekmede değişmiş liste eski oturumdan taşınabilir yedek olarak sunulmaz.
- Kullanım/gizlilik/iş kuralları güncellendi; yeni bağımlılık yok. Kart/ödeme alanları eklenmedi.

Doğrulama:

- `npm run kontrol`: **22 dosyada 283 test**, tip/lint/biçim/derleme geçti; gerçek Excel/ikiz altın testleri dahil.
- `npm audit`: 0 bilinen açık; `git diff --check` temiz.
- Gerçek Web Crypto testleri: PIN, dışa aktarılamayan anahtar, kayıp cihaz anahtarında kaydı koruma,
  eski v1 veri/yedek, farklı PIN kasasına yedek ekleme, sayaç/kayıt çakışması, başarısız anahtar dönüşümü,
  yanıtsız şifreleme zaman aşımı/yeniden deneme, güvensiz bağlantı/eksik Crypto ve geç depo sonuçları.
- Chromium `/tmp/cal-bup-pos-browser.mjs`: gerçek IndexedDB/pano; PIN oluşturma, cari CRUD, ayrı uzun
  parolalı yedek indirme/geri ekleme, parola/PIN değişimi, rota/iki sekme, 6 dakikada açık kalma,
  30 dakika kilidi, seçili carinin geri gelmesi ve açık taklit POS alanlarının aynı kalması geçti.
  Açık/koyu/dar görünüm incelendi, yatay taşma/JS hatası yok. Gerçek POS’a bağlanılmadı.
- `/tmp/cal-bup-pos-hatalar.mjs`: engelli depodan yeniden kontrol ile toparlanma, kanal kurulum hatası,
  pano/elle giriş, bfcache dönüşü, bozuk kaydı koruma geçti.
- `/tmp/cal-bup-pos-kilit-form.mjs`: boş/kısa/farklı PIN için görünür hata, React olayı olmadan DOM
  otomatik doldurma, başı sıfırlı dört rakam PIN ile oluşturma/yeniden açma geçti.
- `/tmp/cal-bup-localwrite.mjs`: gerçek rapor dosyalarıyla gerçek IndexedDB + taklit dosya erişiminde
  tek yazma, kalıcı yedek ve doğru geçmiş/yedek bağlantısı geçti; fiziksel dosyalar değiştirilmedi.
- `/tmp/cal-bup-pos-iptal.mjs`: yanıt vermeyen şifrelemede ilerleme, durdurma ve yeniden oluşturma geçti.

Windows’taki gerçek kullanımı ve POS sağlayıcısının kendi oturum/şifre süresi bu tarayıcı testleriyle
kanıtlanmış sayılmaz. Otomatik POS oturumu/ödeme doğrulaması yoktur. Teknik sınırlar [SANAL_POS.md](SANAL_POS.md).

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
