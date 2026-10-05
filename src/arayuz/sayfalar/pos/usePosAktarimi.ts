import { useEffect, useRef, useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import type { PosKart } from '../../../cekirdek/posKart';
import { AKTARIM_SURESI, kartAktarimi } from '../../../cekirdek/posAktarimi';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { yardimciyaSor } from '../../../platform/posYardimcisi';
import { SURUM } from '../../../surum';

/** Yardımcı ZIP'i program sürümüyle üretilir; farklı sürüm çalışır ama yeni düzeltmeleri içermeyebilir. */
export function surumUyarisi(yardimci: string): string {
  return yardimci === SURUM
    ? ''
    : `POS yardımcısının sürümü ${yardimci}, programın sürümü ${SURUM}. Aktarım çalışır ama son düzeltmeler için yardımcıyı yeni kurulum dosyasıyla güncelleyin ve bu sayfayı yenileyin.`;
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
export function usePosAktarimi(cari: PosCari, kart: PosKart, mesgul: boolean) {
  const [durum, setDurum] = useState('');
  const [hata, setHata] = useState('');
  const [uyari, setUyari] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const islem = useRef<{ id: string; c: AbortController; gonderildi: boolean } | null>(null);
  const iptal = (i: NonNullable<typeof islem.current>) => {
    i.c.abort();
    if (i.gonderildi) void yardimciyaSor('iptal', i.id).catch(() => undefined);
  };
  useEffect(
    () => () => {
      if (islem.current) iptal(islem.current);
    },
    [],
  );
  const durdur = () => {
    if (!islem.current) return;
    iptal(islem.current);
    islem.current = null;
    setBekliyor(false);
    setHata('');
    setDurum('Aktarım durduruldu. Doldurulmuş POS alanlarını kendiniz kontrol edin.');
  };
  const baslat = async (kontrol = false) => {
    if (islem.current || mesgul) return;
    const i = { id: crypto.randomUUID(), c: new AbortController(), gonderildi: false };
    islem.current = i;
    setHata('');
    setBekliyor(true);
    setDurum('POS yardımcısı kontrol ediliyor…');
    try {
      const bag = await yardimciyaSor('durum', undefined, undefined, i.c.signal);
      i.c.signal.throwIfAborted();
      if (bag.durum !== 'hazir') throw new KullaniciHatasi(bag.mesaj);
      setUyari(surumUyarisi(bag.surum));
      if (kontrol) {
        setDurum(
          `POS yardımcısı bağlı (${bag.surum}). Kart bilgisi gönderilmedi; aktarımı başlatabilirsiniz.`,
        );
        return;
      }
      const veri = kartAktarimi(cari, kart);
      i.gonderildi = true;
      const r = await yardimciyaSor('baslat', i.id, veri, i.c.signal);
      i.c.signal.throwIfAborted();
      if (r.durum === 'hata' || r.durum === 'iptal') throw new KullaniciHatasi(r.mesaj);
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
        if (s.durum === 'hata' || s.durum === 'iptal') throw new KullaniciHatasi(s.mesaj);
        if (s.durum === 'dolduruldu') {
          setDurum(s.mesaj);
          return;
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
        setHata(
          e instanceof KullaniciHatasi
            ? e.message
            : 'POS aktarımı tamamlanamadı. POS alanlarını kontrol edin.',
        );
      }
    } finally {
      if (i.gonderildi) void yardimciyaSor('iptal', i.id).catch(() => undefined);
      if (islem.current === i) {
        islem.current = null;
        setBekliyor(false);
      }
    }
  };
  return { durum, hata, uyari, bekliyor, baslat, durdur };
}
