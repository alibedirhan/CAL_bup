/** Kayıtlar yalnız bu tarayıcıda durur; tarayıcı verisi silinirse tek kurtarma yolu şifreli yedektir. */
export const YEDEK_HATIRLATMA_GUNU = 30;

export function yedekHatirlatmasi(son: string | null, simdi: Date, kayitVar: boolean): string {
  if (!kayitVar) return '';
  const t = son ? Date.parse(son) : NaN;
  if (!Number.isFinite(t))
    return 'Bu tarayıcıda henüz şifreli yedek alınmadı. Tarayıcı verisi silinirse cari ve kartlar geri getirilemez; bir yedek indirin.';
  const gun = Math.floor((simdi.getTime() - t) / 86_400_000);
  if (gun < 0 || gun < YEDEK_HATIRLATMA_GUNU)
    return `Son şifreli yedek: ${new Date(t).toLocaleDateString('tr-TR')}. Sonraki değişikliklerden sonra yeni yedek almayı unutmayın.`;
  return `Son şifreli yedek ${gun} gün önce alındı. Yeni bir yedek indirmeniz önerilir.`;
}
