# 5 Ekim 2026 — Sanal POS derin tarama raporu (1.11.0)

Kullanıcı bildirimi (Windows'ta deneme): (1) cari numarası kaydedildikten sonra o cariyle
POS'a girilemedi, (2) kart eklenirken kart bilgileri otomatik yazılmadı. İstek: Sanal POS'un
hatalarını, mantıksız durumlarını, mimarisini ve olası bütün sorunlarını raporlamak.
**Bu turda uygulama davranışı değiştirilmedi.**

## Nasıl incelendi

- Sanal POS'un bütün kaynakları okundu: arayüz (`arayuz/sayfalar/pos/`), saf kurallar
  (`cekirdek/pos*`, `kartMetni`), şifreli depo (`platform/posProfil*`), OCR (`platform/ocr/`,
  `posKartOkuma`), MV3 yardımcısı (`eklenti/`), Windows kurulum üreticisi ve paketleyici.
- Sağlayıcının **herkese açık giriş sayfası** bir kez salt okunur GET ile indirildi (hiçbir bilgi
  gönderilmedi, giriş denenmedi). Form `form1`, alanlar `lvergino / lkullaniciadi / lsifre`,
  düğme `btngiris`, `__VIEWSTATE` ve `__VIEWSTATEGENERATOR` var, `__EVENTVALIDATION` **yok**.
  Yardımcının beklediği giriş yapısı bugünkü sayfayla uyumlu. Sayfa metni: “Vergi numaranızı ve
  sistemde kayıtlı lisans numaranızı giriniz”; ayrıca “Yeni firma — müşteri olmak için başvuru”
  bölümü var.
- Linux'ta POS birim testleri (9 dosya / 122 test) ve POS tarayıcı testleri (posProfil, eklenti,
  posBaglanti, fotograf: 42 senaryo) çalıştırıldı; **hepsi geçti**. Bulunan sorunlar mevcut
  testlerin kapsamadığı gerçek kullanım koşullarındadır.
- Yapılamayan: gerçek POS'a giriş, gerçek ödeme sayfası, gerçek kart fotoğrafı, Windows/Edge
  denemesi. `platform/idb.ts` okuma isteği oturumda izin denetimine takıldı; depolamanın kalıcı
  (persist) istenip istenmediği **doğrulanmadı**.

## A. Kullanıcının bildirdiği iki sorun

### A1. Kaydedilen cariyle POS'a girilemiyor

Kodda kaydetme → seçme → “POS'u aç” zinciri doğru cariyi kullanıyor; eski veri kalması gibi bir
hata bulunmadı. Uygulama giriş sonucunu **okuyamaz**; yalnız şunu gönderir: vergi no, kullanıcı
adı = vergi no, şifre = numaranın ilk 2 + son 2 hanesi. Olası nedenler, olasılık sırasıyla:

1. **Bu cari sağlayıcıda o kuralla kayıtlı değil.** Giriş sayfası “sistemde kayıtlı lisans
   numarası” istiyor ve firmanın önce başvurup onaylanması gerektiğini yazıyor. CAL bup'a cari
   eklemek sağlayıcıda hesap açmaz. Şifresi değiştirilmiş veya farklı kullanıcı adıyla kayıtlı
   cari de bu kurala uymaz. Kod bunu bilemez.
2. **TC / vergi no farkı.** Şahıs firmalarında sağlayıcı VKN ile kayıtlıyken CAL bup'a TC
   (veya tersi) girilmiş olabilir.
3. **Açık başka cari oturumu.** Belgeler de önceki cari oturumundan çıkılmasını istiyor.
4. **Doğrudan form gönderiminin kırılganlığı.** “POS'u aç” sağlayıcının imzalı sayfa değerlerini
   değil boş `__VIEWSTATE` gönderir; `noreferrer` yüzünden Referer gitmez, Origin `null` olur.
   Bugünkü sayfada olay doğrulaması yok, bu yüzden kabul edilmesi olası (daha önce çalıştığı
   bildirilmişti). Sağlayıcı CSRF/olay doğrulaması eklerse bütün girişler sessizce bozulur.
