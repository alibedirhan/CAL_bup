import type { ReactNode } from 'react';

interface Ozellikler {
  ust: string;
  baslik: string;
  children?: ReactNode;
}

export function SayfaBasligi({ ust, baslik, children }: Ozellikler) {
  return (
    <header className="baslik">
      <span className="etiket">{ust}</span>
      <h1>{baslik}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
