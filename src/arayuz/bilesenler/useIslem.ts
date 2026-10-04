import { useCallback, useEffect, useRef, useState } from 'react';
import type { IslemSonucu } from '../../cekirdek/islemSonucu';
import { IslemOturumu } from '../../platform/islemOturumu';
export function useIslem(kapsam: string) {
  const [oturum] = useState(() => new IslemOturumu(kapsam));
  const bagli = useRef(false);
  const [mesgul, setMesgul] = useState(false);
  const [sonuc, setSonuc] = useState<IslemSonucu<unknown> | null>(null);
  useEffect(() => {
    bagli.current = true;
    return () => {
      bagli.current = false;
      oturum.kapat();
    };
  }, [oturum]);
  const calistir = async <T>(
    is: (signal: AbortSignal) => Promise<T>,
    mesaj = 'İşlem tamamlandı.',
    yazma = false,
  ) => {
    if (!oturum.mesgul) {
      setMesgul(true);
      setSonuc(null);
    }
    const s = await oturum.calistir(is, mesaj, yazma);
    if (bagli.current && s.islemId === oturum.islemId && s.kod !== 'MESGUL') {
      setSonuc(s);
      setMesgul(false);
    }
    return s;
  };
  const durdur = useCallback(() => oturum.durdur(), [oturum]);
  const kapat = useCallback(() => oturum.kapat(), [oturum]);
  return {
    mesgul,
    sonuc,
    calistir,
    uygulanabilir: (s: IslemSonucu<unknown>) =>
      bagli.current && s.islemId === oturum.islemId && s.kod !== 'MESGUL',
    durdur,
    kapat,
  };
}
