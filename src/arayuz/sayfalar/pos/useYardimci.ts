import { useCallback, useEffect, useState } from 'react';
import type { YardimciSonucu } from '../../../cekirdek/posBaglantisi';
import type { PosKurulumu } from '../../../cekirdek/posKurulumu';
import { yardimciyaSor } from '../../../platform/posYardimcisi';
import { kurulumKopyasiOku, kurulumKopyasiYaz } from '../../../platform/posKurulumKaydi';

/** Yardımcının bildirdiği kurulum programda da saklanır. Yardımcı kurulumu bilerek sildiyse (`null`)
 * kopya da silinir; hiç kurulumu yoksa (yeniden kurulmuş) programdaki kopya geçerli kalır. */
function kurulumuEsitle(s: YardimciSonucu): PosKurulumu | null {
  if (s.kurulum !== undefined) kurulumKopyasiYaz(s.kurulum);
  return s.kurulum === undefined ? kurulumKopyasiOku() : s.kurulum;
}

/** Yardımcı bir kez kurulup ödeme formu tanıtıldıysa kurulum anlatımları geri plana alınır.
 * `bagli`: sessiz denetim sürerken `null`; kart bilgisi göndermez. */
export function useYardimci() {
  const [kurulum, setKurulum] = useState<PosKurulumu | null>(kurulumKopyasiOku);
  const [bagli, setBagli] = useState<boolean | null>(null);
  const [kapali, setKapali] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void yardimciyaSor('durum', undefined, undefined, c.signal)
      .then((s) => {
        if (c.signal.aborted) return;
        setBagli(true);
        setKapali(Boolean(s.kapali));
        setKurulum(kurulumuEsitle(s));
      })
      .catch(() => {
        if (!c.signal.aborted) setBagli(false);
      });
    return () => {
      c.abort();
    };
  }, []);
  /** Aktarımın bağlantı yanıtı: yardımcı bağlı, kurulumu eşitlenir ve güncel kurulum döner. */
  const esitle = useCallback((s: YardimciSonucu) => {
    const k = kurulumuEsitle(s);
    setBagli(true);
    setKapali(Boolean(s.kapali));
    setKurulum(k);
    return k;
  }, []);
  // Kopya varsa denetim sürerken de kurulu sayılır; yanıt gelmezse kurulum anlatımı geri gelir.
  const hazir = Boolean(kurulum) && bagli !== false && !kapali;
  return { kurulum, bagli, kapali, hazir, esitle };
}
export type Yardimci = ReturnType<typeof useYardimci>;
