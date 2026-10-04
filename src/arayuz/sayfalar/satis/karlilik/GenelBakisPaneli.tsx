import { useState } from 'react';
import {
  KAR_KATEGORILERI,
  type KarKategorisi,
  type KarlilikSonucu,
} from '../../../../cekirdek/karlilik/turler';
import { KarlilikUyarisi, para, sayi } from './KarlilikTablosu';
export function GenelBakisPaneli({ sonuc }: { sonuc: KarlilikSonucu }) {
  const [kategori, setKategori] = useState<KarKategorisi>('all');
  const g = sonuc.genelBakis,
    urunler = g.kategoriler[kategori];
  const max = Math.max(1, ...urunler.map((u) => Math.abs(u.net_profit)));
  return (
    <section className="kart">
      <h2>Genel bakış</h2>
      <KarlilikUyarisi adet={sonuc.ozet.unmatched.length} />
      <dl className="musteri-ozet">
        <div>
          <dt>Kârlı ürün</dt>
          <dd>{sayi(g.istatistik.profitable_count)}</dd>
        </div>
        <div>
          <dt>Sıfır / zararda</dt>
          <dd>{sayi(g.istatistik.loss_count)}</dd>
        </div>
        <div>
          <dt>Ort. net kâr</dt>
          <dd>{para(g.istatistik.average_net_profit)}</dd>
        </div>
        <div>
          <dt>En yüksek net kâr</dt>
          <dd>{para(g.istatistik.max_net_profit)}</dd>
        </div>
      </dl>
      <div className="suzgecler" aria-label="Kârlılık dağılımı">
        {(Object.keys(KAR_KATEGORILERI) as KarKategorisi[]).map((k) => (
          <button key={k} className="suzgec" aria-pressed={kategori === k} onClick={() => setKategori(k)}>
            {KAR_KATEGORILERI[k]} ({k === 'all' ? sonuc.ozet.total_count : g.dagilim[k]})
          </button>
        ))}
      </div>
      <p className="ipucu">
        Kâr grupları kaynak uygulamadaki %33 ve %67 eşiklerine göre belirlenir. Her grupta ilk 15 ürün
        gösterilir.
      </p>
      <ul className="karlilik-cubuklar" aria-label="Ürünlerin net kârı">
        {urunler.length ? (
          urunler.map((u, i) => (
            <li key={i}>
              <div>
                <span>{u.stock_name}</span>
                <strong>{para(u.net_profit)}</strong>
              </div>
              <div className="karlilik-cubuk-iz" aria-hidden="true">
                <span
                  className={u.net_profit < 0 ? 'karlilik-cubuk-zarar' : ''}
                  style={{ width: `${(Math.abs(u.net_profit) / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        ) : (
          <li>Bu grupta ürün yok.</li>
        )}
      </ul>
    </section>
  );
}
