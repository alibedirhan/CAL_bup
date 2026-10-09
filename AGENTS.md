# AGENTS.md — CAL bup

Bu dosya projede çalışan yapay zekâ araçları (Codex, Claude Code vb.) ve geliştiriciler içindir.
İşe başlamadan önce bunu, sonra `docs/MIMARI.md` ve `docs/IS_KURALLARI.md`'yi okuyun.

## Proje

Bupiliç İzmir Bölge Deposu için LED sisteminin Excel çıktılarından günlük raporlar hazırlayan
**tarayıcı uygulaması**. Sunucu yoktur: Excel dosyaları kullanıcının tarayıcısında okunur ve yazılır,
normal kullanımda hiçbir yere gönderilmez; isteğe bağlı Drive kaydı kullanıcının düğmesiyle yapılır. GitHub Pages'te yayınlanır.

- Site: https://alibedirhan.github.io/CAL_bup/
- Depo (herkese açık): https://github.com/alibedirhan/CAL_bup
- Hazır rapor: **Günlük depo kontrol**. Kullanıcı D01, sayım fişi ve şube alış dosyalarını bırakır;
  uygulama depo kontrol kitabına yeni gün sayfasını ekler, toplamları kontrol eder.
- Eski Excel/VBA sürümü arşivdedir: `github.com/alibedirhan/Bup_Excel_Rapor_Eski` (gizli).

## Kullanıcıyla iletişim

- Kullanıcı Bupiliç deposunda çalışıyor, **yazılımcı değil**, Türkçe yazışır.
- Önce 2-3 cümlelik sade özet, sonra yapması gerekenler için numaralı kısa adımlar. Teknik tablo, dosya
  yolu/satır numarası, risk listesi verme; teknik ayrıntı `docs/`'ta durur, sorarsa anlat.
- Kaynak sistemin adı **LED**'dir (LOGO değil). Kullanıcının dilini kullan: "LED dosyaları",
  "depo kontrol dosyası", "gün sayfası".
- Geliştirme Linux'ta yapılır; kullanıcı siteyi iş yerindeki Windows bilgisayarda Chrome/Edge ile kullanır.
  İş yerindeki Excel masaüstü sürümüdür (Microsoft 365 değil). Gerçek Excel'de denemeyi kullanıcı yapar.
- Proje klasöründe gereksiz dosya istemiyor; geçici dosyaları proje dışında tut.

## Komutlar

Node 22 (`.nvmrc`).

```sh
npm ci              # bağımlılıklar
npm run dev         # http://localhost:5173/CAL_bup/
npm test            # birim + (varsa) gerçek dosyalı altın testler
npm run kontrol     # tip + lint + biçim + test + derleme — her değişiklikten sonra geçmeli
npm run test:tarayici # derlenmiş uygulamada sentetik Chromium/IndexedDB/OCR denemeleri
npm run bicim       # Prettier ile biçimle
```

`main` dalına gönderilen her commit GitHub Actions'ta `npm run kontrol` ve `npm run test:tarayici`'den geçer ve geçerse siteye
yayınlanır (`.github/workflows/yayin.yml`). Yani **main'e push = yayın**.

## Klasör haritası

```
src/
  cekirdek/     saf kurallar: sayi, metin, tarih, ayarlar, kaynakVeri, kontrol, hata
  kaynaklar/    LED okuyucuları (led.ts, tabloOku.ts), dosya tanıma (tani.ts),
                Kitap görünümü (kitap.ts), ExcelJS → Kitap (excel.ts)
  hedef/        depo kontrol kitabına yazma: sayfa.ts (kopyala, satır ekle, seç, yaz),
                formul.ts (formül kaydırma), depoKontrol.ts (planı sayfaya yazma)
  raporlar/     kayit.ts (rapor listesi) + depoKontrol/ (hesapla, gunSecimi, tarihDenetimi,
                islem, oturum = ekran durumu, motor/motorYukle = ExcelJS ayrı parça)
  satis/        katalog + musteriTakip/iskonto (portlar, servis, ayrı işçiler)
  platform/     tarayıcıya bağlı: dosya.ts (seç/kaydet), idb.ts, gecmis.ts (geçmiş + yedek),
                ayarlar.ts, saklama.ts (localStorage)
  arayuz/       React: Uygulama.tsx, rota.ts, tema.ts, bilesenler/, sayfalar/, stiller/
tests/
  birim/        her kural ve modül için (CI'da çalışır, sentetik veri)
  altin/        gerçek dosyalarla uçtan uca (yalnızca yerelde, ornekler/ varsa)
  yardimci/     sentetik LED ve depo kontrol kitapları, xlsx XML okuyucu
docs/           MIMARI.md (nasıl), IS_KURALLARI.md (ne)
ornekler/       gerçek şirket dosyaları — GIT DIŞI
tools/          ikiz_aktar.py (eski Python ikizinden başvuru çıktısı üretir; artık gerekmez)
```

