# 1.6.1 — kart incelemesi ve POS yardımcısı

## Kullanıcının istediği akış

Bu araç yalnızca kullanıcının kendi iş akışı içindir. Cari kalıcı kimliğine bağlı kart seçilir;
fotoğraftan çıkan numara/tarih önce incelenir, açık onayla forma uygulanır. Seçilen kartla POS açılır,
cari numarası karşılaştırılır, yalnızca kart numarası ve son kullanma doldurulur.
CVV, tutar, bankanın doğrulaması ve ödeme düğmesi kullanıcıda kalır. SMS gönderme otomasyonu yoktur.

Web sayfasının başka sitenin formuna doğrudan erişimi yoktur. Bu sınır için projede geliştirilen,
kaynakları açık ve dar yetkili bir MV3 Chrome/Edge yardımcısı kullanılır. Sağlayıcının ödeme API'si
ve alanları tahmin edilmez; kullanıcı boş alanları bir kez açıkça tanıtır.

## Kurulum

1. Sanal POS'ta bir kart seçin, “Edge yardımcısını bir kez kur” bölümünü açın.
2. Windows kolay kurulum dosyası ZIP'i doğrulayıp `%LOCALAPPDATA%\CALbup\POSYardimcisi` klasörüne
   hazırlar ve tarayıcının eklenti sayfasını açar; son yükleme onayı kullanıcıdadır. Elle alternatif: ZIP'i indirin ve kalıcı bir klasöre çıkarın. Edge'de `edge://extensions` açın; geliştirici modu,
   “Paketlenmemiş öğe yükle” ile `manifest.json` bulunan klasörü yükleyin.
3. Gerçek kart yazmadan POS ödeme ekranını açın. Yardımcı panelinde tek tarih veya ayrı ay/yıl akışını seçin.
   Görünen vergi/TC numarasını, boş kart numarası alanını ve boş tarih alanını/alanlarını sırayla tıklayın.
   Seçim sırasında ödeme düğmelerinin tıklamaları engellenir. Escape veya iptal seçimi sonlandırır.
4. CAL bup'ı **aynı tarayıcıda** yenileyin; “Yardımcı bağlantısını kontrol et” ile kart göndermeden
   bağlantıyı doğrulayın. CAL bup'ta cari ve kartı seçin; “Seçili kartla POS’u aç” düğmesini kullanın.
   Dolan bilgileri kontrol edin; CVV ve tutarı kendiniz girin.

Alan tanıtımı yalnızca seçici, HTML etiketi ve alan türünü saklar; kart/firma değerini saklamaz.
Kurulum belirli HTTPS sayfasına bağlıdır; başka URL veya değişmiş alan kabul edilmez.
Panel küçültülebilir. Eklenti kaldırma ve güncelleme bilgisi ZIP içindeki `KURULUM.txt`'dedir.
Kurumun eklenti kurulum politikası aşılmaz.

## Katmanlar

| Katman                                    | Sorumluluk                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `cekirdek/posAktarimi.ts`                 | Cari/kart bağı, asgari veri, izinli adres, kurulum şeması                   |
| `platform/posYardimcisi.ts`               | Tek istek kimlikli, süreli ve iptal edilebilir pencere mesajı portu         |
| `arayuz/sayfalar/pos/PosKartAktarimi.tsx` | Açık başlatma, görünür durum/hata, iptal ve kurulum yönergesi               |
| `eklenti/kopru.ts`                        | Yalnızca uygulamanın üst çerçevesindeki kaynak/origin kontrolü              |
| `eklenti/arkaPlan.ts`                     | Seri iş kuyruğu, sekme bağlama, geçici kart, cari karşılaştırması           |
| `eklenti/alanlar.ts`                      | Görünür alan, rol etiketi, tür/uzunluk, cari ve bütün yazıların ön denetimi |
| `eklenti/kurulum.ts`                      | Kullanıcının boş alan tanıtımı, ödeme tıklamalarını engelleme               |
| `eklenti/pos.ts`                          | Sabit giriş formu, tanıtılmış alan adaptörü, tek kullanım sonucu            |
| `tools/posEklentisi.ts`                   | Üç bağımsız IIFE, MV3 manifest ve aynı sürümlü ZIP                          |

