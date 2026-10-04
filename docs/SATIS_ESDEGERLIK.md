# Satış — masaüstü eşdeğerliği ve kabul sınırları

2026-10-04 — 1.10.0. Kullanıcının gerçek test verisi henüz yoktur. İsteği:
Müşteri Takip'i daha kapsamlı doğrulamak, ardından İskonto Hesaplama'yı
masaüstünün iş mantığını koruyarak eklemek. Kaynak BUP Yönetim salt okunur
referanstır; o projedeki mevcut değişiklikler, config ve şirket verisi korunur.

## Korunan kod ve bağımsız başvuru

- İskonto'nun domain hesabı, PDF okuyucusu, application facade/DTO/portları,
  Excel/PDF/görünen çıktı adaptörleri ve güvenli dosya yayımlama kodu
  `vendor/python/bup` altında kaynakla aynı SHA-256'dadır. Yeni JS hesap veya
  PDF yorumlama algoritması yazılmadı. Build ve testler kod özetlerini denetler.
- Tarayıcı `core/runtime_support` adaptörü logger/dosya yolu bağımlılığını
  değiştirir. Saf `safe_turkish_text`, `get_clean_filename`, `get_date_display`
  işlevleri de AST kaynak özetiyle özgün dosyaya eşleşir. Bağlantı `kopru.py`
  içindedir; JSON verisi Python kodu olarak çalıştırılmaz.
- Müşteri Excel okuma artık özgün openpyxl okuyucusudur. Bilimsel gösterim,
  bool, tarih/saat/süre hücreleri JS dönüşümünde kaybolmaz. Karşılaştırma,
  adlandırma ve Excel çıktısı bağımsız kaynak facade'ının sonuçlarıyla sınanır.
- Python Unicode 15.0.0 `upper/casefold/decimal/word` tabloları kaynağın kendi
  Python ortamından üretilir. Harfler tarayıcının yerel/Unicode dönüşümüne
  bırakılmaz. Tüm Unicode skalerlerinin upper/casefold SHA-256'ları eşleşir.

`tools/musteriReferansi.py` **78** duyarlı/duyarsız karşılaştırma, dört hata ve
tam/görünen Excel hücre başvurusu üretir. `tools/iskontoReferansi.py` **11**
yapay PDF, **39** facade/çıktı senaryosu ve **3.264** kuruş/oran sınırı
üretir. Her iki üretici özgün yerel uygulamayı çalıştırır; gerçek dosya veya
config okumaz. Kayıtlı PDF ve Excel baytları yalnız yapay veridir. CI kaynak
projeye veya Python venv'e erişmeden aynı girdileri tarayıcı Python motorunda
çalıştırır ve okuyucu verisi, önizleme, Excel hücreleri, PDF sayfa metinleri
ve dosya adlarını başvuruyla karşılaştırır.

125 TL'ye %10 iskonto örneğinde kaynak `round(112.5 * 1.01, 2)` sonucu
**113,62**'dir. İlk tarayıcı testi yanlışlıkla 113,63 bekliyordu; yerel
özgün hesap ve bağımsız başvuru 113,62'yi doğruladı. Test düzeltildi;
hesap/altın çıktı gevşetilmedi veya değiştirilmedi.

Başvuru yenileme, aktif kaynak uygulamanın Python ortamıyla yapılır:

```sh
<kaynak>/.venv/bin/python tools/musteriReferansi.py <kaynak> tests/yardimci/veriler/musteriReferansi.json
<kaynak>/.venv/bin/python tools/iskontoReferansi.py <kaynak> tests/yardimci/veriler/iskontoReferansi.json
<kaynak>/.venv/bin/python tools/pythonMetinReferansi.py src/cekirdek/musteriTakip/pythonMetin.json tests/yardimci/veriler/pythonMetinReferansi.json
```

Kaynak/kütüphane yükseltmesinde önce mevcut başvuru korunur, farklar ayrıca
incelenir; başarısız testi geçirmek için başvuru sessizce yeniden üretilmez.

## Tarayıcı adaptörü ve kaynak bütçesi

İşler ayrı modül işçilerinde çalışır. İptal/rota/timeout/bitiş işçiyi kapatır;
geç yanıt uygulanmaz. Oran/dosya değişimi eski önizlemeyi kaldırır.
Bitmiş oturum rota değişiminde kalır, sayfa yenilemesinde unutulur.
Çıktılar yalnız açık düğmeyle indirilir; kaynak dosyanın üzerine yazılmaz.
Birden fazla PDF veya Excel+PDF çıktısı tek ZIP olur. Bunlar masaüstü dosya
diyaloğunun platform adaptörüdür; hesap veya çıktı kapsamı değişikliği değildir.

