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
3. **ExcelJS yalnızca `motor.ts` üzerinden yüklenir** (dinamik içe aktarma, ~940 KB ayrı parça).
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

**Güncel sürüm:** 1.4.0. Son çalışma: [docs/OTURUM_NOTU.md](docs/OTURUM_NOTU.md).
Google Drive kurulum/teknik kararlar: [docs/DRIVE.md](docs/DRIVE.md).
Sanal POS cari kasası ve sınırlar: [docs/SANAL_POS.md](docs/SANAL_POS.md).

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
