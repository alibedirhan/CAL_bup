import { useEffect, useState } from 'react';
import { musteriCiktisi } from '../../../../cekirdek/musteriTakip/cikti';
import type { ListeYonu } from '../../../../cekirdek/musteriTakip/turler';
import type { PlasiyerKaydi } from '../../../../cekirdek/musteriTakip/plasiyer';
import { dosyaOku, indir } from '../../../../platform/dosya';
import { plasiyerleriOku } from '../../../../platform/musteriPlasiyer';
import { musteriMotoruYukle } from '../../../../satis/musteriTakip/motorYukle';
import { musteriKarsilastirmasi, type MusteriOturumu } from '../../../../satis/musteriTakip/servis';
import { useIslem } from '../../../bilesenler/useIslem';

export function useMusteriTakip(aktif: boolean) {
  const islem = useIslem('satis:musteri-takip');
  const [eski, setEski] = useState<File | null>(null);
  const [yeni, setYeni] = useState<File | null>(null);
  const [harfDuyarli, setHarfDuyarli] = useState(false);
  const [oturum, setOturum] = useState<MusteriOturumu | null>(null);
  const [kayit, setKayit] = useState<PlasiyerKaydi | null>(null);
  const [ayarHatasi, setAyarHatasi] = useState('');
  const [ayarMesgul, setAyarMesgul] = useState(false);
  const [bildirim, setBildirim] = useState('');
  const [hata, setHata] = useState('');
  const durdur = islem.durdur;
  useEffect(() => {
    if (!aktif) durdur();
  }, [aktif, durdur]);
  useEffect(() => {
    let bagli = true;
    void plasiyerleriOku()
      .then((r) => {
        if (bagli) setKayit(r);
      })
      .catch(() => {
        if (bagli)
          setAyarHatasi(
            'Araç/plasiyer ayarları okunamadı. Site verisi iznini kontrol edip ayarları yeniden okuyun.',
          );
      });
    return () => {
      bagli = false;
    };
  }, []);
  const mesgul = islem.mesgul || ayarMesgul;
  const degistir = (is: () => void) => {
    if (mesgul) return;
    is();
    setOturum(null);
    setBildirim('');
    setHata('');
  };
  const ayarlariYenile = async () => {
    try {
      const r = await plasiyerleriOku();
      setKayit(r);
      setAyarHatasi('');
      return r;
    } catch {
      setKayit(null);
      setAyarHatasi(
        'Araç/plasiyer ayarları okunamadı. Önceki kayıt değiştirilmedi. Site verisi iznini kontrol edin.',
      );
      return null;
    }
  };
  const karsilastir = async () => {
    if (!eski || !yeni || !kayit || mesgul) return;
    setBildirim('');
    setHata('');
    const s = await islem.calistir(async (signal) => {
      const tazeKayit = await plasiyerleriOku();
      signal.throwIfAborted();
      setKayit(tazeKayit);
      const eskiDosya = await dosyaOku(eski);
      signal.throwIfAborted();
      const yeniDosya = await dosyaOku(yeni);
      signal.throwIfAborted();
      const motor = await musteriMotoruYukle();
      signal.throwIfAborted();
      return musteriKarsilastirmasi(motor, eskiDosya, yeniDosya, harfDuyarli, tazeKayit.plasiyerler, signal);
    }, 'Müşteri listeleri karşılaştırıldı.');
    if (s.durum === 'tamam' && islem.uygulanabilir(s)) {
      setOturum(s.deger);
      setBildirim(s.mesaj);
    } else if (islem.uygulanabilir(s)) {
      setHata(s.mesaj);
    }
  };
  const disaAktar = async (
    tur: 'excel' | 'resim',
    secim?: { yon: ListeYonu; satirlar: readonly string[] },
  ) => {
    if (!oturum || !kayit || mesgul) return;
    setBildirim('');
    setHata('');
    const s = await islem.calistir(async (signal) => {
      const tazeKayit = await plasiyerleriOku();
      signal.throwIfAborted();
      setKayit(tazeKayit);
      const cikti = musteriCiktisi(oturum.sonuc, tazeKayit.plasiyerler, secim);
      if (tur === 'excel') {
        const motor = await musteriMotoruYukle();
        signal.throwIfAborted();
        const bayt = await motor.excelOlustur(cikti, signal);
        signal.throwIfAborted();
        indir(bayt, `${cikti.ad}${secim ? `_${secim.yon}_gorunen` : ''}.xlsx`);
        return 'Excel indirmesi başlatıldı.';
      }
      const { musteriResimCiktisi } = await import('../../../../platform/musteriResimCiktisi');
      signal.throwIfAborted();
      const resim = await musteriResimCiktisi(cikti, signal);
      signal.throwIfAborted();
      indir(resim.bayt, resim.ad, resim.tur);
      return 'Resim çıktısının indirmesi başlatıldı.';
    }, 'Çıktı hazırlandı.');
    if (s.durum === 'tamam' && islem.uygulanabilir(s)) setBildirim(s.deger);
    else if (islem.uygulanabilir(s)) setHata(s.mesaj);
  };
  return {
    eski,
    yeni,
    harfDuyarli,
    oturum,
    kayit,
    ayarHatasi,
    mesgul,
    bildirim,
    hata,
    islemMesgul: islem.mesgul,
    dosyaSec: (yon: 'eski' | 'yeni', dosya: File | null) =>
      degistir(() => (yon === 'eski' ? setEski : setYeni)(dosya)),
    harfDegisti: (deger: boolean) => degistir(() => setHarfDuyarli(deger)),
    temizle: () =>
      degistir(() => {
        setEski(null);
        setYeni(null);
      }),
    kayitDegisti: setKayit,
    setAyarMesgul,
    ayarlariYenile,
    karsilastir,
    disaAktar,
    durdur,
  };
}
