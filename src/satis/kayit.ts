export interface SatisModulu {
  readonly id: string;
  readonly ad: string;
  readonly aciklama: string;
}

export const SATIS_MODULLERI = [
  {
    id: 'musteri-takip',
    ad: 'Müşteri Takip',
    aciklama: 'Eski ve yeni müşteri listelerini karşılaştırın; eksik ve yeni müşterileri inceleyin.',
  },
] as const satisfies readonly SatisModulu[];

export type SatisModuluId = (typeof SATIS_MODULLERI)[number]['id'];

export function satisModuluBul(id: string): (typeof SATIS_MODULLERI)[number] | undefined {
  return SATIS_MODULLERI.find((modul) => modul.id === id);
}
