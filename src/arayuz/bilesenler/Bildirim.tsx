import { useContext, useEffect, useId, useRef } from 'react';
import { BildirimBaglami } from './BildirimAlani';
import { Mesaj } from './Mesaj';
/** Genel başarı odağı değiştirmez. Gizli raporun sonucu başka sayfada duyurulmaz. */
export function Bildirim({ mesaj, hata = false }: { mesaj: string; hata?: boolean }) {
  const bildir = useContext(BildirimBaglami);
  const id = useId();
  const konum = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!bildir) return;
    const goster = () => bildir({ id, hata, mesaj: konum.current?.closest('[hidden]') ? '' : mesaj });
    goster();
    window.addEventListener('hashchange', goster);
    return () => {
      window.removeEventListener('hashchange', goster);
      bildir({ id, hata, mesaj: '' });
    };
  }, [bildir, id, mesaj, hata]);
  if (!bildir)
    return mesaj ? (
      <div className="bildirim">
        <Mesaj ton={hata ? 'hata' : 'tamam'}>{mesaj}</Mesaj>
      </div>
    ) : null;
  return <span ref={konum} />;
}