5. **Yanıltıcı mesaj.** Giriş başarısız olsa da uygulama “giriş bilgileri POS'a gönderildi”
   der. Yardımcı yolunda başarısız giriş “ödeme ekranı açılmadı” diye raporlanır; sayfadaki
   hata etiketi (`lblgizleme`) okunmaz. Kullanıcı gerçek nedeni göremez.

**Ayırt etme adımı:** Cari profilinde “Giriş bilgilerini göster” ile numarayı/şifreyi görüp giriş
sayfasına **elle** yazmak. Elle de girilmiyorsa sorun bilgilerde/kayıtta (1–3), elle giriliyor
ama düğmeyle girilmiyorsa sorun koddadır (4); o zaman açılan POS sekmesinin ekran görüntüsü ve
kırmızı hata yazısı gerekir.

### A2. Kart bilgileri otomatik yazılmıyor

İki farklı yer olabilir:

**(a) Kart eklerken fotoğraftan okuma.** Tasarım gereği fotoğraf formu **hiçbir zaman kendiliğinden
doldurmaz**: adaylar ayrı kutuda çıkar, birden çok aday varsa seçilmesi gerekir, “fotoğrafla
karşılaştırdım” kutusu işaretlenip “Kontrol ettiğim alanları uygula” düğmesine basılmalıdır.
Yalnız numara ve tarih okunur; kart üzerindeki ad ve telefon hiçbir zaman okunmaz. OCR yalnız
yapay görüntülerde test edildi (her biri ~1,4 sn); gerçek, yansımalı/kabartmalı fotoğrafta ve
yavaş iş bilgisayarında 2400 piksellik dokuz deneme 90 saniye sınırına dayanabilir.
Ayrıca B1'deki form kaybolması okumayı yarıda kesebilir.

**(b) POS ödeme ekranına doldurma.** Yalnız “Seçili kartla POS'u aç” düğmesi doldurur; profilin
altındaki “POS'u aç” **asla kart doldurmaz** (iki benzer düğme karışıklık yaratıyor). Doldurma için
hepsi aynı anda sağlanmalı:

