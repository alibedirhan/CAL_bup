# CAL bup

Bupiliç İzmir Bölge Deposu için LED çıktılarından günlük raporları hazırlayan tarayıcı uygulaması.

**Adres:** https://alibedirhan.github.io/CAL_bup/

- Raporlar için kurulum gerekmez. Chrome, Edge veya Brave’de adresi açmanız yeterli; POS’a kart aktarımı için ayrı yardımcı kurulur.
- Seçtiğiniz Excel dosyaları **yalnızca sizin bilgisayarınızda, tarayıcının içinde** işlenir. Google Drive’a yalnızca siz isterseniz gönderilir.
- Bu depoda yalnızca programın kendisi bulunur. Şirket verisi, LED dosyaları ve depo kontrol dosyası depoya hiçbir zaman eklenmez.

## Raporlar

| Rapor               | Durum       |
| ------------------- | ----------- |
| Günlük depo kontrol | Hazır       |
| Envanter            | Hazır değil |
| Bakiye              | Hazır değil |
| Palet / kasa        | Hazır değil |

## Sanal POS

Sanal POS bölümünde cari seçince **Kayıtlı kartlar → Kart ekle** görünür. Kart bilgileri elle
eklenebilir veya fotoğraftan numara/tarih okunabilir. Kart adı, kart sahibi ve isteğe bağlı iletişim
telefonu aynı cari altında tutulur; fotoğraf, CVV ve banka doğrulama kodu kaydedilmez.

Günlük açılış PIN’sizdir; eski kasa için yalnızca ilk geçişte mevcut PIN gerekir. Kayıtlar bu
tarayıcıda şifrelidir; bu tarayıcıyı kullanan kişiler erişebilir. Başka bilgisayara aktarım için
ayrı uzun parolayla **Cari ve kart yedeği** indirilir.

**Seçili kartla POS’u aç**, kurulu POS yardımcısına seçilen cari numarası ile kart numarası ve
son kullanma tarihini geçici olarak iletir. Yardımcı görünen cari numarasını karşılaştırır ve önceden
tanıtılmış boş numara/tarih alanlarını bir kez doldurur. Aktarım en fazla iki dakika bekler;
kart düzenlemeye başlamak, başka giriş başlatmak veya cari/rota değiştirmek bekleyen aktarımı iptal eder.
CVV, tutar, SMS ve ödeme düğmeleri kullanıcıda kalır. Yardımcı olmadan firma kontrolünden sonra
elle gösterme/kopyalama kullanılabilir. Ayrıntılar: [POS yardımcısı](docs/POS_YARDIMCISI.md).

## Geliştirme

```sh
npm ci            # bağımlılıklar
npm run dev       # yerel sunucu: http://localhost:5173/CAL_bup/
npm run kontrol   # tip denetimi + lint + biçim + test + derleme (yayından önce hepsi geçmeli)
npx playwright install chromium  # ilk tarayıcı testi kurulumu
npm run test:tarayici             # gerçek Chromium/IndexedDB/OCR ile uçtan uca testler
```

`main` dalına gönderilen her değişiklik GitHub Actions'ta denetlenir ve geçerse siteye yayınlanır.

- Geliştiriciler ve yapay zekâ araçları için: [AGENTS.md](AGENTS.md)
- Google Drive bağlantısı ve ilk kurulum: [docs/DRIVE.md](docs/DRIVE.md)
- Ayrıntılı genel tarama: [docs/GENEL_TARAMA_RAPORU.md](docs/GENEL_TARAMA_RAPORU.md)
- Son çalışma ve doğrulamalar: [docs/OTURUM_NOTU.md](docs/OTURUM_NOTU.md)
- Mimari: [docs/MIMARI.md](docs/MIMARI.md)
- İş kuralları ve LED dosya biçimleri: [docs/IS_KURALLARI.md](docs/IS_KURALLARI.md)
