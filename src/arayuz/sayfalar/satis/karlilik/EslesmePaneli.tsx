import { useState } from 'react';
import type { KarlilikEkrani } from './useKarlilik';
export function EslesmePaneli({ m }: { m: KarlilikEkrani }) {
  const [alias, setAlias] = useState(''),
    [target, setTarget] = useState('');
  const e = m.sonuc?.eslesme;
  if (!e) return null;
  const mevcut = new Set(e.aliases.map((a) => a.alias));
  const adaylar = [...new Set(e.unmatched)].filter((a) => !mevcut.has(a));
  return (
    <section className="kart">
      <h2>Eşleşme Merkezi</h2>
      <p className="ipucu">
        Önce satış stokunu fiyat stokuyla eşleştirmeyi önerin. Yalnız açıkça onayladığınız eşleştirme hesaba
        katılır ve bu tarayıcıda saklanır.
      </p>
      <div className="karlilik-oranlar">
        <label>
          Eşleşmeyen satış stoğu
          <select
            aria-label="Eşleşmeyen satış stoğu"
            className="girdi"
            value={adaylar.includes(alias) ? alias : ''}
            disabled={m.mesgul}
            onChange={(e) => setAlias(e.target.value)}
          >
            <option value="">Stok seçin</option>
            {adaylar.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Fiyat stoğu
          <select
            aria-label="Fiyat stoğu"
            className="girdi"
            value={target}
            disabled={m.mesgul}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Stok seçin</option>
            {e.price_targets.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="satir-dugmeleri">
        <button
          className="dugme birincil"
          disabled={m.mesgul || !adaylar.includes(alias) || !target}
          onClick={() => void m.calistir('oner', { alias, target })}
        >
          Eşleştirme öner
        </button>
        <button
          className="dugme"
          disabled={m.mesgul || !e.can_restore}
          onClick={() => void m.calistir('eslesme-geri')}
        >
          Son eşleştirme değişikliğini geri al
        </button>
      </div>
      <ul className="karlilik-kayitlar" aria-label="Stok eşleştirmeleri">
        {e.aliases.length ? (
          e.aliases.map((a) => (
            <li key={a.alias}>
              <div>
                <strong>
                  {a.alias} → {a.target}
                </strong>
                <span>{a.status === 'approved' ? 'Onaylı' : 'Onay bekliyor'}</span>
              </div>
              <div className="satir-dugmeleri">
                {a.status === 'pending' && (
                  <button
                    className="dugme"
                    disabled={m.mesgul || !e.unmatched.includes(a.alias)}
                    onClick={() => void m.calistir('onayla', { alias: a.alias })}
                  >
                    Onayla: {a.alias}
                  </button>
                )}
                <button
                  className="dugme"
                  disabled={m.mesgul}
                  onClick={() => void m.calistir('kaldir', { alias: a.alias })}
                >
                  Kaldır: {a.alias}
                </button>
              </div>
            </li>
          ))
        ) : (
          <li>Henüz elle eşleştirme yok.</li>
        )}
      </ul>
      {e.applied_aliases.length > 0 && (
        <p className="ipucu">Bu analizde {e.applied_aliases.length} onaylı eşleştirme kullanıldı.</p>
      )}
      <details>
        <summary>Eşleştirme geçmişi ({e.history.length})</summary>
        <ul className="karlilik-liste">
          {e.history
            .slice(-50)
            .reverse()
            .map((h) => (
              <li key={h.revision}>
                {h.occurred_at.replace('T', ' ')} · {h.alias} → {h.target} ·{' '}
                {h.action === 'approved' ? 'Onaylandı' : h.action === 'removed' ? 'Kaldırıldı' : 'Önerildi'}
              </li>
            ))}
        </ul>
        <p className="ipucu">En son 50 değişiklik gösterilir.</p>
      </details>
    </section>
  );
}
