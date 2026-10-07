# 7 Ekim 2026 — Sanal POS saha testi raporu (1.15.0)

Bu raporda, Windows iş bilgisayarında yapılan ilk gerçek kullanım denemesinin bulguları ve düzeltme planı yer alıyor.
Rapor yazıldığında davranış değiştirilmedi; bulgular aynı gün **1.16.0 / yardımcı 2.0.0** ile uygulandı
(aşağıda “Uygulama durumu”). Gerçek POS adresine hiçbir istek gönderilmedi.
Bütün yeniden üretmeler ağdan yalıtılmış taklit POS sayfalarında yapıldı.

> Depo herkese açıktır. Bu belgede cari adı, vergi/TC numarası, e-posta veya bakiye yoktur.
> Çalışan cariye **“1. cari”**, hata veren cariye **“2. cari”** denir.

## Özet

Toplam iki ayrı sorun var ve ikisinin de kökü kodda bulundu:

1. **2. cari POS'a giremiyor.** Büyük olasılıkla CAL bup'a kaydedilen numara, POS'un o cariyi tanıdığı
   numara değil. 2. caride 10 haneli vergi no kayıtlı; ekran görüntüsüne göre doğru olan 11 haneli TC olabilir.
   Asıl engel şu: numara düzeltilmek istendiğinde program buna izin vermiyor, çünkü cariye kart bağlı.
   Kullanıcının elinde kartı silip yeniden yazmaktan başka yol kalmıyor.
2. **Alan tanıtımı her caride yeniden isteniyor.** Yardımcı, tanıtılan kutuyu kalıcı bir kimlikle bulamazsa
   kutunun yerini “sayfadaki sırası” olarak saklıyor. Carinin ekranında tek bir satır fark olsa bile bu sıra
   kayıyor ve yardımcı “Yeniden tanıtın” diyor. Taklit POS'ta birebir yeniden üretildi.
   Panel her sayfada tanıtma düğmelerini gösteriyor ve “kurulum tamam” demiyor; bu da yeniden tanıtma gerektiği izlenimini güçlendiriyor.

Bunların yanında altı eksik daha bulundu: yanıltıcı tanıtma akışı, Ad Soyad'ın doldurulmaması,
cari değişiminde eski POS sekmesi riski, tutar kutusu hatırlatması, gereksiz sürüm uyarısı ve test kapsamı.

## 1. Gelen bildirim ve kanıtlar

Test yapan kişinin yazdıkları:

- “Başka bir cariden giriş yaptığımda hata alıyorum. 1. cariden giriş yapılınca sorun yok, 2. cariden hata veriyor.”
- “Her yeni caride eklentiyi tanımlamak yerine bir defa tanımlamak yeterli olmalı; sanal POS ekranı değişmiyor.”

Dört ekran görüntüsü (kişisel veri içerdiği için depoya alınmadı):

| No  | Ekran                        | Görülen                                                                                                                                                                              |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 1. carinin ödeme sayfası     | Tanıtma akışının 4. adımı açık: “son kullanma yılı olarak tanınmadı… Evet düğmesine basın”. Sayfada tek bir **S.K.T** kutusu var.                                                    |
| 2   | Aynı sayfa                   | Onaydan sonra gelen mesaj: “**Alan seçimi uygun değil.** 4/4: son kullanma yılı alanını tıklayın.”                                                                                   |
| 3   | POS giriş sayfası            | Vergi no ve lisans no kutularında 2. carinin **10 haneli** numarası. Sağlayıcının mesajı: “Girilen Bilgiler Hatalı Bu Piliç İle İrtibata Geçin!”. Yardımcı bu nedeni doğru aktarmış. |
| 4   | CAL bup, 2. cariyi düzenleme | Numara kutusuna **11 haneli** başka bir numara yazılmış. Kırmızı uyarı: “Bu cariye bağlı kartlar var; vergi/TC numarası değiştirilemez.”                                             |

Gerçek ödeme sayfasından öğrenilenler: Ödeme formu girişten hemen sonra açılan sayfada. Üstte “Firma İsmi : AD (numara)” yazıyor;

1. caride burada **11 haneli** numara görünüyor. Form alanları sırasıyla: Tanımlı E-Mail Adresi (dolu), Ad Soyad,
   Kredi Kartı Numarası, S.K.T, CVV ve Tutar. Tutar kutusu POS'un yazdığı **eksi bakiyeyle dolu** geliyor.
   Sayfada bir kart önizleme görseli de var (“FULL NAME”, “•••• ••••”).

