# CAL bup — İş kuralları ve dosya biçimleri

Bu belge raporların _ne_ yaptığını anlatır; _nasıl_ yapıldığı `docs/MIMARI.md`'dedir. Kurallar eski
Excel/VBA aracından (v1.2) taşınmış ve 30.09.2026 gerçek dosyalarıyla doğrulanmıştır. Gerçek rakamlar
burada yazmaz (depo herkese açık); doğrulanmış rakamlar yalnızca yereldeki `ornekler/beklenen.json`'dadır.

## Müşteri Takip — masaüstü sözleşmesi (1.9.0)

Kaynak BUP Yönetim'in aktif müşteri modülüyle yapay veride eşdeğerlik korunur:

1. İlk Excel sayfası kullanılır. İlk 15 satırda `Cari Ünvan` başlık satırı
   harf katlamasıyla aranır; sütun seçiminde kaynak uygulama gibi birebir
   `Cari Ünvan` yazımı aranır. Sütunun altındaki dolu adlar alınır.
2. Python `strip/upper/casefold` davranışı esas alınır. Kenarlar temizlenir;
   iç boşluk, noktalama, aksan ve Türkçe harfler ayrıca normalleştirilmez.
   Kaynakta harf duyarsız olan varsayılan ve duyarlı seçenek korunur.
3. Eski/yeni sayıları, tekrarlar dahil okunan dolu satır sayısıdır. Eksikler
   eski listede olup yenide olmayan, yeniler ters yönde olmayan adlardır.
   Sonuç tekrarları kaldırılır; ilk görülen sıra ve yazım korunur.
4. Depo ilk sütunun ilk 10 satırındaki `Cari Kategori 3 [...]` satırından,
   köşeli parantezden sonraki metinden çıkarılır. Araç/plasiyer eşleşmesi
   isteğe bağlıdır. Dosya önerisi karşılaştırma anındaki eşleşmedir; çıktı
   başlığı kaynak facade gibi dışa aktarma anındaki güncel eşleşmeden gelir.
5. Özgün openpyxl okuyucusu hücre türlerini korur: sayı, mantıksal değer,
   tarih, saat ve süre masaüstünün Python metin dönüşümüyle okunur.
   Formüller çalıştırılmaz; varsa hesaplanmış sonuç okunur. Hesaplanmamış
   formül boş sayılır. Birleşik hücrenin yalnız sol üst değeri alınır.
6. Tam Excel `Sheet1` ve `# / Cari Ünvan` sütunlarıyla bütün eksik listesini
   kaynak sırasıyla verir. Depo başlığı varsa A1:B1 birleşir, tablo 3. satırda
   başlar; yoksa 1. satırda başlar. Arama/sekme/sıralama bu çıktıyı değiştirmez.
7. Görünen Excel seçili eksik/yeni listesinin arama ve sıralama sonrası tüm
   satırlarını, `Görünen Satırlar / Kapsam` sayfalarıyla verir. Ekrandaki 50
   satırlık sayfalama çıktı kapsamını daraltmaz. Boş, tekrar eden veya güncel
   sonuca ait olmayan seçim reddedilir. Metinler formüle dönüşmez.
8. PNG tam eksik listesidir. Kaynak gibi 80 karakterden uzun adlar gösterimde
   77 karakter + `...` olur; Excel ve hesap sonucu tam metni korur. Boş
   sonuçta açıklama resmi vardır. 200 satırdan uzun liste piksel bütçesi için
   PNG sayfalarına ayrılır ve tek ZIP içinde verilir. En fazla 5.000 satır;
   daha büyük liste Excel ile aktarılır.

Müşteri dosyası `.xlsx`, en fazla 25 MB, 16 sayfa, 100.000 satır, 256 sütun;
okunan müşteri/üst bilgi hücresi en fazla 512 Unicode karakteridir. Ortak ZIP
denetimi geçerlidir. Masaüstünün 100 MB/200.000 satır üst sınırları tarayıcıya
aktarılmadı; iş kuralı değil platform kaynak sınırıdır.

