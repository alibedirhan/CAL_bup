import { useEffect, useRef, useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import type { PosKart } from '../../../cekirdek/posKart';
import { AKTARIM_SURESI, kartAktarimi } from '../../../cekirdek/posAktarimi';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { yardimciyaSor } from '../../../platform/posYardimcisi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
export function PosKartAktarimi({ cari, kart, mesgul }: { cari: PosCari; kart: PosKart; mesgul: boolean }) {
  const [durum, setDurum] = useState('');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const islem = useRef<{ id: string; c: AbortController } | null>(null);
  useEffect(
    () => () => {
      if (islem.current) {
        islem.current.c.abort();
        void yardimciyaSor('iptal', islem.current.id).catch(() => undefined);
      }
    },
    [],
  );
  const durdur = () => {
    const i = islem.current;
    if (!i) return;
    i.c.abort();
    void yardimciyaSor('iptal', i.id).catch(() => undefined);
    islem.current = null;
    setBekliyor(false);
    setDurum('Aktarım durduruldu. Doldurulmuş POS alanlarını kendiniz kontrol edin.');
  };
  const baslat = async () => {
    if (islem.current || mesgul) return;
    const i = { id: crypto.randomUUID(), c: new AbortController() };
    islem.current = i;
    setHata('');
    setBekliyor(true);
    setDurum('POS yardımcısı kontrol ediliyor…');
    try {
      const veri = kartAktarimi(cari, kart);
      const bag = await yardimciyaSor('durum', undefined, undefined, i.c.signal);
      if (bag.durum !== 'hazir') throw new KullaniciHatasi(bag.mesaj);
      const r = await yardimciyaSor('baslat', i.id, veri, i.c.signal);
      i.c.signal.throwIfAborted();
      if (r.durum === 'hata') throw new KullaniciHatasi(r.mesaj);
      setDurum(r.mesaj);
      const son = Date.now() + AKTARIM_SURESI;
      while (Date.now() < son) {
        await new Promise<void>((coz) => {
          const f = () => {
            clearTimeout(t);
            coz();
          };
          const t = setTimeout(() => {
            i.c.signal.removeEventListener('abort', f);
            coz();
          }, 1000);
          i.c.signal.addEventListener('abort', f, { once: true });
        });
        i.c.signal.throwIfAborted();
        const s = await yardimciyaSor('durum', i.id, undefined, i.c.signal);
        if (s.durum === 'hata') throw new KullaniciHatasi(s.mesaj);
        if (s.durum === 'dolduruldu') {
          setDurum(s.mesaj);
          return;
        }
        if (s.durum === 'iptal') throw new KullaniciHatasi(s.mesaj);
        if (s.mesaj) setDurum(s.mesaj);
      }
      throw new KullaniciHatasi('Aktarım süresi doldu. POS alanlarını kontrol edip yeniden başlayın.');
    } catch (e) {
      if (!i.c.signal.aborted)
        setHata(
          e instanceof KullaniciHatasi
            ? e.message
            : 'POS aktarımı tamamlanamadı. POS alanlarını kontrol edin.',
        );
    } finally {
      void yardimciyaSor('iptal', i.id).catch(() => undefined);
      if (islem.current === i) {
        islem.current = null;
        setBekliyor(false);
      }
    }
  };
  return (
    <section aria-label="Seçili kartı POS’a aktar">
      <h3>Seçili kartla POS’a geç</h3>
      <p className="ipucu">
        Yardımcı cari numarasını karşılaştırır; yalnızca kart numarası ve son kullanmayı doldurur. CVV, tutar
        ve şifre gönderme işlemi sizde kalır.
      </p>
      <div className="satir-dugmeleri">
        <button
          type="button"
          className="dugme birincil"
          disabled={mesgul || bekliyor}
          onClick={() => void baslat()}
        >
          Seçili kartla POS’u aç
        </button>
        {bekliyor && (
          <button type="button" className="dugme" onClick={durdur}>
            Aktarımı durdur
          </button>
        )}
      </div>
      <FormHatasi id="pos-aktarim-hatasi" hata={hata} />
      {durum && <p role="status">{durum}</p>}
      <details>
        <summary>Edge yardımcısını bir kez kur</summary>
        <ol>
          <li>
            <a href={import.meta.env.BASE_URL + 'pos-yardimcisi.zip'} download="CAL-bup-POS-yardimcisi.zip">
              POS yardımcısını indir
            </a>{' '}
            ve ZIP’i bir klasöre çıkarın.
          </li>
          <li>
            Edge adres çubuğunda <b>edge://extensions</b> açın; geliştirici modunu açıp “Paketlenmemiş öğe
            yükle” ile klasörü seçin.
          </li>
          <li>
            POS ödeme ekranında kart bilgisi girmeden, yardımcının panelinden boş numara/tarih alanlarını ve
            görünen vergi/TC numarasını bir kez tanıtın.
          </li>
          <li>
            Bu sayfayı yenileyip cari ve kartı seçin. Kurumunuz kurulum izni vermiyorsa bilgi işlemle görüşün.
          </li>
        </ol>
        <p className="ipucu">
          Görünen vergi/TC numarası gereklidir. Başka çerçevedeki veya tanıtılmamış alanlar doldurulmaz.
        </p>
      </details>
    </section>
  );
}
