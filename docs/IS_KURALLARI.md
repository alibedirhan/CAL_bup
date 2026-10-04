# CAL bup — İş kuralları ve dosya biçimleri

Bu belge raporların _ne_ yaptığını anlatır; _nasıl_ yapıldığı `docs/MIMARI.md`'dedir. Kurallar eski
Excel/VBA aracından (v1.2) taşınmış ve 30.09.2026 gerçek dosyalarıyla doğrulanmıştır. Gerçek rakamlar
burada yazmaz (depo herkese açık); doğrulanmış rakamlar yalnızca yereldeki `ornekler/beklenen.json`'dadır.

## Kaynak sistem: LED

Okunan raporlar Bupiliç'in **LED** sisteminden alınır (LOGO değil). Ortak özellikler:

- Sayılar hücrede **metin** olarak gelir: `"2.854,61"` (nokta binlik, virgül ondalık). `sayiCevir`
  bölgesel ayardan bağımsız çevirir; gerçek sayı gelirse olduğu gibi alır.
- A1'de raporun adı, A2'de filtreler ve `Başlangıç Tarihi : GG.AA.YYYY` / `Bitiş Tarihi : ...` satırları
  vardır (A2 biçimli metin olabilir). Etiketler Ayarlar'dadır.
- Dip toplam satırında ad ve kod boş, miktar doludur. Birden fazla dip toplam satırı varsa ilki alınır.
- Aynı ürün adı farklı stok kodlarıyla birden fazla satırda gelebilir; miktarlar **ada göre toplanır**.
- Ad karşılaştırması büyük/küçük harf duyarsızdır; fazla boşluk, sekme, satır sonu ve bölünmez boşluk
  temizlenir (`adNormal`).

### D01 Stok Giriş Çıkış Envanteri

- İlk sayfa. A1'de `D01.Stok Giriş Çıkış Envanteri`. Başlıklar 3. satırda, veri 4. satırdan.
- A: Stok Kodu, B: Stok İsmi, H: Net Miktar.
- Sonda iki dip toplam satırı ve arada boşluklu bir satır vardır.

### Sayım fişi

- `Sayım Fişi` adlı sayfa. Başlık 1. satırda; B: stok kodu, C: ad, D: miktar (gerçek sayı).
- Eldeki örnekte E: `Birim` = KG, F: `Amb. Miktar`, G: `Amb. Birim` = KOLİ. Okuyucu yalnızca D'deki
  hazır miktarı kullanır. Aynı ürünün adetli ve kolili satırlarında D kilogram ise bu miktarlar ada
  göre toplanıp raporda ilgili ürün satırına yazılır; ambalaj sayıları bu toplama eklenmez.
- Başlıkta `Birim` sütunu varsa ürün satırları KG/KİLOGRAM/KILOGRAM olmalıdır. Boş, adet, koli veya
  başka birim reddedilir; adet/koli miktarı kilogram kabul edilmez. Birim sütunu olmayan eski biçim
  hazır kilogram varsayımını korur. Ürün adları ambalaja göre farklıysa otomatik eşlenmez.
  Adet/koli → kilogram dönüşümü yeni örnek ve doğrulanmış ağırlık kuralını bekler; ağırlık tahmin edilmez.
- **Dosyanın içinde tarih yazmaz.** Tarih önce dosya adından alınır (`SAYIM_30_09.xlsx`,
  `Sayım 30.09.2026.xlsx`: adın içindeki ilk geçerli gün-ay çifti; dört haneli yıl yoksa bugüne en yakın
  yıl). Adda tarih yoksa dosyanın oluşturulma tarihi kullanılır.
- Dip toplam `SUBTOTAL` formülüdür ve çoğu zaman hesaplanmamış kaydedilir; o durumda satırların toplamı
  kullanılır.

### Şube alış (Dönemsel İskonto Raporu)

- İlk sayfa. A1'de `Şube Alış` geçer.
- Gruplu: her ürün önce `Stok İsim:...` başlık satırı (B sütunu), sonra detay satırı. Başlık satırlarında
  ad sütunu boş olduğu için kendiliğinden atlanır.
