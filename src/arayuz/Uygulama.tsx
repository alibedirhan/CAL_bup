import { basarisiz, tamam } from '../cekirdek/islemSonucu';
import { Bildirim } from './bilesenler/Bildirim';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Ayarlar } from '../cekirdek/ayarlar';
import { ayarlariOku, ayarlariYaz } from '../platform/ayarlar';
import { raporBul } from '../raporlar/kayit';
import { KenarCubugu } from './bilesenler/KenarCubugu';
import { rotaAdresi, rotaCoz, type Rota } from './rota';
import { AyarlarSayfasi } from './sayfalar/AyarlarSayfasi';
import { DepoKontrolSayfasi } from './sayfalar/depoKontrol/DepoKontrolSayfasi';
import { GecmisSayfasi } from './sayfalar/GecmisSayfasi';
import { YakindaSayfasi } from './sayfalar/YakindaSayfasi';
import { SanalPosSayfasi } from './sayfalar/pos/SanalPosSayfasi';
import { SatisSayfalari } from './sayfalar/satis/SatisSayfalari';
import { kayitliTercih, temaUygula, type TemaTercihi } from './tema';

function hashDinle(bildir: () => void) {
  window.addEventListener('hashchange', bildir);
  return () => window.removeEventListener('hashchange', bildir);
}

function useRota(): Rota {
  const hash = useSyncExternalStore(hashDinle, () => window.location.hash);
  return rotaCoz(hash);
}

export function Uygulama() {
  const rota = useRota();
  const [bildirim, setBildirim] = useState({ mesaj: '', hata: false });
  const [tema, setTema] = useState<TemaTercihi>(kayitliTercih);
  const [ayarlar, setAyarlar] = useState<Ayarlar>(ayarlariOku);

  useEffect(() => {
    temaUygula(tema, false);
  }, [tema]);
  const adres = rotaAdresi(rota);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [adres]);

  const ayarDegisti = useCallback((a: Ayarlar) => {
    const kayit = ayarlariYaz(a);
    setAyarlar(a);
    const mesaj = kayit
      ? 'Ayarlar bu tarayıcıya kaydedildi.'
      : 'Ayarlar tarayıcıya kaydedilemedi; yalnızca bu oturumda geçerli. Yenileyince önceki ayarlar açılır. Site verisi iznini kontrol edin.';
    setBildirim({ hata: !kayit, mesaj });
    const baglam = { kapsam: 'ayarlar', islemId: Date.now() };
    return kayit ? tamam(undefined, mesaj, baglam) : basarisiz('hata', mesaj, 'KALICI_KAYIT_YOK', baglam);
  }, []);

  const temaDegisti = (t: TemaTercihi) => {
    const kayit = temaUygula(t);
    setTema(t);
    setBildirim({
      hata: !kayit,
      mesaj: kayit
        ? 'Görünüm tercihi kaydedildi.'
        : 'Görünüm tercihi kaydedilemedi; yalnızca bu oturumda geçerli.',
    });
  };
  const depoKontrol = raporBul('depo-kontrol');
  const rapor = rota.tur === 'rapor' ? (raporBul(rota.id) ?? depoKontrol) : undefined;
  const depoKontrolAcik = rapor?.id === 'depo-kontrol';

  return (
    <div className="kabuk">
      <KenarCubugu rota={rota} tema={tema} temaDegisti={temaDegisti} />
      <main className="sayfa">
        <Bildirim mesaj={bildirim.mesaj} hata={bildirim.hata} />
        {/* Depo kontrol ekranı başka sayfaya geçince de açık kalır; yüklenen dosyalar kaybolmaz */}
        {depoKontrol && (
          <div className="sayfa-ic" hidden={!depoKontrolAcik}>
            <DepoKontrolSayfasi rapor={depoKontrol} ayarlar={ayarlar} />
          </div>
        )}
        <SatisSayfalari modulId={rota.tur === 'satis' ? rota.id : undefined} />
        {!depoKontrolAcik && rota.tur !== 'satis' && (
          <div className="sayfa-ic">
            {rota.tur === 'gecmis' && <GecmisSayfasi />}
            {rota.tur === 'sanal-pos' && <SanalPosSayfasi />}
            {rota.tur === 'ayarlar' && (
              <AyarlarSayfasi
                tema={tema}
                temaDegisti={temaDegisti}
                ayarlar={ayarlar}
                ayarDegisti={ayarDegisti}
              />
            )}
            {rapor && rapor.durum === 'yakinda' && <YakindaSayfasi rapor={rapor} />}
          </div>
        )}
      </main>
    </div>
  );
}
