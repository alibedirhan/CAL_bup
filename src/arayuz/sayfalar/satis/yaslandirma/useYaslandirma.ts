import { useEffect, useState } from 'react';
import { KullaniciHatasi } from '../../../../cekirdek/hata';
import { excelGirdisiniDogrula } from '../../../../cekirdek/yaslandirma/dogrulama';
import type {
  AtamaDurumu,
  AtamaGirdisi,
  YaslandirmaDosyasi,
  YaslandirmaIstegi,
  YaslandirmaSonucu,
} from '../../../../cekirdek/yaslandirma/turler';
import { indir } from '../../../../platform/dosya';
import { atamaKaydiniOku, atamaKaydiniYaz } from '../../../../platform/yaslandirmaDeposu';
import { yaslandirmaMotorunuYukle } from '../../../../satis/yaslandirma/motorYukle';
import { yaslandirmaIslemi } from '../../../../satis/yaslandirma/servis';
import { useIslem } from '../../../bilesenler/useIslem';

type AtamaEylemi = 'atama' | 'ata' | 'kaldir' | 'geri-al';
const ATAMA_MESAJI: Record<AtamaEylemi, string> = {
  atama: 'Araç atamaları yüklendi.',
  ata: 'Atama kaydedildi.',
  kaldir: 'Atama kaldırıldı; son değişikliği geri alabilirsiniz.',
  'geri-al': 'Son atama değişikliği geri alındı.',
};

/** Dosya ve sonuç oturum belleğindedir; araç atamaları sürümlü tarayıcı kaydıdır. */
export function useYaslandirma(aktif: boolean) {
  const islem = useIslem('satis:yaslandirma');
  const [dosya, setDosya] = useState<File | null>(null);
  const [kaynak, setKaynak] = useState<YaslandirmaDosyasi | null>(null);
  const [sonuc, setSonuc] = useState<YaslandirmaSonucu | null>(null);
  const [atama, setAtama] = useState<AtamaDurumu | null>(null);
  const [hata, setHata] = useState(''),
    [bildirim, setBildirim] = useState('');
  const durdur = islem.durdur;
  useEffect(() => {
    if (!aktif) durdur();
  }, [aktif, durdur]);

  const sec = (d: File | undefined) => {
    if (!d || islem.mesgul) return;
    try {
      excelGirdisiniDogrula(d.name, d.size);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Excel seçilemedi.');
      return;
    }
    // Yeni dosya eski sonucu ve çıktıları geçersiz kılar.
    setDosya(d);
    setKaynak(null);
    setSonuc(null);
    setHata('');
    setBildirim('');
  };

  const yurut = async <T>(
    is: (signal: AbortSignal) => Promise<T>,
    yazma: boolean,
  ): Promise<T | undefined> => {
    if (islem.mesgul) return undefined;
    setHata('');
    setBildirim('');
    const s = await islem.calistir(is, 'İşlem tamamlandı.', yazma);
    if (!islem.uygulanabilir(s)) return undefined;
    if (s.durum !== 'tamam') {
      setHata(s.mesaj);
      return undefined;
    }
    return s.deger;
  };

  const analizEt = async () => {
    setSonuc(null);
    setKaynak(null);
    const r = await yurut(async (signal) => {
      if (!dosya) throw new KullaniciHatasi('Yaşlandırma raporunu seçin.');
      excelGirdisiniDogrula(dosya.name, dosya.size);
      const girdi = { ad: dosya.name, bayt: new Uint8Array(await dosya.arrayBuffer()) };
      signal.throwIfAborted();
      const motor = await yaslandirmaMotorunuYukle();
      // Motor işçiye aktarırken baytları taşıyabilir; oturumdaki kopya çıktılar için korunur.
      const cevap = await yaslandirmaIslemi(
        motor,
        { eylem: 'analiz', dosya: { ad: girdi.ad, bayt: girdi.bayt.slice() } },
        signal,
      );
      if (cevap.tur !== 'analiz') throw new KullaniciHatasi('Yaşlandırma yanıtı doğrulanamadı.');
      return { sonuc: cevap.sonuc, girdi };
    }, false);
    if (!r) return;
    setSonuc(r.sonuc);
    setKaynak(r.girdi);
    setBildirim(
      r.sonuc.ozet.vehicle_count ? 'Yaşlandırma analizi hazır.' : 'Analiz tamamlandı ancak araç bulunamadı.',
    );
  };

  const aktar = async (eylem: 'excel' | 'gorunen', araclar: string[] = []) => {
    const r = await yurut(async (signal) => {
      if (!kaynak || !sonuc) throw new KullaniciHatasi('Önce yaşlandırma analizi çalıştırın.');
      const motor = await yaslandirmaMotorunuYukle();
      const dosyaKopyasi = { ad: kaynak.ad, bayt: kaynak.bayt.slice() };
      const istek: YaslandirmaIstegi =
        eylem === 'excel' ? { eylem, dosya: dosyaKopyasi } : { eylem, dosya: dosyaKopyasi, araclar };
      const cevap = await yaslandirmaIslemi(motor, istek, signal);
      if (cevap.tur !== 'dosya') throw new KullaniciHatasi('Excel çıktısı doğrulanamadı.');
      signal.throwIfAborted();
      indir(cevap.bayt, cevap.ad);
      return true;
    }, false);
    if (r) setBildirim('Excel indirmesi başlatıldı.');
  };

  /** Python kaynağının kayıt kurtarma/yedek davranışı korunur; yazma sekmeler arası CAS ile saklanır. */
  const atamaIslemi = async (eylem: AtamaEylemi, alanlar: { atama?: AtamaGirdisi; aracNo?: string } = {}) => {
    const yazma = eylem !== 'atama';
    const r = await yurut(async (signal) => {
      const mevcut = await atamaKaydiniOku();
      signal.throwIfAborted();
      const motor = await yaslandirmaMotorunuYukle();
      const istek: YaslandirmaIstegi =
        eylem === 'ata'
          ? { eylem, kayit: mevcut, atama: alanlar.atama as AtamaGirdisi }
          : eylem === 'kaldir'
            ? { eylem, kayit: mevcut, aracNo: alanlar.aracNo ?? '' }
            : { eylem, kayit: mevcut };
      const cevap = await yaslandirmaIslemi(motor, istek, signal);
      if (cevap.tur !== 'atama') throw new KullaniciHatasi('Araç atama yanıtı doğrulanamadı.');
      if (yazma && !(eylem === 'geri-al' && cevap.geriAlindi === false))
        await atamaKaydiniYaz(mevcut, cevap.kayit, signal);
      return cevap;
    }, yazma);
    if (!r) {
      // Yazma sonucu belirsizse veya kayıt başka sekmede değiştiyse eski liste gösterilmez.
      if (yazma) setAtama(null);
      return false;
    }
    setAtama(r);
    setBildirim(
      eylem === 'geri-al' && r.geriAlindi === false
        ? 'Geri alınabilecek geçerli bir değişiklik bulunamadı.'
        : ATAMA_MESAJI[eylem],
    );
    return true;
  };

  const temizle = () => {
    if (islem.mesgul) return;
    setDosya(null);
    setKaynak(null);
    setSonuc(null);
    setHata('');
    setBildirim('');
  };
  return {
    dosya,
    sonuc,
    atama,
    hata,
    bildirim,
    mesgul: islem.mesgul,
    sec,
    analizEt,
    aktar,
    atamaIslemi,
    temizle,
    durdur,
  };
}
export type YaslandirmaEkrani = ReturnType<typeof useYaslandirma>;
