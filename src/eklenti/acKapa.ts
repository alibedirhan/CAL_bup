import { eklenti } from './chrome';
import { panelGorunur, panelGorunurYaz, yardimciKapali, yardimciKapat } from './kurulumDeposu';

/** Araç çubuğu penceresi: iki anahtar (yardımcı açık/kapalı, POS sayfasında pencere). Kart, cari veya
 * kurulum bilgisi göstermez. */
const anahtar = document.getElementById('anahtar') as HTMLInputElement;
const durum = document.getElementById('durum') as HTMLElement;
const surum = document.getElementById('surum') as HTMLElement;
surum.textContent = 'Sürüm ' + eklenti.runtime.getManifest().version;

function goster(kapali: boolean) {
  anahtar.checked = !kapali;
  anahtar.setAttribute('aria-checked', String(!kapali));
  durum.textContent = kapali
    ? 'Kapalı: POS sayfasında panel görünmez, hiçbir şey doldurulmaz.'
    : 'Açık: POS sayfasında panel görünür; seçtiğiniz kart POS’a yazılır.';
  document.body.dataset.kapali = String(kapali);
}
void yardimciKapali()
  .then(goster)
  .catch(() => goster(false));
anahtar.addEventListener('change', () => {
  const kapali = !anahtar.checked;
  anahtar.disabled = true;
  void yardimciKapat(kapali)
    .then(() => goster(kapali))
    .catch(() => {
      durum.textContent = 'Anahtar değiştirilemedi. Yeniden deneyin.';
      void yardimciKapali().then(goster);
    })
    .finally(() => {
      anahtar.disabled = false;
    });
});

const pencere = document.getElementById('pencere') as HTMLInputElement;
const pencereGoster = (g: boolean) => {
  pencere.checked = g;
  pencere.setAttribute('aria-checked', String(g));
};
void panelGorunur()
  .then(pencereGoster)
  .catch(() => pencereGoster(false));
pencere.addEventListener('change', () => {
  const g = pencere.checked;
  pencere.disabled = true;
  void panelGorunurYaz(g)
    .then(() => pencereGoster(g))
    .catch(() => void panelGorunur().then(pencereGoster))
    .finally(() => {
      pencere.disabled = false;
    });
});
