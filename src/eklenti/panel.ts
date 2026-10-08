import tema from '../arayuz/stiller/tema.css?raw';
import stil from './stil.css?raw';
import { PANEL_KIMLIGI } from './dom';

export type Ton = 'bilgi' | 'uyari' | 'hata';
export interface Eylem {
  ad: string;
  is: () => void;
  birincil?: boolean;
}
export interface Panel {
  kok: HTMLElement;
  /** Yoklama aynı yazıyı her saniye yineler; panel yalnız yeni bir bildirimde açılır. */
  bildir(metin: string, ton?: Ton): void;
  /** Kurulumun kalıcı durumu (“Kurulum tamam…”), bildirimden ayrı satır. */
  kurulumYazisi(metin: string): void;
  eylemler(liste: Eylem[]): void;
  /** Salt okunur metin alanı (ekran yapısı raporu); `null` kapatır. */
  metin(icerik: string | null): void;
  kucult(gizli: boolean): void;
  ac(): void;
  /** Pencerenin sayfada görünmesi (araç çubuğundaki seçim). Uyarı ve hata pencereyi her zaman gösterir. */
  gorunur(goster: boolean): void;
}

/** Yalnız kabuk: gölge kök içinde başlık, durum, kurulum satırı ve düğmeler. Ne gösterileceğine
 * `pos.ts` ve tanıtma akışı karar verir. Sayfa stilleri panele, panel stilleri sayfaya sızmaz. */
export function panelOlustur(kucukDegisti: (kucuk: boolean) => void): Panel {
  const kok = document.createElement('aside');
  kok.id = PANEL_KIMLIGI;
  const shadow = kok.attachShadow({ mode: 'open' });
  const css = document.createElement('style');
  css.textContent = tema.replaceAll(':root', ':host') + stil;
  const bolum = document.createElement('section');
  bolum.setAttribute('aria-label', 'CAL bup POS yardımcısı');
  const baslik = document.createElement('strong');
  baslik.textContent = 'CAL bup POS yardımcısı';
  const durum = document.createElement('p');
  durum.setAttribute('role', 'status');
  durum.textContent =
    'Kart numarası, son kullanma, Ad Soyad ve (yazdıysanız) CVV’yi doldurur. Tutara ve ödeme düğmelerine dokunmaz.';
  const kurulum = document.createElement('p');
  kurulum.className = 'kurulum';
  kurulum.hidden = true;
  const alan = document.createElement('textarea');
  alan.readOnly = true;
  alan.hidden = true;
  alan.setAttribute('aria-label', 'Ekran yapısı raporu');
  const dugmeler = document.createElement('div');
  const gorunum = document.createElement('button');
  gorunum.type = 'button';
  bolum.append(baslik, durum, kurulum, alan, dugmeler, gorunum);
  shadow.append(css, bolum);
  document.body.append(kok);

  const kucult = (gizli: boolean) => {
    dugmeler.hidden = durum.hidden = gizli;
    kurulum.hidden = gizli || !kurulum.textContent;
    alan.hidden = gizli || !alan.value;
    gorunum.textContent = gizli ? 'Paneli aç' : 'Paneli küçült';
    gorunum.setAttribute('aria-expanded', String(!gizli));
  };
  kucult(false);
  gorunum.addEventListener('click', () => {
    const gizli = !dugmeler.hidden;
    kucult(gizli);
    kucukDegisti(gizli);
  });
  return {
    kok,
    bildir(metin, ton = 'bilgi') {
      if (durum.textContent === metin && (durum.dataset.ton ?? 'bilgi') === ton) return;
      durum.textContent = metin;
      if (ton === 'bilgi') delete durum.dataset.ton;
      else durum.dataset.ton = ton;
      durum.hidden = false;
      // Kart aktarılmadığını veya yanlış oturumu söyleyen yazılar gizli pencerede kaybolmaz.
      if (ton !== 'bilgi') kok.hidden = false;
      if (ton === 'hata') kucult(false);
    },
    kurulumYazisi(metin) {
      kurulum.textContent = metin;
      kurulum.hidden = !metin || dugmeler.hidden;
    },
    eylemler(liste) {
      dugmeler.replaceChildren(
        ...liste.map((e) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = e.ad;
          if (e.birincil) b.className = 'birincil';
          b.addEventListener('click', e.is);
          return b;
        }),
      );
    },
    metin(icerik) {
      alan.value = icerik ?? '';
      alan.hidden = icerik === null || dugmeler.hidden;
      if (icerik !== null) alan.select();
    },
    kucult,
    ac: () => kucult(false),
    gorunur(goster) {
      kok.hidden = !goster;
    },
  };
}
