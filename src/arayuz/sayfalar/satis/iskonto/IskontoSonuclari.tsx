import { useMemo, useState } from 'react';
import { harfKatla, kenarlariTemizle } from '../../../../cekirdek/musteriTakip/metin';
import {
  ISKONTO_KATEGORILERI,
  type IskontoOnizlemesi,
  type IskontoCiktiTuru,
  type IskontoSatirRef,
  type IskontoKategori,
} from '../../../../cekirdek/iskonto/turler';

interface Ozellikler {
  sonuc: IskontoOnizlemesi;
  mesgul: boolean;
  aktar: (tur: IskontoCiktiTuru, satirlar?: IskontoSatirRef[]) => Promise<void>;
}
export function IskontoSonuclari({ sonuc, mesgul, aktar }: Ozellikler) {
  const [arama, setArama] = useState('');
  const [kategoriler, setKategoriler] = useState<readonly IskontoKategori[]>(ISKONTO_KATEGORILERI);
  const [sirala, setSirala] = useState('kaynak');
  const [sayfa, setSayfa] = useState(0);
  const [metin, setMetin] = useState(false);
  const satirlar = useMemo(() => {
    const sorgu = harfKatla(kenarlariTemizle(arama));
    const s = sonuc.satirlar.filter(
      (s) =>
        kategoriler.includes(s.ref.category) &&
        s.degerler.slice(0, 3).some((v) => harfKatla(String(v)).includes(sorgu)),
    );
    if (sirala === 'ad') s.sort((a, b) => a.degerler[2].localeCompare(b.degerler[2], 'tr'));
    if (sirala === 'fark') s.sort((a, b) => b.degerler[5] - a.degerler[5]);
    return s;
  }, [arama, kategoriler, sirala, sonuc]);
  const son = Math.max(0, Math.ceil(satirlar.length / 50) - 1),
    no = Math.min(sayfa, son);
  const i = sonuc.istatistik;
  return (
    <section className="kart iskonto-sonuc" aria-labelledby="iskonto-sonuc-baslik">
      <div className="kart-ust">
        <h2 id="iskonto-sonuc-baslik">İskontolu fiyat listesi</h2>
        <span className="rozet durum bilgi">Önizleme hazır</span>
      </div>
      <dl className="musteri-ozet iskonto-ozet">
        {(
          [
            ['PDF', i.pdf_count],
            ['Ürün', i.product_count],
            ['Kategori', i.category_count],
            ['Ort. iskonto', `%${i.average_discount.toLocaleString('tr', { maximumFractionDigits: 1 })}`],
            [
              'Toplam iskonto',
              i.total_discount.toLocaleString('tr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
                ' TL',
            ],
          ] as const
        ).map(([ad, deger]) => (
          <div key={ad}>
            <dt>{ad}</dt>
            <dd>{typeof deger === 'number' ? deger.toLocaleString('tr') : deger}</dd>
          </div>
        ))}
      </dl>
      <div className="suzgecler" aria-label="İskonto önizleme biçimi">
        <button className="suzgec" aria-pressed={!metin} onClick={() => setMetin(false)}>
          Ürün tablosu
        </button>
        <button className="suzgec" aria-pressed={metin} onClick={() => setMetin(true)}>
          Metin önizlemesi
        </button>
      </div>
      {metin ? (
        <pre className="iskonto-metin" aria-label="İskonto metin önizlemesi">
          {sonuc.metin}
        </pre>
      ) : (
        <>
          <div className="musteri-tablo-araclari">
            <label>
              Ürün ara
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
                className="girdi"
                value={sirala}
                onChange={(e) => {
                  setSirala(e.target.value);
                  setSayfa(0);
                }}
              >
                <option value="kaynak">Dosyadaki sıra</option>
                <option value="ad">Ürün adı: A → Z</option>
                <option value="fark">İskonto farkı: yüksekten düşüğe</option>
              </select>
            </label>
          </div>
          <fieldset className="iskonto-suzgec">
            <legend>Gösterilen kategoriler</legend>
            {ISKONTO_KATEGORILERI.map((k) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={kategoriler.includes(k)}
                  onChange={(e) => {
                    setKategoriler(
                      e.target.checked ? [...kategoriler, k] : kategoriler.filter((v) => v !== k),
                    );
                    setSayfa(0);
                  }}
                />
                {k}
              </label>
            ))}
          </fieldset>
          <div className="tablo-kap" tabIndex={0} aria-label="İskonto tablosu kaydırma alanı">
            <table className="tablo" aria-label="İskonto sonuç tablosu">
              <thead>
                <tr>
                  {['Kaynak', 'Kategori', 'Ürün', 'Orijinal', 'İskontolu', 'Fark'].map((b) => (
                    <th scope="col" key={b}>
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.length ? (
                  satirlar.slice(no * 50, (no + 1) * 50).map((s) => (
                    <tr key={JSON.stringify(s.ref)}>
                      <td>{s.degerler[0]}</td>
                      <td>{s.degerler[1]}</td>
                      <td className="musteri-adi">{s.degerler[2]}</td>
                      {s.para.map((p, j) => (
                        <td className="sayi" key={j}>
                          {p}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="bos-satir">
                      Arama ve kategori seçimine uyan ürün yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kart-ust">
            <p className="ipucu">
              {satirlar.length.toLocaleString('tr')} / {sonuc.satirlar.length.toLocaleString('tr')} ürün ·
              Sayfa {no + 1} / {son + 1}
            </p>
            <div className="satir-dugmeleri">
              <button className="dugme kucuk" disabled={no === 0} onClick={() => setSayfa(no - 1)}>
                Önceki
              </button>
              <button className="dugme kucuk" disabled={no === son} onClick={() => setSayfa(no + 1)}>
                Sonraki
              </button>
            </div>
          </div>
        </>
      )}
      <p className="ipucu">
        Tam Excel/PDF bütün ürünleri içerir. Görünen Excel, arama ve kategori seçiminizdeki tüm sayfaları
        içerir.
      </p>
      <div className="satir-dugmeleri">
        <button className="dugme birincil" disabled={mesgul} onClick={() => void aktar('excel')}>
          Excel’e aktar
        </button>
        <button className="dugme" disabled={mesgul} onClick={() => void aktar('pdf')}>
          PDF’e aktar
        </button>
        <button className="dugme" disabled={mesgul} onClick={() => void aktar('paket')}>
          Excel + PDF
        </button>
        <button
          className="dugme"
          disabled={mesgul || metin || !satirlar.length || satirlar.length > 50_000}
          onClick={() =>
            void aktar(
              'gorunen',
              satirlar.map((s) => s.ref),
            )
          }
        >
          Görünenleri Excel’e aktar ({satirlar.length})
        </button>
      </div>
      {satirlar.length > 50_000 && (
        <p className="ipucu">
          Görünen Excel en fazla 50.000 satır içerir. Tam Excel’i kullanın veya listeyi daraltın.
        </p>
      )}
    </section>
  );
}
