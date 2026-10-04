import { useEffect, useState } from 'react';
import {
  sifirOranlar,
  type IskontoBelgesi,
  type IskontoOranlari,
  type IskontoOnizlemesi,
  type IskontoCiktiTuru,
  type IskontoSatirRef,
} from '../../../../cekirdek/iskonto/turler';
import { pdfGirdisiniDogrula } from '../../../../cekirdek/iskonto/dogrulama';
import { fiyatListeleriniYukle, iskontoOnizle } from '../../../../satis/iskonto/servis';
import { iskontoMotorunuYukle } from '../../../../satis/iskonto/motorYukle';
import { indir } from '../../../../platform/dosya';
import { KullaniciHatasi } from '../../../../cekirdek/hata';
import { useIslem } from '../../../bilesenler/useIslem';

function yerelSaat(): string {
  const d = new Date(),
    p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
interface Oturum {
  onizleme: IskontoOnizlemesi;
  belgeler: IskontoBelgesi[];
  oranlar: IskontoOranlari;
  tarih: string;
}

export function useIskonto(aktif: boolean) {
  const islem = useIslem('satis:iskonto');
  const [belgeler, setBelgeler] = useState<IskontoBelgesi[]>([]);
  const [oranlar, setOranlar] = useState<IskontoOranlari>(sifirOranlar);
  const [oturum, setOturum] = useState<Oturum | null>(null);
  const [hata, setHata] = useState('');
  const [bildirim, setBildirim] = useState('');
  const [asama, setAsama] = useState('');
  const durdur = islem.durdur;
  useEffect(() => {
    if (!aktif) durdur();
  }, [aktif, durdur]);
  const basla = (metin: string) => {
    setHata('');
    setBildirim('');
    setAsama(metin);
  };

  const yukle = async (dosyalar: File[]) => {
    if (!dosyalar.length || islem.mesgul) return;
    basla('PDF fiyat listeleri okunuyor… İlk kullanımda dosya motoru da hazırlanır.');
    setOturum(null);
    const s = await islem.calistir(async (signal) => {
      if (dosyalar.length + belgeler.length > 3)
        throw new KullaniciHatasi('En fazla üç PDF yükleyebilirsiniz. Önce mevcut listeyi temizleyin.');
      const okunacak = [];
      for (const d of dosyalar) {
        pdfGirdisiniDogrula(d.name, d.size);
        signal.throwIfAborted();
        okunacak.push({ ad: d.name, bayt: new Uint8Array(await d.arrayBuffer()) });
      }
      signal.throwIfAborted();
      const motor = await iskontoMotorunuYukle();
      return fiyatListeleriniYukle(motor, okunacak, signal);
    });
    if (!islem.uygulanabilir(s)) return;
    setAsama('');
    if (s.durum === 'tamam') {
      setBelgeler([...belgeler, ...s.deger.belgeler]);
      setHata(s.deger.hatalar.map((h) => `${h.ad}: ${h.mesaj}`).join(' · '));
      if (s.deger.belgeler.length) setBildirim(`${s.deger.belgeler.length} PDF yüklendi.`);
    } else setHata(s.mesaj);
  };
  const onizle = async () => {
    if (!belgeler.length || islem.mesgul) return;
    basla('İskontolar hesaplanıyor…');
    setOturum(null);
    const tarih = yerelSaat(),
      sabitOranlar = { ...oranlar };
    const s = await islem.calistir(async (signal) => {
      const motor = await iskontoMotorunuYukle();
      return iskontoOnizle(motor, belgeler, sabitOranlar, tarih, signal);
    });
    if (!islem.uygulanabilir(s)) return;
    setAsama('');
    if (s.durum === 'tamam') {
      setOturum({ onizleme: s.deger, belgeler, oranlar: sabitOranlar, tarih });
      setBildirim('İskonto önizlemesi hazır.');
    } else setHata(s.mesaj);
  };
  const aktar = async (tur: IskontoCiktiTuru, satirlar: IskontoSatirRef[] = []) => {
    if (!oturum || islem.mesgul) return;
    basla('Çıktı hazırlanıyor…');
    const s = await islem.calistir(async (signal) => {
      const motor = await iskontoMotorunuYukle();
      const d = await motor.cikti(tur, oturum.belgeler, oturum.oranlar, oturum.tarih, satirlar, signal);
      signal.throwIfAborted();
      indir(
        d.bayt,
        d.ad,
        d.ad.endsWith('.pdf') ? 'application/pdf' : d.ad.endsWith('.zip') ? 'application/zip' : undefined,
      );
    }, 'Çıktının indirmesi başlatıldı.');
    if (!islem.uygulanabilir(s)) return;
    setAsama('');
    if (s.durum === 'tamam') setBildirim(s.mesaj);
    else setHata(s.mesaj);
  };
  const oranDegistir = (deger: IskontoOranlari) => {
    if (islem.mesgul) return;
    setOranlar(deger);
    setOturum(null);
    setHata('');
    setBildirim('');
  };
  const temizle = () => {
    if (islem.mesgul) return;
    setBelgeler([]);
    setOturum(null);
    setHata('');
    setBildirim('');
  };
  return {
    belgeler,
    oranlar,
    oturum,
    hata,
    bildirim,
    asama,
    mesgul: islem.mesgul,
    yukle,
    onizle,
    aktar,
    oranDegistir,
    temizle,
    durdur,
  };
}