Araç/plasiyer ayarları iki haneli araç anahtarı, dolu ve en fazla 100 karakter
adla doğrulanır. Tekrarlanan anahtarda son satır geçerlidir. En fazla 100 kayıt;
bir önceki ayar aynı atomik kayıtta geri alma için korunur. OS ortam değişkeni
ve masaüstündeki gerçek config tarayıcıya taşınmaz. Müşteri dosyaları ve
sonuçları yenilemede unutulur; yerel ayarlar korunur.

### 1.10.0 eşdeğerlik genişletmesi

Harf dönüşümü masaüstünün Unicode 15.0.0 sözleşmesinden tam tablo olarak
gelir; tarayıcının Unicode sürümü ve yerel ayarı sonucu değiştirmez.
Araç eşlemesinde Python Unicode ondalık rakam/kelime sınırı kullanılır.
78 yapay karşılaştırma, dört hata ve tüm Unicode kod noktalarının
upper/casefold özetleri bağımsız masaüstü başvurusuyla karşılaştırılır.

## İskonto Hesaplama — masaüstü sözleşmesi (1.10.0)

1. En fazla üç PDF yüklenir. Özgün PDF okuyucusu normal/gramaj/dondurulmuş
   türü ve altı kategoriyi kaynak uygulamanın metin, tablo, ürün kodu ve
   sayfa kurallarıyla belirler. Kod, ad, fiyat ve kaynak sırası korunur;
   yinelenen ürünlerin masaüstünde sayılması değiştirilmez.
2. İskonto oranı kategori başına 0–100 arası sonlu sayıdır. KDV hariç fiyat
   önce `(1 - oran / 100)` ile çarpılıp Python `round(..., 2)` ile
   yuvarlanır. Sonra KDV yeniden %1 eklenip aynı yöntemle yuvarlanır.
   JavaScript'in yuvarlaması kullanılmaz. Örnek: 125 TL, %10 iskonto →
   112,50 TL; %1 KDV ile kaynak hesap **113,62 TL** verir.
3. Önizleme istatistikleri ve metni özgün application facade'ından gelir.
   Toplam iskonto kaynak KDV dahil fiyat ile iskontolu KDV dahil fiyat
   farklarını toplar. Metin her kategorinin ilk on ürününü gösterir;
   metindeki kategori toplamı ile genel toplamın kaynakta farklı
   kullanılması aynen korunur, kendiliğinden düzeltilmez.
4. Tam Excel özet ve PDF başına ürün sayfalarını; PDF kaynak dosya başına
   Türkçe kategorili fiyat listesini üretir. Özgün Excel/PDF exporter'ları
   kullanılır. Birden fazla PDF tek ZIP'tir; Excel + PDF kaynak atomik
   çıktı işleminden sonra tek ZIP olarak indirilir. Excel metin formülleri
   etkisizdir; kaynak dosyaların üzerine yazılmaz.
5. Görünen Excel arama, kategori ve sıralama sonrası tüm sayfaları içerir.
   Tam Excel/PDF filtreyle daralmaz. Metin görünümünde görünen Excel yoktur.
   Boş, tekrar eden veya güncel sonuca ait olmayan satır seçimi reddedilir.
6. Oran/dosya değişikliği önizlemeyi kaldırır. Başarısız/iptal işlem yarım
   sonuç yayımlamaz. Rota çıkışı çalışan işçiyi kapatır; bitmiş oturum
   korunur. Yenileme fiyat listelerini/sonuçları unutur. Tarih/saat
   önizleme anında yerel olarak sabitlenir; çıktılar aynı zamanı kullanır.

PDF başına 25 MB, 250 sayfa, sayfa başına 100 tablo, toplam 200.000
ayrıştırılan satır; kategori başına 25.000 ve toplam 100.000 ürün;
hücre metni 4.096 karakter sınırları vardır. İşçi 120 saniyede sonlanır;
görünen çıktı 50.000 satır, indirilecek çıktı 100 MB sınırındadır.
Bozuk PDF geçerli seçimin yanına eklenirse geçerli dosyalar yüklenir ve
bozuk olanlar ayrı açıklanır. Boş fiyat listesi başarılı hesap değildir.
Paket yüklenmesi başarısızsa eski/yarım motorla devam edilmez.

Kanıt, platform farkları ve bağımlılık kabul sınırı:
[Satış eşdeğerliği](SATIS_ESDEGERLIK.md).

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

