// Excel motorunu ilk gerektiğinde yükler (ayrı paket parçası). Bu dosya motor.ts'i
// yalnızca dinamik olarak içe aktarır; statik içe aktarırsa kütüphane ana pakete girer.

export type Motor = typeof import('./motor');

let yukleme: Promise<Motor> | null = null;

export function motorYukle(): Promise<Motor> {
  yukleme ??= import('./motor');
  return yukleme;
}