- D: Stok İsim, F: Stok Kodu, H: Miktar. Dip toplam en alttaki satırdadır.

## Hedef: günlük depo kontrol dosyası

Kullanıcının elle tuttuğu kitap. Her gün için bir sayfa, adı `GG.AA` (`30.09`, `01.08 DEPO` de olur),
en yeni gün en sonda.

- A1:D1 birleşik başlık. G1 = `GELEN MAL` (dosyayı tanımak için kullanılır), G2 = gelen mal (sayı).
  H1:J2'de kullanıcının kendi formülleri vardır (ör. H2 `=D<toplam>`); satır eklenince kaydırılır.
- A2 / C2: `"GG.AA.YYYY LED DEPO STOĞU (D01)"` / `"GG.AA.YYYY DEPO KAPANIŞ STOĞU"` (önceki gün, metin).
  B2 = `=+'önceki gün'!B<toplam>`, D2 aynı biçimde, E2 = `=+B2-D2`.
- A3:B3 ve C3:D3 birleşik, yeni günün tarih metinleri A3 ve C3'te; E3 = `FARK`.
- Liste 4. satırdan başlar: A ad, B sayı, C `=A<r>`, D sayı, E `=B<r>-D<r>`; F/G'de elle notlar olabilir.
- Listenin hemen altında dip toplam satırı: B, D, E'de `=SUM(...)`.
- Başka sayfaya bakan formül yalnızca B2 ve D2'dir; ikisi de yeniden yazılır. Bu yüzden önceki günü
  kopyalayarak yeni gün oluşturmak güvenlidir.

## Günlük depo kontrol kuralları

| Hedef                | Kaynak           | Kural                                                                              |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| B (LED stoğu)        | D01 · Net Miktar | Ada göre eşleşir                                                                   |
| D (depo sayımı)      | Sayım fişi       | Sayımda yoksa ve adı donuk önekiyle (`DON.`) başlıyorsa D = B, değilse 0           |
| G2 (gelen mal)       | Şube alış dip    | Bir önceki günün raporu olmalı                                                     |
| Tekrar eden ad       | —                | Miktar ilk satıra, diğerine 0 (not düşülür)                                        |
| Listede olmayan ürün | D01 veya sayım   | Miktar ≠ 0 ise alfabetik yerine satır eklenir (uyarı); 0 ise yalnızca not          |
| Dip toplamlar        | —                | B, D, E formülleri her çalıştırmada tüm listeyi kapsayacak şekilde yeniden yazılır |
| Başlıklar            | —                | A2/C2 önceki gün, A3/C3 yeni gün; B2/D2 önceki sayfanın dip toplamına bağlanır     |

**Gün seçimi:** son gün sayfasından sonraki iş günü önerilir (ayara göre pazar atlanır). O günün sayfası
varsa kullanıcıya sorulur ve yerinde yeniden doldurulur (kendinden önceki sayfa "önceki gün" olur). Son
sayfadan önceki, olmayan bir gün reddedilir.

**Tarih kontrolleri:** D01 bitiş tarihi ve sayım fişi tarihi = yeni gün; şube alış bitiş tarihi = önceki
gün. Uymazsa sorulur, onaylanırsa uyarı olarak kayda geçer. Tarih bulunamazsa not düşülür.

**Kontroller:**

1. LED stoğu = D01 dip toplamı
2. Depo sayımı = sayım fişi dip toplamı + donuk ürünler
3. Gelen mal = şube alış dip toplamı
4. Bilgi: donuk ürünler toplamı, günlük fark (E toplamı)
5. İç tutarlılık: her kaynağın satır toplamı kendi dip toplamını tutmalı (tutmazsa uyarı). Şube alış
   birden fazla günü kapsıyorsa ya da dip toplamı yoksa uyarı.