**Sorumluluk notu (1.19.0, kullanıcı kararı).** Raporu idari asistan masa başında hazırlar; depo sayımı
depo sorumlusundandır. Dosya yöneticiye Outlook ile gider; onay Outlook oylama düğmeleriyle alınır (rapor
onaydan sonra gönderilir). Makrolu “onaylamadan açılmasın” kapısı, e-postada makrolar engellendiği için
yapılmadı. Her kayıtta (`hedef/bilgilendirme.ts`, metinler `cekirdek/bilgilendirme.ts`):

- Gün sayfasının sağ üstüne üç satır not: son dolu sütundan bir sütun boşluk bırakılarak (gerçek dosyada
  L1:L3); önceki günden kopyalanan not aynı sütunda yenilenir. Metin: “Depo sayımı, depo sorumlusunun
  GG.AA.YYYY sayımından (sayım fişi adı) alınmıştır. / Hazırlayan fiziki sayım yapmamıştır. / Ayrıntı:
  Bilgilendirme sayfası.” İlk iki cümle çıktı alt bilgisine de yazılır; kullanıcının kendi alt bilgisi
  varsa ona dokunulmaz.
- `Bilgilendirme` sayfası en yeni gün sayfasının hemen arkasında durur ve kitap onunla açılır (tek seçili
  sekme). Kullanıcıyla kararlaştırılan metin, `HYPERLINK("#'GG.AA'!A1"; …)` ile hazırlanan güne bağlantı
  (makro ve dış bağlantı yok) ve “Rapor kaydı” (gün, sayım fişi, hazırlanma tarih-saati; en yeni üstte;
  aynı gün yeniden hazırlanınca satırı yenilenir). Sayfa her kayıtta baştan kurulur; yalnız kayıt
  satırları korunur. Aynı adda (büyük/küçük harf fark etmez) kullanıcının kendi sayfası varsa önizleme
  durur ve dosyaya dokunulmaz.
- Depocunun adı yazılmaz (kullanıcı istemedi); metin değiştirilecekse kullanıcıya sorulur.

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

**Atlanan gün (1.14.0):** Önceki gün sayfası ile seçilen gün arasında sayfası olmayan iş günü varsa
(pazar ayara göre sayılmaz) gün alanında gösterilir ve kayda uyarı olarak geçer. Hesap değişmez; yeni gün
yine önceki sayfanın devamıdır.

**Dosya günü önerisi (1.14.0):** Tarihi uymayan dosyalar sağdaki tek soruda listelenir. D01 ile sayım
fişi aynı günü gösteriyor ve o gün seçilebiliyorsa “Günü GG.AA yap” önerilir; “bu dosyalarla devam et”
bütün uyuşmazlıkları birlikte onaylar ve uyarı olarak kayda geçer.

**Hatalı kontrolle kayıt (1.14.0):** Genel durum Hata ise (üç toplam kontrolünden biri tutmuyorsa)
kaydetme/indirme düğmeleri, kullanıcı “yine de kaydet” onayını işaretleyene kadar kapalıdır. Onay yalnız o
plana aittir; dosya, gün veya ayar değişince yeniden istenir.

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
ve kayıt ayrı kullanıcı adımıdır. CVV isteğe bağlı kartla saklanır (1.17.0); banka PIN’i, SMS/OTP,
fotoğraf veya ham OCR saklanmaz.
Telefon bankanın SMS hedefini değiştirmez. Tutar ve banka doğrulaması POS/banka ekranında yapılır.
1.6.0'da ayrı MV3 yardımcı, kullanıcı tarafından tanıtılmış boş numara/S.K.T alanlarını cari numarası
eşleşince doldurabilir. Sağlayıcının kart API'si doğrulanmış değildir; SMS/ödeme otomasyonu yoktur.

**1.16.0 (saha testi):**

- Kartlı carinin numarası yalnız “aynı kişinin numarasını düzeltiyorum” onayıyla değişir; kartlar cari
  kimliğine bağlı olduğundan yerinde kalır. Onaysız değişiklik reddedilir.
- POS girişi varsayılan olarak vergi no = lisans no = numara, şifre = numaranın ilk 2 + son 2 hanesidir.
  Cari kaydında isteğe bağlı `girisKullanici` / `girisSifresi` bu kuralın yerine geçer (şifreli kasada,
  boşsa kayda yazılmaz). Kural tek yerde: `cekirdek/posCari.ts → posGirisBilgisi`.
