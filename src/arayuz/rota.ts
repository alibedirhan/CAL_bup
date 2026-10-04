// Adres çubuğundaki #/... kısmı. GitHub Pages'te sunucu yönlendirmesi
// olmadığı için yol yerine # kullanılır.

import { satisModuluBul } from '../satis/kayit';

export type Rota =
  | { tur: 'rapor'; id: string }
  | { tur: 'satis'; id: string }
  | { tur: 'gecmis' }
  | { tur: 'ayarlar' }
  | { tur: 'sanal-pos' };

export const ACILIS: Rota = { tur: 'rapor', id: 'depo-kontrol' };

export function rotaCoz(hash: string): Rota {
  const parcalar = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [ilk, ikinci] = parcalar;
  if (ilk === 'gecmis') return { tur: 'gecmis' };
  if (ilk === 'ayarlar') return { tur: 'ayarlar' };
  if (ilk === 'sanal-pos') return { tur: 'sanal-pos' };
  if (ilk === 'rapor' && ikinci) return { tur: 'rapor', id: ikinci };
  if (ilk === 'satis' && ikinci && satisModuluBul(ikinci)) return { tur: 'satis', id: ikinci };
  return ACILIS;
}

export function rotaAdresi(rota: Rota): string {
  return rota.tur === 'rapor' || rota.tur === 'satis' ? `#/${rota.tur}/${rota.id}` : `#/${rota.tur}`;
}
