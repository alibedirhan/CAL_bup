# Kârlılık Analizi — 1.11.0

2026-10-04. Satış → Kârlılık Analizi, mevcut masaüstünün iki dosyalı kârlılık
akışını CAL bup'a taşır. Kaynak BUP Yönetim salt okunur kalır. Gerçek şirket
Excel'i, stok eşleştirmesi veya dönem kaydı aktarılmamıştır.

## Kullanım

1. S01S Kârlılık Analizi (Stok Dağılımlı) satış raporunu ve Bupiliç Dönemsel
   İskonto (Şube Alış) fiyat raporunu .xlsx olarak seçin.
2. Analiz et'e basın. Sonuç tablosunu arayın/sıralayın; eşleşmeyenleri gizleme
   ve yalnız negatif marj filtrelerini kullanın. Tam Excel bütün sonucu;
   görünen Excel filtreli/sıralı listenin bütün sayfalarını içerir.
3. Genel Bakış'ta kâr gruplarını; Senaryo'da maliyet/fiyat/miktar değişimini,
   marj, başabaş fiyat ve Pareto sınıfını inceleyin.
4. Eşleşme Merkezi'nde satış stoğunu fiyat stoğuna önce önerin, sonra açıkça
   onaylayın. Bekleyen öneri hesapta kullanılmaz. Kaldırma ve son değişikliği
   geri alma vardır.
5. Dönem Analizi'nde tamamlanan analizi ad vererek kaydedin; iki farklı
   dönemi karşılaştırın. Kayıtları yenile, sil ve son değişikliği geri al
   aynı tarayıcının kayıtlarını kullanır.

## Korunan kaynak davranışı

- İlk çalışma sayfası; ilk beş satırda başlık arama. Satış raporunda stok
  adı koddan önce gelir; ad sütunu yoksa kod kullanılır. TOPLAM/TOTAL/GENEL
  içeren stok satırları kaynak gibi dışlanır.
- Fiyat sözlüğü, stok/tarih alanı boş ve Depo hücresinde stok adı bulunan
  pozitif fiyat satırlarından kurulur. Depo/şube/bölge/merkez başlıkları
  dışlanır; ilk görülen fiyat iki basamağa Python round ile yuvarlanır.
  Fiyat stoklarının harfleri ayrıca düzeltilmez; küçük harfli fiyat adı
  masaüstüyle aynı biçimde eşleşmeyebilir. Tahmini/fuzzy eşleşme yoktur.
- Birim kâr = ortalama satış fiyatı − birim maliyet; net kâr = birim kâr ×
  satış miktarı. Satış tutarı sütunu yeniden hesaplanmaz. Sonuç net kâr ve
  birim kâra göre azalan, eşitlikte kaynak sırasını koruyan listedir.
- Eşleşmeyen maliyet 0'dır. Bu stokların kârı ve toplam kâr yüksek
  görünebilir; analiz, genel bakış, senaryo ve dönem karşılaştırmasında uyarı
  vardır. İş kuralı değiştirilmemiştir.
- Genel bakış %33/%67 pozitif kâr eşikleri ve sıfırın kaynak dağılım
  davranışını korur. Senaryo −100…500 oranları, yalnız maliyeti eşleşmiş
  stokların toplam marjı ve pozitif eşleşen kârın A/B/C katkısı özgün
  domain'de hesaplanır. Ana analiz senaryo hesabıyla değişmez.
- Tam Excel: Karlılık Analizi + Özet. Görünen Excel: Görünen Satırlar +
  Kapsam. Senaryo Excel: Senaryo Özeti + Ürün Senaryosu. Formül başlatan
  metinler kaynak exporter tarafından etkisizleştirilir.

## Katman ve kayıt sınırı

Domain/application/okuyucu/exporter/depo kaynakları `vendor/python/bup`
altında byte düzeyinde aynı SHA-256 ile korunur. Paket başlangıç dosyaları
minimaldir: kullanılmayan masaüstü alt modülleri açılmaz. `core/settings.py`
kodu sadece özgün depo adaptörlerinin import bağımlılığıdır; hiçbir gerçek
ayar okunmaz ve bütün depolara /cal altındaki açık sanal yollar enjekte
edilir. Qt ve masaüstü config/veri dosyaları pakette bulunmaz.