## Kurallar

1. **Depo herkese açık. Şirket verisi asla commit'lenmez:** Excel dosyaları, gerçek ürün adları, gerçek
   stok/miktar rakamları. Gerçek dosyalar `ornekler/`'dedir (`.gitignore`). Testlerde sentetik veri
   kullan; commit'ten önce `git diff --cached`'i gerçek ad/rakam için tara.
2. **Katmanlar:** `cekirdek/` hiçbir katmana, React'e, ExcelJS'e bağlanmaz (ESLint zorlar). Okuyucular
   ExcelJS'i bilmez, `Kitap` görünümünü okur. Rapor önce saf bir **plan** üretir; önizleme ve kayıt aynı
   planı kullanır. Ayrıntı: `docs/MIMARI.md`.
3. **ExcelJS yalnızca modülün `motor.ts` üzerinden yüklenir** (dinamik içe aktarma, ~940 KB ayrı parça).
   Arayüzden `kaynaklar/excel.ts`, `hedef/*` ya da `islem.ts`'i statik içe aktarma; yalnızca `import type`.
4. ExcelJS 4.4.0'a **sabit**. Eksikleri `hedef/sayfa.ts`'te çözüldü (MIMARI.md tablosu). Yükseltirsen
   altın testleri ve tarayıcı denemesini yeniden yap.
5. Kod, arayüz metni, test adları **Türkçe**. Arayüz metni sade ve kullanıcının diliyle.
6. Renkler yalnızca `src/arayuz/stiller/tema.css` belirteçlerinden. Yeni belirteç açık temada ve **iki**
   koyu blokta birebir tanımlanır (test denetler).
7. React efektleri değer döndürmez: `useEffect(() => { f(); }, [...])` yaz, `useEffect(() => f(), ...)`
   değil (bir kez bütün ekranı çökertti).
8. Bir dosya ~400 satırı geçerse böl.
9. Her davranış değişikliğine test. Kural değişirse `docs/IS_KURALLARI.md`'yi de güncelle.
10. Sürüm `package.json`'dadır, arayüzde görünür. Kullanıcıya giden her değişiklikte artır.

## Testler ve gerçek dosyalar

- `tests/birim/` her yerde çalışır. `tests/altin/` yalnızca `ornekler/` doluysa çalışır, yoksa atlanır.
- Altın testler: `ikiz.test.ts` (kurallar eski Python ikiziyle satır satır aynı),
  `gercekExcel.test.ts` (gerçek depo kontrol dosyasında 30.09 silinip yeniden oluşturulur; elle hazırlanmış
  sayfayla hücre hücre karşılaştırılır; diğer sayfalar değişmemeli; çıktı `ornekler/cikti_30.09.xlsx`).
- Doğrulanmış rakamlar `ornekler/beklenen.json`'dadır (git dışı).
- Sanal POS’un sentetik tarayıcı denemeleri `tests/tarayici/` içinde CI’da kalıcıdır; Playwright Chromium
  kurulumu `npx playwright install chromium`. LED gerçek dosya denemeleri yerelde ve Git dışındadır.
  Gerekirse `vite preview` üzerinde dosyaları girişe verip inen dosyayı altın çıktıyla karşılaştır.
- Gerçek Excel'de açma, dosyanın üzerine kaydetme (File System Access) ve Excel açıkken kaydetme yalnızca
  kullanıcının Windows bilgisayarında denenebilir; bunları kullanıcıdan iste.

## Durum ve yol haritası

| Aşama | İçerik                                         | Durum                                                               |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------- |
| 1–4   | İskelet, hesap kuralları, Excel, rapor arayüzü | Bitti                                                               |
| 5     | Windows iş yerinde deneme                      | Bitti (2026-10-01)                                                  |
| 6     | Google Drive kayıt/yedek/LED/ayar/geçmiş       | Kod ve taklit servis denemesi tamam; gerçek OAuth kurulumu bekliyor |
| 7     | Envanter, bakiye, palet/kasa                   | Örnek dosya ve beklenen sonuç bekleniyor                            |

**Güncel sürüm:** 1.19.0 (POS yardımcısı 2.1.0). Son çalışma: [docs/OTURUM_NOTU.md](docs/OTURUM_NOTU.md).
Google Drive kurulum/teknik kararlar: [docs/DRIVE.md](docs/DRIVE.md).
Sanal POS cari kasası ve sınırlar: [docs/SANAL_POS.md](docs/SANAL_POS.md).

