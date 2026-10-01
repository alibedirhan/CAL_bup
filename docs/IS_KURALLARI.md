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
- Birim doğrulama ve adet/koli → kilogram dönüşümü henüz yapılmaz. Ürün adları ambalaja göre
  farklıysa otomatik olarak aynı ürüne eşlenmez. Yeni karma ambalaj örneğiyle bu kurallar
  netleştirilecek; ürün ağırlığı tahmin edilmeyecek.
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
