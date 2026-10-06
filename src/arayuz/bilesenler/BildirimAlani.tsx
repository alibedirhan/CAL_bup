import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mesaj } from './Mesaj';
interface Duyuru {
  id: string;
  mesaj: string;
  hata: boolean;
}
export const BildirimBaglami = createContext<((d: Duyuru) => void) | null>(null);

/** Başarı bildirimi bu süre sonra kendiliğinden kapanır; hata kullanıcı kapatana kadar kalır. */
export const BILDIRIM_SURESI = 12_000;

/** Tek görünür alan: farklı modüllerin bildirimleri birbirini örtmez. */
export function BildirimAlani({ children }: { children: ReactNode }) {
  const [duyuru, setDuyuru] = useState<Duyuru | null>(null);
  // Kapatılan bildirim, kaynağı aynı metni yeniden gönderdiğinde (ör. sayfa geçişi) geri gelmez.
  const kapatilan = useRef<Duyuru | null>(null);
  // Üzerindeyken kapanmaz; bekletme yalnız o bildirime aittir.
  const [duraklayan, setDuraklayan] = useState<Duyuru | null>(null);
  const durakla = duraklayan !== null && duraklayan === duyuru;
  const bildir = useCallback((d: Duyuru) => {
    const k = kapatilan.current;
    if (k?.id === d.id) {
      if (!d.mesaj) kapatilan.current = null;
      else if (k.mesaj === d.mesaj && k.hata === d.hata) return;
      else kapatilan.current = null;
    }
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
  const kapat = useCallback((d: Duyuru) => {
    kapatilan.current = d;
    setDuyuru((eski) => (eski === d ? null : eski));
  }, []);
  useEffect(() => {
    if (!duyuru || duyuru.hata || durakla) return;
    const t = window.setTimeout(() => kapat(duyuru), BILDIRIM_SURESI);
    return () => {
      window.clearTimeout(t);
    };
  }, [duyuru, durakla, kapat]);
  const baglam = useMemo(() => bildir, [bildir]);
  return (
    <BildirimBaglami value={baglam}>
      {children}
      {duyuru && (
        <div
          className="bildirim"
          onMouseEnter={() => setDuraklayan(duyuru)}
          onMouseLeave={() => setDuraklayan(null)}
          onFocus={() => setDuraklayan(duyuru)}
          onBlur={() => setDuraklayan(null)}
        >
          <Mesaj
            ton={duyuru.hata ? 'hata' : 'tamam'}
            eylem={
              <button
                className="dugme kucuk"
                type="button"
                aria-label="Bildirimi kapat"
                onClick={() => kapat(duyuru)}
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