**2026-10-09 depo kontrol sorumluluk notu (1.19.0):** Kullanıcı raporu masa başında hazırlıyor, sayımı
depocu yapıyor; yöneticinin “onaylamadan okuyamaması”nı istedi. Dosya Outlook ile gittiği için makrolu kapı
yerine (makro engellenir) **onay Outlook oylama düğmeleriyle alınır, rapor onaydan sonra gönderilir**
(programda değil, kullanıcının iş akışı). Program her kayıtta gün sayfasının sağ üstüne kısa not + alt
bilgi yazar ve kitabı en yeni günün arkasındaki **Bilgilendirme** sayfasıyla açar (metin, güne bağlantı,
rapor kaydı). Metin kullanıcıyla kararlaştırıldı, depocu adı yok; değiştirmeden sor. Ayrıntı IS_KURALLARI.

**2026-10-08 gece Sanal POS güvenliği (1.18.0, yardımcı 2.1.0):** Kullanıcı kararlarıyla: **Sanal POS
parolası** (≥6, 1.18.1 kullanıcı kararı; harf+rakam; PBKDF2 600k; anahtar yalnız sekme belleğinde; 10 dk boşta/yenilemede kilit;
5 yanlıştan sonra katlanan bekleme). **Unutulan parola kurtarılamaz** — “Parolamı unuttum” + “SİL” her
şeyi siler; bunu değiştirme. **Yedek/yedekten ekleme/dışa aktarma ve kart numarası/CVV gösterme-kopyalama
yoktur**; kart yalnız yardımcıyla aktarılır; geri ekleme önerme. Yardımcıda araç çubuğu aç/kapa ve “POS
sayfasında pencereyi göster” (kurulumdan sonra varsayılan gizli; uyarı/hata açar). Tarayıcı testlerinde
Sanal POS'a girerken `posKilidiniAc` kullan. Ayrıntı: SANAL_POS.md, POS_YARDIMCISI.md.

**2026-10-08 Sanal POS istekleri (1.17.0, yardımcı değişmedi 2.0.0):** Cari profilinde görünür
“Cariyi sil”; kurulum tamamsa “✓ POS yardımcısı kurulu” ve kurulum/elle giriş anlatımı kapalı ayrıntıda
(`pos/useYardimci.ts`). **CVV artık kullanıcı kararıyla kartla birlikte şifreli saklanır** (isteğe bağlı
`PosKart.cvv`, ekranda hep “•••”, yedekte de var, aktarımda kendiliğinden gider). PCI DSS aykırılığı ve
sorumluluk kullanıcıya anlatıldı, yine de seçti; aşağıdaki 2026-10-07 “CVV saklanmaz” cümlesi eskidi.
CVV'yi günlük/test/yayın varlıklarına koyma kuralı sürer. Eklenti koduna dokunulmadığı için yardımcı
yeniden kurulmaz; kod değişirse sürüm kuralı aynen geçerli.

**2026-10-07 Sanal POS saha testi (1.16.0, yardımcı 2.0.0):** İş yerindeki ilk gerçek denemede 2. cari
girişi reddedildi (10 haneli VKN kayıtlı, POS muhtemelen TC istiyor; kartlı caride numara düzeltilemiyordu)
ve alanlar her caride yeniden tanıtılıyordu. [Saha raporu](docs/SANAL_POS_SAHA_TESTI_RAPORU.md) K1–K9
uygulandı: onaylı numara düzeltme, cariye özel lisans no/şifre, site geneli tek kurulum (kimlik → ad →
başlık ile bulma), firma numarası kendiliğinden, tek “Alanları tanıt”, Ad Soyad, eski sekme uyarısı,
ekran yapısı raporu, programda kurulum kopyası. **CVV kullanıcı kararıyla ödeme anında yazılır ve POS'a
doldurulur, hiçbir yerde saklanmaz** (saklama PCI DSS gereği önerilmedi; kartta CVV alanı ekleme).
**Yardımcının sürümü ayrıdır** (`src/cekirdek/posYardimciSurumu.json`); eklenti kodu değişince sürümü
artırıp `npm run yardimci:ozet` çalıştır, yoksa derleme durur. Belgelere cari adı/numarası yazma (depo açık).
Ayrıntı: [SANAL_POS.md](docs/SANAL_POS.md), [POS_YARDIMCISI.md](docs/POS_YARDIMCISI.md).

**2026-10-06 Satış ekranları (1.15.0):** Sekme taramasının son adımı: Yaşlandırma, Kârlılık, İskonto.
Geniş sonuç tabloları tam genişlikte, tek satır dosya seçimi, dönemler kendiliğinden okunur, tutar
kutuları bölünmez. Hesaplar değişmedi. Bütün sekmelerin taraması bitti; kullanıcı iş yerinde kontrol edecek.

