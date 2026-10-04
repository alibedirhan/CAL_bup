import { useEffect, useState } from 'react';
import { KullaniciHatasi } from '../../../../cekirdek/hata';
import { excelGirdisiniDogrula } from '../../../../cekirdek/karlilik/dogrulama';
import {
  SIFIR_SENARYO,
  type KarlilikIstegi,
  type KarlilikSonucu,
  type KarlilikKaydi,
  type KarlilikDosyasi,
  type DonemKaydi,
  type DonemKarsilastirmasi,
  type SenaryoOranlari,
  type KarlilikEylemi,
} from '../../../../cekirdek/karlilik/turler';
import { karlilikKaydiniOku, karlilikKaydiniYaz } from '../../../../platform/karlilikDeposu';
import { indir } from '../../../../platform/dosya';
import { karlilikMotorunuYukle } from '../../../../satis/karlilik/motorYukle';
import { karlilikIslemi } from '../../../../satis/karlilik/servis';
import { useIslem } from '../../../bilesenler/useIslem';

function saat() {
  const d = new Date(),
    p = (n: number, h = 2) => String(n).padStart(h, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
const YAZMA = ['oner', 'onayla', 'kaldir', 'eslesme-geri', 'donem-kaydet', 'donem-sil', 'donem-geri'];
export function useKarlilik(aktif: boolean) {
  const islem = useIslem('satis:karlilik');
  const [satis, setSatis] = useState<File | null>(null),
    [fiyat, setFiyat] = useState<File | null>(null);
  const [sonuc, setSonuc] = useState<KarlilikSonucu | null>(null);
  const [oturum, setOturum] = useState<{
    satis: KarlilikDosyasi;
    fiyat: KarlilikDosyasi;
    kayit: KarlilikKaydi;
  } | null>(null);
  const [kayit, setKayit] = useState<KarlilikKaydi | null>(null);
  const [donemler, setDonemler] = useState<DonemKaydi[]>([]);
  const [karsilastirma, setKarsilastirma] = useState<DonemKarsilastirmasi | null>(null);
  const [oranlar, setOranlar] = useState<SenaryoOranlari>(SIFIR_SENARYO);
  const [senaryoHazir, setSenaryoHazir] = useState(false);
  const [hata, setHata] = useState(''),
    [bildirim, setBildirim] = useState('');
  const durdur = islem.durdur;
  useEffect(() => {
    if (!aktif) durdur();
  }, [aktif, durdur]);

  const sec = (tur: 'satis' | 'fiyat', d: File | undefined) => {
    if (!d || islem.mesgul) return;
    try {
      excelGirdisiniDogrula(d.name, d.size);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Excel seçilemedi.');
      return;
    }
    (tur === 'satis' ? setSatis : setFiyat)(d);
    setSonuc(null);
    setOturum(null);
    setSenaryoHazir(false);
    setHata('');
    setBildirim('');
  };
  const calistir = async (eylem: KarlilikEylemi, alanlar: Partial<KarlilikIstegi> = {}) => {
    if (islem.mesgul) return;
    setHata('');
    setBildirim('');
    if (eylem === 'analiz') {
      setSonuc(null);
      setOturum(null);
      setSenaryoHazir(false);
    }
    const s = await islem.calistir(
      async (signal) => {
        const mevcut = await karlilikKaydiniOku();
        signal.throwIfAborted();
        const motor = await karlilikMotorunuYukle();
        signal.throwIfAborted();
        let kaynak = oturum;
        if (eylem === 'analiz') {
          if (!satis || !fiyat) throw new KullaniciHatasi('Satış ve fiyat raporlarını seçin.');
          const dosya = async (f: File) => {
            excelGirdisiniDogrula(f.name, f.size);
            const bayt = new Uint8Array(await f.arrayBuffer());
            signal.throwIfAborted();
            return { ad: f.name, bayt };
          };
          kaynak = { satis: await dosya(satis), fiyat: await dosya(fiyat), kayit: mevcut };
        }
        if (!['kayit', 'karsilastir', 'donem-sil', 'donem-geri', 'analiz'].includes(eylem) && !kaynak)
          throw new KullaniciHatasi('Önce kârlılık analizi çalıştırın.');
        const cevap = await karlilikIslemi(
          motor,
          {
            tur: 'karlilik',
            eylem,
            kayit: mevcut,
            tarih: saat(),
            ...(kaynak ? { satis: kaynak.satis, fiyat: kaynak.fiyat } : {}),
            ...(kaynak && eylem !== 'analiz' ? { beklenenEslesmeler: kaynak.kayit.eslesmeler.guncel } : {}),
            ...(eylem === 'senaryo' || eylem === 'senaryo-excel' ? { oranlar } : {}),
            ...alanlar,
          },
          signal,
        );
        signal.throwIfAborted();
        if (!YAZMA.includes(eylem)) {
          const sonKayit = await karlilikKaydiniOku();
          signal.throwIfAborted();
          if (JSON.stringify(sonKayit) !== JSON.stringify(mevcut))
            throw new KullaniciHatasi(
              'Kârlılık kayıtları başka sekmede değişti. Kayıtları yenileyip yeniden deneyin.',
            );
        }
        let yeni = cevap.kayit ?? mevcut;
        if (YAZMA.includes(eylem)) {
          if (!cevap.kayit) throw new KullaniciHatasi('Kayıt sonucu doğrulanamadı.');
          yeni = await karlilikKaydiniYaz(mevcut, cevap.kayit, signal);
        }
        if (cevap.tur === 'dosya') {
          if (!cevap.bayt || !cevap.ad) throw new KullaniciHatasi('Excel çıktısı doğrulanamadı.');
          signal.throwIfAborted();
          indir(cevap.bayt, cevap.ad);
        }
        return { cevap, yeni, kaynak: kaynak ? { ...kaynak, kayit: yeni } : null };
      },
      'İşlem tamamlandı.',
      YAZMA.includes(eylem),
    );
    if (!islem.uygulanabilir(s)) return;
    if (s.durum !== 'tamam') {
      setHata(s.mesaj);
      if (s.mesaj.includes('başka sekmede') || (YAZMA.includes(eylem) && s.durum === 'belirsiz')) {
        setSonuc(null);
        setOturum(null);
        setSenaryoHazir(false);
        setKarsilastirma(null);
      }
      return;
    }
    const { cevap, yeni, kaynak } = s.deger;
    setKayit(yeni);
    if (cevap.donemler) {
      setDonemler(cevap.donemler);
      setKarsilastirma(null);
    }
    if (cevap.sonuc) {
      setSonuc(cevap.sonuc);
      setOturum(kaynak);
      setSenaryoHazir(true);
      if (eylem !== 'senaryo') setOranlar(SIFIR_SENARYO);
    }
    if (cevap.karsilastirma) setKarsilastirma(cevap.karsilastirma);
    setBildirim(
      cevap.tur === 'dosya'
        ? 'Excel indirmesi başlatıldı.'
        : YAZMA.includes(eylem)
          ? 'Kârlılık kaydı saklandı.'
          : eylem === 'kayit'
            ? 'Kayıtlar yenilendi.'
            : eylem === 'senaryo'
              ? 'Senaryo hesaplandı.'
              : eylem === 'karsilastir'
                ? 'Dönem karşılaştırması hazır.'
                : 'Kârlılık analizi hazır.',
    );
  };
  const oranDegistir = (v: SenaryoOranlari) => {
    if (!islem.mesgul) {
      setOranlar(v);
      setSenaryoHazir(false);
      setHata('');
      setBildirim('');
    }
  };
  const temizle = () => {
    if (!islem.mesgul) {
      setSatis(null);
      setFiyat(null);
      setSonuc(null);
      setOturum(null);
      setOranlar(SIFIR_SENARYO);
      setSenaryoHazir(false);
      setHata('');
      setBildirim('');
    }
  };
  return {
    satis,
    fiyat,
    sonuc,
    kayit,
    donemler,
    karsilastirma,
    oranlar,
    senaryoHazir,
    hata,
    bildirim,
    mesgul: islem.mesgul,
    calistir,
    sec,
    oranDegistir,
    temizle,
    durdur,
  };
}
export type KarlilikEkrani = ReturnType<typeof useKarlilik>;
