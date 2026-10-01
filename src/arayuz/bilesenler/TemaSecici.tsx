import type { TemaTercihi } from '../tema';
import { Simge, type SimgeAdi } from './Simge';

const SECENEKLER: readonly { deger: TemaTercihi; ad: string; simge: SimgeAdi }[] = [
  { deger: 'sistem', ad: 'Sistem', simge: 'ekran' },
  { deger: 'acik', ad: 'Açık', simge: 'gunes' },
  { deger: 'koyu', ad: 'Koyu', simge: 'ay' },
];

interface Ozellikler {
  tercih: TemaTercihi;
  degisti: (t: TemaTercihi) => void;
  genis?: boolean;
}

export function TemaSecici({ tercih, degisti, genis = false }: Ozellikler) {
  return (
    <div className={genis ? 'tema-secici genis' : 'tema-secici'} role="group" aria-label="Tema">
      {SECENEKLER.map((s) => (
        <button
          key={s.deger}
          type="button"
          aria-pressed={tercih === s.deger}
          title={`${s.ad} tema`}
          onClick={() => degisti(s.deger)}
        >
          <Simge ad={s.simge} boyut={16} />
          {genis ? s.ad : <span className="gorunmez">{s.ad}</span>}
        </button>
      ))}
    </div>
  );
}
