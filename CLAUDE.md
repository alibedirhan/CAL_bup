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
2. Hesap kuralları ve testler — **bitti** (0.2.0). Altın test: `tests/altin/ikiz.test.ts`, gerçek dosyalarla
   Python ikiziyle 209 satır birebir aynı. İkiz çıktısı: `tools/ikiz_aktar.py` → `ornekler/ikiz.json`
3. Excel okuma ve yazma — **bitti** (0.3.0). `kaynaklar/excel.ts`, `hedef/` (sayfa kopyalama, satır ekleme +
   formül/koşullu biçim kaydırma, planı yazma), `raporlar/depoKontrol/islem.ts` (adımlar). Altın test
   `tests/altin/gercekExcel.test.ts`: 30.09 silinip yeniden oluşturulur, elle sayfayla hücre hücre aynı
   (tek fark `beklenen.json`daki örnek satır; elle sayfadaki E toplamı son satırı kapsamıyordu), diğer 48 sayfa değişmez.
   Çıktı `ornekler/cikti_30.09.xlsx`; LibreOffice ile yeniden hesaplanınca toplamlar tutuyor.
4. Arayüz: adımlar, kontrol ekranı, Geçmiş, Ayarlar
5. İş yerinde 30.09 denemesi — beklenen rakamlar yalnızca yerelde: `ornekler/beklenen.json`
   (git dışı; gerçek stok rakamları açık depoya yazılmaz)
6. Google Drive'a kaydetme (drive.file kapsamı, "BUP Rapor" klasörü; OAuth istemci kimliği kurulumunu
   kullanıcıya adım adım anlat)
7. Sonraki raporlar: envanter, bakiye, palet/kasa — önce örnek LED dosyası iste

Eski Excel/VBA aracı `../bupilic-rapor-araci/` web sürümü 5. aşamayı geçene kadar kalır.
