import { useSyncExternalStore } from 'react';
import { driveBagli, driveDinle, driveOturumNo } from '../../../platform/driveKimlik';
import { KullaniciHatasi } from '../../../cekirdek/hata';
export function useDriveOturumu() {
  return useSyncExternalStore(driveDinle, driveOturumNo, () => 0);
}
export function useDrive() {
  useDriveOturumu();
  return useSyncExternalStore(driveDinle, driveBagli, () => false);
}
export function driveHatasi(e: unknown): string {
  return e instanceof KullaniciHatasi
    ? e.message
    : 'Drive işlemi tamamlanamadı. İnternet bağlantısını kontrol edip yeniden deneyin.';
}
