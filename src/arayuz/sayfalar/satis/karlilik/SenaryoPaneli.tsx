import { useState } from 'react';
import type { KarlilikEkrani } from './useKarlilik';
import type { SenaryoOranlari } from '../../../../cekirdek/karlilik/turler';
import { KarlilikUyarisi, para, sayi } from './KarlilikTablosu';
export function SenaryoPaneli({ m }: { m: KarlilikEkrani }) {
  const [sayfa, setSayfa] = useState(0);
  const s = m.sonuc?.senaryo;
  if (!s) return null;
  const son = Math.max(0, Math.ceil(s.rows.length / 50) - 1),
    no = Math.min(sayfa, son);
  return (
    <section className="kart">
      <h2>Senaryo</h2>
      <p className="ipucu">
        Maliyet, satış fiyatı ve miktar değişirse ne olur? Oranlar −100 ile %500 arasındadır. Ana analiz
        değişmez.
      </p>
      <div className="karlilik-oranlar">
        {(
          [
            ['cost_change_pct', 'Maliyet değişimi (%)'],
            ['price_change_pct', 'Fiyat değişimi (%)'],
            ['quantity_change_pct', 'Miktar değişimi (%)'],
          ] as [keyof SenaryoOranlari, string][]
        ).map(([k, ad]) => (
          <label key={k}>
            {ad}
            <input
              className="girdi"
              type="number"
              min="-100"
              max="500"
              step="0.1"
              value={Number.isNaN(m.oranlar[k]) ? '' : m.oranlar[k]}
              disabled={m.mesgul}
              onChange={(e) => m.oranDegistir({ ...m.oranlar, [k]: e.target.valueAsNumber })}
            />
          </label>
        ))}
      </div>
      <div className="satir-dugmeleri">
        <button className="dugme birincil" disabled={m.mesgul} onClick={() => void m.calistir('senaryo')}>
          Senaryoyu hesapla
        </button>
        <button
          className="dugme"
          disabled={m.mesgul || !m.senaryoHazir}
          onClick={() => void m.calistir('senaryo-excel')}
        >
          Senaryoyu Excel’e aktar
        </button>
      </div>
      {m.senaryoHazir ? (
        <>
          <KarlilikUyarisi adet={s.unmatched_count} />
          <dl className="musteri-ozet">
            <div>
              <dt>Mevcut net kâr</dt>
              <dd>{para(s.baseline_net_profit)}</dd>
            </div>
            <div>
              <dt>Senaryo net kârı</dt>
              <dd>{para(s.scenario_net_profit)}</dd>
            </div>
            <div>
              <dt>Net kâr farkı</dt>
              <dd>{para(s.net_profit_delta)}</dd>
            </div>
            <div>
              <dt>Eşleşen marj</dt>
              <dd>%{sayi(s.scenario_matched_margin_pct)}</dd>
            </div>
          </dl>
          <div className="tablo-kap" tabIndex={0} aria-label="Senaryo tablosu kaydırma alanı">
            <table className="tablo" aria-label="Kârlılık senaryo tablosu">
              <thead>
                <tr>
                  {[
                    'Stok',
                    'Mevcut Kâr',
                    'Senaryo Kârı',
                    'Fark',
                    'Marj (%)',
                    'Başabaş Fiyatı',
                    'Katkı (%)',
                    'Kümülatif (%)',
                    'Pareto',
                  ].map((a) => (
                    <th scope="col" key={a}>
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.slice(no * 50, (no + 1) * 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.stock_name}</td>
                    <td className="sayi">{para(r.current_net_profit)}</td>
                    <td className="sayi">{para(r.scenario_net_profit)}</td>
                    <td className="sayi">{para(r.net_profit_delta)}</td>
                    <td className="sayi">{sayi(r.scenario_margin_pct)}</td>
                    <td className="sayi">{para(r.break_even_price)}</td>
                    <td className="sayi">{r.contribution_pct === null ? '—' : sayi(r.contribution_pct)}</td>
                    <td className="sayi">
                      {r.cumulative_contribution_pct === null ? '—' : sayi(r.cumulative_contribution_pct)}
                    </td>
                    <td>{r.pareto_class}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kart-ust">
            <p className="ipucu">
              Sayfa {no + 1} / {son + 1} · Pareto yalnız maliyeti eşleşen pozitif kârları kapsar.
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
      ) : (
        <p role="status">Oranlar değişti. Güncel sonucu görmek için senaryoyu hesaplayın.</p>
      )}
    </section>
  );
}