1. Yardımcı aynı tarayıcıda (Edge ise Edge'de) yüklü ve açık, CAL bup sekmesi kurulumdan sonra
   yenilenmiş olmalı. Önceki tarama kullanıcının yardımcıyı kurmadığını kaydetmişti.
2. Ödeme sayfasında boş alanlar ve vergi/TC yazısı **o sayfa adresinde** bir kez tanıtılmış olmalı.
3. Ödeme sayfasında tek ve açık 10–11 haneli numara görünmeli ve kaydedilen cariyle birebir aynı
   olmalı (TC/VKN farkı burada da doldurmayı engeller).
4. Tıklamadan sonra **2 dakika içinde** ödeme sayfasına gelinmeli; sayfa betiği de sayfa
   açılışından 125 sn sonra denemeyi bırakır.
5. Alanlar boş olmalı. Edge'in kendi kart otomatik doldurması alanı önceden doldurursa yardımcı
   “başka bilgi var” diyerek durur.
6. Kart alanları ayrı çerçevede (iframe) veya banka alan adında olmamalı; orada hiç çalışmaz.
7. Tarih tek alansa `AA/YY` yazılır; alan `AAYY` (4 karakter) veya `AA/YYYY` bekliyorsa reddedilir
   ya da yanlış biçim olur.
8. Değer olay üretmeden yazılır (bilerek). Kart maskesi/JS doğrulaması kullanan alanlar değeri
   görmeyebilir veya odaklanınca silebilir.

Girişten sonra açılan ilk sayfa büyük olasılıkla ödeme sayfası değildir. Yardımcı o sayfada da
“Bu ödeme ekranı henüz tanıtılmadı, alanları tanıtın” der; kullanıcı yanlış sayfayı tanıtmaya
yönlendirilebilir. Uygulamadaki durum mesajı da aynı yanlış izlenimi verir.

## B. Kodla doğrulanan hata ve mantıksız davranışlar

**B1 — Açık formlar sessizce kayboluyor (en önemli).** “Yeni cari”, “Kart ekle” penceresi ve yedek
önizlemesi, sayfa gizlenince veya **2 dakika tıklama/tuşa basma olmayınca** uyarısız kapanıyor;
yazılanlar kayboluyor, süren fotoğraf okuması iptal oluyor (`usePosProfili` gizlilik sayacı,
`form.no === gizlilikNo` koşulu). Tetikleyiciler:

- Başka sekmeye geçmek (örneğin LED'den numara kopyalamak).
- **Windows'ta** pencereyi küçültmek ya da üstüne tam ekran başka pencere (WhatsApp'taki kart
  fotoğrafı, Excel) gelmesi: Chrome/Edge Windows'ta örtülen pencereyi “gizli” sayar. Linux'ta bu
  çoğu zaman olmaz; bu yüzden Linux denemelerinde fark edilmemesi beklenir.
- Fotoğraf seçme penceresinde geçen süre + 90 saniyeye kadar okuma: kullanıcı beklerken tıklamadığı
  için boşta sayılır.
  Tarayıcı testi gizlenince formun kapanmasını **beklenen davranış** olarak doğruluyor; yani bu bir
  tasarım kararı, ama gerçek kullanımda veri kaybına dönüşüyor. Öneri: formu kapatmak yerine yalnız
  tam kart numarasını maskelemek, okuma sürerken boşta sayacını durdurmak, kapanırsa açık mesaj vermek.

**B2 — Firma kontrol kutusu her sekme geçişinde sıfırlanıyor.** Elle akışta: kutuyu işaretle →
numarayı kopyala → POS sekmesine geçip yapıştır → geri dön: kutu boş, kopyalama düğmeleri kapalı.
Tarih için yeniden işaretlemek gerekir. Kutu yalnız bu sayfada “POS'u aç” tıklandıktan sonra
görünür; POS zaten başka sekmede açıksa bir kez daha açmak gerekir.

**B3 — Fotoğraf adayını uygulamak elle yazılanı silebilir.** Numara elle yazılıp sonra fotoğraf
okunursa ve yalnız tarih bulunursa, “uygula” numarayı boşaltır (metinde yazıyor ama gözden kaçar).

**B4 — Alan tanıtımında sıkı ad kuralları.** Ay alanı ancak kimliğinde/etiketinde ayrı bir “ay”
sözcüğü varsa kabul edilir; `ddlAy`, `txtAy` gibi tipik ASP.NET adları reddedilir. Numara alanı
“kart+no/num” ipucu ister; `txtCCNo` gibi adlar reddedilir. Gerçek ödeme sayfasının HTML'i
bilinmediğinden kesin değil, ama “Bu alan uygun değil” hatasının olası kaynağı.

**B5 — Giriş adresi büyük/küçük harf duyarlı.** Yardımcı yalnız tam `/login.aspx` adresini giriş
sayfası sayar. Oturum düşüp sağlayıcı `/Login.aspx?ReturnUrl=…` gibi bir adrese yönlendirirse otomatik
giriş yapılmaz, “alanları tanıtın” denir.

**B6 — Sekmeden ayrılma temizliği çoğu durumda çalışmıyor.** Yardımcının `tabs` izni yok; adres
değişikliği yalnız POS alan adında görülebilir. Program sekmesinin başka adrese gitmesi algılanmaz
(2 dakikalık süre sonu yine işi bitirir; düşük risk).

**B7 — Küçük girdi katılıkları.** Kart numarası yalnız boşluklarla kabul edilir, tireli yapıştırma
reddedilir; vergi numarasına boşluk girerse reddedilir. 17–19 haneli gerçek kartların yaklaşık beşte
biri OCR'da “CVV birleşmiş olabilir” kuralıyla reddedilir (Türkiye'de kartların çoğu 16 hane).

## C. Mimari, güvenlik ve bakım riskleri

**C1 — Veriler yalnız o tarayıcıda.** Linux'taki cariler Windows'ta, Chrome'dakiler Edge'de yoktur.
Kurumsal “kapatınca site verilerini sil” politikası, tarayıcı temizliği veya depolama baskısı bütün
cari ve kartları siler. Şifreli yedek tek kurtarma yoludur ve yedek hatırlatması yok.

