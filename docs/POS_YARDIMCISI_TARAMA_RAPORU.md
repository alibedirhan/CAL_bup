# 4 Ekim 2026 — POS yardımcısı taraması / 1.6.1

## Sonuç ve kapsam

Kullanıcı doğru yayın adresini kullanıyor: `https://alibedirhan.github.io/CAL_bup/#/sanal-pos`.
Yardımcıyı henüz kurmadığını açıkça bildirdi. Bu durumda kartın başka sitenin formuna aktarılmaması
beklenen sınırdır. Ancak 1.6.0 hata sonrasında “POS yardımcısı kontrol ediliyor…” mesajını temizlemiyordu:
kurulum eksikliği ile uygulamadaki bildirim hatası iki ayrı bulgudur.

İnceleme bağlantı/işlem kancası, MV3 köprü/arka plan kuyruğu, POS giriş ve alan adaptörleri,
alan tanıtımı, paket üretimi, profil/inceleme/OCR yaşam döngüsü ve mevcut regresyonları kapsadı.
Paylaşılan ekran görüntüsü yalnızca arayüz bağlamı olarak incelendi; müşteri adı, kart bilgisi veya
fotoğrafı test/veri/koda alınmadı. Testler yapay kartlar ve ağdan yalıtılmış taklit POS ile çalıştı;
gerçek sağlayıcıya giriş, ödeme, SMS veya müşteri kartıyla deneme yapılmadı.

## Bulgular ve uygulanan düzeltmeler

Kanıt türü ayrılmıştır: **yeniden üretim** doğrudan eski sürümde başarısız test;
**kod bulgusu** denetimde görülen eksik kontrol, sonrasında yeni arıza/regresyonla doğrulanan düzeltme.
Her satır müşteri sisteminde gerçekleşmiş olay iddiası değildir.

| No  | Kanıt              | Sorun / önce                                                                                           | 1.6.1 sonucu                                                                                                                              | Kalıcı doğrulama                                                         |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Kullanıcı yanıtı   | ZIP/eklenti henüz kurulmamış; yayın adresi doğru                                                       | Aynı tarayıcıya kurulum, etkinleştirme ve sayfayı yenileme açıkça anlatılır                                                               | Eksik yardımcı testi                                                     |
| 2   | Yeniden üretim     | Bağlantı hatasından sonra “kontrol ediliyor” kalır                                                     | Hata durum mesajını temizler, eylem tekrar açılır, kurulum yönergesi görünür                                                              | `posBaglanti.spec.ts`                                                    |
| 3   | Yeniden üretim     | Eski yardımcıdan biçim/sürüm doğrulanmadan kart göndermek mümkün                                       | Karttan önce protokol 2 / sürüm biçimi / bilinen durum doğrulaması; eski yanıt reddedilir                                                 | `posBaglanti.spec.ts`, `posBaglantisi.test.ts`                           |
| 4   | Kod bulgusu        | Yerel veya farklı program adresi genel zaman aşımı verir                                               | Dar izin kapsamı dışında hemen açıklayıcı adres hatası                                                                                    | `eklenti.spec.ts`                                                        |
| 5   | Kullanım eksikliği | Kurulumu kart aktarmaya basarak kontrol etmek gerekir                                                  | Ayrı bağlantı kontrolü: kart göndermeden sürümü gösterir, POS sekmesi açmaz                                                               | `posArizalari.spec.ts`                                                   |
| 6   | Kod bulgusu        | Giriş DOM'u değiştiğinde uygulama uzun süre bekler                                                     | Giriş arızası arka plana ve uygulamaya ulaşır; geçici kart silinir                                                                        | Değişmiş giriş testi                                                     |
| 7   | Kod bulgusu        | Girişten sonra yeniden login sayfası gelince süre dolana kadar beklenir                                | İkinci giriş yapılmaz; açık giriş sonucu hatası, kart silme                                                                               | Tek giriş POST testi                                                     |
| 8   | Kod bulgusu        | Süresi dolup kaybolan iş “hazır” yanıtıyla beklemeye devam eder                                        | Bekleyen iş bulunamadı / süre doldu hatası; otomatik tekrar yok                                                                           | TTL regresyonu                                                           |
| 9   | Kod bulgusu        | Duvar saati geriye alınırsa kart bekleme süresi uzayabilir                                             | Başlangıç/son tutarlılığı ve başlangıçtan önceye saat geri alma reddi; UI/POS süreleri monotonic                                          | Saat geri alma testi                                                     |
| 10  | Kod bulgusu        | PAN teslimi sonrası sonuç bildirimi yoksa 120 saniyeye kadar bekleme; belirsiz sonuç dilinin eksikliği | Teslim ayrı durumdur; 5 saniyede sonuç yoksa belirsiz hata. PAN teslimden önce silinir, tekrar yok; POS bildirimi dolmuş alanı yok saymaz | Teslim yanıtı kaybı durum testi                                          |
| 11  | Kod bulgusu        | İki uygulama sekmesinin eşzamanlı bekleyen POS aktarımları ortak banka oturumunu değiştirebilir        | Başka uygulama sekmesinin bekleyen işi varken yeni iş/sekme açılmaz                                                                       | İki uygulama sekmesi testi                                               |
| 12  | Kod bulgusu        | Önceki alan kaydının geç yanıtı yeni seçim talimatını ezer                                             | Panel nesil kontrolü; iptal/yeni seçim/çıkış eski sonucu geçersiz kılar                                                                   | Geciktirilmiş alan kaydı testi                                           |
| 13  | Kod bulgusu        | Alan kurulumunu silme arızası yakalanmaz / yanıta bakılmadan başarı denebilir                          | Sonuç durumu kontrol edilir, Promise reddi görünür hataya dönüşür                                                                         | Yapay depo arızası testi                                                 |
| 14  | Kullanım eksikliği | Windows'ta ZIP çıkarma ve klasör bulma zahmetli                                                        | Kendi yayınının ZIP'ini SHA-256 ile doğrulayan, sabit klasöre hazırlayan okunabilir CMD                                                   | Üretici ve gerçek ZIP/hash/sürüm paket testleri; yerel PowerShell parser |

