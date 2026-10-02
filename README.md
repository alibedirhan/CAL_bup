# CAL bup

Bupiliç İzmir Bölge Deposu için LED çıktılarından günlük raporları hazırlayan tarayıcı uygulaması.

**Adres:** https://alibedirhan.github.io/CAL_bup/

- Kurulum gerekmez. Chrome ya da Edge'de adresi açmanız yeterli.
- Seçtiğiniz Excel dosyaları **yalnızca sizin bilgisayarınızda, tarayıcının içinde** işlenir. Google Drive’a yalnızca siz isterseniz gönderilir.
- Bu depoda yalnızca programın kendisi bulunur. Şirket verisi, LED dosyaları ve depo kontrol dosyası depoya hiçbir zaman eklenmez.

## Raporlar

| Rapor               | Durum   |
| ------------------- | ------- |
| Günlük depo kontrol | Hazır   |
| Envanter            | Yakında |
| Bakiye              | Yakında |
| Palet / kasa        | Yakında |

## Geliştirme

```sh
npm ci            # bağımlılıklar
npm run dev       # yerel sunucu: http://localhost:5173/CAL_bup/
npm run kontrol   # tip denetimi + lint + biçim + test + derleme (yayından önce hepsi geçmeli)
```

`main` dalına gönderilen her değişiklik GitHub Actions'ta denetlenir ve geçerse siteye yayınlanır.

- Geliştiriciler ve yapay zekâ araçları için: [AGENTS.md](AGENTS.md)
- Google Drive bağlantısı ve ilk kurulum: [docs/DRIVE.md](docs/DRIVE.md)
- Son çalışma ve doğrulamalar: [docs/OTURUM_NOTU.md](docs/OTURUM_NOTU.md)
- Mimari: [docs/MIMARI.md](docs/MIMARI.md)
- İş kuralları ve LED dosya biçimleri: [docs/IS_KURALLARI.md](docs/IS_KURALLARI.md)
