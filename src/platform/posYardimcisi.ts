import { KullaniciHatasi } from '../cekirdek/hata';
import type { PosAktarimi } from '../cekirdek/posAktarimi';
import type { PosKurulumu } from '../cekirdek/posKurulumu';
import { programAdresi } from '../cekirdek/posAktarimi';
import { yardimciYanitiniDogrula, type YardimciSonucu } from '../cekirdek/posBaglantisi';
/** Sırlar URL, pano veya kalıcı ayara konmaz. Eklenti köprüsüne tek işlem mesajı. `kurulum`: programın
 * sakladığı alan kurulumu kopyası; yardımcıda kurulum yoksa (yeniden kurulduysa) geri yüklenir. */
export function yardimciyaSor(
  is: 'durum' | 'baslat' | 'iptal',
  islemId?: string,
  veri?: PosAktarimi,
  signal?: AbortSignal,
  kurulum?: PosKurulumu | null,
): Promise<YardimciSonucu> {
  return new Promise((coz, reddet) => {
    if (!programAdresi(location.href)) {
      reddet(
        new KullaniciHatasi(
          'POS yardımcısı yalnızca yayımlanmış CAL bup adresinde çalışır. Bu yerel veya farklı adreste eklenti bağlantısı kurulmaz.',
        ),
      );
      return;
    }
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
      temizle();
      try {
        coz(yardimciYanitiniDogrula(e.data.sonuc));
      } catch (e) {
        reddet(e);
      }
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
          'POS yardımcısı bağlı değil veya yanıt vermedi. ZIP’i indirmek tek başına kurulum değildir. Aynı Chrome/Edge tarayıcısında yardımcıyı etkinleştirip program sekmesini yenileyin.',
        ),
      );
    }, 5_000);
    window.postMessage(
      { kanal: 'CAL_BUP_POS_1', id, is, islemId, veri, ...(kurulum ? { kurulum } : {}) },
      location.origin,
    );
  });
}