İlk iki yeni tarayıcı regresyonu 1.6.0 derlemesinde başarısız oldu; düzeltme sonrası geçti.
İptal edilen bağlantının geç zaman aşımı yeni başarılı kontrolü değiştirmiyor. Mevcut yanlış cari,
değişmiş alan/CVV, dolu alan, rota/kart değişimi, sekme kapanması ve ödeme olayı üretmeme
regresyonları da korunmuştur. Her şeyin kusursuz olduğu veya bütün olası arızaların bulunduğu iddia edilmez.

Görsel kontrolde ek bir CSS bulgusu doğrulandı: `.kart p` seçicisi `.alan-hatasi` rengini
eziyordu; hata sıradan açıklama rengine dönüyordu. Hata stili kart içinde de geçerli olacak
özgüllüğe taşındı; tema belirteçleriyle zemin, kenarlık ve boşluk eklendi. Açık/koyu renk ayrımı
bağlantı regresyonunda denetlenir; dar görünüm taşma açısından incelendi.

## Mimari ve veri yaşam döngüsü

Saf `cekirdek/posBaglantisi.ts` bağlantı yanıtı sözleşmesini tanımlar. Platform portu adres,
kaynak/istek kimliği, iptal ve zaman aşımını denetler. `usePosAktarimi` React işlem yaşamını yürütür;
bileşen yalnızca eylem, sonuç ve kurulum yönergesini gösterir. Arka plan mesajları seri çalıştırır.

Başarı **alan doldurma onayıdır**, ödeme sonucu değildir. `giris → alanlar → teslim → dolduruldu`
ve `hata/iptal` ayrılmıştır. Teslim tamamlanmadan gelen belirsizlik kullanıcıya gösterilir; bekleyen
kart otomatik yeniden gönderilmez. Kaynak ve hedef sekme kimliği, görünen vergi/TC eşleşmesi ve
pozitif alan türü/rol kontrolü korunur. CVV/tutar/SMS/ödeme eylemleri otomasyona eklenmedi.

