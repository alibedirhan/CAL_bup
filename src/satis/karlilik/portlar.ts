import type { KarlilikIstegi, KarlilikCevabi } from '../../cekirdek/karlilik/turler';
export interface KarlilikMotoru {
  calistir(istek: KarlilikIstegi, signal: AbortSignal): Promise<KarlilikCevabi>;
}
