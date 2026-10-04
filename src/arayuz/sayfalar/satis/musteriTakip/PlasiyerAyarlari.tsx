import { useState } from 'react';
import type { PlasiyerKaydi } from '../../../../cekirdek/musteriTakip/plasiyer';
import { kenarlariTemizle } from '../../../../cekirdek/musteriTakip/metin';
import { plasiyerleriKaydet } from '../../../../platform/musteriPlasiyer';
import { FormHatasi } from '../../../bilesenler/FormHatasi';
import { useIslem } from '../../../bilesenler/useIslem';

interface Ozellikler {
  kayit: PlasiyerKaydi | null;
  hata: string;
  kilitli: boolean;
  degisti: (kayit: PlasiyerKaydi) => void;
  yenile: () => Promise<PlasiyerKaydi | null>;
  mesgulDegisti: (mesgul: boolean) => void;
}

export function PlasiyerAyarlari({ kayit, hata, kilitli, degisti, yenile, mesgulDegisti }: Ozellikler) {
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  const [satirlar, setSatirlar] = useState<{ no: string; ad: string }[]>([]);
  const [alanHatasi, setAlanHatasi] = useState('');
  const [mesaj, setMesaj] = useState('');
  const islem = useIslem('satis:musteri-plasiyer');
  const mesgul = kilitli || islem.mesgul;
  const ac = async () => {
    mesgulDegisti(true);
    try {
      const taze = await yenile();
      setDuzenleniyor(true);
      setSatirlar(
        Object.entries(taze?.plasiyerler ?? {})
          .sort()
          .map(([no, ad]) => ({ no, ad })),
      );
      setAlanHatasi('');
      setMesaj('');
    } finally {
      mesgulDegisti(false);
    }
  };
  const kaydet = async (geriAl = false) => {
    if (!kayit || mesgul) return;
    const degerler: Record<string, string> = {};
    for (const satir of geriAl ? [] : satirlar) {
      const no = kenarlariTemizle(satir.no);
      const ad = kenarlariTemizle(satir.ad);
      if (!no && !ad) continue;
      if (!/^\d{2}$/.test(no) || !ad) {
        setAlanHatasi('Araç numarası iki haneli, plasiyer adı dolu olmalıdır.');
        return;
      }
      degerler[no] = ad;
    }
    setAlanHatasi('');
    setMesaj('');
    mesgulDegisti(true);
    try {
      const s = await islem.calistir(
        (signal) => plasiyerleriKaydet(kayit.nesil, geriAl ? 'geri-al' : degerler, signal),
        'Araç/plasiyer ayarları kaydedildi.',
        true,
      );
      if (s.durum === 'tamam' && islem.uygulanabilir(s)) {
        degisti(s.deger);
        setSatirlar(
          Object.entries(s.deger.plasiyerler)
            .sort()
            .map(([no, ad]) => ({ no, ad })),
        );
        setMesaj(geriAl ? 'Son değişiklik geri alındı.' : s.mesaj);
      } else if (islem.uygulanabilir(s)) {
        setAlanHatasi(s.mesaj);
      }
    } finally {
      mesgulDegisti(false);
    }
  };
  return (
    <section className="musteri-ayarlar" aria-label="Araç ve plasiyer ayarları">
      <button className="dugme kucuk" type="button" onClick={() => void ac()} disabled={mesgul}>
        Araç/plasiyer ayarları
      </button>
      <FormHatasi id="plasiyer-okuma-hatasi" hata={hata} />
      {duzenleniyor && (
        <div className="musteri-ayar-duzen">
          <p className="ipucu">
            Eşleştirme çıktı başlığını ve dosya adını belirler. Ayarlar bu tarayıcıda saklanır.
          </p>
          <div className="satir-dugmeleri">
            <button
              className="dugme kucuk"
              onClick={() => setSatirlar([...satirlar, { no: '', ad: '' }])}
              disabled={mesgul || !kayit || satirlar.length >= 100}
            >
              Satır ekle
            </button>
          </div>
          {kayit && (
            <p className="ipucu">
              Kayıtlı eşleştirme: {Object.keys(kayit.plasiyerler).length}. Tekrarlanan araç numarasında son
              satır kullanılır.
            </p>
          )}
          {satirlar.map((satir, i) => (
            <div className="musteri-plasiyer-satiri" key={i}>
              <label>
                Araç {i + 1}
                <input
                  className="girdi"
                  value={satir.no}
                  maxLength={2}
                  inputMode="numeric"
                  disabled={mesgul}
                  onChange={(e) =>
                    setSatirlar(satirlar.map((s, n) => (n === i ? { ...s, no: e.target.value } : s)))
                  }
                />
              </label>
              <label>
                Plasiyer {i + 1}
                <input
                  className="girdi"
                  value={satir.ad}
                  maxLength={100}
                  disabled={mesgul}
                  onChange={(e) =>
                    setSatirlar(satirlar.map((s, n) => (n === i ? { ...s, ad: e.target.value } : s)))
                  }
                />
              </label>
              <button
                className="dugme kucuk"
                aria-label={`${i + 1}. eşleştirmeyi sil`}
                disabled={mesgul}
                onClick={() => setSatirlar(satirlar.filter((_, n) => n !== i))}
              >
                Sil
              </button>
            </div>
          ))}
          <FormHatasi id="plasiyer-ayar-hatasi" hata={alanHatasi} />
          {mesaj && <p role="status">{mesaj}</p>}
          <div className="satir-dugmeleri">
            <button className="dugme birincil" onClick={() => void kaydet()} disabled={mesgul || !kayit}>
              Ayarları kaydet
            </button>
            <button className="dugme" onClick={() => void kaydet(true)} disabled={mesgul || !kayit?.yedek}>
              Son değişikliği geri al
            </button>
            <button className="dugme" onClick={() => setDuzenleniyor(false)} disabled={mesgul}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