## 2. Bulgular (önem sırasıyla)

### K1 — 2. cari POS'a giremiyor ve numara düzeltilemiyor (yüksek)

**Ne oluyor:** Program cari başına tek bir numara saklıyor. Bu numarayla giriş şu şekilde yapılıyor:
vergi no = numara, lisans no = numara, şifre = numaranın ilk 2 ve son 2 hanesi (`posCari.ts`, `posGiris.ts`, `arkaPlan.ts`).
Bu kural 1. caride çalışıyor. 1. carinin POS'ta görünen numarası 11 hanelidir; yani şahıs carisi POS'ta TC ile kayıtlı. 2. caride ise 10 haneli vergi no kayıtlı ve POS bunu reddediyor. 4 numaralı ekrandaki 11 haneli numara,
test yapan kişinin doğru numarayı bulduğunu düşündürüyor.

**Neden çıkmaz yol:** `posProfil.ts → profilCariKaydet`, kartı olan carinin numarasının değiştirilmesini engelliyor.
Oysa kartlar cariye numarayla değil, cari kimliğiyle bağlı. Numarayı düzeltmek kartların bağını bozmaz.
Bu engel “bir kişinin kartları başka kişiye geçmesin” diye konmuştu, ama gerçek kullanımda en sık
ihtiyaç olan şeyi, yani yanlış girilmiş numaranın düzeltilmesini engelliyor. Ayrıca yardımcı, giriş hatasında
“numarayı kontrol edin” diyor; kullanıcı numarayı düzeltmeye gittiğinde ise program izin vermiyor.

**Kesin olmayan nokta:** 2. cari için doğru bilgi gerçekten 11 haneli numara mı? Yoksa bu caride POS'ta farklı bir
lisans no veya değiştirilmiş bir şifre mi var? Kod bunu bilemez. Ayırt etmek için test yapan kişiye
elle hangi bilgilerle girebildiğini sormak gerekiyor (bölüm 3).

**Düzeltme önerisi:**

1. Kartı olan caride de numara düzeltilebilsin. Kullanıcıya şu açık uyarı ve onay sunulsun:
   “Bu carinin N kartı var. Numara düzeltmesi yalnız aynı kişi için yapılmalı.” Kartlar aynı cari kimliğinde kalır.
2. Giriş reddedildiğinde hem yardımcı panelinde hem programda doğrudan **“Cari numarasını düzelt”** yolu gösterilsin.
   10 haneli numarayla giriş reddedildiyse şu ipucu verilsin: “Şahıs carilerinde POS çoğunlukla 11 haneli TC ile açılır.”
3. Varsayılan kurala uymayan cariler için isteğe bağlı **özel POS giriş bilgisi** eklenebilir (lisans no / şifre,
   şifreli kasada). Bu ancak test yapan kişinin yanıtına göre yapılmalı; kural tahminle değiştirilmemeli.

### K2 — Alan tanıtımı cari değişince bozuluyor (yüksek)

**Ne oluyor:** Tanıtılan kutu `eklenti/alanlar.ts → alanTanimi` ile saklanıyor. Kutunun kalıcı bir kimliği (`id`) varsa
kimlikle saklanıyor. Kimliği yoksa veya kimliğinde 6 rakam yan yana geçiyorsa kutu
`body>div:nth-of-type(2)>…` biçiminde **sayfadaki sırasıyla** saklanıyor. Kutunun `name` adı hiç kullanılmıyor.
Firma yazısı da aynı şekilde saklanıyor.

**Yeniden üretme (taklit POS, iki cari, tek tanıtım, 1.15.0 derlemesi):**

| Durum                                                | 2. cari doldu mu | Panelde                                                           |
| ---------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| Kutular kimlikli, iki carinin sayfası aynı           | Evet             | “Cari eşleşti… dolduruldu”                                        |
| Kutular kimlikli, 2. caride fazladan bir satır       | Evet             | “Cari eşleşti… dolduruldu”                                        |
| Kutular kimliksiz, 2. caride fazladan bir satır      | **Hayır**        | “Firma numarası veya alanlar doğrulanamadı. **Yeniden tanıtın.**” |
| Firma yazısı kimliksiz, 2. caride fazladan bir satır | **Hayır**        | Aynı                                                              |
| Kimlikli, 2. carinin girişi `/Index.aspx`'e gidiyor  | **Hayır**        | “POS'ta ödeme sayfasına geçin” (zaten oradayken)                  |

