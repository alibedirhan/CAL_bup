# CAL bup

Bupiliç İzmir Bölge Deposu için LED çıktılarından günlük raporları hazırlayan tarayıcı uygulaması.

**Adres:** https://alibedirhan.github.io/CAL_bup/

- Raporlar için kurulum gerekmez. Chrome, Edge veya Brave’de adresi açmanız yeterli; POS’a kart aktarımı için ayrı yardımcı kurulur.
- Seçtiğiniz Excel dosyaları **yalnızca sizin bilgisayarınızda, tarayıcının içinde** işlenir. Google Drive’a yalnızca siz isterseniz gönderilir.
- Bu depoda yalnızca programın kendisi bulunur. Şirket verisi, LED dosyaları ve depo kontrol dosyası depoya hiçbir zaman eklenmez.

## Raporlar

| Rapor               | Durum       |
| ------------------- | ----------- |
| Günlük depo kontrol | Hazır       |
| Envanter            | Hazır değil |
| Bakiye              | Hazır değil |
| Palet / kasa        | Hazır değil |

Gün sayfalarının yılı başlıklardan doğrulanamazsa uygulama dosya yılını açıkça kontrol etmenizi
ister. Windows/Excel denemesi için Ayarlar’dan **Deneme dosyalarını indir** seçeneğiyle tamamen
yapay örnekler ve beklenen sonuçlar alınabilir.

## Satış

**Müşteri Takip** hazırdır. Eski ve yeni tarihli LED müşteri Excel'lerini seçip
**Karşılaştır** düğmesine basın. Eksik ve yeni müşterileri ayrı listelerde
arayabilir ve sıralayabilirsiniz. Tam Excel/resim tüm eksik müşterileri,
görünen Excel ise seçili listedeki arama ve sıralamanın tamamını içerir.
Araç/plasiyer ayarları bu tarayıcıda tutulur; müşteri listeleri yalnız oturumda kalır.

**İskonto Hesaplama** da hazırdır. En fazla üç PDF fiyat listesi seçin,
kategori oranlarını girip **Önizleme oluştur** düğmesine basın. Excel, PDF
veya ikisini birlikte indirebilirsiniz. Tam çıktı bütün ürünleri; görünen
Excel arama, kategori ve sıralama seçiminizdeki bütün sayfaları içerir.
Excel/PDF dosyaları bilgisayarınızda işlenir. İlk kullanımda ek dosya motoru
yüklenir; müşteri ve fiyat listeleri sunucuya gönderilmez.

Masaüstü BUP Yönetim'in kuralları yapay dosyalardan üretilmiş bağımsız Python
başvurusuyla karşılaştırılır. Aktarım planı ve kapsam:
[Satış modülleri](docs/SATIS_MODULLERI_PLANI.md).
Özgün motor, karşılaştırma kanıtları ve kalan kabul sınırları:
[Satış eşdeğerliği](docs/SATIS_ESDEGERLIK.md).

## Sanal POS

Sanal POS bölümü **parolayla kilitlidir**: ilk açılışta parola belirlenir; sayfa yenilenince, tarayıcı
kapanınca ve 10 dakika işlem yapılmayınca yeniden sorulur. Parola unutulursa kurtarma yoktur; “Parolamı
unuttum” bütün kayıtları silip yeniden başlatır. Yedek veya dışa aktarma yoktur; kayıtlar yalnız bu
tarayıcıda, paroladan üretilen anahtarla şifreli durur.

Cari seçince **Kayıtlı kartlar → Kart ekle** görünür. Kart bilgileri elle eklenebilir veya fotoğraftan
numara/tarih okunabilir; kart sahibi, isteğe bağlı CVV ve iletişim telefonu aynı cari altında tutulur.
Kart numarası ve CVV ekranda açık gösterilmez, kopyalanmaz.

**Seçili kartla POS’u aç**, kurulu POS yardımcısına seçilen cari ve kart bilgisini geçici olarak iletir.
Yardımcı görünen cari numarasını karşılaştırır ve tanıtılmış alanları bir kez doldurur; tutar, SMS ve ödeme
düğmeleri kullanıcıda kalır. Yardımcı araç çubuğundan açılıp kapatılır; POS sayfasındaki penceresi
kurulumdan sonra yalnız istenince görünür. Ayrıntılar: [Sanal POS](docs/SANAL_POS.md),
[POS yardımcısı](docs/POS_YARDIMCISI.md).

## Geliştirme

```sh
npm ci            # bağımlılıklar
npm run dev       # yerel sunucu: http://localhost:5173/CAL_bup/
npm run kontrol   # tip denetimi + lint + biçim + test + derleme (yayından önce hepsi geçmeli)
npx playwright install chromium  # ilk tarayıcı testi kurulumu
npm run test:tarayici             # gerçek Chromium/IndexedDB/OCR ile uçtan uca testler
npm run test:performans           # derleme sonrası büyük yapay Excel sınırları ve okuma ölçümü
```

`main` dalına gönderilen her değişiklik GitHub Actions'ta denetlenir ve geçerse siteye yayınlanır.
Tarayıcı testlerinde dış ağ kapalıdır; POS/Google taklitleri yalnızca yapay veri kullanır.

- Geliştiriciler ve yapay zekâ araçları için: [AGENTS.md](AGENTS.md)
- Google Drive bağlantısı ve ilk kurulum: [docs/DRIVE.md](docs/DRIVE.md)
- Ayrıntılı genel tarama: [docs/GENEL_TARAMA_RAPORU.md](docs/GENEL_TARAMA_RAPORU.md)
- Son çalışma ve doğrulamalar: [docs/OTURUM_NOTU.md](docs/OTURUM_NOTU.md)
- Mimari: [docs/MIMARI.md](docs/MIMARI.md)
- İş kuralları ve LED dosya biçimleri: [docs/IS_KURALLARI.md](docs/IS_KURALLARI.md)
