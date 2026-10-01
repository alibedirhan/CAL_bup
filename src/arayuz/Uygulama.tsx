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
  const [tema, setTema] = useState<TemaTercihi>(kayitliTercih);
  const [ayarlar, setAyarlar] = useState<Ayarlar>(ayarlariOku);

  useEffect(() => {
    temaUygula(tema);
  }, [tema]);
  const adres = rotaAdresi(rota);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [adres]);

  const ayarDegisti = useCallback((a: Ayarlar) => {
    ayarlariYaz(a);
    setAyarlar(a);
  }, []);

  const depoKontrol = raporBul('depo-kontrol');
  const rapor = rota.tur === 'rapor' ? (raporBul(rota.id) ?? depoKontrol) : undefined;
  const depoKontrolAcik = rapor?.id === 'depo-kontrol';

  return (
    <div className="kabuk">
      <KenarCubugu rota={rota} tema={tema} temaDegisti={setTema} />
      <main className="sayfa">
        {/* Depo kontrol ekranı başka sayfaya geçince de açık kalır; yüklenen dosyalar kaybolmaz */}
        {depoKontrol && (
          <div className="sayfa-ic" hidden={!depoKontrolAcik}>
            <DepoKontrolSayfasi rapor={depoKontrol} ayarlar={ayarlar} />
          </div>
        )}
        {!depoKontrolAcik && (
          <div className="sayfa-ic">
            {rota.tur === 'gecmis' && <GecmisSayfasi />}
            {rota.tur === 'ayarlar' && (
              <AyarlarSayfasi tema={tema} temaDegisti={setTema} ayarlar={ayarlar} ayarDegisti={ayarDegisti} />
            )}
            {rapor && rapor.durum === 'yakinda' && <YakindaSayfasi rapor={rapor} />}
          </div>
        )}
      </main>
    </div>
  );
}