Gerçek sayfada carinin ekranını değiştirebilecek şeyler: e-posta satırının olup olmaması, USD bakiye kartı, duyuru veya uyarı satırı.
Bunların hangisinin gerçekten değiştiği bilinmiyor; ama bunlardan herhangi biri tek başına bu sorunu üretmeye yeter.

**Sorunu büyüten diğer etkenler:**

- Tanıtım, sayfa adresine bağlı (`origin + pathname`) ve büyük/küçük harfe duyarlı saklanıyor. Aynı form farklı adresle
  açılırsa “tanıtılmamış” sayılıyor.
- Panel her POS sayfasında “Numara ve tek tarih alanını tanıt”, “Numara, ayrı ay ve yılı tanıt” ve “Bu sayfanın kurulumunu sil”
  düğmelerini gösteriyor. Kurulumun hazır olduğunu söyleyen bir yazı yok. Kullanıcı her seferinde tanıtması gerektiğini düşünüyor.
- “Bu sayfanın kurulumunu sil” düğmesi **onaysız**, tek tıkla siliyor.
- Tanıtım yalnız eklentinin kendi deposunda tutuluyor. Eklenti kaldırılıp yeniden yüklenirse, başka bir tarayıcı
  veya bilgisayar kullanılırsa tanıtım kayboluyor.

**Düzeltme önerisi:**

1. **Tek, site geneli kurulum:** Tanıtım sayfa adresinden bağımsız saklansın; gerçekten bir kez yapılsın.
2. **Sağlam kutu bulma:** Kutu şu sırayla aransın: kimlik → `name` → kutunun başlığı (“Kredi Kartı Numarası”, “S.K.T”,
   “Ad Soyad”) → son çare olarak sıra. Saklanan yol bulunamazsa, kullanıcıya sormadan önce başlık yazısıyla
   kendiliğinden yeniden bulunsun.
3. **Firma numarası tıklatılmadan okunsun:** “Firma İsmi” yazısının yanındaki tek 10–11 haneli numara kendiliğinden okunsun.
   Sayfada tam olarak bir eşleşme olmazsa yardımcı yine durur. Güvenlik kuralı (numara eşleşmezse doldurma yok) aynen kalır.
4. **Panel durumu:** Kurulum varsa panel “Kurulum tamam — bir daha tanıtmanız gerekmez” desin. Tanıtma düğmeleri
   “Kurulumu yenile” altına alınsın, silme işlemi onay istesin. Kart alanı olmayan sayfada
   “bu sayfada yapılacak bir şey yok” yazsın.
5. **Kurulum CAL bup'ta da saklansın:** Program kurulumu tutsun ve her aktarımda yardımcıya göndersin.
   Böylece eklenti güncellemesi veya yeniden kurulumu tanıtımı silmez. Kurulum şifreli yedeğe de eklenebilir.

### K3 — Tanıtma akışı yanıltıcı ve hata mesajı anlaşılmaz (orta)

**Ne oluyor:** Panelde iki ayrı tanıtma düğmesi var: “tek tarih” ve “ayrı ay ve yıl”. Gerçek sayfada tek bir S.K.T kutusu var,
ama test yapan kişi “ayrı ay ve yıl” akışını seçmiş. Akış “ay” adımında da “yıl” adımında da aynı S.K.T kutusunu istiyor.
Kullanıcı ikisinde de “Evet” deyince, aynı kutu iki kez seçildiği için `alanlariDogrula` kurulumu reddediyor.
Mesaj yalnızca “Alan seçimi uygun değil” diyor (2 numaralı ekran). Taklit sayfada aynı mesaj birebir yeniden üretildi.

**Düzeltme önerisi:** Tek bir **“Alanları tanıt”** düğmesi olsun. Tarih kutusu seçilince yardımcı kutunun türüne bakarak
yılı ayrıca sorup sormayacağına kendisi karar versin: liste kutusuysa veya 2 karakterlikse yılı ayrıca sorsun, yoksa sormasın.
Aynı kutu ikinci kez seçilirse şu açık mesaj çıksın: “Bu kutuyu zaten … olarak seçtiniz.” S.K.T başlığı zaten tarih olarak tanınıyor;
doğru akışta “Evet” onayına bile gerek kalmaz.

