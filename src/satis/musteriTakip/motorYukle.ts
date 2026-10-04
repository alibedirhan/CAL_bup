import type { MusteriMotoru } from './portlar';

let yukleme: Promise<MusteriMotoru> | null = null;

export function musteriMotoruYukle(): Promise<MusteriMotoru> {
  yukleme ??= import('./workerMotoru')
    .then((motor) => motor.musteriMotoru)
    .catch((hata: unknown) => {
      yukleme = null;
      throw hata;
    });
  return yukleme;
}