**C2 — Ortak köken.** Uygulama `alibedirhan.github.io` kökeninde çalışır. Aynı hesabın yayınladığı
**her** GitHub Pages sitesi aynı kökeni paylaşır ve kart deposunu açabilir (anahtar dışa aktarılamaz
ama kullanılabilir). Google Drive girişi için Google betiği aynı kökte yüklenir. (İlk turdaki “CSP yok”
ifadesi **yanlıştı**: derleme sırasında `vite.config.ts` sıkı bir CSP meta etiketi ekliyor; bkz. E.)
Öneri: bu hesapta başka Pages sitesi yayınlamamak veya ayrı alan adı.

**C3 — PIN'siz şifreleme sınırı ve uyum.** Şifreleme yalnız diskteki ham dosyaya karşı korur; tarayıcı
profiline erişen kişi kartları görür (belgelerde açık). Tam kart numarası saklamak PCI DSS kapsamına
girer; şirketin/bankanın buna izin verip vermediği ve KVKK açısından durum kullanıcı/işletme ile
netleştirilmelidir. Kod bunu çözemez.

**C4 — Sağlayıcıya tam bağımlılık, gerçek sayfasız testler.** Giriş alan adları, şifre kuralı ve
ödeme sayfası değişirse özellik bozulur. Bütün testler taklit sayfalarla çalışır; taklit giriş
formunda gerçek sayfadaki kayıt alanları, `__VIEWSTATE`, hata etiketi yoktur. Bugünkü gerçek giriş
sayfası yardımcının denetimlerinden geçecek yapıda.

**C5 — Yardımcı kurulumu ağır ve kırılgan.** Geliştirici modu ve paketlenmemiş eklenti gerekir;
kurum politikası engelleyebilir, tarayıcı açılışta uyarı gösterebilir. `.cmd` indirmesi Edge/
SmartScreen tarafından engellenebilir. Eklenti sürümü her uygulama sürümüyle değişir ve otomatik
güncellenmez; eski indirilmiş kurulum dosyası yeni ZIP ile “Paket doğrulanamadı” verir.

**C6 — Kullanım yükü.** Bir ödeme için dört ayrı onay kutusu (cari, kart, fotoğraf, firma), iki
benzer “POS'u aç” düğmesi ve ~6.300 satırlık POS kodu var. Hata mesajları çoğunlukla güvenli ama
nedeni söylemiyor; kullanıcı ne yapacağını bilemiyor.

**C7 — Test kapsamı dışında kalanlar.** Pencere örtülmesi/küçültme, 2 dakika boşta kalma sırasında
form, gerçek fotoğraf hızı/başarısı, gerçek ödeme sayfası, başarısız giriş yanıtı, Edge otomatik
doldurması ve kurumsal politika hiç denenmiyor.

## D. Önerilen düzeltme sırası (kullanıcı onayıyla)

1. B1: formları kapatmayıp yalnız hassas bilgiyi gizlemek; okuma sırasında boşta sayacını
   durdurmak; kapanırsa görünür mesaj.
2. A1: giriş sonucunu yardımcıyla okuyup (`lblgizleme`) açık hata vermek; “gönderildi” mesajını
   “sonucu POS sekmesinde kontrol edin” olarak düzeltmek; elle giriş denetimini kullanıcıya önermek.
3. A2(b): girişten sonra ödeme sayfasına gelinmediğinde “ödeme sayfasına geçin” demek, tanıtma
   davetini yalnız gerçekten kart alanı olan sayfada göstermek; süreyi gerçekçi uzatmak.
4. B2/B3: firma onayını sekme geçişinde korumak; fotoğraf uygulamasında bulunmayan alanı boşaltmamak.
5. B4/B5 ve tarih biçimi: gerçek ödeme sayfasının (kart bilgisi olmadan) HTML'i görüldükten sonra.
6. C1: yedek hatırlatması ve kalıcı depolama isteğinin doğrulanması.
7. Gerçek sayfa yapısına yakın taklitlerle ve Windows görünürlük/boşta senaryolarıyla yeni testler.

## E. İkinci tarama (aynı gün) — doğrulamalar, düzeltmeler, yeni bulgular