Karşılaştırma toleransı Ayarlar'dadır (varsayılan 0,001 kg). **Genel durum:** herhangi bir kontrol
tutmazsa Hata; tutuyor ama uyarı varsa Uyarı; yoksa Tamam.

## Doğrulama kaydı

- 30.09.2026 dosyalarıyla: üç kontrol de Tamam; liste 209 satır, 1 ürün eklenir (satır 106), genel durum
  Uyarı. Elle hazırlanmış 30.09 sayfasıyla tek fark, elle yanlış yazılmış bir ürün miktarı.
- Elle hazırlanan sayfada E dip toplamının son satırı kapsamadığı görüldü (satır eklendikten sonra formül
  güncellenmemiş); araç her seferinde tüm listeyi kapsayacak şekilde yazar.
- Kullanıcı 2026-10-01'de iş yerinde (Windows, Chrome/Edge, masaüstü Excel) siteyi denedi: sorunsuz.

## Dosya ve kayıt sınırları (1.1.0)

- Yalnızca `.xlsx` kabul edilir. ExcelJS makroları korumadığından `.xlsm` reddedilir;
  kullanıcı Excel’de makroları kaldırarak `.xlsx` kopyası oluşturmalıdır.
- Dosya en fazla 25 MB; ZIP merkez dizinindeki açılmış toplam boyut 100 MB, tek parça 50 MB,
  parça sayısı 5000; kitap en fazla 400 sayfa, sayfa başına 100.000 satır ve 256 sütun.
  Bunlar bozuk/aşırı büyük dosyaların işlenmesini sınırlayan kontrollerdir; tam bir zararlı dosya analizi değildir.
- Aynı bırakma grubunda aynı türden iki dosya gelirse ilk dosya korunur ve ikincisi açıklamayla
  reddedilir. Değiştirmek için doğru dosya tek başına bırakılır.
- Üzerine yazmada kalıcı yedek zorunludur. Tarayıcı yedeği saklayamazsa üzerine yazılmaz;
  indirme seçeneği kullanılabilir. Zaman damgası ve yazmadan hemen önce içerik kontrol edilir.
- Geçmiş CSV’sindeki formülle başlayabilecek metinler tek tırnakla korunur. Sayı çevirisinde
  tarihsel serbest dönüştürücü uyumluluk için korunur. 1.7.0’dan itibaren dış LED miktarlarında
  geçersiz/taşmış değer sıfıra dönüştürülmez; satır açıklamasıyla okuma durur.
- Drive isteğe bağlıdır. Dosya/önceki yedek ayrı kopya, LED dosyaları ayrıca seçilirse gönderilir.
  Aynı türde aynı içeriğin yeniden gönderilmesi mevcut kopyayı kullanır. Geçmiş son 500 kaydı tutar;
  rapor ayarları kullanıcının açık seçimiyle geri alınır. Ayrıntılar: [DRIVE.md](DRIVE.md).

## Sanal POS cari profili ve kartlar (1.4.0)

Cari adı ve vergi/TC numarası elle kaydedilir; aynı ad veya numaraya ikinci kayıt açılmaz.
Numara metin olarak korunur, POS kullanıcı alanında da kullanılır. POS giriş şifresi sağlayıcı
kuralına göre işlem anında hazırlanır; kaydedilmez. Kaydetme sonrası cari otomatik seçilir.
“POS’u aç” yalnızca seçilen carinin giriş bilgilerini sabit sağlayıcı adresine POST eder.
Kullanıcı girişin çalıştığını bildirdi; uygulama sonucu/firma oturumunu okuyamaz. Kullanıcı eski
oturumdan çıkar, açılan firma adı/numarasını karşılaştırır ve kontrol kutusunu işaretler.

