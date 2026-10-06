# Satış — Yaşlandırma (1.13.0)

2026-10-05. Kullanıcı BUP Yönetim masaüstü programındaki kalan Satış modülü
Yaşlandırma'nın CAL bup'a taşınmasını, önce plan sonra üç aşamalı uygulamayı
istedi ve atamaların yalnız tarayıcıda saklanmasını onayladı. Masaüstü projesi
salt okunur kaynaktır; gerçek rapor, config ve masaüstü atama kaydı taşınmadı.

## Korunan kod ve bağımsız başvuru

Masaüstünün `domain/yaslandirma` (8 dosya), `application/aging_analysis`
(6 dosya), `infrastructure/excel/aging_workbook_reader.py`,
`infrastructure/export/aging_exporter.py` ve
`infrastructure/persistence/vehicle_assignments.py` dosyaları
`vendor/python/bup` altında byte düzeyinde aynıdır; SHA-256 özetleri
`vendor/python/kaynak.json` ve başvuruda kayıtlıdır, derleme farkı reddeder.
Paylaşılan iptal, görünen-satır, atomik yayımlama ve sürümlü JSON deposu
dosyaları Kârlılık'tan beri aynı özetle bulunur. Yeni JS hesap yoktur.

`tools/yaslandirmaReferansi.py` masaüstü `.venv` Python'uyla yalnız kendi
ürettiği yapay Excel'leri okur (`PYTHONDONTWRITEBYTECODE=1`, kaynak projeye
yazmaz): 8 okuma/analiz/rapor/tam-görünen Excel senaryosu (filtre özeti
başlığı, `<dimension>` eksik dosya, 5. satır başlık, Toplam/Diğer sütunları,
tuhaf/formül başlık, 40 araç, araçsız rapor, masaüstü golden verisi), 9 hata
ve 10 atama adımı (ekle, güncelle, boş sorumlu, kaldır, geri al). CI aynı
girdileri tarayıcı Python motorunda çalıştırıp `tests/birim/yaslandirmaReferansi.test.ts`
ile karşılaştırır. Başvuru sessizce yeniden üretilmez.

```sh
PYTHONDONTWRITEBYTECODE=1 <kaynak>/.venv/bin/python tools/yaslandirmaReferansi.py <kaynak> tests/yardimci/veriler/yaslandirmaReferansi.json
```

## Korunan iş davranışı

- İlk sayfa; başlık ilk 5 satırda, araç/cari/kova sütunları ayrı hücrelerde
  olmalı (tek hücredeki süzgeç özeti başlık sayılmaz). Yalnız `.xlsx`.
- Araç numarası 1–99; depo/merkez/genel/kesimhane kategorileri araç değildir.
  `ARAÇ 1` ile `ARAÇ 10` karışmaz. Cari adı boşsa `Müşteri_<satır>`.
- Türkçe sayı ayrıştırması kaynağın kuralıdır; örneğin `1,234.56` 123.456
  olur, sayısal hücre olduğu gibi alınır. Kova kategorisi ve sırası kaynak
  sözlüğündendir; Toplam/Genel Toplam sütunu varsa kaynak gibi toplama girer.
- Tam Excel: “Araç Özeti” ve “Yaşlandırma Kovaları” iki sayfası, formül
  nötrleştirme dahil masaüstüyle aynı hücreler. Görünen Excel ekrandaki
  arama/29+ süzgeci/sıralama ile seçilen araçları aynı sırada içerir.
- Raporlar: Özet (araç detayları), Detaylı (araç sırası, bakiyeye göre azalan
  müşteriler), Karşılaştırma (bakiye sırası), Yaşlandırma (kova + pay).
  Araç Detayı beş gösterge + en yüksek 10 müşteri. Grafik: en yüksek 10 araç ve
  kova dağılımı; değerler yazılıdır, 29–56 gün uyarı / 57+ kritik metinle de.
- Atama: araç no + sorumlu zorunlu, alanlar kırpılır, 200 karakter/500 kayıt
  sınırı, kaynak `VersionedJsonStore` birincil + `.bak` ve “son değişikliği geri
  al” davranışı; iş yükü sorumluya göre sayılır.

## Platform farkları (hesap değişikliği değildir)

- 25 MB/100.000 veri satırı/5.000 arşiv parçası tarayıcı bütçesi; CAL'nin ZIP
  ön denetimi bozuk arşivi masaüstü okuyucusundan önce kendi mesajıyla reddeder.
- Dosya ve sonuç oturum belleğindedir; çıktı indirilir. Atama kaydı IndexedDB
  `satis:yaslandirma:atamalar:v1` anahtarında nesil + önceki kayıt CAS ile tek
  aktarımda saklanır; başka sekme değişikliği ezilmez, belirsiz yazıda liste
  gizlenir. Bozuk kayıt boş sayılmaz.
- Masaüstünün geçmiş kaydı ve Tahsilat kuyruğu senkronu taşınmadı (Tahsilat
  modülü CAL'de yok). Grafikler matplotlib yerine CAL tema çubuklarıdır.
- Ekran ek kolaylığı: araç numarasına basınca Araç Detayı açılır.

## Kabul

Birim eşdeğerlik 29 senaryo; tarayıcıda 3 akış senaryosu (kapalı ağ, Excel
hücreleri, raporlar, atama kalıcılığı, hatalı dosya); performans: 20.000 satır /
60 araç yerelde ~10 sn, en uzun ana ekran beklemesi ~32 ms. Açık/koyu/390 px
görünüm incelendi. Gerçek LED raporuyla Windows denemesi kullanıcıdadır.