İlk turdaki iddialar derlenmiş uygulamada ve derlenmiş MV3 yardımcısıyla, ağa kapalı yapay POS
sayfalarında denendi. Yapay POS giriş sayfası gerçek sayfanın yapısını taklit eder (kayıt alanları,
`__VIEWSTATE`, `lblgizleme`); gerçek sağlayıcıya bağlanılmadı. Geçici test dosyaları silindi.

### Gerçek tarayıcıda doğrulananlar

- **B1 doğrulandı.** Saat 120 sn ileri alınınca kart penceresi kapandı; ekranda uyarı yok; yeniden
  açılınca numara alanı boş. “Yeni cari” formu da aynı şekilde kapandı.
- **B2 doğrulandı.** Firma kontrol kutusu işaretliyken sekme gizlenip geri gelince işaret kalktı.
- **Girişten sonra ana sayfa (A2-b) doğrulandı.** Yardımcı, girişten sonra açılan ana sayfada da
  panelde “Bu ödeme ekranı henüz tanıtılmadı”, programda “POS ödeme ekranı henüz tanıtılmadı” diyor.
  Kullanıcı ödeme sayfasına geçince kart numarası ve tarih **doğru dolduruldu**. Sorun doldurma değil,
  yanıltıcı mesajdır. Mevcut testlerin taklit POS'u girişten sonra doğrudan ödeme sayfasına gittiği
  için bu durum hiç görülmüyordu.
- **Başarısız giriş (A1-5) doğrulandı.** Taklit sayfa “Kullanıcı adı veya şifre hatalı” gösterirken
  panel ve program “POS girişinden sonra ödeme ekranı açılmadı” diyor; gerçek neden aktarılmıyor.
- **Tarih alanı 4 karakter (AAYY) doğrulandı ve ağırlaştı.** Böyle bir alan **tanıtılamıyor bile**
  (“Bu alan uygun değil”); yardımcı o sayfada hiç kullanılamaz.
- **B4 alan adı kuralları denendi.** Etiket/placeholder yardımı olmadan `ddlAy`, `txtAy`,
  `cmbSKTAy` (ay); `txtCCNo`, `txtKKNo`, `KrediKarti`, `txtPan`, `ccnumber` (numara);
  `txtGecerlilik` (tarih) reddediliyor. Engelli sözcük listesi `pin` alt dizesi yüzünden
  `...Shopping`, `...Pinar` gibi adları da engelliyor.

### Elenen / düzeltilen iddialar

- **CSP yönlendirmeyi engellemiyor.** Programın CSP'si form gönderimini yalnız giriş adresine izin
  veriyor. Girişten sonra sunucu 302 ile başka sayfaya yönlendirdiğinde Chromium'un bunu engelleyip
  engellemediği iki yerel sunucuyla denendi: yeni sekmede yönlendirme **çalıştı**. Bu, giriş sorununun
  nedeni değildir.
- **OCR hızı ilk turda abartılmıştı.** Telefon çözünürlüğünde (4000×3000), desenli zeminde, hafif
  eğik, okunur yapay kart **1,9 sn**'de okundu. Okunacak rakam bulunmayan, çok kalabalık desenli
  4000×3000 görüntü ise 20 çekirdekli bu bilgisayarda bile 9 denemenin sonunda **90 sn sınırına
  takıldı**. Yani yavaşlık yalnız okunamayan/kalabalık fotoğraflarda olur. Ayrıca her okuma yaklaşık
  7 MB motor/model dosyasını yeniden yükler ve 90 sn süre bu yüklemeyle birlikte başlar; yavaş iş
  ağında ilk okuma süreyi yer.

### Yeni bulgular

**E1 — Yedekten geri yükleme, iki bilgisayarda yapılan küçük düzenlemelerde tümüyle reddediliyor.**
Saf birleştirme kuralıyla denendi:

- Aynı yedek: eklendi (değişiklik yok).
- Bir tarafta cari adı değişmiş (“… Ltd” eklenmiş): **bütün yedek reddedildi**.
- Bir tarafta karta telefon eklenmiş ya da kartın adı değişmiş: **bütün yedek reddedildi**.
- Aynı ad, farklı numara: reddedildi.
- Aynı cari iki bilgisayarda ayrı ayrı oluşturulmuş (farklı iç kimlik): doğru birleşti.
  Kullanıcı hem Linux'ta hem Windows'ta kullandığı için kayıtları yedekle taşımak, ilk düzenlemeden
  sonra pratikte imkânsızlaşır. Hata mesajı hangi carinin/kartın çeliştiğini söylemez. “Yedektekini
  kullan / buradakini koru” seçeneği yok.