Pyodide 314.0.7/Python 3.14.2 ve paketler sabit sürüm/özetle hazırlanır.
Runtime bütün kod/wheel/font/WASM varlıklarını aynı yayının `python/`
dizininden alır. PDF okuma ve önizleme ağır çıktı paketlerini yüklemez;
Excel/PDF isteği onları ayrıca yükler. İlk kullanım ek indirme ve bellek
gerektirir. Yavaş bağlantı/Windows için süre veya bellek garantisi verilmez.

25 MB girdi, müşteri için 16 sayfa/100.000 satır/256 sütun ve 512 karakter;
PDF için özgün 250 sayfa/100 tablo/200.000 ayrıştırılan satır/4.096 karakter,
toplam 100.000 ürün/kategori başına 25.000 ürün sınırı vardır. Görünen Excel
50.000 satır; çıktı 100 MB; iskonto işçisi 120 saniye ile sınırlıdır.
XML varlık bildirimi `defusedxml` ile reddedilir. Kaynak limitlerinin
daraltılması ve tarayıcı indirmesi ayrı platform sınırıdır.

## Güvenlik taraması ve açık bağımlılık kaydı

Aktarılan Python katman/safety auditleri sıfır bulguyla geçer. npm runtime
auditinde bilinen açık yoktur. **Python paket setinde sıfır açık denemez:**
2026-10-04 `pip-audit --no-deps --disable-pip` 17 paket içinde iki pakette
32 bildirim (17 ayrı kimlik, yinelenen advisory kayıtları dahil) buldu:

- `cryptography 47.0.0`: sertifika zinciri/DNS kısıtı/PKCS7/OpenSSL wheel
  bildirimleri; düzeltilen sürümler 48.0.1–50.0.0.
- `Pillow 12.2.0`: görüntü/font/parser/filter/bellek ve Windows görüntüleyici
  bildirimleri; düzeltilen sürüm 12.3.0.

Bu sürümler sabit Pyodide dağıtımının hazır WASM paketleridir; güncel npm
Pyodide ve [resmî paket listesi](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
de aynı sürümleri verir. Native wheel ile WASM paketi değiştirilmedi veya
uyumsuz bir motor güncellemesi yapıldı diye sunulmadı.

Kullanılan hat PDF metin/tablo çıkarır ve sabit TrueType fontla vektör/metin
PDF yazar; harici görüntü/font veya sertifika/PKCS7 hizmeti yoktur. Regresyon
testi `Image.open`, `FPDF.image`, sertifika PolicyBuilder ve üç PKCS7 decrypt
girişini hata veren taklitlerle kapatıp 11 PDF'yi ve tam PDF çıktısını
doğrular. 251 sayfalı gerçek yapay PDF reddedilir. Bozuk wheel özetinde
tarayıcı hiç belge/önizleme üretmez; yeniden denemede yeni işçi çalışır.

Bu erişim kanıtı paket açıklarını kapatmaz; genel güvenlik garantisi değildir.
Paket güncellemesi için uyumlu düzeltilmiş WASM build'i ve bütün başvuru
kapılarının yeniden geçmesi gerekir. Pillow'a harici görüntü/font veya
cryptography'ye sertifika/PKCS7 akışı eklenmeden bu kayıt yeniden ele alınır.
POS ile test yalnız yapay veri ve dış ağa kapalı taklit ortamda yapılır.

## Kabul kanıtı ve kalan sınırlar

Kural/Excel kapısı, tüm Chromium regresyonları ve büyük dosya kapısı yayın
öncesi çalıştırılır. İskonto'nun açık/koyu/390 px görselleri ayrıca incelenir;
test gerçekten `html[data-theme]` değerini kontrol eder. Ölçümler ve ekran
görüntüleri `/tmp` içindedir, şirket verisi veya test çıktısı yayımlanmaz.
Kesin son sayılar ve yayın durumu [oturum notundadır](OTURUM_NOTU.md).

PDF dosya baytları/nesne kimlikleri veya PNG piksellerinin eşitliği değil,
iş verisi, sıra, hesap, çıktı hücre/metin/ad kapsamı doğrulanır. Tüm olası
gerçek dosyaların kabul edildiği veya Windows Excel/PDF görüntüleme
denemesinin yapıldığı iddia edilmez. Kullanıcının iş yeri kabulü ayrıca
bekler. Drive ve örneksiz raporlar önceki kararla ertelenmiştir. Kârlılık ve
Yaşlandırma bu sürümün işi değildir; sonraki satış dilimleri ayrı başvuruyla
başlatılmalıdır.
