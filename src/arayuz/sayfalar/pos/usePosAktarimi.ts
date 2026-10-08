import { useEffect, useRef, useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import type { PosKart } from '../../../cekirdek/posKart';
import { AKTARIM_SURESI, cvvDogrula, kartAktarimi } from '../../../cekirdek/posAktarimi';
import { YARDIMCI_SURUMU, type YardimciSonucu } from '../../../cekirdek/posBaglantisi';
import { kurulumOzeti } from '../../../cekirdek/posKurulumu';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { yardimciyaSor } from '../../../platform/posYardimcisi';
import type { Yardimci } from './useYardimci';

/** Yardımcının kendi sürümü vardır; yalnız eklenti kodu değişince güncelleme önerilir. */
export function surumUyarisi(yardimci: string): string {
  return yardimci === YARDIMCI_SURUMU
    ? ''
    : `POS yardımcısının sürümü ${yardimci}, beklenen ${YARDIMCI_SURUMU}. Aktarım çalışır ama son düzeltmeler için yardımcıyı kurulum dosyasıyla güncelleyin (kaldırmadan “Yeniden yükle”) ve bu sayfayı yenileyin.`;
}
function bekle(signal: AbortSignal) {
  return new Promise<void>((coz) => {
    const bitir = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', bitir);
      coz();
    };
    const t = setTimeout(bitir, 1000);
    signal.addEventListener('abort', bitir, { once: true });
    if (signal.aborted) bitir();
  });
}
type Neden = YardimciSonucu['neden'];
class AktarimHatasi extends KullaniciHatasi {
  constructor(
    mesaj: string,
    readonly neden: Neden,
  ) {
    super(mesaj);
  }
}

export function usePosAktarimi(cari: PosCari, kart: PosKart, mesgul: boolean, yardimci: Yardimci) {
  const [durum, setDurum] = useState('');
  const [hata, setHata] = useState('');
  const [neden, setNeden] = useState<Neden>(undefined);
  const [uyari, setUyari] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const islem = useRef<{ id: string; c: AbortController; gonderildi: boolean } | null>(null);
  const iptal = (i: NonNullable<typeof islem.current>) => {
    i.c.abort();
    if (i.gonderildi) void yardimciyaSor('iptal', i.id).catch(() => undefined);
  };
  // Sessiz bağlantı denetimini `useYardimci` yapar; burada yalnız yarım kalan aktarım kapatılır.
  useEffect(() => {
    return () => {
      if (islem.current) iptal(islem.current);
    };
  }, []);
  const durdur = () => {
    if (!islem.current) return;
    iptal(islem.current);
    islem.current = null;
    setBekliyor(false);
    setHata('');
    setNeden(undefined);
    setDurum('Aktarım durduruldu. Doldurulmuş POS alanlarını kendiniz kontrol edin.');
  };
  /** `cvv`: yalnız bu ödeme için; çağıran sonra kendi kutusunu boşaltır. Hiçbir yere yazılmaz. */
  const baslat = async (kontrol = false, cvv = '') => {
    if (islem.current || mesgul) return false;
    const i = { id: crypto.randomUUID(), c: new AbortController(), gonderildi: false };
    islem.current = i;
    setHata('');
    setNeden(undefined);
    setBekliyor(true);
    setDurum('POS yardımcısı kontrol ediliyor…');
    try {
      cvvDogrula(cvv);
      const bag = await yardimciyaSor('durum', undefined, undefined, i.c.signal);
      i.c.signal.throwIfAborted();
      if (bag.durum !== 'hazir') throw new KullaniciHatasi(bag.mesaj);
      setUyari(surumUyarisi(bag.surum));
      const k = yardimci.esitle(bag);
      // Araç çubuğundan kapatılmış yardımcıya kart gönderilmez.
      if (bag.kapali) throw new KullaniciHatasi(bag.mesaj);
      if (kontrol) {
        setDurum(
          `POS yardımcısı bağlı (${bag.surum}). ${
            k
              ? 'Ödeme formu tanıtılmış; her cari için geçerli.'
              : 'Ödeme formu henüz tanıtılmamış: POS’taki yardımcı panelinden “Alanları tanıt” ile bir kez tanıtın.'
          } Kart bilgisi gönderilmedi.`,
        );
        return true;
      }
      const veri = kartAktarimi(cari, kart, cvv);
      i.gonderildi = true;
      const r = await yardimciyaSor('baslat', i.id, veri, i.c.signal, bag.kurulum === undefined ? k : null);
      veri.cvv = veri.numara = veri.sifre = '';
      i.c.signal.throwIfAborted();
      if (r.durum === 'hata' || r.durum === 'iptal') throw new AktarimHatasi(r.mesaj, r.neden);
      if (r.durum !== 'giris')
        throw new KullaniciHatasi(
          'POS başlangıcı doğrulanamadı. Açık POS alanlarını kontrol edin; tekrar yapılmadı.',
        );
      setDurum(r.mesaj);
      const son = performance.now() + AKTARIM_SURESI;
      while (performance.now() < son) {
        await bekle(i.c.signal);
        i.c.signal.throwIfAborted();
        const s = await yardimciyaSor('durum', i.id, undefined, i.c.signal);
        i.c.signal.throwIfAborted();
        if (s.durum === 'hata' || s.durum === 'iptal') throw new AktarimHatasi(s.mesaj, s.neden);
        if (s.durum === 'dolduruldu') {
          setDurum(s.mesaj);
          return true;
        }
        if (s.durum === 'hazir')
          throw new KullaniciHatasi(
            'Bekleyen aktarım bulunamadı veya süresi doldu. POS alanlarını kontrol edin; otomatik tekrar yapılmadı.',
          );
        setDurum(s.mesaj);
      }
      throw new KullaniciHatasi('Aktarım süresi doldu. POS alanlarını kontrol edip yeniden başlayın.');
    } catch (e) {
      if (!i.c.signal.aborted && islem.current === i) {
        setDurum('');
        setNeden(e instanceof AktarimHatasi ? e.neden : undefined);
        setHata(
          e instanceof KullaniciHatasi
            ? e.message
            : 'POS aktarımı tamamlanamadı. POS alanlarını kontrol edin.',
        );
      }
      return false;
    } finally {
      if (i.gonderildi) void yardimciyaSor('iptal', i.id).catch(() => undefined);
      if (islem.current === i) {
        islem.current = null;
        setBekliyor(false);
      }
    }
  };
  return {
    durum,
    hata,
    neden,
    uyari,
    bekliyor,
    baslat,
    durdur,
    tanitilan: kurulumOzeti(yardimci.kurulum),
    kurulum: yardimci.kurulum,
  };
}
