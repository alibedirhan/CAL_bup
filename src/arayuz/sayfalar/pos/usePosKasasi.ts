import { useCallback, useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosVerisi } from '../../../cekirdek/posCari';
import { PosKasasi, posKasaVar, type PosAcmaAsamasi } from '../../../platform/posKasasi';

function hataMetni(e: unknown): string {
  return e instanceof KullaniciHatasi
    ? e.message
    : 'Cari deposuna erişilemiyor. Diğer CAL bup sekmelerini kapatıp yeniden deneyin.';
}

export function usePosKasasi() {
  const [kasa] = useState(() => new PosKasasi());
  const [varMi, setVarMi] = useState<boolean | null>(null);
  const [veri, setVeri] = useState<PosVerisi | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [asama, setAsama] = useState('');
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const kilit = useRef(false);
  const kanal = useRef<BroadcastChannel | null>(null);
  const bagli = useRef(true);
  const kontrolNesli = useRef(0);

  const kilitle = useCallback(() => {
    kasa.kilitle();
    setVeri(null);
    setHata('');
    setBilgi('');
  }, [kasa]);

  const kontrol = useCallback(async () => {
    const nesil = ++kontrolNesli.current;
    setYukleniyor(true);
    setHata('');
    try {
      const v = await posKasaVar();
      if (bagli.current && nesil === kontrolNesli.current) setVarMi(v);
    } catch (e) {
      if (bagli.current && nesil === kontrolNesli.current) {
        setVarMi(null);
        setHata(hataMetni(e));
      }
    } finally {
      if (bagli.current && nesil === kontrolNesli.current) setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    bagli.current = true;
    const ilkKontrol = window.setTimeout(() => {
      void kontrol();
    }, 0);
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
      try {
        kanal.current = new BroadcastChannel('cal-bup-pos-kasa');
        kanal.current.onmessage = () => {
          kilitle();
          setBilgi('Cari listesi başka sekmede değişti. Güncel listeyi görmek için kasayı yeniden açın.');
          void kontrol();
        };
      } catch {
        kanal.current = null;
      } // Kanal zorunlu değil; atomik kayıt denetimi korunur.
    }
    return () => {
      window.clearTimeout(ilkKontrol);
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
  }, [kasa, kilitle, kontrol]);

  const calistir = async (is: () => Promise<PosVerisi>, mesaj: string, degisti = true) => {
    if (kilit.current) return false;
    kilit.current = true;
    setMesgul(true);
    setHata('');
    setBilgi('');
    setAsama('Kasa işlemi yürütülüyor…');
    try {
      const sonuc = await is();
      if (!bagli.current || !kasa.acik) return false;
      setVeri(sonuc);
      setVarMi(true);
      setBilgi(mesaj);
      if (degisti) {
        try {
          kanal.current?.postMessage('degisti');
        } catch {
          /* bildirim kaydın sonucunu değiştirmez */
        }
      }
      return true;
    } catch (e) {
      if (bagli.current) {
        if (!kasa.acik) setVeri(null);
        setHata(
          e instanceof KullaniciHatasi ? e.message : 'Cari işlemi tamamlanamadı. Mevcut kayıt korunuyor.',
        );
        if (!kasa.acik) {
          // İptal/hata anında tamamlanan bir kayıt olabilir; sonraki deneme doğru kipte başlamalı.
          try {
            const v = await posKasaVar();
            if (bagli.current) setVarMi(v);
          } catch {
            if (bagli.current) setVarMi(null);
          }
        }
      }
      return false;
    } finally {
      kilit.current = false;
      if (bagli.current) {
        setMesgul(false);
        setAsama('');
      }
    }
  };

  const asamayiBildir = (a: PosAcmaAsamasi) => {
    if (!bagli.current) return;
    setAsama(
      {
        depo: 'Cari deposu kontrol ediliyor…',
        sifreleme: 'Şifreleme anahtarı hazırlanıyor…',
        kayit: 'Şifreli cari kasası kaydediliyor…',
      }[a],
    );
  };
  return {
    kasa,
    varMi,
    veri,
    mesgul,
    hata,
    bilgi,
    yukleniyor,
    asama,
    kontrol,
    asamayiBildir,
    setHata,
    setBilgi,
    kilitle,
    calistir,
    seciliId,
    setSeciliId,
  };
}