**2026-10-06 Müşteri Takip ve bildirimler (1.14.2):** Sekme taramasının üçüncü adımı. Başarı
bildirimleri 12 sn sonra kapanır, hata kalır; Müşteri Takip'te tek satır dosya seçimi, depo/Excel başlığı
ve plasiyer ayarı açıklaması. Masaüstü eşdeğerliği değişmedi.

**2026-10-06 Sanal POS sadeleştirmesi (1.14.1):** Sekme taramasının ikinci adımı. Yalnız görünüm:
işlem sırası, seçili kart panelinde iki ayrı yol, elle girişte açıklamalar “Ayrıntılar” altında.
Güvenlik/akış kuralları değişmedi; gerçek POS'a istek yok.

**2026-10-06 Günlük depo kontrol kullanım kolaylığı (1.14.0):** Kullanıcı bütün sekmelerin
UX/mantık taramasına depo kontrolden başladı. Sorular sağdaki “sıradaki adım” kutusunda düğmeleriyle;
dosya günü önerisi; atlanan iş günü uyarısı; Hata durumunda açık kayıt onayı; fark süzgeci ve sonuç
özeti. Ayrıntı oturum notunda. Diğer sekmelerin taraması sıradadır.

**2026-10-05 Yaşlandırma (1.13.0):** Kullanıcı masaüstündeki kalan Satış modülünü plana göre
taşımayı istedi. Özgün 17 Python dosyası SHA-256 ile aynı; `tools/yaslandirmaReferansi.py`
masaüstü `.venv` ile yalnız yapay Excel'den başvuru üretir (masaüstüne yazmaz). Beş bölüm
(Analiz, Araç Detayı, Grafikler, Raporlar, Atama); atamalar yalnız tarayıcıda.
[YASLANDIRMA.md](docs/YASLANDIRMA.md). Satış dışı masaüstü bölümleri ayrı işlerdir.

**2026-10-05 Sanal POS üç aşamalı düzeltme (1.12.0):** Kullanıcı Windows'ta kayıtlı cariyle POS'a
girememe ve kart bilgilerinin yazılmaması sorunlarını bildirdi; derin tarama
([rapor](docs/SANAL_POS_DERIN_TARAMA_RAPORU.md)) sonrası üç aşamayı istedi: (1) formlar gizlilikte
kapanmaz, yalnız hassas görünüm örtülür; firma beyanı sekme geçişinde korunur; başka sekme değişikliği
ezilmez; (2) yardımcı mesajları, giriş hatası nedeni, AAYY/AA/YYYY tarih, alan ipuçları, panel tercihi,
180 sn; (3) yedek birleştirmede açık çatışma seçimi, numara araması, yedek hatırlatması.
**Kullanıcı açıkça istedi: Bupiliç'in gerçek sanal POS adresine hiçbir test/istek gönderilmez**;
bütün denemeler ağdan yalıtılmış taklit POS'la yapılır. Gerçek giriş/ödeme ve Windows kabulü kullanıcıdadır.

**2026-10-04 satış özellik taraması — güncel devam bağlamı:** Kullanıcı kârlılık,
iskonto ve müşteri takibin masaüstünde olup webde olmayan bütün özelliklerini
analiz edip raporlamayı istedi. [Özellik farkları raporu](docs/SATIS_OZELLIK_FARKLARI_RAPORU.md)
50 başlıkta eksik/kısmi özellikleri, platform farklarını ve mevcut kapsamı ayırır.
Hesap eşdeğerliği tam özellik aktarımı değildir. Satış Şefi Raporu bütünü,
temel ekran ayrıntıları ve ortak geçmiş/bulgular/CAL bağlantısı eksiktir.
Bu tur davranış/kural değişmedi; masaüstü salt okunur kaldı. Sonraki oturumda
önce raporu ve oturum notunun en üstündeki devam kaydını oku; taramayı baştan
yapma, eksikleri tamamlandı sayma ve kullanıcı yalnız rapor istediği için
kendiliğinden uygulamaya geçme. Kullanıcı dönüşte çalışmaya devam etmek istiyor.

**2026-10-04 Kârlılık (1.11.0):** Kullanıcı kaldığı yerden bu modülü istedi.
İki Excel analizi, genel bakış, senaryo, onaylı eşleşme ve dönem karşılaştırması
özgün Python kodlarıyla tarayıcı işçisinde çalışır; 9 okuyucu/analiz, 45 senaryo/
Excel, 4 hata ve geçiş/dönem başvurusu bağımsız masaüstü üreticisindendir.
Eşleşme/dönem JSON'ları kaynak şemasıyla doğrulanır; IndexedDB güncel/yedek
tek CAS aktarımı, bozuk kaydı ezmeme ve çıktı öncesi yeniden okuma vardır.
Gerçek config/dönem/stok/şirket dosyaları taşınmaz. Kaynak settings modülü
kod olarak depo import bağımlılığıdır; tüm yollar /cal altında açıkça enjekte
edilir, gerçek ayar yüklenmez. Ayrı F2.11 Satış Şefi Raporu sonraki aktarım;
ana sıradaki modül Yaşlandırma'dır. [Kârlılık kaydı](docs/KARLILIK.md) ve
[oturum notu](docs/OTURUM_NOTU.md) güncel kapsam/kabul kaynağıdır.

