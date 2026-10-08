import { eskiKurulumuDonustur, kurulumDogrula, type PosKurulumu } from '../cekirdek/posKurulumu';
import { eklenti } from './chrome';

/** `storage.local` yalnız `kurulum` (site geneli alan seçicileri), `panel` (küçük/büyük tercihi),
 * `panelGoster` (POS sayfasında pencere) ve `kapali` (araç çubuğundaki aç/kapa anahtarı) tutar; kart, cari veya firma değeri asla. Güncellemede eklenti kaldırılmadan “Yeniden yükle”
 * denirse kurulum korunur; kaldırılırsa program kendi kopyasını geri verir. */
/** `undefined`: hiç kurulmadı (veya yardımcı yeniden kuruldu); `null`: kullanıcı bilerek sildi. */
export async function kurulumKaydi(): Promise<PosKurulumu | null | undefined> {
  const d = await eklenti.storage.local.get(['kurulum', 'alanlar']);
  if (d.kurulum === null) return null;
  if (d.kurulum !== undefined) {
    try {
      return kurulumDogrula(d.kurulum);
    } catch {
      return undefined;
    }
  }
  // 1.15 ve öncesi: sayfa adresine bağlı kayıtlar bir kez site geneli kuruluma taşınır.
  if (d.alanlar === undefined) return undefined;
  const eski = eskiKurulumuDonustur(d.alanlar);
  if (eski) await eklenti.storage.local.set({ kurulum: eski });
  await eklenti.storage.local.remove('alanlar');
  return eski ?? undefined;
}
export async function kurulumOku(): Promise<PosKurulumu | null> {
  return (await kurulumKaydi()) ?? null;
}
export async function kurulumYaz(veri: unknown): Promise<PosKurulumu> {
  const k = kurulumDogrula(veri);
  await eklenti.storage.local.set({ kurulum: k });
  return k;
}
/** Bilerek silme `null` olarak kalır; program kendi kopyasını bu durumda geri yüklemez. */
export async function kurulumSil(): Promise<void> {
  await eklenti.storage.local.set({ kurulum: null });
  await eklenti.storage.local.remove('alanlar');
}
export async function panelTercihi(kucuk?: unknown): Promise<boolean> {
  if (typeof kucuk === 'boolean') {
    await eklenti.storage.local.set({ panel: { kucuk } });
    return kucuk;
  }
  const p = await eklenti.storage.local.get('panel');
  return (p.panel as { kucuk?: unknown } | undefined)?.kucuk === true;
}
/** Araç çubuğundaki anahtar. Kayıt yoksa yardımcı açıktır. */
export async function yardimciKapali(): Promise<boolean> {
  return (await eklenti.storage.local.get('kapali')).kapali === true;
}
export async function yardimciKapat(kapali: boolean): Promise<void> {
  if (kapali) await eklenti.storage.local.set({ kapali: true });
  else await eklenti.storage.local.remove('kapali');
}
/** POS sayfasındaki pencere: kullanıcı araç çubuğundan seçmediyse yalnız kurulum yokken (tanıtmak için)
 * görünür. Kurulumdan sonra pencere kendiliğinden açılmaz. */
export async function panelGorunur(): Promise<boolean> {
  const d = await eklenti.storage.local.get('panelGoster');
  if (typeof d.panelGoster === 'boolean') return d.panelGoster;
  return !(await kurulumOku());
}
export async function panelGorunurYaz(goster: boolean): Promise<void> {
  await eklenti.storage.local.set({ panelGoster: goster });
}
