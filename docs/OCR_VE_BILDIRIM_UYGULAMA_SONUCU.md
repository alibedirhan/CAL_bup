# OCR ve bildirim düzeltmeleri — 1.5.0

4 Ekim 2026. Kullanıcının üç aşamayı sırayla uygulama isteğiyle, araştırmadaki 20 bulgunun
üretim kodu ve regresyon karşılıkları tamamlandı. Bu belge yerel/sentetik kabul sonuçlarını
anlatır; gerçek kart sahipliği, banka ödeme sonucu, PCI uygunluğu veya Windows kabulü iddia etmez.

## Aşama kapıları

| Aşama | Uygulanan temel değişiklik                                                                   | Kabul kanıtı                                                       |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | Form kapsamlı hatalar, görünür başarı, ayar/depo/indirme kesinliği, yönetilen OCR worker     | 329 test; 16 tarayıcı senaryosunun her biri geçti                  |
| 2     | Geçici önizleme, kırpma/döndürme, sınırlı OCR denemeleri, açık aday inceleme/uygulama        | 335 test; 35 tarayıcı senaryosu geçti, 17 fotoğraf referansı dahil |
| 3     | Ortak işlem denetimi, Drive/rapor/yedek/pano kapsamı, kurtarma ekranı ve yayın regresyonları | 341 test; 49 tarayıcı senaryosu geçti                              |

Aşamalar sırayla uygulanıp kapı kontrollerinden sonra ilerletildi. Birinci aşamadaki tarayıcı
kontrolünde bir assertion, hiç bildirim olmaması durumunu yanlış denetliyordu; assertion
bildirim sayısını denetleyecek biçimde düzeltildi, ilgili senaryo geçti. Son ortak çalıştırma
49 senaryonun hepsini birlikte doğruladı.

## Bulgu kapanışları

| Bulgu | Son uygulama                                                                                                                     | Kalıcı kanıt                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| O-01  | Dört yön, sınırlı küçük eğiklik analizi, geçici kontrast dönüşümü; kullanıcı kırpma/döndürmesi                                   | `fotograf.spec.ts`: 90/180/270°, 12° eğiklik, koyu/düşük kontrast, kırpıp yeniden okuma           |
| O-02  | PAN/tarih önce ayrılır; kısa rakam satırları kontrollü birleştirilir, tek rakam ay ve etiketli bitişik tarih okunur              | `kartMetni.test.ts`, aynı satır/bölünmüş PAN/bitişik tarih gerçek OCR                             |
| O-03  | Numara ve tarih adayları ayrı seçimler; numara adayı sıra+ilk altı+son dört ile ayırt edilir, seçilen numara tam karşılaştırılır | İki tarih matrisinde seçim yapılmadan uygulama yok                                                |
| O-04  | Okuma formdan ayrı taslak; açık onayla PAN ve tarih birlikte uygulanır, eksik alan açık uyarıdan sonra boşaltılır                | Boş/kısmi fotoğraf, eski tarih, elle değişiklik regresyonları                                     |
| O-05  | Native Worker referansı ilk oluşturma anından denetleyiciye aittir; model yüklenmese de sonlandırılır                            | Model/worker/WASM 404, bekleyen modelde iptal/süre: aktif worker 0                                |
| O-06  | Denetim/hazırlama/model/okuma evreleri, ayrı iptal/süre dolması/hata sonuçları                                                   | `bildirim.spec.ts` ve bileşen arızaları                                                           |
| O-07  | Yalnızca doğrulanmış adayın satır konumu ve güveni çıkar; kesilmiş kenar adayları reddedilir, geçersiz rakam açıklanır           | Gerçek OCR karşılaştırması, ham metin dışarı çıkmayan adaptör; aday güveni kullanıcıya gösterilir |
| O-08  | Türkçe fotoğraf düğmesi, geçici önizleme, düzeltme, yeniden okuma/kaldırma; URL kaynak temizliği                                 | Kaldırma/rota çıkışı sonrası önizleme URL'si açılamaz                                             |
| B-01  | Kaydetme sonucu formun kendisine döner; modalın arkasında hata bırakılmaz                                                        | Yinelenen kart ve depo yazı reddi modal içinde görünür/odaklı                                     |
| B-02  | Odaklanıp görünür alana gelen hata özeti; kart/cari girdileri `aria-invalid`/açıklama bağlantıları                               | Boş form ve hatalı PAN görünür alan/odak denetimi                                                 |
| B-03  | Uygulama genelinde tek sabit bildirim alanı; başarı odağı çalmaz                                                                 | 390 piksel görünümde başarı ekran içinde; birbiri üstüne bildirim yok                             |
| B-04  | Geçersiz ayar taslağı ve açıklaması korunur; son geçerli ayar sessiz değiştirilmez                                               | Geçersiz tolerans ve alan doğrulaması                                                             |
| B-05  | localStorage yazısı doğrulanır; kalıcı ve yalnızca oturum sonucu ayrılır; Drive istemcisi başarısızsa durur                      | Engellenmiş ayar kaydı, yenilemeden sonra eski değerin korunması                                  |
| B-06  | Kesin depo okuması ve şema denetimi; yükleniyor/boş/hata/yeniden dene ayrı                                                       | Engellenmiş ve bozuk geçmiş boş liste sayılmaz                                                    |
| B-07  | Eksik/bozuk yedek baytı açık hata verir                                                                                          | Listesi var, içeriği yok yedek testi                                                              |
| B-08  | Dosyaya kapanışı tamamlanan yazı ile tarayıcıya indirme isteği ayrı metinler                                                     | Dosya yazı iptalinde kapanış yapılmaz; indirme metinleri ve gerçek indirme olayları               |
| B-09  | Taşınabilir yedek doğrulaması ayrı bağlam; günlük kasa parolası sözü kullanılmaz                                                 | Saf yedek parola doğrulaması, eski kasa ve taşınabilir yedek regresyonları                        |
| A-01  | Saf `IslemSonucu`: tamam/doğrulama/hata/iptal/belirsiz; kod, kapsam ve kimlik; yazı belirsizliği otomatik tekrarlanmaz           | `islemSonucu.test.ts`, `islemOturumu.test.ts`, gerçek depo reddi                                  |
| A-02  | Tek işlem/iptal/süre/nesil denetleyicisi; Drive sinyali, geç OAuth/pano sonucu korunması, React hata sınırı                      | Drive ağ/süre/yazı arızaları, geç OAuth/pano, rota/worker ve kurtarma testi                       |
| A-03  | Testler ekran içinde bulunmayı, odak/örtülmeyi, kaynak temizliğini ve OCR eşitliğini ölçer                                       | CI mevcut `kontrol` + `test:tarayici` kapısından bütün yeni senaryoları çalıştırır                |