### K4 — Ad Soyad doldurulmuyor (orta)

Kart sahibinin adı CAL bup'ta kayıtlı, ama yardımcı yalnız numara ve S.K.T'yi dolduruyor. Gerçek formda Ad Soyad kutusu var ve boş kalıyor.
**Öneri:** İsteğe bağlı bir “Ad Soyad” alanı tanıtılsın ve kart sahibinin adıyla doldurulsun. CVV, tutar ve şifre engelleri aynen kalır.

### K5 — Sayfanın kendi kart biçimlendirmesi tetiklenmiyor (orta, doğrulanmalı)

Yardımcı, değerleri sayfa olaylarını (`input/change`) tetiklemeden yazıyor. Bu bilinçli bir güvenlik seçimi:
alan değişince SMS veya ödeme başlatan bir kod varsa yardımcı onu çalıştırmamış olur. Ancak gerçek sayfadaki kart önizleme görseli
bu olaylarla güncelleniyor; görsel boş kalır. Sayfa “Devam Et” öncesinde kendi denetimini bu olaylara bağlıyorsa doldurulan değeri görmeyebilir.

1. caride “sorun yok” denmiş, ama “Ödeme İşlemine Devam Et”ten sonra banka ekranına geçilip geçilmediği bilinmiyor.
   **Karar gereken nokta:** Gerçek davranış öğrenilmeden olay üretimi açılmamalı. Gerekirse olaylar yalnız numara, tarih ve ad kutularında üretilmeli;
   CVV, tutar ve düğmelerde asla.

### K6 — Cari değiştirirken eski POS sekmesi riski (yüksek etki, doğrulanmalı)

