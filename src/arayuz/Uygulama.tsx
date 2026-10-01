import { useEffect, useState, useSyncExternalStore } from 'react';
import { raporBul } from '../raporlar/kayit';
import { KenarCubugu } from './bilesenler/KenarCubugu';
import { rotaAdresi, rotaCoz, type Rota } from './rota';
import { AyarlarSayfasi } from './sayfalar/AyarlarSayfasi';
import { DepoKontrolSayfasi } from './sayfalar/DepoKontrolSayfasi';
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

function Sayfa({
  rota,
  tema,
  temaDegisti,
}: {
  rota: Rota;
  tema: TemaTercihi;
  temaDegisti: (t: TemaTercihi) => void;
}) {
  if (rota.tur === 'gecmis') return <GecmisSayfasi />;
  if (rota.tur === 'ayarlar') return <AyarlarSayfasi tema={tema} temaDegisti={temaDegisti} />;
  const rapor = raporBul(rota.id) ?? raporBul('depo-kontrol');
  if (!rapor) return null;
  if (rapor.durum === 'yakinda') return <YakindaSayfasi rapor={rapor} />;
  return <DepoKontrolSayfasi rapor={rapor} />;
}

export function Uygulama() {
  const rota = useRota();
  const [tema, setTema] = useState<TemaTercihi>(kayitliTercih);

  useEffect(() => temaUygula(tema), [tema]);
  const adres = rotaAdresi(rota);
  useEffect(() => window.scrollTo(0, 0), [adres]);

  return (
    <div className="kabuk">
      <KenarCubugu rota={rota} tema={tema} temaDegisti={setTema} />
      <main className="sayfa">
        <div className="sayfa-ic">
          <Sayfa rota={rota} tema={tema} temaDegisti={setTema} />
        </div>
      </main>
    </div>
  );
}