Bulgu kapanışı doğrulanmış davranışın düzeltildiği anlamındadır; bütün olası fotoğraf, tarayıcı,
servis veya kullanıcı eylemleri için hatasızlık garantisi değildir.

## OCR karşılaştırması ve ölçüm sınırı

Araştırma raporundaki aynı 15 sentetik görüntü yeniden çalıştırıldı:

| Sonuç                                     | 1.4.0 araştırma | 1.5.0 tekrar |
| ----------------------------------------- | --------------- | ------------ |
| Numara ve tarih tek/eksiksiz/doğru        | 9               | 12           |
| Kısmi alan                                | 2               | 0            |
| Boş sonuç                                 | 3               | 2            |
| Birden fazla geçerli tarih, seçim gerekli | 1               | 1            |
| Yanlış aday                               | 0               | 0            |

Önemli düzeltme: ilk araştırmanın 90°/270° görüntülerinde tuval boyutu değişmediği için rakamlar
kadrajdan kesilmiştir. Bu iki örnekte kayıp rakam yeniden üretilemez; artık kenara değen hatalı
adaylar da reddedilir. Son karşılaştırmada boş kalmaları beklenen güvenli sonuçtur. Döndürme
başarısı ayrıca **tuval boyutu korunarak** üretilen 90°/180°/270° görüntülerle kalıcı testte doğrulandı.

Kalıcı genişletilmiş matris 17 okunabilir referans içerir: 16 tanesinde tek doğru PAN/tarih;
birinde doğru PAN ve iki gerçek tarih seçeneği. Boş/yanlış sonuç bu referans kümesinde 0.
Boş, kısmi, bozuk ve fazla piksel görüntülerin güvenli davranışı ayrıca test edilir.
Bu sayılar gerçek dünya başarı oranı değildir. Ağ gecikmesi/hardware süresi genellenmez.
Gerçek müşteri fotoğrafı kullanılmadı; kullanıcı ekranındaki başarısız fotoğrafın fiziksel sebebi bilinmiyor.

Etiketsiz `1235` gibi dört rakam otomatik tarih kabul edilmez; CVV veya başka sayı olabilir.
`VALID THRU 1235` gibi açık bağlamdaki bitişik tarih desteklenir. Rakam düzeltme/uydurma,
Luhn'a uydurmak için rakam değiştirme ve belirsiz tarihte otomatik seçim yapılmaz.

