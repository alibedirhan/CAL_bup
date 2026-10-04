import type { MusteriCiktisi, MusteriListesi } from '../../cekirdek/musteriTakip/turler';
import type { MusteriDosyasi } from './portlar';

export type MotorIstegi = { tur: 'oku'; dosya: MusteriDosyasi } | { tur: 'excel'; cikti: MusteriCiktisi };
export type MotorYaniti =
  | { tur: 'liste'; liste: MusteriListesi }
  | { tur: 'excel'; bayt: Uint8Array }
  | { tur: 'hata'; mesaj: string };
