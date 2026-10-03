import { useCallback, useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosProfilVerisi } from '../../../cekirdek/posProfil';
import { PosProfilDeposu } from '../../../platform/posProfilDeposu';

export function usePosProfili() {
  const [depo] = useState(() => new PosProfilDeposu());
  const [veri, setVeri] = useState<PosProfilVerisi | null>(null);
  const [eski, setEski] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [gizlilikNo, setGizlilikNo] = useState(0);
  const [veriNo, setVeriNo] = useState(0);
  const bagli = useRef(false);
  const nesil = useRef(0);
  const kilit = useRef(false);
  const kanal = useRef<BroadcastChannel | null>(null);
  const bildir = (m: string, h = false) => {
    setHata(h ? m : '');
    setBilgi(h ? '' : m);
  };
  const kontrol = useCallback(async () => {
    const n = ++nesil.current;
    depo.kapat();
    setYukleniyor(true);
    setHata('');
    setVeri(null);
    setEski(false);
    setGizlilikNo((s) => s + 1);
    try {
      const s = await depo.ac();
      if (!bagli.current || n !== nesil.current) return;
      setEski(s.eski);
      if (!s.eski) {
        setVeri(s.veri);
        setVeriNo((s) => s + 1);
      }
    } catch (e) {
      if (bagli.current && n === nesil.current)
        setHata(e instanceof KullaniciHatasi ? e.message : 'Profil açılamadı. Yeniden kontrol edin.');
    } finally {
      if (bagli.current && n === nesil.current) setYukleniyor(false);
    }
  }, [depo]);
  useEffect(() => {
    bagli.current = true;
    let yenileme = window.setTimeout(() => {
      void kontrol();
    }, 0);
    const guncelle = () => {
      depo.kapat();
      nesil.current++;
      setVeri(null);
      setSeciliId(null);
      setGizlilikNo((s) => s + 1);
      window.clearTimeout(yenileme);
      yenileme = window.setTimeout(() => {
        void kontrol();
      }, 0);
    };
    const gizle = () => {
      if (document.hidden) setGizlilikNo((s) => s + 1);
    };
    const yenidenGoster = (e: PageTransitionEvent) => {
      if (e.persisted) guncelle();
    };
    const kapat = () => {
      depo.kapat();
      nesil.current++;
      setGizlilikNo((s) => s + 1);
    };
    let sonEtkinlik = Date.now();
    const etkinlik = () => {
      sonEtkinlik = Date.now();
    };
    const sure = window.setInterval(() => {
      if (Date.now() - sonEtkinlik >= 120_000 || Date.now() < sonEtkinlik) {
        setGizlilikNo((s) => s + 1);
        sonEtkinlik = Date.now();
      }
    }, 1000);
    try {
      kanal.current = new BroadcastChannel('cal-bup-pos-kasa');
      kanal.current.onmessage = guncelle;
    } catch {
      kanal.current = null;
    }
    document.addEventListener('visibilitychange', gizle);
    document.addEventListener('pointerdown', etkinlik);
    document.addEventListener('keydown', etkinlik);
    window.addEventListener('pagehide', kapat);
    window.addEventListener('pageshow', yenidenGoster);
    return () => {
      bagli.current = false;
      kapat();
      window.clearTimeout(yenileme);
      window.clearInterval(sure);
      document.removeEventListener('visibilitychange', gizle);
      document.removeEventListener('pointerdown', etkinlik);
      document.removeEventListener('keydown', etkinlik);
      window.removeEventListener('pagehide', kapat);
      window.removeEventListener('pageshow', yenidenGoster);
      kanal.current?.close();
      kanal.current = null;
    };
  }, [depo, kontrol]);
  const calistir = async (is: () => Promise<PosProfilVerisi>, mesaj: string) => {
    if (kilit.current) return false;
    kilit.current = true;
    setMesgul(true);
    bildir('');
    const n = nesil.current;
    try {
      const v = await is();
      if (!bagli.current || n !== nesil.current || !depo.acik) return false;
      setVeri(v);
      setVeriNo((s) => s + 1);
      setEski(false);
      setGizlilikNo((s) => s + 1);
      setBilgi(mesaj);
      try {
        kanal.current?.postMessage('degisti');
      } catch {
        /* Kayıt tamamlandı. */
      }
      return true;
    } catch (e) {
      if (bagli.current && n === nesil.current) {
        setHata(e instanceof KullaniciHatasi ? e.message : 'İşlem tamamlanamadı. Mevcut kayıtlar korundu.');
        if (!depo.acik) setVeri(null);
      }
      return false;
    } finally {
      kilit.current = false;
      if (bagli.current) setMesgul(false);
    }
  };
  const durdur = () => {
    depo.kapat();
    nesil.current++;
    setVeri(null);
    setEski(false);
    setYukleniyor(false);
    setBilgi('İşlem durduruldu. Güncel kayıtları görmek için yeniden kontrol edin.');
  };
  const dosyaCalistir = async (
    is: () => Promise<Uint8Array<ArrayBuffer>>,
    kaydet: (b: Uint8Array<ArrayBuffer>) => void,
    mesaj: string,
  ) => {
    if (kilit.current) return false;
    kilit.current = true;
    setMesgul(true);
    bildir('');
    const n = nesil.current;
    try {
      const b = await is();
      if (!bagli.current || n !== nesil.current) return false;
      kaydet(b);
      setBilgi(mesaj);
      return true;
    } catch (e) {
      if (bagli.current && n === nesil.current)
        setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek hazırlanamadı. Kayıtlar korundu.');
      return false;
    } finally {
      kilit.current = false;
      if (bagli.current) setMesgul(false);
    }
  };
  return {
    depo,
    veri,
    eski,
    mesgul,
    yukleniyor,
    hata,
    bilgi,
    bildir,
    kontrol,
    calistir,
    durdur,
    seciliId,
    setSeciliId,
    gizlilikNo,
    veriNo,
    dosyaCalistir,
  };
}
