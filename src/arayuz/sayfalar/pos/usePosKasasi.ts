import { useCallback, useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosVerisi } from '../../../cekirdek/posCari';
import { PosKasasi, posKasaVar } from '../../../platform/posKasasi';

export function usePosKasasi() {
  const [kasa] = useState(() => new PosKasasi());
  const [varMi, setVarMi] = useState<boolean | null>(null);
  const [veri, setVeri] = useState<PosVerisi | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const kilit = useRef(false);
  const kanal = useRef<BroadcastChannel | null>(null);
  const bagli = useRef(true);

  const kilitle = useCallback(() => {
    kasa.kilitle();
    setVeri(null);
    setHata('');
    setBilgi('');
  }, [kasa]);

  useEffect(() => {
    bagli.current = true;
    let iptal = false;
    void posKasaVar()
      .then((v) => {
        if (!iptal) setVarMi(v);
      })
      .catch(() => {
        if (!iptal)
          setHata('Cari deposu açılamadı. Kaydı değiştirmeden yeniden denemek için sayfayı yenileyin.');
      });
    const sureyiDenetle = () => {
      if (kasa.suresiDoldu) kilitle();
    };
    const etkinlik = (olay: Event) => {
      if (!olay.isTrusted) return;
      try {
        if (kasa.acik) kasa.etkinlik();
        else sureyiDenetle();
      } catch {
        kilitle();
      }
    };
    const zamanlayici = window.setInterval(sureyiDenetle, 1000);
    document.addEventListener('pointerdown', etkinlik);
    document.addEventListener('keydown', etkinlik);
    document.addEventListener('visibilitychange', sureyiDenetle);
    window.addEventListener('pagehide', kilitle);
    const yenidenGoster = (e: PageTransitionEvent) => {
      if (e.persisted) kilitle();
    };
    window.addEventListener('pageshow', yenidenGoster);
    if ('BroadcastChannel' in window) {
      kanal.current = new BroadcastChannel('cal-bup-pos-kasa');
      kanal.current.onmessage = () => {
        kilitle();
        setBilgi('Cari listesi başka sekmede değişti. Güncel listeyi görmek için kasayı yeniden açın.');
        void posKasaVar()
          .then(setVarMi)
          .catch(() => setHata('Cari deposuna erişilemiyor. Sayfayı yenileyin.'));
      };
    }
    return () => {
      iptal = true;
      bagli.current = false;
      kasa.kilitle();
      window.clearInterval(zamanlayici);
      document.removeEventListener('pointerdown', etkinlik);
      document.removeEventListener('keydown', etkinlik);
      document.removeEventListener('visibilitychange', sureyiDenetle);
      window.removeEventListener('pagehide', kilitle);
      window.removeEventListener('pageshow', yenidenGoster);
      kanal.current?.close();
      kanal.current = null;
    };
  }, [kasa, kilitle]);

  const calistir = async (is: () => Promise<PosVerisi>, mesaj: string, degisti = true) => {
    if (kilit.current) return false;
    kilit.current = true;
    setMesgul(true);
    setHata('');
    setBilgi('');
    try {
      const sonuc = await is();
      if (!bagli.current || !kasa.acik) return false;
      setVeri(sonuc);
      setVarMi(true);
      setBilgi(mesaj);
      if (degisti) kanal.current?.postMessage('degisti');
      return true;
    } catch (e) {
      if (bagli.current) {
        if (!kasa.acik) setVeri(null);
        setHata(
          e instanceof KullaniciHatasi ? e.message : 'Cari işlemi tamamlanamadı. Mevcut kayıt korunuyor.',
        );
      }
      return false;
    } finally {
      kilit.current = false;
      if (bagli.current) setMesgul(false);
    }
  };

  return { kasa, varMi, veri, mesgul, hata, bilgi, setHata, setBilgi, kilitle, calistir };
}