- CVV (1.17.0): kart kaydında isteğe bağlı, 3–4 rakam, parolayla şifreli profilde saklanır; ekranda
  yalnız “•••”. Kayıtlıysa aktarımda kendiliğinden gider; ödeme anında yazılan CVV kayıtlı olanın önüne
  geçer. Yardımcıya yalnız o aktarımda gider, teslimden önce yardımcının oturum belleğinden silinir.
  Kullanıcı kararı (2026-10-08), önceki “kaydetme” kararının (2026-10-07) yerine geçti; PCI DSS'ye
  aykırılığı ve sorumluluk kendisine açıkça anlatıldı.
- Yardımcı Ad Soyad kutusunu kartın “Kart üzerindeki ad” bilgisiyle doldurur (tanıtıldıysa). Tutar
  kutusuna hiçbir durumda yazılmaz; POS'un yazdığı bakiye ödeme tutarı değildir.

- 500 cari, cari başına 10 kart; şifreli zarf 2 MiB’yi geçemez.
- Numara 12–19 ASCII rakam ve Luhn; telefon isteğe bağlı Türkiye cep telefonu biçimidir.
  Biçim kontrolü kart/telefon sahipliği doğrulaması değildir.
- Aynı caride aynı numara tekrar eklenmez; mevcut kartın bağlı carisi değiştirilmez.
- İlk açılışta kart kendiliğinden seçilmez. Cari değişimi ve seçili kartın içeriğinin değişmesi/silinmesi
  kart seçimini sıfırlar. Numara ve CVV her zaman maskelidir.
- 1.18.0: kart numarası/CVV gösterme ve kopyalama yoktur; kart yalnız POS yardımcısıyla aktarılır.
  Gizli sekme veya iki dakika boşta giriş bilgileri gizlenir. Açık cari/kart formları **kapanmaz**, yazılanlar
  korunur; kart formundaki numara ve fotoğraf örtülür, “Gizlenen bilgileri göster” ile açılır (1.12.0).
- Başka sekmedeki kayıt bu sekmede ekranı kapatmadan yeniden okunur. Düzenlenen cari/kart o arada
  başka sekmede değiştiyse veya silindiyse kayıt reddedilir; diğer sekmenin değişikliği ezilmez.
- Fotoğraftan yalnız tarih okunursa formdaki numara korunur; yeni numara uygulanırsa tarih o fotoğrafın
  tarihi olur ya da boşaltılır (başka kartın tarihiyle karışmaz).
- Son kullanma ayı boyunca kart geçerlidir. Süresi geçmiş kart düzenlenebilir/silinebilir;
  işlem için seçilemez ve yeni kayıt olarak kaydedilemez.
- Cari silme bağlı kartları onayla birlikte atomik siler (cari profilinde “Cariyi sil”, 1.17.0).
- Cari listesi ada veya en az üç rakamla vergi/TC numarasının bir kısmına göre aranır.

**Parola kilidi (1.18.0, kullanıcı kararı):** Sanal POS parolası en az 6 karakter (1.18.1; önce 10), en az bir harf
ve bir rakam. Kayıtlar yalnız bu paroladan PBKDF2-SHA256 (600.000) ile üretilen anahtarla açılır; anahtar hiçbir
yere yazılmaz. Açılışta, yenilemede, tarayıcı kapanınca, 10 dakika işlem yapılmayınca ve “Şimdi kilitle”de
parola sorulur. 5 yanlış denemeden sonra bekleme 30 sn’den başlayıp katlanır (en çok 15 dk). **Unutulan
parola kurtarılamaz**; “Parolamı unuttum” + “SİL” onayı bütün cari/kart/CVV kayıtlarını kalıcı siler ve
yeni parolayla boş başlatır. Parolasız 1.17 kaydı ilk açılışta yeni parolayla şifrelenir, eski anahtar
silinir. Eski PIN kasa önce PIN ile taşınır. **Yedek, yedekten ekleme ve dışa aktarma yoktur**; veriler
rapor/Drive kaydına girmez. Ayrıntı: [SANAL_POS.md](SANAL_POS.md).

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
Bekleyen kart 180 saniyeyle sınırlıdır (1.12.0 öncesi 120), teslimden önce silinir. Cari/kart/rota/veri değişimi ve sekme
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

