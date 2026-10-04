# Satış modüllerinin aktarılması

2026-10-04 — Kullanıcı bir modülle başlamayı, CAL bup tasarımını kullanmayı ve
masaüstü uygulamasının iş davranışını korumayı istedi.

## İlk dilim: Müşteri Takip

İlk modül Müşteri Takip'tir. PDF okuyucusu eklemeden mevcut Excel altyapısını
kullanır; okuma, saf kural, uygulama servisi, çıktı ve ekran sınırlarını diğer
Satış modülleri için doğrulanabilir biçimde kurar. İskonto, kârlılık ve
yaşlandırma bu dilimin kabulünden sonra ayrı işlerdir.

Kaynak: yerel BUP Yönetim'in aktif `BUP_Yonetim` uygulaması; katalog,
`domain/musteri_takip`, `application/customer_tracking`, müşteri Excel
okuyucusu ve Excel/PNG/görünür satır dışa aktarıcıları. Masaüstü projesi ve
kullanıcı dosyaları değiştirilmez veya CAL bup deposuna kopyalanmaz.

## Uygulama sırası

1. **Sözleşme ve bağımsız başvuru:** çalışan Python okuyucu/facade/export
   hattını yalnız yapay dosyalarla çalıştır; girdileri, sonuçları ve çıktı
   hücrelerini sabit başvuru olarak kaydet. Kural uygulamasından önce üret.
2. **Dikey dilim:** saf TypeScript kuralları → `Kitap` okuyucusu → enjekte
   edilmiş portlarla servis → ayrı yüklenen Excel motoru → CAL bup ekranı.
3. **Kabul:** bağımsız Python başvurusuyla karşılaştır; bozuk dosya, iptal,
   eski sonuç, eşzamanlı işlem, saklama hatası ve çıktı kapsamını sınayarak
   birim/Chromium kapılarını ve mevcut uygulamanın kontrollerini çalıştır.

## Korunacak davranış

- İlk sayfa kullanılır. Başlık ilk 15 satırda, depo ilk sütunun ilk 10
  satırında aranır. `Cari Ünvan` sütunu ve kaynak uygulamanın harf davranışı
  korunur; iç boşluklar, noktalama ve Türkçe harfler ayrıca sadeleştirilmez.
- Liste sayıları kaynak satır sayısıdır; sonuçtaki tekrarlar ilk görülen
  sırayla kaldırılır. Varsayılan harf duyarsızdır; duyarlı seçenek vardır.
- Eksikler eski → yeni, yeniler yeni → eski yönde bulunur. Başlık ve dosya
  adı eski listenin deposundan, isteğe bağlı araç/plasiyer eşleştirmesinden
  türetilir. Gerçek masaüstü eşleştirmeleri aktarılmaz.
- Tam Excel ve PNG yalnız eksik listesidir. Arama/sıralama bu çıktıları
  değiştirmez. Görünen Excel seçili eksik/yeni listesinin filtrelenmiş,
  sıralanmış bütün satırlarını içerir; sayfalama kapsamı daraltmaz.
- Tam Excel'in Sheet1, başlık, boş satır, `#` ve `Cari Ünvan` sözleşmesi;
  görünen Excel'in Görünen Satırlar/Kapsam ve kapsam bilgileri korunur. Metin formül
  olarak çalıştırılmaz. PNG'de uzun adlar yalnız gösterimde kısalır.

## Katman ve durum sınırları

`cekirdek/musteriTakip` tarayıcı/React/ExcelJS bilmez. `kaynaklar` kitap
portunu okur. `satis/musteriTakip` uygulama servisi sadece kendi portlarını
ve saf kuralları bilir. Somut Excel/PNG/saklama adaptörleri motor/platform
katmanındadır. Arayüz uygulama servisini kullanır; bütün kütüphaneler
gerektiğinde yüklenir. ESLint yeni Satış katmanını da denetler.

Girdiler veya karşılaştırma seçeneği değiştiğinde eski çıktı kullanılamaz.
Başarısız/iptal işlem yarım sonuç yayımlamaz. Aynı anda tek işlem yürür.
Dosyalar ve müşteri sonuçları yalnız oturum belleğinde kalır; araç/plasiyer
ayarları sürümlü, doğrulanan yerel kayıttır. Ağ isteği yapılmaz.

