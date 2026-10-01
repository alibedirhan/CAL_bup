import { useDeferredValue, useMemo, useState } from 'react';
import { adAnahtari } from '../../../cekirdek/metin';
import { sayiMetni, yuvarla3 } from '../../../cekirdek/sayi';
import type { DepoKontrolPlani, PlanSatiri } from '../../../raporlar/depoKontrol/hesapla';

type Suzgec = 'tumu' | 'eklenen' | 'fark' | 'donuk' | 'tekrar';

const SUZGECLER: { id: Suzgec; ad: string; uyar: (s: PlanSatiri) => boolean }[] = [
  { id: 'tumu', ad: 'Tümü', uyar: () => true },
  { id: 'eklenen', ad: 'Eklenen', uyar: (s) => s.eklendi },
  { id: 'fark', ad: 'Fark var', uyar: (s) => Math.abs(yuvarla3(s.b - s.d)) > 0 },
  { id: 'donuk', ad: 'Donuk', uyar: (s) => s.donuk },
  { id: 'tekrar', ad: 'Tekrar eden', uyar: (s) => s.tekrar },
];

/** Gün sayfasına yazılacak satırların önizlemesi. */
export function SatirTablosu({ plan }: { plan: DepoKontrolPlani }) {
  const [suzgec, setSuzgec] = useState<Suzgec>('tumu');
  const [arama, setArama] = useState('');
  const geciktirilmis = useDeferredValue(arama);

  const sayilar = useMemo(
    () => Object.fromEntries(SUZGECLER.map((f) => [f.id, plan.satirlar.filter(f.uyar).length])),
    [plan],
  );
  const satirlar = useMemo(() => {
    const f = SUZGECLER.find((x) => x.id === suzgec)?.uyar ?? (() => true);
    const a = adAnahtari(geciktirilmis.trim());
    return plan.satirlar.filter((s) => f(s) && (!a || adAnahtari(s.ad).includes(a)));
  }, [plan, suzgec, geciktirilmis]);

  return (
    <section className="kart" aria-labelledby="satir-baslik">
      <div className="kart-ust">
        <h2 id="satir-baslik">Satırlar</h2>
        <input
          className="girdi arama"
          type="search"
          placeholder="Ürün ara"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          aria-label="Ürün ara"
        />
      </div>
      <div className="suzgecler" role="group" aria-label="Süzgeç">
        {SUZGECLER.filter((f) => f.id === 'tumu' || (sayilar[f.id] ?? 0) > 0).map((f) => (
          <button
            key={f.id}
            type="button"
            className="suzgec"
            aria-pressed={suzgec === f.id}
            onClick={() => setSuzgec(f.id)}
          >
            {f.ad} <span className="rakam">{sayilar[f.id]}</span>
          </button>
        ))}
      </div>
      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr>
              <th className="sayi">Satır</th>
              <th>Ürün</th>
              <th className="sayi">LED (B)</th>
              <th className="sayi">Sayım (D)</th>
              <th className="sayi">Fark (E)</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const fark = yuvarla3(s.b - s.d);
              return (
                <tr key={s.satir} className={s.eklendi ? 'eklendi' : s.tekrar ? 'tekrar' : undefined}>
                  <td className="sayi soluk">{s.satir}</td>
                  <td>
                    {s.ad}
                    {s.eklendi && <span className="rozet uyari">eklendi</span>}
                    {s.donuk && <span className="rozet bilgi">donuk</span>}
                    {s.tekrar && <span className="rozet">tekrar</span>}
                  </td>
                  <td className="sayi">{sayiMetni(s.b)}</td>
                  <td className="sayi">{sayiMetni(s.d)}</td>
                  <td className={`sayi ${fark !== 0 ? 'vurgulu' : 'soluk'}`}>{sayiMetni(fark)}</td>
                </tr>
              );
            })}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={5} className="bos-satir">
                  Bu süzgeçte satır yok.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="sayi soluk">{plan.toplamSatiri}</td>
              <td>Dip toplam ({plan.satirlar.length} satır)</td>
              <td className="sayi">{sayiMetni(plan.bToplam)}</td>
              <td className="sayi">{sayiMetni(plan.dToplam)}</td>
              <td className="sayi">{sayiMetni(yuvarla3(plan.bToplam - plan.dToplam))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