**E2 — Açıkken başka sekmede kayıt yapılırsa bu sekmedeki açık form da kaybolur.** Profil değişim
yayını gelince sayfa profili yeniden açıyor, seçimi ve açık formu temizliyor (belgelenmiş davranış);
yazılanlar uyarısız gider.

**E3 — POS'ta başka cari oturumu açıkken “Seçili kartla POS'u aç”.** Sağlayıcı oturum açıkken giriş
sayfasından ana sayfaya yönlendirirse yardımcı giriş yapmadan eski carinin sayfasına düşer, cari
karşılaştırması “eşleşmiyor” der ve doldurmaz. Bu güvenli, ama kullanıcıya “önce POS'tan çıkış yapın”
denmiyor.

**E4 — Firma numarası alanı tek numara içermeli.** Tanıtılan yazıda vergi no ile birlikte 10 haneli
bir telefon (5xx…) veya ikinci bir numara varsa “Firma numarası tek ve açık biçimde okunamadı” olur.

**E5 — Cari araması yalnız ada göre.** POS'un kimliği vergi/TC numarası olduğu hâlde numarayla arama
yok; 500 cariye kadar kayıtta yavaşlatıcı bir kullanım eksikliği.

**E6 — Yardımcı paneli her POS sayfasında sağ altta, en üst katmanda açılıyor** (390 px). Küçük
dizüstü ekranında ödeme formunun sağ alt köşesini (düğmeler) örtebilir. Küçültme seçimi hatırlanmıyor,
her sayfa açılışında panel yeniden büyük açılır.

### Yeniden çalıştırılan testler

Linux'ta POS birim testleri (122) ve POS tarayıcı testleri (42) yine geçti. Yukarıdaki bulguların
hiçbiri mevcut testlerle yakalanmıyor; D bölümündeki sıraya E1 (yedek birleştirme seçenekleri) 2. veya 3. sıraya eklenmelidir.

## F. Uygulama (1.12.0, aynı gün)

Kullanıcı bulguların üç aşamada giderilmesini ve Bupiliç'in gerçek sanal POS adresine hiçbir şey
yapılmamasını istedi. Bütün denemeler ağdan yalıtılmış taklit POS ile yapıldı.

- **1. aşama (B1, B2, B3, E2):** formlar kapanmaz, hassas görünüm örtülür; firma beyanı sekme geçişinde
  korunur ve 30 dakikayla sınırlıdır; kutu POS'u bu sayfadan açmadan da işaretlenebilir; başka sekme
  değişikliği ekranı kapatmadan okunur, bayat düzenleme reddedilir; tarih-yalnız fotoğraf numarayı korur.
- **2. aşama (A1-5, A2-b, B4, E3, E6, AAYY):** dürüst giriş mesajı; başarısız girişte sağlayıcı yazısı;
  ana sayfada “ödeme sayfasına geçin”; çıkış önerisi; `AAYY`/`AA/YYYY`; genişletilmiş alan ipuçları ve
  daraltılmış PIN engeli; hatırlanan panel tercihi; 180 sn; sürüm farkı uyarısı.
- **3. aşama (E1, E5, C1 kısmen):** yedek birleştirmede özet, açık “koru/yedek” seçimi, özet imzası;
  numara ile arama; yedek hatırlatması.

Uygulanmayanlar ve nedenleri: B5 (büyük harfli `Login.aspx` yönlendirmesi) gerçek sağlayıcı davranışı
görülmeden değiştirilmedi; B6 için `tabs` izni istenmedi (yetki genişletmek istenmedi, süre sınırı korur);
E4 güvenlik gereği katı bırakıldı; C2/C3/C5 kod dışı kararlardır; depolama kalıcılık isteği incelenmedi.

Gerçek kart, müşteri fotoğrafı veya canlı ödeme bu taramada kullanılmadı.
