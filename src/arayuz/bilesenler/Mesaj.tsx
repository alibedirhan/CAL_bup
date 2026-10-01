import type { ReactNode } from 'react';

type Ton = 'bilgi' | 'uyari' | 'hata' | 'tamam';

interface Ozellikler {
  ton: Ton;
  baslik?: string;
  children?: ReactNode;
  eylem?: ReactNode;
}

/** Kısa bildirim kutusu: sol şerit rengi durumu anlatır. */
export function Mesaj({ ton, baslik, children, eylem }: Ozellikler) {
  return (
    <div className={`mesaj ${ton}`} role={ton === 'hata' ? 'alert' : 'status'}>
      <div className="mesaj-govde">
        {baslik && <b>{baslik}</b>}
        {children && <div>{children}</div>}
      </div>
      {eylem && <div className="mesaj-eylem">{eylem}</div>}
    </div>
  );
}
