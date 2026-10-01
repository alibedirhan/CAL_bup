# BUP Rapor — Claude için notlar

## Kullanıcı

- Bupiliç İzmir Bölge Deposu'nda çalışıyor, Türkçe yazışır. **Yazılımcı değil.**
- Yanıtlar: önce 2-3 cümlelik sade özet, sonra numaralı kısa adımlar. Teknik tablo, dosya:satır,
  risk listesi verme; teknik ayrıntı `docs/` içinde durur, kullanıcı sorarsa anlatılır.
- Kaynak dosyalar **LED** sisteminden gelir (LOGO değil).
- Geliştirme Linux'ta yapılır; kullanıcı siteyi iş yerindeki Windows bilgisayarda (Chrome/Edge) kullanır.
  İş yerindeki Excel Microsoft 365 değildir.

## Kurallar

- Depo **herkese açık**. Şirket verisi (Excel dosyaları, gerçek ürün adı/miktarı) asla commit'lenmez.
  Gerçek dosyalar `ornekler/` altında durur, git dışıdır.
- Katman kuralları ve yeni rapor ekleme: `docs/MIMARI.md`. `cekirdek/` saf kalır.
- Kod, arayüz metni ve test adları Türkçe. Arayüz metni kullanıcının diliyle yazılır
  ("LED dosyaları", "depo kontrol dosyası", "gün sayfası").
- Renkler yalnızca `tema.css` belirteçlerinden; yeni belirteç hem açık hem iki koyu blokta tanımlanır.
- Her değişiklikten sonra `npm run kontrol` geçmeli. `main`'e gönderilen her şey yayına çıkar.
- Dosya başına en fazla ~400 satır; büyüyen dosya bölünür.

## Yapım aşamaları

1. Temel: iskelet, tema, yayın — **bitti** (0.1.0)
2. Hesap kuralları ve testler (Python ikizinin TypeScript'e taşınması, gerçek dosyalarla altın test)
3. Excel okuma ve yazma (ExcelJS; LED okuyucular, gün sayfası kopyalama/yazma)
4. Arayüz: adımlar, kontrol ekranı, Geçmiş, Ayarlar
5. İş yerinde 30.09 denemesi — beklenen rakamlar yalnızca yerelde: `ornekler/beklenen.json`
   (git dışı; gerçek stok rakamları açık depoya yazılmaz)
6. Google Drive'a kaydetme (drive.file kapsamı, "BUP Rapor" klasörü; OAuth istemci kimliği kurulumunu
   kullanıcıya adım adım anlat)
7. Sonraki raporlar: envanter, bakiye, palet/kasa — önce örnek LED dosyası iste

Eski Excel/VBA aracı `../bupilic-rapor-araci/` web sürümü 5. aşamayı geçene kadar kalır.