POS oturumu büyük olasılıkla tarayıcı çereziyle tutuluyor (ASP.NET'in genel davranışı; bu sitede doğrulanmadı).
Bu durumda yeni cariyle giriş yapıldığında, açık kalan eski sekmenin oturumu da değişir. Eski sekmede ise hâlâ önceki carinin adı görünür.
Ödeme eski sekmeden yapılırsa paranın hangi cariye yazılacağı belirsizdir.
**Öneri:** Yeni girişte yardımcı diğer açık POS sekmelerine şu kırmızı uyarıyı koysun: “Bu sekme eski cariye ait, kapatın.”
Program da “önce eski POS sekmelerini kapatın” diye hatırlatsın.

### K7 — Tutar kutusu bakiyeyle dolu geliyor (düşük)

POS, tutar kutusuna carinin eksi bakiyesini kendisi yazıyor. Yardımcı bu kutuya dokunmuyor ve dokunmamalı.
**Öneri:** Doldurmadan sonra panelde şu hatırlatma çıksın: “Tutar kutusundaki değer POS'un yazdığı bakiyedir; ödenecek tutarı kendiniz yazın.”

### K8 — Gereksiz “yardımcıyı güncelleyin” uyarısı (düşük)

Yardımcının sürümü programın sürümüyle aynı tutuluyor (`tools/posEklentisi.ts`). Bu yüzden POS'la ilgisi olmayan her güncellemeden sonra
(Excel, Yaşlandırma vb.) program “yardımcıyı güncelleyin” diyor. Bu her seferinde yeniden kurulum ve tanıtım kaybı riski doğuruyor.
**Öneri:** Yardımcının ayrı bir sürümü olsun ve yalnız yardımcı kodu değişince artsın. Güncelleme talimatında “kaldırmayın, yalnız Yeniden yükle” açıkça yazsın.

### K9 — Testler gerçek ekranı temsil etmiyor (orta)

Bütün taklit ödeme sayfalarında kutular kimlikli ve tek cari var. Şu durumlar hiç denenmiyor: iki cari, farklı satır düzeni,
kimliksiz kutu, adres farkı, aynı kutunun iki kez seçilmesi ve kartlı caride numara düzeltme.
**Öneri:** Bu senaryolar kalıcı teste eklensin. Ayrıca yardımcıya bir **“Ekran yapısı raporu”** düğmesi eklensin.
Bu düğme kutuların tür/kimlik/ad/uzunluk/başlık bilgilerini **değerler ve rakamlar olmadan** üretsin. Kullanıcı bu raporu gönderirse
gerçek siteye hiç dokunmadan birebir taklit sayfa kurulabilir.

## 3. Test yapan kişiye sorulacaklar

1. 2. cariyle POS'a **elle** girebiliyor mu? Hangi numarayla (10 haneli mi, 11 haneli mi)? Şifre o numaranın ilk 2 ve son 2 hanesi mi?
2. Yeniden tanıtmak zorunda kaldığında panelde hangi yazı vardı: “Yeniden tanıtın” mı, “ödeme sayfasına geçin” mi?
   Yoksa düğmeler göründüğü için mi tanıttı?
3. 1. caride doldurulan bilgilerle “Ödeme İşlemine Devam Et”ten sonra banka ekranına geçilebildi mi? Kart görseli değişti mi?
4. Yardımcıyı güncellerken eklentiyi kaldırıp yeniden mi yükledi?
5. Aynı anda birden fazla POS sekmesi açık mıydı?

## 4. Uygulama planı

Kullanıcı onayıyla, aşama aşama yapılacak. Her aşama ayrı sürüm ve yayın olacak.

| Aşama                      | İçerik                                                                                                                                                                                                        | Bulgular                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1 — 2. cari                | Kartlı caride onaylı numara düzeltme; giriş hatasında “numarayı düzelt” yolu ve TC/VKN ipucu; yanıta göre isteğe bağlı özel giriş bilgisi                                                                     | K1                             |
| 2 — Tek seferlik kurulum   | Site geneli kurulum, sağlam kutu bulma ve kendiliğinden yeniden bulma, firma numarasını kendiliğinden okuma, “kurulum tamam” paneli, onaylı silme, tek “Alanları tanıt” akışı, kurulumun programda saklanması | K2, K3                         |
| 3 — Eksik alan ve güvenlik | Ad Soyad doldurma, eski POS sekmesi uyarısı, tutar hatırlatması                                                                                                                                               | K4, K6, K7                     |
| 4 — Bakım                  | Ayrı yardımcı sürümü, ekran yapısı raporu düğmesi, yeni kalıcı testler, belgeler                                                                                                                              | K8, K9 (K5 kararı yanıta göre) |

Her aşamada değişmeyecek kurallar: CVV, tutar, ödeme düğmesi ve SMS kullanıcıda kalır. Cari numarası eşleşmezse hiçbir şey doldurulmaz.
Gerçek POS adresine geliştirme veya test isteği gönderilmez. Denemeler taklit POS'la yapılır; gerçek kabul Windows'ta kullanıcıdadır.

## 5. Ekran görüntülerindeki kişisel veri

İş yerinden gelen ekran görüntülerinde cari adı, TC/vergi numarası, e-posta ve bakiye var. Bu görüntüler depoya, testlere veya bu
belgeye alınmadı. Düzeltmeler bittikten sonra proje klasöründen silinmeleri önerilir.

## 6. Uygulama durumu (1.16.0 / yardımcı 2.0.0, 7 Ekim 2026)

Kullanıcı bütün aşamaların eksiksiz uygulanmasını istedi; CVV için “ödeme anında yazılsın,
kaydedilmesin” seçeneğini seçti (saklama, PCI DSS gereği önerilmedi).

| Bulgu | Durum                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| K1    | Onaylı numara düzeltme, “Cariyi düzenle” düğmesi, TC ipucu, cariye özel lisans no/şifre                                                     |
| K2    | Site geneli kurulum, kimlik → ad → başlık ile bulma, firma numarası kendiliğinden, “Kurulum tamam”, onaylı silme, programda kurulum kopyası |
| K3    | Tek “Alanları tanıt”; tarih kutusunun türüne göre yıl sorusu; aynı kutu açık mesajı                                                         |
| K4    | Ad Soyad doldurma                                                                                                                           |
| K5    | Olay üretmeme kararı korundu; gerçek sayfa davranışı kullanıcı denemesine bağlı                                                             |
| K6    | Yeni girişte eski POS sekmelerine uyarı; programda “eski sekmeleri kapatın” adımı                                                           |
| K7    | Doldurma sonrası tutar hatırlatması                                                                                                         |
| K8    | Yardımcının ayrı sürümü (2.0.0) ve kod özeti denetimi                                                                                       |
| K9    | Ekran yapısı raporu, iki cari/kimliksiz kutu/adres/aynı kutu/düzeltme/özel giriş testleri                                                   |
| Ek    | CVV ödeme anında, kaydedilmeden doldurulur                                                                                                  |

Bölüm 3'teki sorular hâlâ geçerlidir; yanıtlar özellikle K1 (özel giriş gerekli mi) ve K5 için önemlidir.
