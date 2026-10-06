import { lazy, Suspense, useState, type ComponentType } from 'react';
import { satisModuluBul, type SatisModuluId } from '../../../satis/kayit';

const EKRANLAR = {
  karlilik: lazy(() => import('./karlilik/KarlilikSayfasi')),
  iskonto: lazy(() => import('./iskonto/IskontoSayfasi')),
  yaslandirma: lazy(() => import('./yaslandirma/YaslandirmaSayfasi')),
  'musteri-takip': lazy(() => import('./musteriTakip/MusteriTakipSayfasi')),
} satisfies Record<SatisModuluId, ComponentType<{ aktif: boolean }>>;

/** Kabuk katalogdan açar; ziyaret edilen ekranın oturumunu rota değişiminde korur. */
export function SatisSayfalari({ modulId }: { modulId: string | undefined }) {
  const [acilanlar, setAcilanlar] = useState<SatisModuluId[]>([]);
  const gecerliId = satisModuluBul(modulId ?? '')?.id;
  if (gecerliId && !acilanlar.includes(gecerliId)) setAcilanlar([...acilanlar, gecerliId]);
  return acilanlar.map((id) => {
    const Ekran = EKRANLAR[id];
    return (
      <div className="sayfa-ic" hidden={modulId !== id} key={id}>
        <Suspense fallback={<p role="status">Satış ekranı hazırlanıyor…</p>}>
          <Ekran aktif={modulId === id} />
        </Suspense>
      </div>
    );
  });
}
