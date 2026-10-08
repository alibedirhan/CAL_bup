import { basarisiz, tamam, hataSonucu } from '../../../cekirdek/islemSonucu';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosProfilVerisi } from '../../../cekirdek/posProfil';
import {
  PosProfilDeposu,
  posEtkinligi,
  posOturumuSuresiDoldu,
  type ProfilAcilisi,
} from '../../../platform/posProfilDeposu';

export function usePosProfili() {
  const [depo] = useState(() => new PosProfilDeposu());
  const [veri, setVeri] = useState<PosProfilVerisi | null>(null);
  // Kilit durumu: veri yalnız `acik` iken ekrandadır.
  const [durum, setDurum] = useState<Exclude<ProfilAcilisi['tur'], 'acik'> | 'acik' | null>(null);
  const [tasima, setTasima] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [gizlilikNo, setGizlilikNo] = useState(0);
  const [veriNo, setVeriNo] = useState(0);
  const bagli = useRef(false);
  const nesil = useRef(0);
  const islemNo = useRef(0);
  const kilit = useRef(false);
  const yenileniyorRef = useRef(false);
  const seciliRef = useRef<string | null>(null);
  const kanal = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    seciliRef.current = seciliId;
  }, [seciliId]);
  const bildir = useCallback((m: string, h = false) => {
    setHata(h ? m : '');
    setBilgi(h ? '' : m);
  }, []);
  /** `koru`: başka sekmedeki kayıttan sonra ekran ve açık formlar korunarak güncel veri okunur. */
  const kontrol = useCallback(
    async (koru = false) => {
      const n = ++nesil.current;
      depo.kapat();
      setHata('');
      if (koru) {
        yenileniyorRef.current = true;
        setYenileniyor(true);
      } else {
        setYukleniyor(true);
        setVeri(null);
        setDurum(null);
        setGizlilikNo((s) => s + 1);
      }
      try {
        const s = await depo.ac();
        if (!bagli.current || n !== nesil.current) return;
        setDurum(s.tur);
        if (s.tur === 'parolaBelirle') setTasima(s.tasima);
        if (s.tur !== 'acik') {
          setVeri(null);
          setSeciliId(null);
        } else {
          setVeri(s.veri);
          setVeriNo((s) => s + 1);
          const id = seciliRef.current;
          if (koru && id !== null && !s.veri.cariler.some((c) => c.id === id)) {
            setSeciliId(null);
            setBilgi('Seçili cari başka sekmede silindi. Listeden yeniden seçin.');
          }
        }
      } catch (e) {
        if (bagli.current && n === nesil.current) {
          setVeri(null);
          setSeciliId(null);
          setHata(e instanceof KullaniciHatasi ? e.message : 'Profil açılamadı. Yeniden kontrol edin.');
        }
      } finally {
        if (n === nesil.current) yenileniyorRef.current = false;
        if (bagli.current && n === nesil.current) {
          setYukleniyor(false);
          setYenileniyor(false);
        }
      }
    },
    [depo],
  );
  useEffect(() => {
    bagli.current = true;
    let yenileme = window.setTimeout(() => {
      void kontrol();
    }, 0);
    // Başka sekmedeki kayıt: ekran kapatılmadan yeniden okunur; açık formlar korunur.
    const guncelle = () => {
      window.clearTimeout(yenileme);
      yenileme = window.setTimeout(() => {
        void kontrol(true);
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
      yenileniyorRef.current = false;
      setYenileniyor(false);
      setGizlilikNo((s) => s + 1);
    };
    let sonEtkinlik = Date.now();
    const etkinlik = () => {
      sonEtkinlik = Date.now();
      posEtkinligi(sonEtkinlik);
    };
    const sure = window.setInterval(() => {
      if (Date.now() - sonEtkinlik >= 120_000 || Date.now() < sonEtkinlik) {
        setGizlilikNo((s) => s + 1);
        sonEtkinlik = Date.now();
      }
      // 10 dakika dokunulmazsa kilitlenir: anahtar bellekten silinir, parola yeniden sorulur.
      // Süren bir kayıt bitince bir sonraki saniyede denetlenir; oturum ancak kilitlenebiliyorsa silinir.
      if (!kilit.current && posOturumuSuresiDoldu()) {
        setBilgi('Uzun süre işlem yapılmadığı için Sanal POS kilitlendi. Parolanızı yazın.');
        void kontrol();
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
  const calistir = async (is: () => Promise<PosProfilVerisi>, mesaj: string, yerel = false) => {
    if (kilit.current || yenileniyorRef.current)
      return basarisiz('dogrulama', 'Başka bir işlem sürüyor veya kayıtlar yenileniyor.', 'MESGUL', {
        kapsam: 'pos',
        islemId: islemNo.current,
      });
    kilit.current = true;
    setMesgul(true);
    bildir('');
    const n = nesil.current;
    const islemId = ++islemNo.current;
    try {
      const v = await is();
      if (!bagli.current || n !== nesil.current || !depo.acik)
        return basarisiz('iptal', 'İşlem durduruldu. Güncel kayıtları yeniden kontrol edin.', 'IPTAL', {
          kapsam: 'pos',
          islemId,
        });
      setVeri(v);
      setVeriNo((s) => s + 1);
      setDurum('acik');
      setGizlilikNo((s) => s + 1);
      setBilgi(mesaj);
      try {
        kanal.current?.postMessage('degisti');
      } catch {
        /* Kayıt tamamlandı. */
      }
      return tamam(undefined, mesaj, { kapsam: 'pos', islemId });
    } catch (e) {
      if (bagli.current && n === nesil.current) {
        if (!yerel)
          setHata(
            e instanceof KullaniciHatasi ? e.message : 'İşlem tamamlanamadı. Güncel kayıtları kontrol edin.',
          );
        if (!depo.acik) {
          setVeri(null);
          setGizlilikNo((s) => s + 1);
          setHata(
            e instanceof KullaniciHatasi
              ? e.message
              : 'Profil kapandı. Güncel kayıtları yeniden kontrol edin.',
          );
        }
      }
      return hataSonucu(e, { kapsam: 'pos', islemId }, !depo.acik);
    } finally {
      kilit.current = false;
      if (bagli.current) setMesgul(false);
    }
  };
  const durdur = () => {
    depo.kapat();
    nesil.current++;
    yenileniyorRef.current = false;
    setYenileniyor(false);
    setVeri(null);
    setDurum(null);
    setYukleniyor(false);
    setBilgi('İşlem durduruldu. Güncel kayıtları görmek için yeniden kontrol edin.');
  };
  /** Kilit ekranı işleri: başarılıysa güncel kayıtlar açılır; parola hiçbir duruma yazılmaz. */
  const kilitIsi = async (is: () => Promise<unknown>, mesaj: string) => {
    if (kilit.current) return false;
    kilit.current = true;
    setMesgul(true);
    bildir('');
    try {
      await is();
      if (!bagli.current) return false;
      kilit.current = false;
      await kontrol();
      if (bagli.current) setBilgi(mesaj);
      return true;
    } catch (e) {
      if (bagli.current)
        setHata(e instanceof KullaniciHatasi ? e.message : 'İşlem tamamlanamadı. Yeniden deneyin.');
      return false;
    } finally {
      kilit.current = false;
      if (bagli.current) setMesgul(false);
    }
  };
  const kilitle = () => {
    depo.kilitle();
    nesil.current++;
    setVeri(null);
    setSeciliId(null);
    setGizlilikNo((s) => s + 1);
    setDurum('kilitli');
    setBilgi('Sanal POS kilitlendi.');
  };
  return {
    depo,
    veri,
    durum,
    tasima,
    kilitIsi,
    kilitle,
    // Arka plan yenilemesi formları kilitlemez (yazarken odak kaybolmasın); bu arada kayıt
    // girişimi `calistir` içinde açık mesajla reddedilir.
    mesgul,
    yenileniyor,
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
  };
}
