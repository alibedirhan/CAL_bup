# 1.6.0 — kart incelemesi ve POS yardımcısı

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
2. ZIP'i indirin ve kalıcı bir klasöre çıkarın. Edge'de `edge://extensions` açın; geliştirici modu,
   “Paketlenmemiş öğe yükle” ile `manifest.json` bulunan klasörü yükleyin.
3. Gerçek kart yazmadan POS ödeme ekranını açın. Yardımcı panelinde tek tarih veya ayrı ay/yıl akışını seçin.
   Görünen vergi/TC numarasını, boş kart numarası alanını ve boş tarih alanını/alanlarını sırayla tıklayın.
   Seçim sırasında ödeme düğmelerinin tıklamaları engellenir. Escape veya iptal seçimi sonlandırır.
4. CAL bup'ı yenileyin, cari ve kartı seçin; “Seçili kartla POS’u aç” düğmesini kullanın.
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
- Kart yalnızca tarayıcı oturum belleği deposunda, en fazla 120 saniyelik işte bekler.
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

Son yerel kabul: `npm run kontrol` (28 dosya/346 test, tip, lint, biçim, derleme),
`npm run test:tarayici` (66 senaryo), `npm audit` (bilinen açık 0), `git diff --check` geçti.
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
