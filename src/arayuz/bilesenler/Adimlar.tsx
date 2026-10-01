import { Simge } from './Simge';

interface Ozellikler {
  adlar: readonly string[];
  /** 1'den başlayan, şu an tamamlanması gereken adım. Sonraki adımlar sırada görünür. */
  simdiki: number;
}

export function Adimlar({ adlar, simdiki }: Ozellikler) {
  return (
    <ol className="adimlar" aria-label="Adımlar">
      {adlar.map((a, i) => {
        const no = i + 1;
        const durum = no < simdiki ? 'bitti' : no === simdiki ? 'simdi' : '';
        return (
          <li key={a} className={`adim ${durum}`} aria-current={durum === 'simdi' ? 'step' : undefined}>
            <span className="adim-no">{durum === 'bitti' ? <Simge ad="tik" boyut={13} /> : no}</span>
            {a}
          </li>
        );
      })}
    </ol>
  );
}