## Son mimari

- Saf kurallar: `cekirdek/islemSonucu`, `posFormDenetimi`, `kartMetni`, `gecmis`.
- Tarayıcı yaşam döngüsü: `platform/islemOturumu`; enjekte edilen işlem işlevine AbortSignal verir.
  POS'un atomik şifreli depo/nesil denetimi korunur; aynı saf sonuç sözleşmesine bağlanır.
- OCR: `platform/ocr/goruntu`, `motor`, `alanlar`; UI taslağı `useKartFotografi` ve `FotoAdaylari`.
  En fazla bir worker, beş deneme, toplam 90 saniye; tuval kenarı en fazla 2400 piksel,
  giriş dosyası 10 MiB/20 MP. Önizleme ve adaylar yalnızca form ömründeki bellektedir.
- Ortak UI: `useIslem`, `IslemBildirimi`, `FormHatasi`, `BildirimAlani`, `HataSiniri`.
  Hata ilgili formdadır; genel bildirim tek alandadır; ham istisna/React yığını günlükte tutulmaz.
- Drive: işlem sinyali istek/çok adımlı akış boyunca taşınır. Ağ isteği 30 saniye,
  genel akış 120 saniye sınırında. İptal edilmiş Google yanıtı token açamaz.
- Dosya akışı: yedek zorunluluğu/son içerik kontrolü korunur. İptal yazıcıyı abort eder;
  kapanış sırasında sonucu bilinmeyen yazı kesin geri alınmış sayılmaz.
- Depo kontrol ekranı rota değişiminde dosyalarını korumak için bağlı kalır. Kendi devam eden
  işlemi başka sayfaya mesaj taşımaz; kullanıcı dönüp sonucu görebilir veya durdurabilir.
  POS ve Ayarlar rota çıkışında kendi geç sonuçlarını iptal eder.
- Ödeme ve rapor hesap kuralları değiştirilmedi; yeni framework/event bus veya sunucu eklenmedi.
  Değişen/yeni kaynak dosyaları yaklaşık 400 satır sınırının altında.

## Yayın ve kabul

Yerelde `npm run kontrol`: tip, lint, biçim, 27 dosya / 341 test ve üretim derlemesi başarılı.
`npm run test:tarayici`: 49 senaryo başarılı. Bunlar Linux Chromium denemeleridir.
Gerçek dosyalı 17 altın test yalnızca yerelde bulunur; CI'da 25 dosya / 324 test geçer,
2 dosya / 10 altın test örnek dosyalar bulunmadığından atlanır. Kamuya gerçek dosya konmaz.
`npm audit`: raporlanan bilinen açık 0; bu tüm güvenlik risklerinin yokluğu anlamına gelmez.

Sürüm 1.5.0 `main` yayınına hazırlanmıştır. Actions aynı iki kontrolü geçmeden Pages yayını yoktur.
Canlı kabul: yeni izole tarayıcıda sürüm/varlık erişimi, yapay cari, yerel OCR inceleme/uygulama,
kart kaydı ve yenileme sonrası maskeleme/kalıcılık; gerçek banka veya Google isteği yapılmaz.

Windows Chrome/Edge, kullanıcının gerçek fotoğrafı, gerçek Google hesabı ve bankadaki cari/ödeme
sonucu bu geliştirme ortamında doğrulanamaz. Kullanıcıyla son kabul gerekir. Günlük PIN'siz tercih,
aynı tarayıcıya erişim sınırı ve manuel firma kontrolü devam eder. Otomatik kart aktarımı ve banka
SMS başlatma için sağlayıcı sözleşmesi hâlâ gerekir; bu sürüm bunları eklemez.

## Kullanıcı akışı

1. Siteyi Ctrl+F5 ile yenileyin; sürümün 1.5.0 olduğunu kontrol edin.
2. Sanal POS → cari → Kart ekle → Fotoğraf seç.
3. Gerekirse döndür/kırp; bulunan numara ve tarih seçeneklerini fotoğrafla karşılaştırın.
4. Fotoğraf kontrolünü işaretleyip “Kontrol ettiğim alanları uygula” deyin.
5. Eksik alanları elle tamamlayın; kart adı/cari kontrolü ardından kartı kaydedin.

Araştırma: [ana rapor](OCR_VE_BILDIRIM_ARASTIRMA_RAPORU.md),
[ilk araştırma kanıtı](OCR_VE_BILDIRIM_KANITLARI.md). Bunlar 1.4.0 bulgularının tarihsel kaydıdır.