**2026-10-04 eşdeğerlik ve İskonto (1.10.0):** Kullanıcı gerçek test verisi yokken
masaüstünün iş mantığının korunmasını ve ardından sıradaki modülü istedi.
Müşteri okuma özgün openpyxl adaptöründedir; 78 karşılaştırma/dört hata,
tam Unicode 15.0.0 harf tablosu ve sayı/tarih/saat/süre hücreleri doğrulanır.
İskonto, değişmemiş PDF okuyucu/domain/facade/Excel/PDF exporter kodunu
Pyodide 314.0.7 işçisinde çalıştırır. 11 yapay PDF/39 facade/3.264 yuvarlama
başvurusu bağımsız kaynaktandır. Qt/config/şirket dosyaları aktarılmaz.
Runtime varlıkları kendi yayınımızdadır; kaynak ve paket SHA-256'ları denetlenir.
İptal/rota/timeout işçiyi kapatır. XML varlıkları defusedxml ile reddedilir.
Tam/görünen kapsam, platform farkları ve **iki Python paketindeki açık audit
bulguları** [eşdeğerlik kaydındadır](docs/SATIS_ESDEGERLIK.md); sıfır açık veya
gerçek Windows kabulü iddia etme. Diğer satış modülleri ayrı iştir.

**2026-10-04 Satış — Müşteri Takip (1.9.0):** Kullanıcı bir modülle başlamayı,
CAL bup arayüzünü ve masaüstü iş davranışını korumayı istedi. İlk dilim
Müşteri Takip'tir; diğer üç satış modülü sonraki işlerdir.
[Aktarım planı](docs/SATIS_MODULLERI_PLANI.md) ve iş kuralları bağlayıcıdır.
Kaynak BUP Yönetim, config ve gerçek müşteri dosyalarını buraya kopyalama.
64 yapay Python karşılaştırma başvurusu, dört hata ve Excel hücre sözleşmesi
`tests/yardimci/veriler/musteriReferansi.json` içindedir; üretici kaynak dosyaların
SHA-256'larını kaydeder. Yeni iş kuralı ancak bağımsız başvuruyla sınanır.
Saf kurallar `cekirdek/musteriTakip`, okuyucu `kaynaklar/musteriListesi`,
port/servis `satis/musteriTakip`, somut adaptörler motor/platformdadır.
Excel işçisi iptal/rota çıkışında kapatılır. Liste sonuçları kalıcı kaydedilmez.
Tam Excel/PNG eksik listesidir; görünen Excel etkin filtreli/sıralı listenin
bütün sayfalarını içerir. Araç/plasiyer ayarı sürümlü/atomik/nesil denetimlidir;
bozuk veya başka sekmede değişmiş kaydı ezme. Tasarım örnekleri kullanıcı tarafından
sonraya bırakıldı; `tasarim-ornekleri/` üretim değişikliğine katılmaz.

**2026-10-04 üç aşamalı devam (1.8.0):** Kullanıcı yeni rapor/karma ambalaj örneklerini,
Drive kurulumunu ve gerçek Windows denemesini sonraya bıraktı. Gün başlığı yılı doğrulanır;
belirsiz başlıklarda son yıl açıkça kontrol edilmeden plan/kayıt oluşmaz. Eski başlıklar
kendiliğinden düzeltilmez. Satır eklemede Excel özellikleri kaydırılır; desteklenmeyen yapılar
önizleme/yazıdan önce reddedilir. ZIP yerel/merkez başlık ve çakışma denetimleri güçlendi.
MV3 gizli/etkisiz üst kapsayıcıda doldurmaz. Ayarlar’dan indirilebilir yapay kabul ZIP’i gerçek
uygulamada doğrulanır. Nihai test/yayın ve dış kabul sınırları oturum notundadır.

