import { useMemo, useState } from 'react';
import { harfKatla, kenarlariTemizle } from '../../../../cekirdek/musteriTakip/metin';
import type { ListeYonu, MusteriSonucu } from '../../../../cekirdek/musteriTakip/turler';

interface Ozellikler {
  sonuc: MusteriSonucu;
  mesgul: boolean;
  aktar: (tur: 'excel' | 'resim', secim?: { yon: ListeYonu; satirlar: readonly string[] }) => Promise<void>;
}

const SAYFA_BOYU = 50;

export function MusteriSonuclari({ sonuc, mesgul, aktar }: Ozellikler) {
  const [yon, setYon] = useState<ListeYonu>('eksik');
  const [arama, setArama] = useState('');
  const [sirala, setSirala] = useState('kaynak');
  const [sayfa, setSayfa] = useState(0);
  const satirlar = useMemo(() => {
    const sorgu = harfKatla(kenarlariTemizle(arama));
    const liste = yon === 'eksik' ? sonuc.eksikler : sonuc.yeniler;
    const sonucListe = liste.filter((ad) => harfKatla(ad).includes(sorgu));
    if (sirala !== 'kaynak') sonucListe.sort((a, b) => a.localeCompare(b, 'tr') * (sirala === 'az' ? 1 : -1));
    return sonucListe;
  }, [arama, sirala, yon, sonuc]);
  const sonSayfa = Math.max(0, Math.ceil(satirlar.length / SAYFA_BOYU) - 1);
  const sayfaNo = Math.min(sayfa, sonSayfa);
  const gosterilen = satirlar.slice(sayfaNo * SAYFA_BOYU, (sayfaNo + 1) * SAYFA_BOYU);
  return (
    <section className="kart" aria-labelledby="musteri-sonuc-baslik">
      <div className="kart-ust">
        <h2 id="musteri-sonuc-baslik">Karşılaştırma sonucu</h2>
        <span className="rozet durum bilgi">Karşılaştırıldı</span>
      </div>
      <p>{sonuc.mesaj}</p>
      <dl className="musteri-ozet">
        {(
          [
            ['Eski liste', sonuc.eskiSayisi],
            ['Yeni liste', sonuc.yeniSayisi],
            ['Eksik müşteri', sonuc.eksikler.length],
            ['Yeni müşteri', sonuc.yeniler.length],
          ] as const
        ).map(([ad, sayi]) => (
          <div key={ad}>
            <dt>{ad}</dt>
            <dd>{sayi.toLocaleString('tr')}</dd>
          </div>
        ))}
      </dl>
      <div className="suzgecler" aria-label="Müşteri listesi seçimi">
        <button
          className="suzgec"
          aria-pressed={yon === 'eksik'}
          onClick={() => {
            setYon('eksik');
            setSayfa(0);
          }}
        >
          Eksik Müşteriler <span>{sonuc.eksikler.length}</span>
        </button>
        <button
          className="suzgec"
          aria-pressed={yon === 'yeni'}
          onClick={() => {
            setYon('yeni');
            setSayfa(0);
          }}
        >
          Yeni Müşteriler <span>{sonuc.yeniler.length}</span>
        </button>
      </div>
      <div className="musteri-tablo-araclari">
        <label>
          Cari ara
          <input
            className="girdi"
            type="search"
            value={arama}
            onChange={(e) => {
              setArama(e.target.value);
              setSayfa(0);
            }}
          />
        </label>
        <label>
          Sıralama
          <select
            aria-label="Sıralama"
            className="girdi"
            value={sirala}
            onChange={(e) => {
              setSirala(e.target.value);
              setSayfa(0);
            }}
          >
            <option value="kaynak">Dosyadaki sıra</option>
            <option value="az">Ad: A → Z</option>
            <option value="za">Ad: Z → A</option>
          </select>
        </label>
      </div>
      <div className="tablo-kap" tabIndex={0} aria-label="Müşteri sonuçları kaydırma alanı">
        <table className="tablo" aria-label={yon === 'eksik' ? 'Eksik müşteriler' : 'Yeni müşteriler'}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Cari Ünvan</th>
            </tr>
          </thead>
          <tbody>
            {gosterilen.length ? (
              gosterilen.map((ad, i) => (
                <tr key={ad}>
                  <td>{sayfaNo * SAYFA_BOYU + i + 1}</td>
                  <td className="musteri-adi">{ad}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="bos-satir">
                  {arama
                    ? 'Aramanıza uyan müşteri yok.'
                    : yon === 'eksik'
                      ? 'Eski listedeki tüm müşteriler yeni listede mevcut.'
                      : 'Yeni listede eklenen müşteri yok.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="kart-ust">
        <p className="ipucu">
          {satirlar.length.toLocaleString('tr')} satır · Sayfa {sayfaNo + 1} / {sonSayfa + 1}
        </p>
        <div className="satir-dugmeleri">
          <button className="dugme kucuk" onClick={() => setSayfa(sayfaNo - 1)} disabled={sayfaNo === 0}>
            Önceki
          </button>
          <button
            className="dugme kucuk"
            onClick={() => setSayfa(sayfaNo + 1)}
            disabled={sayfaNo === sonSayfa}
          >
            Sonraki
          </button>
        </div>
      </div>
      <p className="ipucu">
        Tam Excel ve resim tüm eksikleri içerir. Görünen Excel, seçili listedeki arama ve sıralamanın tamamını
        içerir.
      </p>
      <div className="satir-dugmeleri">
        <button className="dugme birincil" disabled={mesgul} onClick={() => void aktar('excel')}>
          Eksikleri Excel’e aktar
        </button>
        <button
          className="dugme"
          disabled={mesgul || sonuc.eksikler.length > 5000}
          onClick={() => void aktar('resim')}
        >
          Eksikleri resme aktar
        </button>
        <button
          className="dugme"
          disabled={mesgul || !satirlar.length}
          onClick={() => void aktar('excel', { yon, satirlar })}
        >
          Görünenleri Excel’e aktar ({satirlar.length})
        </button>
      </div>
      {sonuc.eksikler.length > 5000 && (
        <p className="ipucu">5.000 satırdan büyük listeleri Excel ile aktarabilirsiniz.</p>
      )}
      {sonuc.eksikler.length > 200 && sonuc.eksikler.length <= 5000 && (
        <p className="ipucu">
          Uzun resim çıktısı {Math.ceil(sonuc.eksikler.length / 200)} PNG sayfası içeren tek ZIP olarak
          indirilir.
        </p>
      )}
    </section>
  );
}
