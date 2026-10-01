# BUP Rapor

Bupiliç İzmir Bölge Deposu için LED çıktılarından günlük raporları hazırlayan tarayıcı uygulaması.

**Adres:** https://alibedirhan.github.io/Bup_Excel_Rapor/

- Kurulum gerekmez. Chrome ya da Edge'de adresi açmanız yeterli.
- Seçtiğiniz Excel dosyaları **yalnızca sizin bilgisayarınızda, tarayıcının içinde** işlenir. Hiçbir sunucuya gönderilmez.
- Bu depoda yalnızca programın kendisi bulunur. Şirket verisi, LED dosyaları ve depo kontrol dosyası depoya hiçbir zaman eklenmez.

## Raporlar

| Rapor               | Durum            |
| ------------------- | ---------------- |
| Günlük depo kontrol | Yapım aşamasında |
| Envanter            | Yakında          |
| Bakiye              | Yakında          |
| Palet / kasa        | Yakında          |

## Geliştirme

```sh
npm ci            # bağımlılıklar
npm run dev       # yerel sunucu: http://localhost:5173/Bup_Excel_Rapor/
npm run kontrol   # tip denetimi + lint + biçim + test + derleme (yayından önce hepsi geçmeli)
```

`main` dalına gönderilen her değişiklik GitHub Actions'ta denetlenir ve geçerse siteye yayınlanır.
Mimari ve kurallar: [docs/MIMARI.md](docs/MIMARI.md).