**2026-10-04 açık noktaların devamı (1.7.1):** 1.7.0'daki tamamlanan 29 bulgu tekrar uygulanmadı.
Formül kaydırıcıda tam satır/küçük harf, Türkçe tanımlı ad ve sayfa aralığı adı regresyonları
düzeltildi; Excel yaz/yeniden aç testi eklendi. Normal Playwright bağlamları da dış ağa kapalı
proxy kullanır; MV3 sınırı korunur. `npm run test:performans`, derlemeden sonra altı büyük yapay
Excel senaryosunu çalıştırır ve `/tmp/`'a ölçüm yazar; yayın kapısındadır. Yerel 401 test,
89 Chromium senaryosu ve altı performans/sınır senaryosu başarılıdır. Gerçek Windows/Google/
sağlayıcı kabulü ve yeni LED örnekleri beklenir; iş kuralları tahmin edilmez.

**2026-10-04 genel tarama (1.7.0):** Kullanıcı Sanal POS ve bütün alanlarda ayrıntılı tarama,
gerekli düzeltmeler ve rapor istedi. [Genel rapor](docs/GENEL_TARAMA_RAPORU.md) 29 düzeltilmiş
bulgu başlığı ve gerçek ortam kabul sınırlarını ayırır. Dosya iş akışı artık
`raporlar/depoKontrol/dosyaIslemleri.ts`; saf Drive/ayar/geçmiş kuralları çekirdekte.
LED miktarı sıkı doğrulanır; gerçek birleşik grup başlığı ve dip toplam davranışı korunur.
Kart düzenleme/elle yeni giriş aktarımı iptal eder; kapalı profil eski kartları işlemde tutmaz.
Bozuk geçmiş/yedek yazıyla ezilmez; ayar değişince onaylar sıfırlanır; Drive bağlantı nesli denetlenir.
Kullanıcının Brave/Linux ekranı cari eşleşmesi ve kart/tarih doldurma mesajını gösterdi;
ödeme/SMS veya bütün gerçek sağlayıcı durumları doğrulanmış sayılmaz. Müşteri kartıyla test yasağı sürer.

**2026-10-04 bağlantı/Windows kurulumu (1.6.1):** Kullanıcı doğru GitHub Pages adresini kullanıyor,
yardımcıyı henüz kurmamış. Hata sonrası kalan “kontrol ediliyor” düzeltildi; protokol doğrulama,
kart göndermeyen bağlantı kontrolü, giriş/TTL/teslim sonucu hataları, saat geri alma ve eşzamanlı
bekleyen iş koruması eklendi. Windows CMD kendi ZIP'ini hash ile doğrular ve klasöre hazırlar;
tarayıcı ekleme kullanıcı onayıdır, politika/registry değiştirme. Linux parser kontrolü Windows
kurulum kabulü değildir. [Tarama raporu](docs/POS_YARDIMCISI_TARAMA_RAPORU.md).
Müşteri kartıyla test/SMS/ödeme yasağı ve kapalı ağ sınırı aynen sürüyor.

**2026-10-04 kart aktarımı (1.6.0):** Kullanıcı tek operatör için Edge yardımcısını ve fotoğraf
numarası düzeltmesini yetkilendirdi. Müşteri kartı/fotoğrafıyla test, ödeme veya SMS kesinlikle yasak;
yalnızca sentetik kart ve ağdan yalıtılmış taklit POS kullanılır. Numara/tarih ayrı incelemeden açık
onayla forma geçer; okunamayan numara elle tamamlanabilir. MV3 yardımcı yalnızca uygulama yolu ve
tam POS alan adında çalışır; kullanıcı boş alanları tanıtır, görünen vergi/TC numarası karşılaştırılır.
PAN/tarih yalnızca bağlanmış hedef sekmeye, bir kez teslim edilir; ödeme DOM olayları üretilmez.
CVV/tutar/SMS/ödeme kullanıcıda kalır. POS sekmesine geçiş izinli aktarımı kesmez; cari/kart/veri/rota
değişimi keser. Kaynak kod `src/eklenti/`, ZIP ana derlemenin parçasıdır.
Gerçek sağlayıcının HTML'i, Windows/Edge ve sözleşme uygunluğu doğrulanmış sayılmaz. Varsayılan
ödeme seçicisi, iframe enjeksiyonu veya otomatik ödeme uçları ekleme. Testlerin kapalı proxy sınırını
kaldırma. Mimari/kurulum/test sınırları: [docs/POS_YARDIMCISI.md](docs/POS_YARDIMCISI.md).
1.5.0 ve aşağıdaki eski notlar tarihsel bağlamdır; otomatik doldurma yoktu ifadeleri o sürüme aittir.