Çekirdek Chrome/React/DOM'a bağımlı değildir. Eklenti depoyu veya OCR'ı bilmez; uygulama ödeme DOM'unu
bilmez. Alanları kontrol eden adaptör saf aktarım sözleşmesini tüketir; sunucu eklenmez.

## Güvenlik sınırları

- Manifest yalnızca `storage` ve `alarms` yetkilerini ister; içerik betikleri uygulama yolu ile
  tam POS HTTPS alan adında, yalnızca üst çerçevede çalışır. Genel sekme, pano, indirme, çerez,
  ağ yakalama, tüm siteler, dış mesajlaşma veya uzaktan betik yetkisi yoktur.
- Arka plan ağ çağrısı yapmaz. CSP uzantı sayfalarında `connect-src 'none'` kullanır.
  Normal POS sayfasının kendi ağ bağlantılarını eklenti yönetmez.
- Kart yalnızca tarayıcı oturum belleği deposunda, en fazla 180 saniyelik işte bekler (1.12.0; önce 120).
  `storage.local` yalnızca alan yapılandırması içerir. Her iki depoya doğrudan erişim güvenilir
  eklenti bağlamıyla sınırlıdır. Kart URL, pano, günlük, hata, ZIP veya rapora yazılmaz.
- Kaynak uygulama sekmesi ve yardımcının açtığı hedef POS sekmesi eşleşmelidir. Aynı alan adlı
  başka sekmeye kart teslim edilmez. Görünen vergi/TC numarası eşleşmeden arka plan PAN teslim etmez.
- Teslimden **önce** geçici kart kuyruktan silinir. Teslim başarısızsa otomatik tekrar yoktur.
  Başarı yalnızca bütün değerler yazılıp yerel kontrol sonucu döndüğünde bildirilir; ödeme başarısı değildir.
- Cari/kart/veri/rota değişimi, kaynak/hedef sekmenin kapanması, izinli siteden ayrılma ve süre sonu
  bekleyen kartı iptal eder. POS sekmesine geçişte uygulamanın açık bilgileri gizlenir; izin verilen
  aktarım bunun yüzünden kesilmez. Süre kontrolü arka plandadır; görünür uygulama zamanlayıcısına bağlı değildir.
- Girilmiş farklı PAN/tarih ezilmez; değişmiş, görünmeyen, salt okunur, belirsiz veya rol etiketi
  uygun olmayan alan reddedilir. CVV/tutar/SMS/şifre etiketleri her yazmadan önce tekrar engellenir.
  Bütün alanlar doğrulanmadan yazılmaz; başarısız yerel doğrulamada eski değerler geri konur.
- Ödeme ekranında yalnızca yerleşik `value` yazıcısı kullanılır. `input/change/click/submit` olayları
  üretilmez. Böylece alan değişim olayına bağlı doğrulama/SMS düğmesi eklenti tarafından tetiklenmez.
  Giriş formuna POST bunun ayrı ve yalnızca tam `/login.aspx` adresindeki istisnasıdır.
- İptal daha önce doldurulmuş POS alanlarını silmez. Kullanıcı açık POS bilgilerini kontrol etmelidir.
  Tarayıcı/işletim sistemi belleğinin mutlak silinmesi veya ele geçirilmiş POS sayfasına karşı koruma
  iddia edilmez. Aynı uygulama origin'indeki kötü amaçlı kod, profili açabilecek güven sınırındadır.

## OCR düzeltmesi

Yapay kabartmalı ve desenli görüntülerde tarih bulunurken PAN bulunamaması yeniden üretildi.
Beş genel yön/kontrast denemesinden sonra, yalnızca PAN yoksa aynı fotoğrafın seçilmiş yönünden
dört sınırlı numara şeridi denemesi yapılır: renkli, koyu, açık ve kabartma eşiği. Sayfa bölümleme
tek satır ve rakam sınırlıdır. Toplam üst sınır dokuz deneme/90 saniyedir; Luhn için rakam uydurulmaz.
Numara kanıtının konumu şerit başlangıcına göre düzeltilir; farklı fotoğraflar/yönler birleştirilmez.