Her kart kalıcı cari kimliğine bağlıdır; kart adı, numara, son kullanma, kart sahibi ve isteğe bağlı
iletişim telefonu elle kaydedilir. Fotoğraf numara/tarih adaylarını yerelde okuyabilir; gözden geçirme
ve kayıt ayrı kullanıcı adımıdır. CVV/CVC, banka PIN’i, SMS/OTP, fotoğraf veya ham OCR saklanmaz.
Telefon bankanın SMS hedefini değiştirmez. Tutar ve banka doğrulaması POS/banka ekranında yapılır.
1.6.0'da ayrı MV3 yardımcı, kullanıcı tarafından tanıtılmış boş numara/S.K.T alanlarını cari numarası
eşleşince doldurabilir. Sağlayıcının kart API'si doğrulanmış değildir; SMS/ödeme otomasyonu yoktur.

- 500 cari, cari başına 10 kart; şifreli zarf/yedek toplamı 2 MiB’yi geçemez.
- Numara 12–19 ASCII rakam ve Luhn; telefon isteğe bağlı Türkiye cep telefonu biçimidir.
  Biçim kontrolü kart/telefon sahipliği doğrulaması değildir.
- Aynı caride aynı numara tekrar eklenmez; mevcut kartın bağlı carisi değiştirilmez.
- İlk açılışta kart kendiliğinden seçilmez. Cari veya veri değişiminde kart seçimi/firma beyanı sıfırlanır;
  yeni POS açılışı ve kart değişimi firma beyanını sıfırlar. Numara varsayılan maskelidir.
- Tam numara gösterme/kopyalama açık kullanıcı adımı ve firma kontrolü ister. Gizli sekme veya iki dakika
  boşta açık numara/form kapanır; açık POS sekmesine müdahale edilmez.
- Son kullanma ayı boyunca kart geçerlidir. Süresi geçmiş kart düzenlenebilir/silinebilir;
  işlem için seçilemez ve yeni kayıt olarak kaydedilemez.
- Cari silme bağlı kartları onayla birlikte atomik siler. Geri yükleme maskeli inceleme ve açık onay
  ister; çelişkide tüm aktarım durur, mevcut bilgiler sessizce ezilmez.

Günlük açılışta PIN sorulmaz; dışa aktarılamayan AES-GCM anahtarı bu tarayıcıda saklanır.
Bu tarayıcıya erişen kişi veriyi açabilir; kullanıcı doğrulaması değildir. Eski kasa mevcut
PIN/parolayla bir kez taşınır, cari kimlikleri korunur. Yanlış parola/geçiş hatası eski kaydı korur.
Taşınabilir cari/kart yedeği ayrı en az 14 karakterlik uzun parola kullanır; eski cari yedekleri okunur.
Veriler rapor/Drive kaydına girmez. Ayrıntı: [SANAL_POS.md](SANAL_POS.md).

## Fotoğraf ve işlem sonuçları (1.5.0)

Fotoğraf alanları ayrı geçici taslaktır: kullanıcı aday numara/tarihi seçip fotoğrafla karşılaştırmayı
onaylamadan forma uygulanmaz. Uygulama eski PAN/tarihi birlikte değiştirir; eksik alanın boşaltılacağı
önceden açıklanır. Boş fotoğraf manuel alanları değiştirmez; manuel düzenleme eski adayları kaldırır.
Etiketsiz dört rakam tarih sayılmaz, Luhn için rakam uydurulmaz; çoklu tarih otomatik seçilmez.

Kayıt sonucu kalıcı depo doğrulandığında başarıdır. İndirme düğmesi yalnızca indirme isteğinin
başlatıldığını bildirir; dosya sisteminde tamamlandığını iddia etmez. Ayar kaydı başarısızken yalnızca
oturumda geçerli olduğu açıklanır. Okunamayan/bozuk geçmiş boş liste değildir. Belirsiz veya durdurulmuş
yazı kesin geri alınmış sayılmaz; otomatik yeniden yazma yapılmaz. [Kapanış raporu](OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md).

## Kart aktarımı ve eksik OCR numarası (1.6.0)

