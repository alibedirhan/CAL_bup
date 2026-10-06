import { useEffect, useRef, useState } from 'react';
import type { KarlilikEkrani } from './useKarlilik';
import { KarlilikUyarisi, para, sayi } from './KarlilikTablosu';
export function DonemPaneli({ m }: { m: KarlilikEkrani }) {
  const [ad, setAd] = useState(''),
    [ilk, setIlk] = useState(''),
    [ikinci, setIkinci] = useState('');
  const c = m.karsilastirma;
  // Bölüm açılınca kayıtlı dönemler bir kez kendiliğinden okunur.
  const okundu = useRef(false);
  const { calistir, mesgul } = m;
  useEffect(() => {
    if (okundu.current || mesgul) return;
    okundu.current = true;
    void calistir('kayit');
  }, [calistir, mesgul]);
  return (
    <section className="kart">
      <h2>Dönem analizi</h2>
      <p className="ipucu">
        Tamamlanan analizi ad vererek bu tarayıcıya kaydedin. İki kayıt arasında net kâr, doluluk ve ürün
        değişimlerini karşılaştırın.
      </p>
      <div className="satir-dugmeleri">
        <button className="dugme" disabled={m.mesgul} onClick={() => void m.calistir('kayit')}>
          Kayıtları yenile
        </button>
        <button
          className="dugme"
          disabled={m.mesgul || !m.kayit?.donemler.yedek}
          onClick={() => void m.calistir('donem-geri')}
        >
          Son dönem değişikliğini geri al
        </button>
      </div>
      <label className="karlilik-donem-adi">
        Dönem adı
        <input
          className="girdi"
          value={ad}
          maxLength={120}
          placeholder="Örn. Eylül 2026"
          disabled={m.mesgul}
          onChange={(e) => setAd(e.target.value)}
        />
      </label>
      <button
        className="dugme birincil"
        disabled={m.mesgul || !m.sonuc || !ad.trim() || m.sonuc.ozet.total_count > 5000}
        onClick={() => void m.calistir('donem-kaydet', { ad })}
      >
        Analizi dönem olarak kaydet
      </button>
      {m.sonuc && m.sonuc.ozet.total_count > 5000 && (
        <p className="ipucu">Dönem kaydı en fazla 5.000 ürün içerir.</p>
      )}
      <ul className="karlilik-kayitlar" aria-label="Kayıtlı kârlılık dönemleri">
        {m.donemler.length ? (
          m.donemler.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{d.name}</strong>
                <span>
                  {d.saved_at.replace('T', ' ')} · {sayi(d.total_count)} ürün · {para(d.total_net_profit)}
                </span>
              </div>
              <button
                className="dugme"
                disabled={m.mesgul}
                onClick={() => void m.calistir('donem-sil', { id: d.id })}
              >
                Sil: {d.name}
              </button>
            </li>
          ))
        ) : (
          <li>Henüz kayıtlı dönem yok. Analiz yaptıktan sonra yukarıda ad verip kaydedin.</li>
        )}
      </ul>
      <div className="karlilik-oranlar">
        {(
          [
            ['İlk dönem', ilk, setIlk],
            ['İkinci dönem', ikinci, setIkinci],
          ] as const
        ).map(([a, v, set]) => (
          <label key={a}>
            {a}
            <select
              aria-label={a}
              className="girdi"
              value={m.donemler.some((d) => d.id === v) ? v : ''}
              disabled={m.mesgul}
              onChange={(e) => set(e.target.value)}
            >
              <option value="">Dönem seçin</option>
              {m.donemler.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.saved_at.replace('T', ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        className="dugme birincil"
        disabled={
          m.mesgul ||
          !ilk ||
          !ikinci ||
          ilk === ikinci ||
          !m.donemler.some((d) => d.id === ilk) ||
          !m.donemler.some((d) => d.id === ikinci)
        }
        onClick={() => void m.calistir('karsilastir', { ilk, ikinci })}
      >
        Dönemleri karşılaştır
      </button>
      {c && (
        <>
          <KarlilikUyarisi
            adet={
              c.first.total_count - c.first.matched_count + (c.second.total_count - c.second.matched_count)
            }
          />
          <h3>
            {c.first.name} → {c.second.name}
          </h3>
          <div className="tablo-kap" tabIndex={0} aria-label="Dönem tablosu kaydırma alanı">
            <table className="tablo" aria-label="Dönem karşılaştırması">
              <thead>
                <tr>
                  {['Ölçüt', 'İlk Dönem', 'İkinci Dönem', 'Fark', 'Değişim (%)'].map((a) => (
                    <th scope="col" key={a}>
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.metrics.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    {[r.first, r.second, r.delta].map((v, i) => (
                      <td className="sayi" key={i}>
                        {r.is_money ? para(v) : sayi(v)}
                      </td>
                    ))}
                    <td className="sayi">{r.pct_change === null ? '—' : sayi(r.pct_change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(
            [
              ['Kârı artan ürünler', c.top_gainers],
              ['Kârı azalan ürünler', c.top_losers],
            ] as const
          ).map(([a, rows]) => (
            <div key={a}>
              <h3>{a}</h3>
              <ul className="karlilik-liste">
                {rows.length ? (
                  rows.map((r) => (
                    <li key={r.stock_name}>
                      {r.stock_name} · {para(r.delta)}
                    </li>
                  ))
                ) : (
                  <li>Bu yönde değişim yok.</li>
                )}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