`karlilik_kopru.py` tarayıcı composition portudur. Kaynak facade'a özgün
okuyucu, Excel exporter, eşleşme deposu ve dönem servisini bağlar. Kaynak
JSON şeması bozuk kaydı boş varsayılanla ezmeden önce doğrulanır. Başarılı
geçişin güncel/yedek JSON'ları tek IndexedDB CAS aktarımıyla saklanır;
nesil ve bütün önceki kayıt karşılaştırılır. Depo hatası boş kayıt sayılmaz.
Yazı iptali sonucu belirsizse ekran eski analizi kaldırır; tekrar işlemden
önce kayıtların yenilenmesini ister. Okuma/çıktı sırasında kayıt değişirse
indirme veya eski analiz yayımlanmaz.

`cekirdek/karlilik` tür, girdi ve çıktı doğrular; iş hesabını tekrar etmez.
`satis/karlilik/servis` yalnız motor portunu kullanır. Motor her işlem için
ayrı Pyodide işçisi açar, bitiş/hata/iptal/rota/zaman aşımında kapatır. Aynı
anda tek işlem vardır. Kaynak/oran değişimi eski sonucu geçersiz kılar.
Tamamlanmış ekran oturumu rota değişiminde korunur; yenileme dosyaları ve
analizi unutur. Eşleştirmeler/dönem özetleri bu tarayıcıda açık kullanıcı
kaydıyla kalır; Drive'a veya bir sunucuya gönderilmez.

## Bütçeler ve platform farkları

25 MB girdi, 100 MB açılmış ZIP, 5.000 arşiv parçası, 16 sayfa, 100.000
veri satırı, 256 sütun ve 512 karakterlik hücre sınırı vardır. ZIP yerel/
merkez başlıkları kaynak açmadan önce denetlenir. XML varlıkları defusedxml
ile reddedilir. Sayısal sonucu sonlu olmayan dosya yarım başarı oluşturmaz.
Görünür çıktı en fazla 50.000 satır; dönem kaydı kaynak gibi 5.000 ürün,
200 dönem ve 4 MB; eşleşme kaydı 512 KB'dır. İşçi 120 saniye; çıktı 100 MB
ile sınırlıdır. Motor varlıkları kendi yayınımızdan SHA-256 doğrulamasıyla
alınır. Bu modül PDF/görüntü/cryptography/Pillow paketlerini yüklemez.

Çıktı yeni dosya olarak indirilir; kaynak Excel'e yazılmaz. İndirme başlaması
fiziksel disk kaydı değildir. Gerçek Windows/Excel kabulü kullanıcıyla yapılır.
Masaüstündeki ayrı F2.11 **Satış Şefi Raporu**, SQLite/çok aylı alış-satış
analizi ve PDF yönetici raporu bu beş bölümlü aktarımın kapsamı dışındadır;
ayrı bağımsız okuyucu/hesap/çıktı başvurusuyla sonraki iş olarak ele alınır.

## Bağımsız başvuru ve denetim

`tools/karlilikReferansi.py` kaynak uygulamanın kendi Python ortamıyla 9
okuyucu/analiz, 45 senaryo ve Excel, 4 hata; öneri/onay/kaldırma/geri alma
geçişleri ve iki dönem karşılaştırması üretir. Yalnız sentetik kitaplar
kullanılır; üretici tarayıcı köprüsünü çağırmaz. JSON girdileri/satırları/
hücreleri kaynak SHA-256'larıyla CI'da kaynak projeye erişmeden karşılaştırılır.

```sh
<kaynak>/.venv/bin/python tools/karlilikReferansi.py <kaynak> tests/yardimci/veriler/karlilikReferansi.json
npm run kontrol
npm run test:tarayici
npm run test:performans
```

İlk formül-injection örneği openpyxl tarafından formül hücresi olarak
üretiliyordu ve cached sonuç olmadığı için okuyucu tarafından atlanıyordu.
Üretici bu saldırı metnini açıkça string hücresine yazar; hesap değişmemiştir.
ExcelJS XML'deki −0'ı, openpyxl ise 0'ı döndürür. Bağımsız tüm-hücre testleri
özgün/WASM çıktısını aynı openpyxl ile yeniden okur. Tarayıcı dosya testleri
kaynak **Excel hücresi** değerlerini kullanır; DTO'nun daha uzun float'ını
Excel'in 16 anlamlı basamaklı serileştirilmesine eşit saymaz. Hiçbir hesap
beklentisi toleransla gevşetilmemiştir.

Kabul sonuçları ve yayın durumu [OTURUM_NOTU.md](OTURUM_NOTU.md) içindedir.
Yaşlandırma sıradaki satış modülüdür. Önceden kayıtlı Python PDF paket
açıkları [SATIS_ESDEGERLIK.md](SATIS_ESDEGERLIK.md) içinde açık kalır.
