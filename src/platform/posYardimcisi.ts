import { KullaniciHatasi } from '../cekirdek/hata';
import type { PosAktarimi } from '../cekirdek/posAktarimi';
export interface YardimciSonucu {
  durum: string;
  mesaj: string;
}
/** Sırlar URL, pano veya kalıcı ayara konmaz. Eklenti köprüsüne tek işlem mesajı. */
export function yardimciyaSor(
  is: 'durum' | 'baslat' | 'iptal',
  islemId?: string,
  veri?: PosAktarimi,
  signal?: AbortSignal,
): Promise<YardimciSonucu> {
  return new Promise((coz, reddet) => {
    const id = crypto.randomUUID();
    let zaman: ReturnType<typeof setTimeout> | undefined = undefined;
    const temizle = () => {
      clearTimeout(zaman);
      window.removeEventListener('message', dinle);
      signal?.removeEventListener('abort', iptal);
    };
    const iptal = () => {
      temizle();
      reddet(new KullaniciHatasi('POS aktarımı durduruldu.'));
    };
    const dinle = (e: MessageEvent) => {
      if (
        e.source !== window ||
        e.origin !== location.origin ||
        e.data?.kanal !== 'CAL_BUP_POS_YANIT_1' ||
        e.data.id !== id
      )
        return;
      const s = e.data.sonuc as YardimciSonucu | null;
      if (!s || typeof s.durum !== 'string' || (s.mesaj !== undefined && typeof s.mesaj !== 'string')) return;
      temizle();
      coz({ durum: s.durum, mesaj: s.mesaj ?? '' });
    };
    if (signal?.aborted) {
      iptal();
      return;
    }
    window.addEventListener('message', dinle);
    signal?.addEventListener('abort', iptal, { once: true });
    zaman = setTimeout(() => {
      temizle();
      reddet(
        new KullaniciHatasi(
          'POS yardımcısı bağlı değil veya yanıt vermedi. Kurulumdan sonra sayfayı yenileyin.',
        ),
      );
    }, 5_000);
    window.postMessage({ kanal: 'CAL_BUP_POS_1', id, is, islemId, veri }, location.origin);
  });
}
