import { useState } from 'react';
/** Geçersiz taslak korunur; uygulanan son geçerli değer sessizce değiştirilmez. */
export function AyarGirdisi({
  id,
  deger,
  denetle,
  className,
  sayi,
  'aria-label': etiket,
}: {
  id?: string;
  deger: string;
  denetle: (s: string) => void;
  className: string;
  sayi?: boolean;
  'aria-label'?: string;
}) {
  const [taslak, setTaslak] = useState(deger);
  const [hata, setHata] = useState('');
  const hataId = (id ?? etiket?.replace(/\s/g, '-')) + '-hata';
  return (
    <div>
      <input
        id={id}
        className={className}
        aria-label={etiket}
        inputMode={sayi ? 'decimal' : undefined}
        value={taslak}
        aria-invalid={Boolean(hata)}
        aria-describedby={hata ? hataId : undefined}
        onChange={(e) => {
          setTaslak(e.target.value);
          setHata('');
        }}
        onBlur={() => {
          if (taslak === deger) return;
          try {
            denetle(taslak);
            setHata('');
          } catch (e) {
            setHata(e instanceof Error ? e.message : 'Değeri kontrol edin.');
          }
        }}
      />
      {hata && (
        <p id={hataId} className="alan-hatasi" role="alert">
          {hata}
        </p>
      )}
    </div>
  );
}
