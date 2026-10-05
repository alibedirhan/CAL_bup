import { alanlariDogrula, posSayfasi, type AlanRolu, type PosAlanlari } from '../cekirdek/posAktarimi';
import { alanTanimi, firmaNumarasi } from './alanlar';
import { eklenti } from './chrome';
import tema from '../arayuz/stiller/tema.css?raw';
import stil from './stil.css?raw';
/** `degisti`: kullanıcı paneli küçültüp büyüttüğünde tercih arka plana bildirilir. */
export function yardimciPaneli(degisti: (kucuk: boolean) => void = () => undefined) {
  const kok = document.createElement('aside');
  kok.id = 'cal-bup-pos-yardimcisi';
  const shadow = kok.attachShadow({ mode: 'open' });
  const css = document.createElement('style');
  css.textContent = tema.replaceAll(':root', ':host') + stil;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'CAL bup POS yardımcısı');
  const baslik = document.createElement('strong');
  baslik.textContent = 'CAL bup POS yardımcısı';
  const durum = document.createElement('p');
  durum.setAttribute('role', 'status');
  durum.textContent = 'Kart numarası ve son kullanmayı doldurur. CVV, tutar ve ödeme düğmelerini kullanmaz.';
  const eylemler = document.createElement('div');
  panel.append(baslik, durum, eylemler);
  shadow.append(css, panel);
  document.body.append(kok);
  // Yoklama aynı yazıyı her saniye yineler; panel yalnız yeni bir bildirimde açılır.
  const bildir = (s: string) => {
    if (durum.textContent === s) return;
    durum.textContent = s;
    durum.hidden = false;
  };
  let temizle = () => {};
  let nesil = 0;
  const dugme = (ad: string, is: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ad;
    b.addEventListener('click', is);
    eylemler.append(b);
    return b;
  };
  const iptal = dugme('Alan seçimini iptal et', () => {
    nesil++;
    temizle();
    bildir('Alan seçimi iptal edildi.');
  });
  iptal.hidden = true;
  const baslat = (ayri: boolean) => {
    const buNesil = ++nesil;
    temizle();
    const roller: AlanRolu[] = ayri ? ['firma', 'numara', 'ay', 'yil'] : ['firma', 'numara', 'tarih'];
    const adlar = {
      firma: 'POS’ta görünen vergi/TC numarasını',
      numara: 'boş kart numarası alanını',
      tarih: 'boş son kullanma alanını',
      ay: 'son kullanma ayı alanını',
      yil: 'son kullanma yılı alanını',
    };
    const a: PosAlanlari = { sayfa: posSayfasi(location.href), alanlar: {} };
    let no = 0;
    const talimat = () =>
      bildir(
        `${no + 1}/${roller.length}: ${adlar[roller[no] ?? 'firma']} tıklayın. Ödeme düğmeleri bu seçim sırasında çalıştırılmaz.`,
      );
    const sec = (event: Event) => {
      if (event.composedPath().includes(kok)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        nesil++;
        temizle();
        bildir('Alan seçimi iptal edildi.');
        return;
      }
      if (event.type !== 'click') return;
      const e = event.target;
      if (!(e instanceof Element)) return;
      try {
        const rol = roller[no] ?? 'firma';
        if (rol !== 'firma' && e instanceof HTMLInputElement && e.value)
          throw new Error('Önce boş kart/tarih alanını seçin.');
        a.alanlar[rol] = alanTanimi(e, rol);
        if (rol === 'firma') {
          const t = e.textContent?.match(/(?<!\d)\d{10,11}(?!\d)/g);
          if (t?.length !== 1) throw new Error('Vergi/TC numarasının tek başına göründüğü yazıyı seçin.');
        }
        if (no + 1 < roller.length) {
          no++;
          talimat();
          return;
        }
        alanlariDogrula(a);
        firmaNumarasi(a);
        temizle();
        void eklenti.runtime
          .sendMessage({ is: 'kurulum', veri: a })
          .then((r) => {
            if (buNesil !== nesil) return;
            const s = r as { durum: string };
            bildir(
              s.durum === 'hazir'
                ? 'Alanlar tanıtıldı. CAL bup’tan cari ve kart seçerek POS’u açabilirsiniz.'
                : 'Kurulum kaydedilemedi. Yeniden deneyin.',
            );
          })
          .catch(() => {
            if (buNesil === nesil) bildir('Kurulum kaydedilemedi.');
          });
      } catch (e) {
        bildir(
          (e instanceof Error ? e.message : 'Alan seçilemedi.') +
            ' ' +
            adlar[roller[Math.min(no, roller.length - 1)] ?? 'firma'] +
            ' seçin.',
        );
      }
    };
    temizle = () => {
      for (const t of ['click', 'pointerdown', 'mousedown', 'keydown'])
        window.removeEventListener(t, sec, true);
      iptal.hidden = true;
    };
    for (const t of ['click', 'pointerdown', 'mousedown', 'keydown']) window.addEventListener(t, sec, true);
    iptal.hidden = false;
    talimat();
  };
  dugme('Numara ve tek tarih alanını tanıt', () => baslat(false));
  dugme('Numara, ayrı ay ve yılı tanıt', () => baslat(true));
  dugme('Bu sayfanın kurulumunu sil', () => {
    temizle();
    const buNesil = ++nesil;
    void eklenti.runtime
      .sendMessage({ is: 'kurulumuSil' })
      .then((r) => {
        if (buNesil !== nesil) return;
        bildir(
          (r as { durum: string }).durum === 'hazir'
            ? 'Alan seçimi silindi.'
            : 'Alan seçimi silinemedi. Yeniden deneyin.',
        );
      })
      .catch(() => {
        if (buNesil === nesil) bildir('Alan seçimi silinemedi. Yeniden deneyin.');
      });
  });
  const gorunum = document.createElement('button');
  gorunum.type = 'button';
  gorunum.textContent = 'Paneli küçült';
  gorunum.setAttribute('aria-expanded', 'true');
  // Küçük panel ödeme formunu örtmez; yeni bildirim geldiğinde yalnız durum yazısı görünür.
  const kucult = (gizli: boolean) => {
    nesil++;
    temizle();
    eylemler.hidden = durum.hidden = gizli;
    gorunum.textContent = gizli ? 'Paneli aç' : 'Paneli küçült';
    gorunum.setAttribute('aria-expanded', String(!gizli));
  };
  gorunum.addEventListener('click', () => {
    const gizli = !eylemler.hidden;
    kucult(gizli);
    degisti(gizli);
  });
  panel.append(gorunum);
  window.addEventListener(
    'pagehide',
    () => {
      nesil++;
      temizle();
    },
    { once: true },
  );
  return { bildir, kucult, seciliyor: () => !iptal.hidden };
}
