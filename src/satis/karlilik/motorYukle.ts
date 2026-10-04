import type { KarlilikMotoru } from './portlar';
let motor: Promise<KarlilikMotoru> | undefined;
export function karlilikMotorunuYukle() {
  motor ??= import('./workerMotoru')
    .then((m) => m.karlilikMotoru)
    .catch((e: unknown) => {
      motor = undefined;
      throw e;
    });
  return motor;
}
