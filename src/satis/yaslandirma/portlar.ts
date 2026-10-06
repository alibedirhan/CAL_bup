import type { YaslandirmaCevabi, YaslandirmaIstegi } from '../../cekirdek/yaslandirma/turler';
export interface YaslandirmaMotoru {
  calistir(istek: YaslandirmaIstegi, signal: AbortSignal): Promise<YaslandirmaCevabi>;
}
