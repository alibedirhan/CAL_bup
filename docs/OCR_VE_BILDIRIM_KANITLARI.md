# Kart okuma ve bildirim araştırması — deney/kanıt eki

> Bu belge 1.4.0 araştırmasının tarihsel kaydıdır. Üç aşama uygulandı; güncel kapanış ve ölçüm:
> [1.5.0 uygulama sonucu](OCR_VE_BILDIRIM_UYGULAMA_SONUCU.md).

Ana rapor: [araştırma ve üç aşamalı çözüm](OCR_VE_BILDIRIM_ARASTIRMA_RAPORU.md).
Tarih 3 Ekim 2026; sürüm 1.4.0, commit `9d18259`. Bütün deney verileri yapaydır.
Bu ek, sorunu yeniden üretir; kalıcı regresyon testleri ve düzeltmeler sonraki üç aşamanın işidir.

## Başlangıç kontrolleri

| Kontrol                      | Bu araştırmadaki sonuç                            | Kanıt sınırı                                                              |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run kontrol`            | Tip/lint/biçim/derleme; 24 dosyada 325 test geçti | Bu sonuç geniş OCR doğruluğunu veya mesajın ekranda okunmasını kanıtlamaz |
| `npm run test:tarayici`      | 8 senaryo geçti                                   | Mevcut tek düz fotoğraf ve mesaj varlığı kontrollerinin kapsamı           |
| Kullanıcının ekran görüntüsü | Okuma sonlandı, numara/tarih bulunamadı           | Gerçek fotoğrafın kesin nedeni görüntüden belirlenemez                    |
| Üretim kodu                  | Araştırmada değiştirilmedi                        | Raporun önerileri uygulanmış değildir                                     |

Geçici deneyler `/tmp/cal-bup-arastirma/` içinde tutuldu. Üretim arayüzü
`http://127.0.0.1:4175/CAL_bup/`, doğrudan kaynak denemeleri `http://127.0.0.1:4190/CAL_bup/`.
Gerçek müşteri profiline veya kullanıcı tarayıcısına bağlanılmadı; yeni izole Chromium bağlamları kullanıldı.

## E-OCR — 15 görüntülük başlangıç matrisi

Aynı yapay numara ve 12/2035 tarihi; 1800 × 1200 canvas, varsayılan 64 px monospace metin.
Numara/tarih ayrı satırdır. JPEG kalite 0,9; WebP/PNG tarayıcı kodlayıcısı.
Dönüşümler: merkezden açı, 3 px blur, renk değişimi, 0,28 ölçek ve belirtilen metin varyasyonları.
Resim dosyası yerine canvas → Blob → File kullanıldı. Motor model/worker/WASM kendi yerel sunucumuzdandır.

| Vaka  | Değişiklik                  | Numara | Tarih    | Değerlendirme                                      |
| ----- | --------------------------- | ------ | -------- | -------------------------------------------------- |
| E-O01 | Düz PNG                     | Doğru  | Doğru    | Tam sonuç                                          |
| E-O02 | Düz JPEG                    | Doğru  | Doğru    | Tam sonuç                                          |
| E-O03 | Düz WebP                    | Doğru  | Doğru    | Tam sonuç                                          |
| E-O04 | 90° döndürme                | Yok    | Yok      | Boş sonuç                                          |
| E-O05 | 180° döndürme               | Yok    | Yok      | Boş sonuç                                          |
| E-O06 | 270° döndürme               | Yok    | Yok      | Boş sonuç                                          |
| E-O07 | 12° eğim                    | Yok    | Doğru    | Kısmi sonuç                                        |
| E-O08 | 3 px bulanıklık             | Doğru  | Doğru    | Bu örnekte geçti; genel bulanıklık garantisi değil |
| E-O09 | Düşük kontrast              | Doğru  | Doğru    | Bu renk çiftinde geçti                             |
| E-O10 | Koyu zemin/açık yazı        | Doğru  | Doğru    | Bu örnekte geçti                                   |
| E-O11 | Küçük/uzak kart, 0,28 ölçek | Doğru  | Doğru    | Bu örnekte geçti                                   |
| E-O12 | 09/2024 ve 12/2035 birlikte | Doğru  | İki aday | Son kullanma tarihi kullanıcı seçimi gerektiriyor  |
| E-O13 | Numara iki satıra bölünmüş  | Yok    | Doğru    | Kısmi sonuç                                        |
| E-O14 | 24 px rakam                 | Doğru  | Doğru    | Bu boyutta geçti                                   |
| E-O15 | Ek yapay sayısal yazılar    | Doğru  | Doğru    | Bu yerleşimde geçti                                |