Tarayıcının mevcut 25 MB/100.000 satır/ZIP sınırları geçerlidir; masaüstünün
daha yüksek kaynak sınırları aynen artırılmaz. PNG tarayıcı piksel bütçesine
göre sayfalara ayrılır; çok sayfalı PNG tek ZIP ile indirilir. Her eksik müşteri tam bir kez yer alır. Bunlar
platform farklarıdır, karşılaştırma kurallarının değişmesi değildir.

## Tamamlanma ölçütleri

- Sentetik Python başvurusu okuma, iki yön, harf seçeneği, adlandırma ve
  tam/görünen Excel hücrelerinde eşleşir; kaynak SHA-256'ları kaydedilir.
- Dosya/formül/birleşim/başlık sınırları ve uygulama servisi testleri geçer.
- Gerçek Chromium'da yükleme → karşılaştırma → filtre → Excel/PNG indirme;
  açık/koyu/dar ekran, klavye, rota ve iptal/hata akışları doğrulanır.
- `npm run kontrol`, `npm run test:tarayici` ve `npm run test:performans`
  başarılıdır. Çıktılar ve ekran görüntüleri `/tmp` içinde tutulur.
- Kaynak/masaüstü proje değişmez; tasarım örnekleri bu değişikliğe katılmaz.
  Gerçek iş yeri Excel kabulü kullanıcıya ait ayrı bir sınırdır.

## İlk modülün teknik kabulü — 1.9.0

Üç adım uygulandı. 64 bağımsız Python karşılaştırması ve dört hata başvurusu;
tam/görünen Excel hücreleri eşleşir. Toplam 588 birim/Excel testi, 112
Chromium senaryosu ve yedi performans/sınır denemesi geçti. 40.000 satırda
yerel işlem yaklaşık 874 ms, en uzun ana ekran zamanlayıcı beklemesi 38 ms.
Açık/koyu ve 390 px ekranlar incelendi. Yeni Satış sayfası dış istek yapmadı.

Masaüstü projesi aynı kaldı. Tarayıcı kaynak sınırı, PNG sayfalarının ZIP
olması ve dosyanın indirilmesi platform farklarıdır. Excel hücre kapsamı
doğrulandı; dosya XML'i veya PNG pikselleri birebir kopya iddiası yoktur.
Gerçek Windows/Excel kabulü kullanıcı incelemesidir. İlk modül gözden
geçirildikten sonra İskonto Hesaplama ayrı bir dilim olarak ele alınacaktır.

Başvuruyu yenileme: yerel aktif BUP Yönetim'in Python ortamıyla
`tools/musteriReferansi.py <kaynak-uygulama> <çıktı-json> [harf-katlama-json]`
çalıştırılır. Eski başvuru sessizce değiştirilmez; kaynak/kural değişikliği
ve beklenen çıktı farkları birlikte incelenir. CI masaüstü proje gerektirmez.

## Kullanıcının sonraki isteği — 1.10.0

İlk modül için gerçek test verisi olmadığından kullanıcı masaüstü iş mantığının
aynı olduğundan emin olunmasını, ardından sıradaki modülün eklenmesini istedi.
Bu istek ilk modül incelemesinden sonra İskonto'ya geçme sırasının yeni yetkisidir.
Müşteri başvurusu 78 senaryoya genişletildi; hücre türleri için özgün openpyxl
okuyucusu ve tarayıcıdan bağımsız tam Python Unicode tablosu kullanılır.

İskonto'nun saf hesap, PDF okuyucu, facade ve tam/görünen Excel/PDF hattı
yeniden yazılmak yerine aynı Python dosyalarıyla tarayıcı işçisine taşındı.
11 yapay PDF, 39 facade/çıktı ve 3.264 yuvarlama sınırı özgün masaüstüyle
karşılaştırılır. Yeni ekran CAL bup tema ve bileşenlerini kullanır.
Kaynak uygulamanın kendi yol haritası ve dosyaları değiştirilmez.

Güncel katman, üretici, test ve bağımlılık sınırları
[Satış eşdeğerliği](SATIS_ESDEGERLIK.md) ve [mimaridedir](MIMARI.md).
Sonraki modül Kârlılık Analizi'dir; mevcut davranış için ayrı bağımsız
okuyucu/hesap/çıktı başvurusu oluşturulmadan uygulamaya geçilmez.