**2026-10-04 OCR/bildirim üç aşaması (1.5.0):** Kullanıcı aşamaları sırayla uygulamayı yetkilendirdi.
20 bulgu kod/regresyon düzeyinde giderildi; [kapanış raporu](docs/OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md).
Modal hata özeti, tek görünür bildirim, kesin ayar/geçmiş/yedek sonuçları, worker kurulum iptali;
geçici fotoğraf önizleme/döndürme/kırpma ve açık aday uygulaması; ortak işlem denetimi/Drive sinyali/
React kurtarma ekranı. 341 yerel test + 49 Chromium senaryosu, 17 OCR referansı başarılı.
İlk 15 resimde 90/270 dönüşüm kadrajı rakamı kesiyordu; kayıp rakam tahmin edilmez, yeni matris
boyutu koruyarak dönüşümü sınar. Windows/gerçek fotoğraf/Google/banka kabulü yapılmış sayılmaz.
OCR motoru native worker referansını kurulumdan önce alır; Tesseract.js 7.0.0 protokolü sabittir.
Paket yükseltirken model/worker/WASM arızası, iptal/timeout ve gerçek OCR matrisi zorunludur.
Fotoğraf/ham OCR/CVV/PAN/telefon veya bunların hash'lerini günlük, test ve yayın varlıklarına koyma.
[İlk araştırma](docs/OCR_VE_BILDIRIM_ARASTIRMA_RAPORU.md) tarihsel 1.4.0 kaydıdır.

**2026-10-03 profil tamamlaması (1.4.0):** Kullanıcı eksik kalan Sanal POS işlerinin tamamlanmasını
istedi. Gerçek cari profilinde kart ekleme/düzenleme/silme, isimli maskeli kartlar, iletişim telefonu,
kontrollü gösterme/kopyalama ve yerel fotoğraftan numara/tarih okuma uygulandı. Günlük PIN kaldırıldı;
rastgele AES cihaz anahtarı aynı tarayıcıda olduğundan bu profile erişen kişi veriyi açabilir.
Eski v1/v2 kasa mevcut PIN/parolayla bir kez taşınır; cariler/kimlikler korunur. Uzun parolalı kartlı
şifreli yedek, eski yedek uyumu, çoklu sekme çakışma ve iptal/hata denetimleri vardır.
İlk [profil planı](docs/SANAL_POS_PROFIL_PLANI.md) tarihsel belgedir; güncel davranış SANAL_POS.md’dedir.
Telefon kart başına isteğe bağlı varsayımıdır, kullanıcıya soruldu; yanıt yok. Banka SMS hedefi değişmez.
Gerçek kart fotoğrafı CVV içerir; kod/test/Git/yayın/önizlemeye koyma. CVV/OTP/fotoğraf/ham OCR saklanmaz.
Otomatik kart aktarımı/SMS başlatma uygulanmış değildir; sağlayıcı sözleşmesi doğrulanmadan ödeme
alanlarını/uçlarını tahmin etme. Aşağıdaki eski sürüm kayıtları tarihsel bağlamdır, güncel özellik değildir.

**2026-10-03 seçilen cariyle giriş:** Kullanıcı “POS’u aç” ile doğrudan seçilen carinin hesabının
açılmasını istedi. Düğme numara/kullanıcı/türetilen giriş şifresini sabit HTTPS giriş sayfasına yerel
HTML formuyla POST eder; yanıt yeni sekmede açılır. Boş `__VIEWSTATE` postback tanımasını sağlar;
imzalı sağlayıcı durum değeri kopyalanmaz. CSP yalnızca bu giriş adresine form gönderimine izin verir.
Kaydedilen cari otomatik seçilir. Elle bağlantı/kopyalama alternatifi korunur. Giriş sonucu/oturum
okunamaz; doğru firma kontrolü kullanıcıya aittir. İki yapay cariyle tarayıcı gönderimi taklit POS’ta
doğrulandı, gerçek cariyle giriş ve ödeme yapılmadı. Gerçek giriş kullanıcıyla denenmelidir.

**2026-10-03 PIN düzeltmesi:** Yeni kasalar cihaz anahtarlı v2 zarf kullanır, günlük açılış 4–12 rakam PIN
veya uzun parola, boşta kilit 30 dakika. Taşınabilir v1 yedek ayrı uzun parola ile yeniden şifrelenir;
cihaz HMAC anahtarı yedeğe konmaz. Eski v1 kasa/yedekler okunur; parola değişikliği v2’ye taşır.
Seçili cari kimliği yalnızca aynı oturumda kilit/açılış boyunca kalır; açık POS sekmesine müdahale yok.
Ayrıntı ve sınırlar SANAL_POS.md’de.