**Özet:** 9 tam sonuç, 2 kısmi, 3 boş, 1 çoklu tarih sonucu. Bu örneklerde yanlış numara döndürülmedi.
Bu, gerçek kart fotoğraflarında %60 başarı oranı olduğu anlamına gelmez; örnek sayısı/düzeni
istatistiksel bir saha doğruluğu ölçümü için yeterli değildir. Farklı yazı tipi, kabartma, parlama,
perspektif ve kamera sıkıştırması hâlâ ayrıca ölçülmelidir.

Doğrudan yerel adaptör deneyleri 335–394 ms aralığında sonuçlandı. Bu süre internetten ilk model
indirmesi, Windows donanımı veya gerçek fotoğraf performansı için tahmin olarak kullanılmaz.

## E-METIN — 8 saf çıkarıcı denemesi

| Vaka  | Yapay OCR metni düzeni             | Gözlem                            |
| ----- | ---------------------------------- | --------------------------------- |
| E-M01 | Numara tek satır, 12/35 ayrı satır | İki alan doğru                    |
| E-M02 | Numara iki satıra bölünmüş         | Numara yok, tarih doğru           |
| E-M03 | Numara ardından aynı satırda 12/35 | Numara yok, tarih doğru           |
| E-M04 | Tek haneli ay: 1/35                | Numara doğru, tarih yok           |
| E-M05 | Aralarda boşluk: 12 / 2035         | İki alan doğru                    |
| E-M06 | İki tarih: 09/24 ve 12/35          | İki tarih adayı                   |
| E-M07 | Ayraçsız tarih: 1235               | Numara doğru, tarih yok           |
| E-M08 | Tarihle aynı satırda yapay telefon | Bu düzen tarih çıkarımını bozmadı |

E-M04/E-M07 için çözüm “her dört rakamı tarih saymak” değildir; belirsiz sayılar ancak inceleme adayı olabilir.

## E-UI — bildirim ve taslak denemeleri

### E-U01 — Yinelenen kart kayıt hatası

1. Yapay cari ve bir yapay kart kaydet.
2. Aynı cariye aynı numaralı ikinci kartı eklemeyi dene.
3. Hata sayfa üstündeki `.mesaj.hata` içinde; dialog içinde hata sayısı **0**.
4. Hata kutusu görünür alanla kesişiyor, ancak dialog metnin önemli bölümünü örtüyor.
   Playwright `getByRole('alert')` burada **1** döndürdü; bu sayı okunabilirliği kanıtlamaz.

Ekran görüntüsü: `/tmp/cal-bup-arastirma/yinelenen-kart.png`. Bulgu B-01/A-01/A-03.

### E-U02 — Hata dialog içinde ama görünür alan dışında

1. Yeni boş kart formunu aç; dialog’un kaydırmasını üste al.
2. Formu gönder (deneyde `requestSubmit`; Enter/klavye ayrıca regresyona alınacak).
3. Kontrol kutusu hatası `y=832,84`, alt kenarı `852,98`; pencere yüksekliği **800**.
4. Odak hata/alan yerine düğmede kaldı. Hata yerleşimi görünür alana taşınmadı.

Ekran görüntüsü: `/tmp/cal-bup-arastirma/form-hatasi-uzak.png`. Bulgu B-02.

### E-U03 — Dar görünümde başarılı kart kaydı

390 × 800 görünümde normal kart kaydı başarıyla tamamlandı; başarı kutusu `y=-190,16`,
alt kenarı `-146,47` idi. Kullanıcının gördüğü alan kart listesiydi; başarı kutusu ekranın üstünde kaldı.
Ekran görüntüsü: `/tmp/cal-bup-arastirma/basari-uzak-390.png`. Bulgu B-03.

### E-U04 — Yedek parolasında yanlış bağlam

“Şifreli yedeği indir” → boş parola → mesaj **“Kasa parolasını yazın.”**
Bu mesaj deneyde görünür alandaydı; sorun burada görünürlük değil, bağlamdır. Bulgu B-09.

### E-U05 — Boş ikinci fotoğraf eski kartı görünürde koruyor

Düzenleme formunda önceki yapay numara ve 12/2035 varken yalnızca boş görüntü okutuldu.
“Numara veya tarih okunamadı” yazdı; önceki üç alan korundu, onay kutusu sıfırlandı.
Yanlış kayıt yapılmadı. Bulgu O-04; mevcut kontrol kutusu koruması ayrıca kayıtlıdır.

### E-U06 — Geçersiz ayar sessiz reddediliyor

Tolerans `0,001` → geçersiz metin → alandan ayrıl → `0,001`; hata mesajı sayısı **0**.
İlgili alan `#tolerans`. Bulgu B-04.

### E-U07 — Saklama engeli kullanıcıya bildirilmiyor

