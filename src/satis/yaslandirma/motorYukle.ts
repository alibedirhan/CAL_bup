import type { YaslandirmaMotoru } from './portlar';
let motor: Promise<YaslandirmaMotoru> | undefined;
export function yaslandirmaMotorunuYukle() {
  motor ??= import('./workerMotoru')
    .then((m) => m.yaslandirmaMotoru)
    .catch((e: unknown) => {
      motor = undefined;
      throw e;
    });
  return motor;
}
