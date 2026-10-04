import type {
  IskontoBelgesi,
  IskontoOranlari,
  IskontoOnizlemesi,
  IskontoDosyasi,
  IskontoCiktiTuru,
  IskontoSatirRef,
  IskontoYuklemesi,
} from '../../cekirdek/iskonto/turler';

export interface IskontoMotoru {
  yukle(dosyalar: readonly IskontoDosyasi[], signal: AbortSignal): Promise<IskontoYuklemesi>;
  onizle(
    belgeler: IskontoBelgesi[],
    oranlar: IskontoOranlari,
    tarih: string,
    signal: AbortSignal,
  ): Promise<IskontoOnizlemesi>;
  cikti(
    tur: IskontoCiktiTuru,
    belgeler: IskontoBelgesi[],
    oranlar: IskontoOranlari,
    tarih: string,
    satirlar: IskontoSatirRef[],
    signal: AbortSignal,
  ): Promise<IskontoDosyasi>;
}
