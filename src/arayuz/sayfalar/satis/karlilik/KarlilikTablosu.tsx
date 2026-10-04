import { useMemo, useState } from 'react';
import { harfKatla } from '../../../../cekirdek/musteriTakip/metin';
import type { KarlilikSonucu } from '../../../../cekirdek/karlilik/turler';
export const para = (n: number) =>
  n.toLocaleString('tr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
export const sayi = (n: number) => n.toLocaleString('tr', { maximumFractionDigits: 2 });
export function KarlilikUyarisi({ adet }: { adet: number }) {
  return adet > 0 ? (
    <p className="karlilik-uyari" role="note">
      {adet} ürün fiyat raporuyla eşleşmedi. Bu ürünlerde maliyet 0 kabul edildiği için kâr yüksek
      görünebilir. Eşleşme Merkezi’nden kontrol edin.
    </p>
  ) : null;
}
export function KarlilikTablosu({
  sonuc,
  mesgul,
  aktar,
}: {
  sonuc: KarlilikSonucu;
  mesgul: boolean;
  aktar: (tur: 'excel' | 'gorunen', satirlar?: number[]) => Promise<void>;
}) {
  const [arama, setArama] = useState(''),
    [sira, setSira] = useState('net');
  const [gizle, setGizle] = useState(false),
    [negatif, setNegatif] = useState(false),
    [sayfa, setSayfa] = useState(0),
    [eslesmeyen, setEslesmeyen] = useState(false);
  const o = sonuc.ozet;
  const satirlar = useMemo(() => {
    const s = o.rows
      .map((r, i) => ({ r, i }))
      .filter(
        ({ r }) =>
          harfKatla(r.stock_name).includes(harfKatla(arama.trim())) &&
          (!gizle || r.unit_cost !== 0) &&
          (!negatif || r.unit_profit < 0),
      );
    if (sira === 'ad') s.sort((a, b) => a.r.stock_name.localeCompare(b.r.stock_name, 'tr'));
    if (sira === 'birim') s.sort((a, b) => b.r.unit_profit - a.r.unit_profit);
    if (sira === 'dusuk') s.sort((a, b) => a.r.net_profit - b.r.net_profit);
    return s;
  }, [o, arama, gizle, negatif, sira]);
  const son = Math.max(0, Math.ceil(satirlar.length / 50) - 1),
    no = Math.min(sayfa, son);
  return (
    <section className="kart karlilik-sonuc" aria-labelledby="karlilik-sonuc">
      <div className="kart-ust">
        <h2 id="karlilik-sonuc">Kârlılık sonuçları</h2>
        <span className="rozet durum bilgi">Analiz hazır</span>
      </div>
      <dl className="musteri-ozet">
        <div>
          <dt>Toplam stok</dt>
          <dd>{sayi(o.total_count)}</dd>
        </div>
        <div>
          <dt>Eşleşen</dt>
          <dd>{sayi(o.matched_count)}</dd>
        </div>
        <div>
          <dt>Doluluk</dt>
          <dd>%{sayi(o.fill_rate)}</dd>
        </div>
        <div>
          <dt>Toplam net kâr</dt>
          <dd>{para(o.total_net_profit)}</dd>
        </div>
      </dl>
      <KarlilikUyarisi adet={o.unmatched.length} />
      <div className="suzgecler">
        <button className="suzgec" aria-pressed={!eslesmeyen} onClick={() => setEslesmeyen(false)}>
          Sonuç tablosu
        </button>
        <button className="suzgec" aria-pressed={eslesmeyen} onClick={() => setEslesmeyen(true)}>
          Eşleşmeyen ürünler ({o.unmatched.length})
        </button>
      </div>
      {eslesmeyen ? (
        <ul aria-label="Eşleşmeyen ürünler" className="karlilik-liste">
          {o.unmatched.length ? (
            o.unmatched.map((ad, i) => <li key={i}>{ad}</li>)
          ) : (
            <li>Tüm ürünler eşleşti.</li>
          )}
        </ul>
      ) : (
        <>
          <div className="musteri-tablo-araclari">
            <label>
              Stok ara
              <input
                type="search"
                className="girdi"
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
                value={sira}
                onChange={(e) => {
                  setSira(e.target.value);
                  setSayfa(0);
                }}
              >
                <option value="net">Net kâr: yüksekten düşüğe</option>
                <option value="dusuk">Net kâr: düşükten yükseğe</option>
                <option value="birim">Birim kâr: yüksekten düşüğe</option>
                <option value="ad">Stok adı: A → Z</option>
              </select>
            </label>
          </div>
          <div className="satir-dugmeleri">
            <label>
              <input
                type="checkbox"
                checked={gizle}
                onChange={(e) => {
                  setGizle(e.target.checked);
                  setSayfa(0);
                }}
              />{' '}
              Eşleşmeyenleri gizle
            </label>
            <label>
              <input
                type="checkbox"
                checked={negatif}
                onChange={(e) => {
                  setNegatif(e.target.checked);
                  setSayfa(0);
                }}
              />{' '}
              Sadece negatif marj
            </label>
          </div>
          <div className="tablo-kap" tabIndex={0} aria-label="Kârlılık tablosu kaydırma alanı">
            <table className="tablo" aria-label="Kârlılık sonuç tablosu">
              <thead>
                <tr>
                  {[
                    'Stok İsmi',
                    'Satış Miktarı',
                    'Ort. Satış Fiyatı',
                    'Satış Tutarı',
                    'Birim Maliyet',
                    'Birim Kâr',
                    'Net Kâr',
                  ].map((b) => (
                    <th scope="col" key={b}>
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.length ? (
                  satirlar.slice(no * 50, (no + 1) * 50).map(({ r, i }) => (
                    <tr key={i}>
                      <td className="musteri-adi">{r.stock_name}</td>
                      <td className="sayi">{sayi(r.sales_quantity)}</td>
                      {[r.average_sales_price, r.sales_amount, r.unit_cost, r.unit_profit, r.net_profit].map(
                        (v, j) => (
                          <td key={j} className={`sayi ${j >= 3 && v < 0 ? 'karlilik-zarar' : ''}`}>
                            {para(v)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="bos-satir">
                      Aramanıza ve filtrelerinize uyan stok yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kart-ust">
            <p className="ipucu">
              {sayi(satirlar.length)} / {sayi(o.total_count)} stok · Sayfa {no + 1} / {son + 1}
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
        Tam Excel bütün sonuçları içerir. Görünen Excel, filtrelenmiş ve sıralanmış listenin tüm sayfalarını
        içerir.
      </p>
      <div className="satir-dugmeleri">
        <button className="dugme birincil" disabled={mesgul} onClick={() => void aktar('excel')}>
          Excel’e aktar
        </button>
        <button
          className="dugme"
          disabled={mesgul || eslesmeyen || !satirlar.length || satirlar.length > 50_000}
          onClick={() =>
            void aktar(
              'gorunen',
              satirlar.map((s) => s.i),
            )
          }
        >
          Görünenleri Excel’e aktar ({satirlar.length})
        </button>
      </div>
      {satirlar.length > 50_000 && (
        <p className="ipucu">
          Görünen Excel sınırı 50.000 satırdır. Listeyi daraltın veya tam Excel’i kullanın.
        </p>
      )}
    </section>
  );
}
