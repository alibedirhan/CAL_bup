import { programAdresi } from '../cekirdek/posAktarimi';
import { POS_KIMLIK } from '../cekirdek/posKart';
import { eklenti } from './chrome';
if (window.top === window && programAdresi(location.href)) {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || e.origin !== location.origin || !programAdresi(location.href)) return;
    const m = e.data as { kanal?: string; id?: string; is?: string } | null;
    if (
      m?.kanal !== 'CAL_BUP_POS_1' ||
      typeof m.id !== 'string' ||
      !POS_KIMLIK.test(m.id) ||
      !['durum', 'baslat', 'iptal'].includes(m.is ?? '')
    )
      return;
    void eklenti.runtime
      .sendMessage(e.data)
      .then((sonuc) => {
        window.postMessage({ kanal: 'CAL_BUP_POS_YANIT_1', id: m.id, sonuc }, location.origin);
      })
      .catch(() => {
        window.postMessage(
          {
            kanal: 'CAL_BUP_POS_YANIT_1',
            id: m.id,
            sonuc: { durum: 'hata', mesaj: 'POS yardımcısı yanıt vermedi. Yeniden kontrol edin.' },
          },
          location.origin,
        );
      });
  });
}
