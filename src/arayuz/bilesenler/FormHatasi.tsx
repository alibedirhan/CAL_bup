import { useEffect, useRef } from 'react';
/** Hata kendi formunda kalır; modalın arkasındaki bildirimlere odak verilmez. */
export function FormHatasi({ hata, id }: { hata: string; id: string }) {
  const alan = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (hata) {
      alan.current?.focus();
      alan.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [hata]);
  return hata ? (
    <p id={id} ref={alan} tabIndex={-1} className="alan-hatasi" role="alert">
      {hata}
    </p>
  ) : null;
}