## POS yardımcısı mesajları ve alan biçimleri (1.12.0)

- Doğrudan “POS’u aç” giriş sonucunu okuyamaz; başarı bildirilmez, sonucu POS sekmesinde kontrol etme
  ve başka cari oturumundan çıkma söylenir.
- Yardımcı girişten sonra giriş sayfası yeniden gelirse giriş kabul edilmemiştir; sağlayıcının hata
  yazısı en fazla 120 karakter, 4+ rakam dizileri maskeli olarak aktarılır.
- Tanıtılmamış sayfada bekleyen iş varken: bir ödeme sayfası daha önce tanıtıldıysa “ödeme sayfasına
  geçin”, hiç tanıtılmadıysa “ödeme sayfasını tanıtın” denir. Cari numarası eşleşmezse başka cari
  oturumundan çıkış önerilir.
- Tek tarih alanı: en fazla 4 karakterse `AAYY`, 7 karakter veya `YYYY` yer tutucusu varsa `AA/YYYY`,
  diğerlerinde `AA/YY`. Ay/yıl/numara alan adı ipuçları yaygın ASP.NET öneklerini (`ddlAy`, `txtKKNo`)
  tanır. CVV/güvenlik/tutar/taksit/SMS/OTP/şifre/parola/PIN alanları hiçbir rolde yazılmaz.
- (1.12.1) Kutu tanımada kutunun adı, bağlı etiketi, yalnız o kutuyu içeren üst kapsayıcıların (en fazla
  dört düzey) yazısı ve hemen önündeki başlık öğesi okunur; “TL” gibi birim yazısı üstteki “Tutar”
  başlığını gizleyemez. Yanında TL/₺/USD/EUR yazan kutu tutar sayılır. Adı/yazısı tanınmayan kutu
  panelde nedeniyle gösterilir ve yalnız kullanıcının “Evet, bu kutu … kutusu” onayıyla kaydedilir
  (`elle: true`). Görünürlük, CVV/tutar/şifre engeli, tür ve uzunluk denetimleri onayla da atlanmaz;
  doldurma anında yeniden uygulanır. Yer tutucu `AA / YY` biçimindeyse tarih boşluklu yazılır.
- Panelin küçük/büyük tercihi yardımcının yerel deposunda saklanır; kart/cari bilgisi saklanmaz.
- Yardımcı sürümü program sürümünden farklıysa aktarım engellenmez, güncelleme önerilir.

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

## Satış — Kârlılık Analizi (1.11.0)

İlk sayfa ve ilk beş satırdaki başlıklar kullanılır. Satış stok adı koddan
önce gelir; toplam satırları kaynak gibi dışlanır. Fiyat haritası stok/tarih
boş, Depo hücresinde ürün adı olan pozitif fiyatların ilk görüleninden
kurulur. Birim kâr = ort. satış fiyatı − maliyet, net kâr = birim kâr ×
miktar. Satış tutarı ayrıca korunur. Eşleşmeyen maliyet sıfır ve görünür
uyarıdır; tahmini eşleşme yoktur. Öneri yalnız açık onay sonrası hesapta
kullanılır. Senaryo −100…500 oranları, marj/başabaş/Pareto ve dönem
karşılaştırması özgün Python kuralıdır. Tam/görünen/senaryo Excel kapsamı
masaüstüyle aynı; görünür çıktı bütün filtreli sonuç sayfalarını içerir.
Ayrıntı, depo sınırları ve Satış Şefi Raporu ayrımı [KARLILIK.md](KARLILIK.md).

## Satış — Yaşlandırma (1.13.0)

İlk sayfa, ilk beş satırda ayrı hücrelerde araç/cari/kova başlıkları. Araç 1–99,
depo/merkez/genel/kesimhane araç değildir. Bakiye ve kova hesabı, Türkçe sayı
ayrıştırma, raporlar ve tam/görünen Excel özgün Python kodudur. Görünen Excel
ekrandaki arama, 29+ gün süzgeci ve sıralamayı izler. Atamalar yalnız bu
tarayıcıda, kaynak şeması ve yedek/geri al davranışıyla saklanır.
Ayrıntı [YASLANDIRMA.md](YASLANDIRMA.md).
