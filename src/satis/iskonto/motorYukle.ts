import type { IskontoMotoru } from './portlar';
let motor: Promise<IskontoMotoru> | undefined;
export function iskontoMotorunuYukle(): Promise<IskontoMotoru> {
  motor ??= import('./workerMotoru')
    .then((m) => m.iskontoMotoru)
    .catch((hata: unknown) => {
      motor = undefined;
      throw hata;
    });
  return motor;
}