Okunamayan numara inceleme alanında elle tamamlanabilir. Geçersiz numara onayı engeller;
değişiklik fotoğraf kontrolünü sıfırlar. Açık onaydan sonra numara/tarih birlikte uygulanır ve numara
girdisine odaklanılır. CVV çıkarma veya saklama eklenmedi. Dikey dört ayrı numara grubunun güvenilir
birleştirilmesi desteklenmiyor; bu durumda açık elle tamamlama kullanılır.
Uzun OCR adayı geçerli kısa PAN ve 3/4 ek rakama ayrılabiliyorsa, CVV birleşmesi olabileceği için
Luhn geçse bile aday reddedilir; hiçbir kısa parça çıkarılmaz. Bu belirsizlikte elle giriş gerekir.

## Doğrulama ve kalan kabul

Son yerel kabul (1.6.1): `npm run kontrol` (29 dosya/349 test, tip, lint, biçim, derleme),
`npm run test:tarayici` (78 senaryo), `npm audit` (bilinen açık 0), `git diff --check` geçti.
Yapay veride açık/koyu/dar uygulama ve yardımcının panel küçültmesi görsel olarak incelendi.

Kalıcı testler: `tests/birim/posAktarimi.test.ts`, `tests/tarayici/eklenti.spec.ts`,
`eklentiPaket.spec.ts`, `numaraOkuma.spec.ts`. Gerçek Chromium'da üretim MV3 paketi yüklenir;
uygulama ve POS adresleri yerel dosya/sentetik HTML ile karşılanır. Ağ için ayrıca çalışmayan yerel
proxy kullanılır; eşleştirmeden kaçan bağlantı canlıya gidemez. CVV/tutar ve ödeme/SMS dinleyicileri
özellikle yapay ekranlara konur, tüm testlerde işlem sayıları sıfır olmalıdır.

İlk test düzeneğinin 302 yanıtı tarayıcının sonraki gezinmesini route dışında bırakmış ve yalnızca
uydurulmuş ödeme sayfasına bir GET gerçek sağlayıcıda 404 almıştır. Müşteri kartı, gerçek giriş veya
ödeme/SMS gönderilmedi. Düzenek ayrı yakalanan sayfa gezinmesine çevrildi ve kapalı proxy ile ikinci
ağ sınırı eklendi. Tam regresyon bu düzeltilmiş düzenekte çalıştırılır.

Müşterinin fotoğrafı ve kartı bu çalışmada kullanılmadı. OCR görüntüleri ve kartlar sentetiktir.
Gerçek Windows/Edge, sağlayıcının oturum sonrası HTML'i ve gerçek fotoğraf başarısı doğrulanmış
sayılmaz. POS'ta görünen vergi/TC numarası yoksa, alanlar ayrı iframe'deyse veya sayfa olay gerektiriyorsa
otomatik doldurma desteklenmez; uygulama kullanıcıya durumu gösterir, elle akış korunur.
Sağlayıcının otomasyon izni, PCI/KVKK uyumu ve sözleşme uygunluğu bu testlerle kanıtlanmaz.

## 1.6.1 bağlantı ve arıza taraması

