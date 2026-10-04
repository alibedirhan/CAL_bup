import type {
  IskontoBelgesi,
  IskontoOranlari,
  IskontoDosyasi,
  IskontoCiktiTuru,
  IskontoSatirRef,
} from '../../cekirdek/iskonto/turler';

export type IskontoIstegi =
  | { tur: 'yukle'; dosyalar: readonly IskontoDosyasi[] }
  | {
      tur: 'onizle' | IskontoCiktiTuru;
      belgeler: IskontoBelgesi[];
      oranlar: IskontoOranlari;
      tarih: string;
      satirlar?: IskontoSatirRef[];
    };