Aktarım açık kart seçimi ve “Seçili kartla POS’u aç” isteği gerektirir. Kalıcı cari/kart kimlikleri
ve görünen POS vergi/TC numarası karşılaştırılır; yalnızca bu işin hedef sekmesine teslim yapılır.
Bekleyen kart 120 saniyeyle sınırlıdır, teslimden önce silinir. Cari/kart/rota/veri değişimi ve sekme
kapanması iptal eder; uygulamadan POS sekmesine geçmek aktarımı iptal etmez. CVV/tutar girilmez,
ödeme/SMS düğmesine basılmaz ve ödeme ekranında alan değişim olayları gönderilmez.
Değişmiş/gizli/uygunsuz alan veya başka girilmiş bilgi varsa yazı durur; belirsiz teslim tekrarlanmaz.

Yalnızca tarih okunduğunda PAN inceleme alanında elle tamamlanabilir; biçim/Luhn denetlenir ve
fotoğraf kontrolü yeniden istenir. Numara/tarih birlikte, açık onayla uygulanır. Numara bulunamazsa
aynı görüntü/yön üzerinde sınırlı ek şerit okuması vardır; rakam tahmin edilmez. Ayrıntı ve test sınırları:
[POS_YARDIMCISI.md](POS_YARDIMCISI.md).
Uzun OCR adayı geçerli kısa PAN + 3/4 ek rakam olabiliyorsa CVV birleşmesi belirsizliğinde reddedilir;
kısa PAN veya kod çıkarılmaz. Gerçek uzun kartın elle kaydı normal 12–19/Luhn kuralını kullanır.

## Yardımcı bağlantısı ve hata sonucu (1.6.1)

Bağlantı kontrolü kart göndermez veya POS açmaz. Protokol doğrulanmadan kart aktarılmaz.
Yardımcı olmayan/eski/izin kapsamı dışındaki adreste açık hata görünür; “kontrol ediliyor” kalmaz.
Giriş başarısızlığı, kaybolmuş/süresi dolmuş iş ve saat geri alma bekleyen kartı durdurur.
Teslim edilen kartın onayı 5 saniyede gelmezse sonuç belirsizdir; otomatik tekrar yapılmaz.
Başka uygulama sekmesinin bekleyen aktarımı varken yeni aktarım açılmaz; önceki doldurulmuş
POS sekmesi ve sağlayıcının ortak oturumu tamamen kontrol ediliyor sayılmaz.
Windows hazırlayıcı yalnızca hash/sürümü doğrulanmış kendi paketini hazırlar; tarayıcı yükleme onayı
kullanıcıdadır. Ayrıntı: [tarama raporu](POS_YARDIMCISI_TARAMA_RAPORU.md).

## Genel tarama kuralları (1.7.0)

- LED miktarı gerçek sonlu sayı veya geçerli Türkçe sayı metni olmalıdır. Boş hücre 0’dır;
  birim/hata yazısı, mantıksal değer ve kısmi sayı kabul edilmez. Ürün toplamı ve hesap taşması durdurur.
- Kod/ad/miktar aynı birleşik hücredeki LED grup başlığı ise eski sıfır katkısı korunur.
  Ürün miktarı formülünün hesaplanmış sonucu yoksa Excel’de hesaplatıp kaydetmek gerekir.
  Sonucu olmayan dip toplamda mevcut satır toplamı kuralı sürer.
- Sayım Birim kontrolü A–IV (256 sütun) boyunca yapılır. Aynı dosyada birden fazla rapor türü
  tanınırsa otomatik tür seçilmez. Bir bırakma grubu en fazla 10 dosya ve toplam 100 MB’dır.
- Gün sayfaları benzersiz ve sekme sırasında kronolojik olmalıdır. Girilen tarihin tamamı doğrulanır.
  Bilinen başka yıldaki aynı gün/ay sayfasının üzerine yazılmaz; yıl bilgisi olmayan kitap sınırı sürer.
- Rapor ayarı değişince öneri yenilenir; eski tarih ve üzerine yazma onayları kaldırılır. Dosya işlemi
  sırasında tarih/kaynak/onay değişmez. Kayıtta planın ürün adları/sırası da yeniden doğrulanır.