Yalnızca izole test bağlamında `Storage.prototype.setItem` hata üretmeye ayarlandı.
Tolerans `0,02` ekranda uygulandı; yenileyince `0,001` oldu; hata mesajı sayısı **0**.
Gerçek kullanıcı ayarı veya tarayıcı kaydı değiştirilmedi. Bulgu B-05.

### E-U08 — Geçmiş deposu okunamıyor ama boş görünüyor

İzole testte `indexedDB.open` hata üretti. Geçmiş ekranı “Henüz kayıt yok” ve
“Henüz yedek yok” gösterdi; hata sayısı **0**. Bulgu B-06.

### E-X01 — Listedeki yedeğin byte kaydı kayıp

İzole IndexedDB’ye yalnızca yapay `yedekler` liste kaydı yazıldı; `yedek:<id>` içeriği yoktu.
“İndir” tıklaması sonrası **0 indirme**, **0 hata mesajı**. Bulgu B-07.

### E-X02 — Çoklu tarih, yeni numara ve eski tarih karışımı

Formda önceki yapay numara ve 10/2034 varken başka numaralı, iki tarihli fotoğraf okutuldu.
Yeni numara uygulandı, 10/2034 korundu; aday tarih çiftleri seçilebilir/görünür listede sunulmadı.
Bu, sessiz alan karışımını ve aday inceleme eksikliğini gösterir. Bulgu O-03/O-04.

## E-WORKER — yükleme arızası ve iptal

`Worker` kurucu/terminate çağrıları izole bağlamda sayıldı; ayrıca `page.workers().length` ölçüldü.
Saat ilerletme sayfanın 90 saniye zaman aşımını tetikledi; kullanıcı gerçek 90 saniye bekletilmedi.

| Vaka  | Enjeksiyon/eylem                                 | UI sonucu                                                             | Oluşturulan/sonlandırılan | Aktif worker |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------- | ------------ |
| E-W01 | `eng.traineddata.gz` → 404; 91 saniye yapay saat | Önce %0; sonra “Fotoğraf okuma durduruldu. Elle devam edebilirsiniz.” | 1 / 0                     | 1            |
| E-W02 | Model isteği bitmiyor; “Okumayı durdur”          | Gösterge kalktı; dialog’da terminal hata/iptal mesajı yok             | 1 / 0                     | 1            |

Deney sonrası bağlamlar kapatıldı; test worker’ları gerçek kullanıcı oturumunda bırakılmadı.
Yalnızca aktif kaynak/sonlandırma denetlendi; byte düzeyinde bellek veya CPU tüketimi ölçülmedi.
Kaynak kodu karşılığı: `posKartOkuma.ts` atamadan önce bekleyen `createWorker` ve
Tesseract.js 7.0.0 `createWorker.js` dil/başlatma promise zincirindeki boş catch. Bulgu O-05/O-06.

## Kod incelemesiyle sınır olarak kaydedilenler

- O-07: güven/bölge/elenme nedeni sonuç sözleşmesinde yok; bunların kullanılmaması kaynakta görüldü.
- O-08: dosya girişinin temizlenmesi doğru gizlilik davranışı; yerine durum/önizleme konmaması UX eksikliği.
- B-08: indirme isteğinin diske yazılmasını doğrulamayan helper; bu deneyde gerçek indirme engeli taklit edilmedi.
- A-01: boolean/void/metin dönüşleri; alan/işlem/sonuç kesinliği taşıyan ortak sözleşme yok.
- A-02: Drive geç sonuç/render çökmesi gerçek olay olarak tekrar üretilmedi; ilgili yaşam döngüsü/test kapsamı eksik.
- A-03: mevcut testlerin kapsamı ile bu yeni arıza/yerleşim deneyleri arasındaki fark gözlemlendi.

## Yeniden çalışma dosyaları

Sadece bu çalışma makinesinde; Node/Playwright bağımlılık yolu ve iki yerel sunucu adresi scriptlerde yer alır:

```sh
node /tmp/cal-bup-arastirma/ocr-matris.mjs
node /tmp/cal-bup-arastirma/bildirim-denemeleri.mjs
node /tmp/cal-bup-arastirma/worker-arizasi.mjs
node /tmp/cal-bup-arastirma/ek-denemeler.mjs
```

Ham sonuçlar aynı klasördeki `ocr-sonuclari.json`, `bildirim-sonuclari.json`,
`worker-sonuclari.json`, `ek-sonuclar.json`. Scriptlerde ve ekran görüntülerinde yalnızca yapay veri var.
Geçici dosyalar sistemce silinebilir; kalıcı kanıt özeti bu belgededir. Kalıcı, taşınabilir regresyon
karşılıkları Aşama 1–3 kapsamında `tests/` içinde hazırlanacak.