Oturum deposu eklenti yeniden yüklenince, kapatılınca, güncellenince veya tarayıcı yeniden başlayınca
silinir. Bu nedenle eski işlem kaybolmuşsa devam ediyormuş gibi gösterilmez.
[Chrome storage belgesi](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Windows hazırlayıcı ne yapar?

`POS-Yardimcisi-Windows-Kurulum.cmd` ayrı derleme çıktısıdır; kart profilini veya müşteri dosyasını
okumaz. Edge/Chrome seçimi ister; yalnızca kendi sabit HTTPS yayınından ZIP indirir. Yönlendirme
kabul etmez, süre sınırı vardır. ZIP özeti ve manifest sürümü uyuşmadan kopyalama yapmaz; beş sabit
dosyayı kontrol eder. Sabit hedef/üst klasör/dosya bağlantıları reddedilir. Geçici klasör temizlenir.
Panoya yalnızca kurulum klasörü yolu konur; gizli komut, yönetici izni, kayıt defteri, yürütme politikası
ve kurumsal politika değişikliği yoktur. Aynı klasör eklenti güncellemesinde kimlik/alan ayarını korumayı amaçlar.

Tarayıcı eklentisi sessizce kurulmuş sayılmaz. Kullanıcı geliştirici modunu açıp “Paketlenmemiş öğe
yükle” ile klasörü seçer; uygulama sekmesini yeniler. Bu tarayıcı adımı resmi yükleme akışının parçasıdır.
[Microsoft Edge kurulum belgesi](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

CMD içindeki PowerShell kodu resmi PowerShell 7.4.6 Linux parser'ıyla **çalıştırılmadan** sözdizimi
kontrolünden geçti; indirilen parser arşivi resmi SHA-256 listesiyle doğrulandı. Windows PowerShell
5.1/Edge/Chrome üzerinde indirme, SmartScreen/kurum politikası ve klasör seçimi **fiilen denenmedi**.
Bu sonuç Windows kurulum kabulü değildir. Ek yayın kapısı `windows-2022` üzerinde
Windows PowerShell ile `tools/posKurulumDenemesi.ps1` çalıştırır: üretilen CMD'nin kodunu
yalıtılmış hedef klasöründe yürütür; indirme kendi ZIP'iyle, tarayıcı ve pano test işlevleriyle
karşılanır. Beş dosyanın özetleri ve tarayıcı/klasör yolu doğrulanır. Bu da iş bilgisayarındaki
gerçek tarayıcı ekleme/kurumsal politika kabulünün yerini almaz.
[GitHub runner belgesi](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Mağazada yayınlanmış veya otomatik güncellenen eklenti yoktur;
Windows'ta yeniden kurulum dosyası indirip eklentiyi yeniden yükleme gerekir.

## Gerçek sağlayıcıda kalan sınırlar

- Gerçek ödeme DOM'u yalnızca ekran görüntüsünden biliniyor. Kullanıcı boş alanları bir kez tanıtır;
  görünür vergi/TC numarası tek başına seçilemiyorsa veya form iframe/olay gerektiriyorsa otomatik doldurma
  desteklenmez. Alan veya ödeme uçları tahmin edilmez.
- Eşzamanlı **bekleyen** işler engellenir. Önceden doldurulmuş başka POS sekmesi, elle giriş veya
  sağlayıcı çerezlerinin sonradan değişmesi tümüyle kontrol altında değildir. Her ödeme öncesinde
  ekrandaki firma bilgisi kullanıcı tarafından kontrol edilir; ödeme otomasyonu yapılmaz.
- Kartın yerel cihaz anahtarıyla şifrelenmesi, aynı tarayıcı profilini açan kişiye karşı kimlik doğrulama
  değildir. Protokol/sürüm kontrolü kriptografik eklenti kimlik doğrulaması değildir; aynı origin'de
  zararlı kod bulunursa bu kontrol yeterli olmaz. PCI/KVKK/sözleşme uygunluğu bu testlerden çıkarılamaz.
- OCR tekrarları sentetik örnekler üzerinde doğrulandı. Gerçek müşteri fotoğrafının başarısı test edilmedi;
  okunamayan rakam tahmin edilmez, inceleme alanında elle tamamlanır ve açık onay gerekir.

## Kabul kaydı

`npm run kontrol`: 29 dosya / 349 test, tip/lint/biçim/derleme geçti.
`npm run test:tarayici`: 78 senaryo geçti. `npm audit`: bilinen açık 0.
Komut kayıtları `/tmp` içinde, sürüm kabul özeti oturum notundadır. Üretim kodunda arıza enjeksiyonu veya
test yetkisi yoktur; testler derlenmiş gerçek MV3 yardımcısını kullanır. Taklit POS ağı ayrıca çalışmayan
proxy ile kapalıdır. SMS/ödeme sayaçları sıfırdır. Gerçek müşteri kartı/fotoğrafı işlenmedi.