Yardımcı kurulu değilken hata sonrası kontrol mesajı temizlenir ve kurulum yönergesi açılır.
Aktarımdan önce protokol 2 / sürüm biçimi doğrulanır; yerel adresler açıklamayla reddedilir.
Giriş alanı değişimi/tekrar giriş sonucu, kaybolmuş iş ve belirsiz teslim açık hataya dönüşür.
Teslim sonrası onay en fazla 5 saniye beklenir; otomatik kart tekrarı yoktur. Saat geri alma geçici
kartı düşürür; uygulama/POS süre ölçümü monotonic'tir. Başka uygulama sekmesinde bekleyen iş varken
yeni iş açılamaz. Önceki alan kaydı yeni seçim talimatını ezmez; alan silme arızası görünürdür.
Windows CMD kendi ZIP'ini SHA-256 ile doğrular, yalnızca dosyaları hazırlar; sessiz tarayıcı kurulumu
veya politika değiştirme yapmaz. Windows'ta çalışması henüz denenmedi.
Detaylı kanıt, testler ve sınırlar: [tarama raporu](POS_YARDIMCISI_TARAMA_RAPORU.md).

## 1.8.0 görünürlük sınırı

Tanıtılan alanın üst kapsayıcıları da görünür ve etkin olmalıdır. Opaklığı sıfır, hidden,
inert, aria-hidden veya content-visibility:hidden kapsayıcı içindeki alan/firma ile aktarım
başlamaz. Devre dışı fieldset içindeki girdi reddedilir. Beş kapalı ağ MV3 regresyonunda alanlar
boş kalır; ödeme/SMS/dış ağ isteği sıfırdır. Bu kontrol sağlayıcı arka uç ortak oturumunu veya
kurum sözleşmesini doğrulamaz. Gerçek müşteri kartı/fotoğrafı ile test yasağı sürer.

## 1.12.0 mesaj ve uyumluluk

Kart yalnız oturum belleğinde en fazla 180 saniye bekler (girişten sonra ödeme sayfasına geçiş için).
`storage.local` alan seçicilerine ek olarak yalnız panelin küçük/büyük tercihini tutar; test bunun
dışında anahtar ve kart/cari değeri bulunmadığını denetler. Başarısız giriş, girişten sonraki ana sayfa,
`AAYY`/`AA/YYYY` tarih ve panel tercihi `tests/tarayici/eklentiAkis.spec.ts` ile, kurallar
`tests/birim/posYardimciKurallari.test.ts` ile sınanır. Yeni ZIP kurulana kadar eski yardımcı çalışmayı
sürdürür; program farklı sürümü bildirir.

## 1.12.1 kutu tanıma