- Bozuk geçmiş/yedek listesi boş sayılmaz; okuma ve yeni ekleme/birleştirme durur, eski kayıt korunur.
  Geçmiş sıralama/tekilleştirmesi ISO metnine değil gerçek zamana göre yapılır.
- Cari numarası, bağlı kart varken değiştirilemez. Farklı kişi yeni cariyle eklenir; yanlış numara
  düzeltilirken önce bağlı kartlar kaldırılır. Cari adı değişikliği mümkündür.
- Kart ekleme/düzenleme ve elle yeni POS girişi eski bekleyen kart aktarımını iptal eder.
  Profil yazısı başarısız olup depo kapanırsa kart ekranı kapanır; yeniden kontrol gerekir.
- Drive bağlantısı ayrılınca bekleyen OAuth hemen sonlanır. İstekler belirteç ve bağlantı neslini
  birlikte doğrular; yeni bağlantıda eski iş sürmez. Listelemede 100 sayfa ve tekrarlı anahtar sınırı
  vardır; ilk 20 kayıttan sonrası “Daha fazla göster” ile açılır.

Kanıtlar ve kalan gerçek ortam kabulü: [genel tarama raporu](GENEL_TARAMA_RAPORU.md).

## Ek formül ve doğrulama kuralları (1.7.1)

Satır eklenirken yerel tam satır aralıkları (`4:211`, `$106:$212`) ve küçük harfli hücre
başvuruları da kaydırılır. Türkçe tanımlı adlar ve Excel hücre sınırı dışındaki adlar (`XFE212`)
hücre sayılmaz. Başka sayfa/kitap ve sayfa aralığı başvurularının metni korunur; üç boyutlu
başvuruların hedef sayfaya göre yeniden hesaplanması uygulanmış değildir.

POS dahil bütün Chromium testleri dış ağa kapalı proxy ile çalışır; yalnızca yerel test sunucusu
ve açıkça tanımlanan taklit yanıtlar kullanılabilir. Büyük dosya denemeleri yalnızca yapay
kitaplarla yapılır; satır/sütun sınırında son hücrenin korunması ve aşan kitabın reddi doğrulanır.

## Yıl kontrolü ve Excel özellikleri (1.8.0)

Yıl, gün sayfasının A3/C3 başlıklarından ve sekme sırasından doğrulanır. Eski yıl dosyası
bugünün yılına taşınmaz. Başlıklar eksik/tutarsızsa son gün sayfasının yılı dört rakamla
1900–9998 arasında açıkça kontrol edilir; kontrol edilmeden plan/kayıt oluşmaz. Son günün
geçerli başlık yılıyla çelişen onay reddedilir. Eski yanlış başlıklar otomatik değiştirilmez.
Yıl değişince gün, üzerine yazma ve kaynak tarih onayları sıfırlanır. Aralık→ocak geçişi
korunur; aynı gün/ay tekrarını içeren çok yıllı kitap desteklenmez.

Satır eklemede veri doğrulama ve koşullu biçim formülleri/adresleri, filtre ve baskı alanları
kaydırılır. Bitişiğin altına eklenen ürün filtreye katılır. Tablo/resim, tanımlı hücre adları,
dizi formülü, formüllü renk ölçeği ya da eklenen satırın altında birleşik hücre varsa güvenle
korunamadığı açıklanır ve işlem başlamaz. ZIP yerel/merkez başlık uyuşmazlığı, tekrarlı parça,
veri örtüşmesi, şifreleme ve desteklenmeyen sıkıştırma reddedilir; boyut sınırları değişmez.

POS aktarımında gizli/etkisiz üst kapsayıcı veya devre dışı fieldset uygun alan değildir;
gizli firma numarası eşleşme kanıtı sayılmaz. Gerçek sağlayıcı oturumu doğrulanmış değildir.
Ayarlar’daki deneme paketi yalnızca yapay LED/hedef Excel dosyaları ve beklenen sonuç içerir.