**2026-10-03 Sanal POS:** Kullanıcı eklenti istemiyor; elle cari adı/numarası kaydetmek ve gerektiğinde
alanları elle doldurmak istiyor. İlk sürüm ayrı Sanal POS sekmesi, şifreli yerel cari kasası,
arama/ekleme/düzenleme/silme, sabit giriş bağlantısı, açık kopyalama düğmeleri, şifreli yedek/ekleme ve
parola değiştirmedir. Kart/fotoğraf/CVV/banka şifresi/ödeme tutarı/sonuç alanı yoktur. Giriş veya ödeme
yapılmadı; bağlantı tarayıcı testinde taklit sayfaya yönlendirildi. POS oturumu otomatik doğrulanamaz;
doğru firma adı/numara kontrolü kullanıcıya aittir. Gerçek giriş bilgilerini koda/teste/belgeye ekleme.
Fotoğraftan okuma ve ödeme/hata geçmişi sonraki ayrı aşamalardır; tamamlandı diye sunma.

**2026-10-02 oturum devri:** Kullanıcı plandaki uygulanabilir işleri tamamlamayı, genel tarama ve
hata düzeltmelerini yetkilendirdi. Önceki oturumda depo/yayın komutlarının asistan tarafından
çalıştırılmasına açık yetki verilmiştir; aynı işlemler için yeniden izin isteme. Kullanıcı ayrıldı;
sonuçları dönüşte sade Türkçeyle anlat.

Tamamlanan yeni işler:

- Drive bağlantısı: sadece `drive.file`; erişim belirteci yalnızca oturum belleğinde. Kullanıcı kendi
  Google Cloud istemci kimliğini Ayarlar’a girer. Aynı kimlik diğer bilgisayarda da kullanılmalıdır.
- Rapor ve önceki hâlinin ayrı Drive kopyaları; isteğe bağlı LED dosyaları, Drive’dan rapor açma.
  Ayar/geçmiş kopyaları; geçmiş birleştirme, ayarları inceleyip açık seçimle geri getirme.
- Yedekler ve geçmiş IndexedDB aktarımı tamamlanınca başarılı sayılır; yedek verisi/liste/silme
  atomiktir. Yedek saklanamazsa dosyanın üzerine yazılmaz. Yazmadan önce içerik yeniden kontrol edilir.
- 25 MB sınırı dosyayı okumadan önce uygulanır; ZIP açılma sınırları; makroları kaybetmemek için
  `.xlsm` reddedilir. CSV formül koruması; ayar doğrulaması; ilk dosya seçme/bırakma olayının
  motor yükleme beklemesi yüzünden kaybolması önlendi; çift işlem kilidi eklendi.
- `Birim` başlığı olan sayımda KG dışındaki/boş birim reddedilir. Aynı adın hazır kilogramı toplanır.
  Adet/koli ağırlığı veya farklı ürün adları otomatik tahmin edilmez.
- ExcelJS 4.4.0 sabit kaldı. Yalnızca kullandığı UUID bağımlılığı 11.1.1’e override edildi;
  bilinen açık taraması ve gerçek dosya testleriyle doğrulandı.
- Yayın araçları resmi güncel release SHA’larına, runner Ubuntu 24.04’e sabitlendi; uygulama Node 22’de kalır.

Önceki tamamlanan işler (2026-10-01): CAL bup adı/yayın adresi, dört dosyanın içerikten tanınması,
aynı ürünün adetli/kolili hazır kilogram toplamı. Gizli eski araç arşivi
`alibedirhan/Bup_Excel_Rapor_Eski`; temizlenmiş 8 commit doğrulandı. Özgün geçmiş ve yerel dosyalar
`ornekler/eski_arac_arsivi/` içinde git dışında korunur.

**Sıradaki somut işler:**

1. Kullanıcı kendi Google hesabıyla OAuth istemcisini kurmalı ([DRIVE.md](docs/DRIVE.md)); asistanın
   hesabına erişim yoktur. Canlı Google izin penceresi, gerçek yükleme ve ikinci bilgisayarda açma
   kullanıcıyla doğrulanacak. Testlerde OAuth ve Drive taklit edildi; gerçek Google testi diye anlatma.
2. Karma ambalaj sayım örneği hâlâ yok. `Miktar` kilogram mı, adet/koli mi; ürün adları aynı mı,
   ağırlık bilgisi hangi sütunda? Örnek/yanıt olmadan dönüşüm/eşleme kuralı ekleme.
3. Envanter, bakiye ve palet/kasa için LED örnekleri ve elle doldurulmuş beklenen rapor gerekir.
   Palet/kasa hedefi: haftalık günlük satışları cari adına göre toplamak. Uydurma kolon/kural uygulama.
4. Windows Excel’de yeni sürüm çıktı/kayıt ve açık Excel dosyasına yazma denemesi kullanıcıyla yapılır.

Şirket verileri yalnızca `ornekler/` içinde kalmalı; testler sentetik olmalı. Tarayıcı ekran görüntüleri,
indirilen raporlar ve geçici tarama çıktıları proje dışında `/tmp/` içinde tutulur; commit’e girmez.
