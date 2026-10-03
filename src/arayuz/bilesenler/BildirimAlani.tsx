import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Mesaj } from './Mesaj';
interface Duyuru {
  id: string;
  mesaj: string;
  hata: boolean;
}
export const BildirimBaglami = createContext<((d: Duyuru) => void) | null>(null);
/** Tek görünür alan: farklı modüllerin bildirimleri birbirini örtmez. */
export function BildirimAlani({ children }: { children: ReactNode }) {
  const [duyuru, setDuyuru] = useState<Duyuru | null>(null);
  const bildir = useCallback((d: Duyuru) => {
    setDuyuru((eski) =>
      !d.mesaj
        ? eski?.id === d.id
          ? null
          : eski
        : eski?.id === d.id && eski.mesaj === d.mesaj && eski.hata === d.hata
          ? eski
          : d,
    );
  }, []);
  const baglam = useMemo(() => bildir, [bildir]);
  return (
    <BildirimBaglami value={baglam}>
      {children}
      {duyuru && (
        <div className="bildirim">
          <Mesaj
            ton={duyuru.hata ? 'hata' : 'tamam'}
            eylem={
              <button
                className="dugme kucuk"
                type="button"
                aria-label="Bildirimi kapat"
                onClick={() => setDuyuru(null)}
              >
                Kapat
              </button>
            }
          >
            {duyuru.mesaj}
          </Mesaj>
        </div>
      )}
    </BildirimBaglami>
  );
}