Gerçek ödeme ekranında başlıklar (“S.K.T”, “CVV”, “Tutar”) kutuya bağlı etiket olmayabilir. Yardımcı
artık yalnız o kutuyu içeren üst kapsayıcıların ve hemen önündeki başlık öğesinin yazısını da okur.
Tanınmayan kutuda panel nedeni yazar; kullanıcı açıkça onaylarsa kutu `elle: true` ile kaydedilir.
CVV/tutar/şifre/para birimi yazılı, gizli, kapalı, uygunsuz türde veya kısa kutular onaylanamaz; doldurma
anında da aynı engeller yeniden denetlenir. Elle kopyalama yolu her zaman alternatiftir.
Denemeler: `tests/tarayici/eklentiTanitma.spec.ts` (yapay düzen, ASP.NET `$` adları, onay/ret, sonradan
CVV'ye dönen kutu).

## 2.0.0 — tek seferlik kurulum

Saha testinde alanlar her caride yeniden tanıtılmak zorunda kalıyordu: kimliği olmayan kutular sayfadaki
sırasıyla saklanıyor, carinin ekranındaki tek satır fark bu sırayı kaydırıyordu; kurulum da sayfa adresine
(büyük/küçük harf dahil) bağlıydı. 2.0.0'da:

- **Site geneli kurulum** (`cekirdek/posKurulumu.ts`, `storage.local` `kurulum`): bir kez tanıtılır, bütün
  cariler ve POS adresleri için geçerlidir. Eski sayfa adresli `alanlar` kaydı ilk okumada dönüştürülür.
  Bilerek silme `kurulum: null` olarak kalır.
- **Sağlam kutu bulma** (`eklenti/alanlar.ts`): kimlik → `name` → sayfadaki sıra ile saklanır; bulunurken
  seçici kaydıysa `name`, sonra rakamsız başlık yazısıyla (“kredi karti numarasi”, “s.k.t”) tek aday
  aranır. Her adayda görünürlük/engelli alan/tür/uzunluk denetimi yinelenir.
- **Firma numarası kendiliğinden** (`eklenti/firma.ts`): içinde “firma” geçen ve tek 10–11 haneli numara
  taşıyan en küçük görünür yazı(lar); farklı numaralar varsa okunmuş sayılmaz. Okunamazsa tanıtmada
  kullanıcıya sorulur. Seçilen cariyle birebir eşleşmeyen numarada hiçbir şey yazılmaz (değişmedi).
- **Tek “Alanları tanıt” akışı** (`eklenti/tanitma.ts`): kart numarası → S.K.T (liste veya 2 karakterlik
  kutuysa ayrıca yıl) → Ad Soyad (atlanabilir) → CVV (atlanabilir). Aynı kutu ikinci kez seçilirse
  “zaten … olarak seçtiniz” denir. Güvenlik nedeni boşluk uyarısından önce gösterilir.
- **Panel** (`eklenti/panel.ts`): kurulum varsa “Kurulum tamam … yeniden tanıtmanız gerekmez”;
  “Kurulumu yenile”, onaylı “Kurulumu sil”, “Ekran yapısı raporu” (`eklenti/tanilama.ts`: tür/kimlik/ad/
  uzunluk/başlık; değer yok, rakamlar `#`, e-posta gizli). Giriş sayfasında tanıtma düğmesi yoktur.
- **Roller:** CVV yalnız `cvv` rolüne yazılır, diğer rollerde engellidir; tutar/şifre/SMS/PIN/para birimi
  her rolde engellidir (`eklenti/alanKurallari.ts`). Ad Soyad kutusunda başka ad yazılıysa yalnız o kutu
  atlanır; numara/tarih/CVV'de farklı bilgi varsa hiçbir şey yazılmaz. Olay üretilmez (değişmedi).
- **Eski sekme uyarısı:** Yeni aktarım başlarken yardımcı, gördüğü diğer POS sekmelerine (`tabs.sendMessage`,
  ek izin gerekmez) “bu sekme önceki cariye ait olabilir, buradan ödeme yapmayın” uyarısı gösterir.
- **Giriş:** lisans no/şifre programdan gelir (cariye özel olabilir). `/Login.aspx?ReturnUrl=…` de giriş
  sayfasıdır. Ret mesajı 10 haneli numarada TC ipucu ve `neden: 'giris'` taşır; cari farkı `neden: 'cari'`
  ve her iki numaranın son dört hanesiyle bildirilir.
- **Protokol 3, ayrı sürüm:** Yardımcının sürümü `src/cekirdek/posYardimciSurumu.json`'dadır ve programın
  sürümünden bağımsızdır. Derleme, yardımcı kodunun SHA-256 özetini `tools/posYardimciOzeti.json` ile
  karşılaştırır; eklenti kodu değişip sürüm artırılmadıysa derleme durur. Yardımcı kodu değişince:
  sürümü artırın, `npm run yardimci:ozet` çalıştırın. Windows kurulum adresi `?v=sürüm-özet` taşır.
- **Güncelleme:** Kaldırmadan aynı klasöre çıkarıp “Yeniden yükle”; kurulum korunur. Kaldırılırsa program
  kendi kopyasını geri verir.

Testler: `tests/tarayici/eklentiSaha.spec.ts` (iki cari tek kurulum: kimliksiz kutular, fazladan satır,
eksik e-posta, `/Index.aspx`; eski sekme uyarısı; CVV'nin hiçbir depoda kalmaması; ret → düzeltme;
özel giriş; yeniden kurulumda geri yükleme ve bilerek silmede geri yüklememe), `eklentiTanitma.spec.ts`
(tanıtma, CVV/tutar engeli, aynı kutu, ekran raporu). Gerçek POS ekranı ve Windows/Edge kabulü
kullanıcıdadır; sayfa olaylarına bağlı doğrulama (kart görseli) bilinçli olarak tetiklenmez.
