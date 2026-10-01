# AGENTS.md — CAL bup

Bu dosya projede çalışan yapay zekâ araçları (Codex, Claude Code vb.) ve geliştiriciler içindir.
İşe başlamadan önce bunu, sonra `docs/MIMARI.md` ve `docs/IS_KURALLARI.md`'yi okuyun.

## Proje

Bupiliç İzmir Bölge Deposu için LED sisteminin Excel çıktılarından günlük raporlar hazırlayan
**tarayıcı uygulaması**. Sunucu yoktur: Excel dosyaları kullanıcının tarayıcısında okunur ve yazılır,
hiçbir yere gönderilmez. GitHub Pages'te yayınlanır.

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
npm run bicim       # Prettier ile biçimle
```

`main` dalına gönderilen her commit GitHub Actions'ta `npm run kontrol`'den geçer ve geçerse siteye
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
- Tarayıcıda uçtan uca deneme kalıcı değildir; gerekirse Playwright ile `vite preview` üzerinde gerçek
  dosyaları LED dosya girişine (`input[type=file][multiple]`) verip inen dosyayı altın çıktıyla karşılaştır.
- Gerçek Excel'de açma, dosyanın üzerine kaydetme (File System Access) ve Excel açıkken kaydetme yalnızca
  kullanıcının Windows bilgisayarında denenebilir; bunları kullanıcıdan iste.

## Durum ve yol haritası

| Aşama | İçerik                                                     | Durum                        |
| ----- | ---------------------------------------------------------- | ---------------------------- |
| 1     | İskelet, tema, yayın                                       | Bitti                        |
| 2     | Hesap kuralları (VBA/Python ikizinden taşındı)             | Bitti                        |
| 3     | Excel okuma ve yazma (ExcelJS)                             | Bitti                        |
| 4     | Arayüz: dosya bırakma, kontrol ekranı, kayıt, geçmiş, ayar | Bitti                        |
| 5     | İş yerinde deneme                                          | Bitti (2026-10-01, sorunsuz) |
| 6     | Google Drive'a kaydetme                                    | Sırada                       |
| 7     | Envanter, bakiye, palet/kasa raporları                     | Örnek dosya bekleniyor       |

**Tamamlanan işler (2026-10-01):**

1. **Yeniden adlandırma:** GitHub depo adı `CAL_bup`, ekranda görünen ad **"CAL bup"**, sürüm
   **1.0.1**. Yeni site yayını tamamlandı ve tarayıcıda doğrulandı:
   `alibedirhan.github.io/CAL_bup/`. Kullanıcı yer imini güncellemeli. Yerel klasör adı `CAL_bup`.
   Tarayıcı kayıtları aynı alan adında korunur: localStorage öneki ve IndexedDB adı uyumluluk için
   `bup-rapor` olarak kalır.
2. **Eski aracı arşivleme:** Gizli `alibedirhan/Bup_Excel_Rapor_Eski` deposuna yüklendi ve depo
   arşiv durumuna alındı. Eski belgelerdeki gerçek ürün adları ve stok miktarları tüm geçmişten
   temizlendi; 8 commit'in kodu, dosyaları ve kayıt bilgileri korundu (commit kimlikleri değişti).
   Arşiv GitHub'dan yeniden indirilip bütün geçmiş ve dosyalar karşılaştırıldı; git bütünlüğü doğrulandı.
   Özgün git geçmişi `ornekler/eski_arac_arsivi/eski_git_gecmisi.bundle` içinde, GitHub'a gitmeyen
   yerel dosyalar aynı alanda korunuyor (git dışı). Kopyaların içerikleri doğrulandıktan sonra eski
   `../bupilic-rapor-araci` klasörü silindi.

**Sıradaki işler:** Kullanıcı Google Drive'a geçilebileceğini belirtti; aynı mesajda adetli ve kolili
sayım satırlarının doğru toplanmasını istedi. Önce sayım isteğini netleştir: yeni örnekte `Miktar`
sütunu iki ambalajda da KG mı, ürün adları aynı mı? Eldeki örnekte tüm miktarlar KG ve ambalaj birimi
KOLİ; karma ambalaj örneği yok. Aynı adın hazır kilogram miktarları zaten toplanır; adet/koli dönüşümü
ve farklı ürün adlarını eşleme henüz yok. Şirket verisini kod/test/belgeye koyma; yeni örnek yalnızca
`ornekler/` içinde kalır. Ardından Google Drive'a geç; bağlantı henüz uygulanmadı.

**6. Google Drive (kullanıcı kararı):** Tarayıcı içi kayıt (ayarlar, geçmiş, yedekler) kalır; ek olarak
"Drive'a bağlan". `drive.file` kapsamı (uygulama yalnızca kendi oluşturduğu dosyaları görür), Drive'da
"CAL bup" klasörü: günlük depo kontrol dosyası, yedeği, isteğe bağlı LED dosyaları; geçmiş/ayarlar
eşitlemesi. Kullanıcı Google Drive kullanıyor ve şirket verisini kendi Drive'ına koymayı onayladı.
Google Cloud'da OAuth istemci kimliği kurulumunu kullanıcıya adım adım anlat. CSP'ye
(`vite.config.ts`) yalnızca gereken Google adreslerini ekle. Yeni modül `platform/drive.ts`.

**7. Yeni raporlar:** Önce kullanıcıdan o raporun LED çıktısından örnek ve elle doldurduğu Excel'i iste.
Adımlar `docs/MIMARI.md` → "Yeni rapor eklemek". Palet/kasa için ilk istek: 40. haftada günlük depo
satışlarını cari adına göre haftalık toplamak (eskiden SUMIF önerilmişti).
