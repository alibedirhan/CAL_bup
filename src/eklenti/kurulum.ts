import { alanlariDogrula, posSayfasi, type AlanRolu, type PosAlanlari } from '../cekirdek/posAktarimi';
import { AlanHatasi, alanTanimi, firmaNumarasi, ROL_ADI } from './alanlar';
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
  // Adı/yazısı tanınmayan kutu yalnız kullanıcının açık onayıyla kabul edilir.
  let onayBekleyen: (() => void) | null = null;
  const onayDugmesi = dugme('Evet, tıkladığım kutu doğru', () => {
    const is = onayBekleyen;
    onayGizle();
    is?.();
  });
  const onayRed = dugme('Hayır, başka kutu seçeceğim', () => {
    onayGizle();
    bildir('Doğru kutuya tıklayın.');
  });
  const onayGizle = () => {
    onayBekleyen = null;
    onayDugmesi.hidden = onayRed.hidden = true;
  };
  onayGizle();
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
    const sira = () => `${no + 1}/${roller.length}: ${adlar[roller[no] ?? 'firma']} tıklayın.`;
    const kabul = (e: Element, rol: AlanRolu, elle: boolean) => {
      if (rol !== 'firma' && e instanceof HTMLInputElement && e.value)
        throw new AlanHatasi('Kart bilgisi yazmadan, boş kutuyu seçin.');
      const tanim = alanTanimi(e, rol, elle);
      if (rol === 'firma') {
        const t = e.textContent?.match(/(?<!\d)\d{10,11}(?!\d)/g);
        if (t?.length !== 1) throw new AlanHatasi('Yalnız bir vergi/TC numarasının göründüğü yazıyı seçin.');
      }
      a.alanlar[rol] = tanim;
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
    };
    const hataGoster = (e: unknown) =>
      bildir(`${e instanceof Error ? e.message : 'Alan seçilemedi.'} ${sira()}`);
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
      onayGizle();
      const rol = roller[no] ?? 'firma';
      try {
        kabul(e, rol, false);
      } catch (h) {
        if (!(h instanceof AlanHatasi && h.onaylanabilir)) {
          hataGoster(h);
          return;
        }
        const n = nesil;
        onayBekleyen = () => {
          if (n !== nesil) return;
          try {
            kabul(e, rol, true);
          } catch (h2) {
            hataGoster(h2);
          }
        };
        onayDugmesi.textContent = `Evet, bu kutu ${ROL_ADI[rol]} kutusu`;
        onayDugmesi.hidden = onayRed.hidden = false;
        bildir(
          `${h.message} Tıkladığınız kutu gerçekten ${ROL_ADI[rol]} kutusuysa “Evet” düğmesine basın; değilse doğru kutuya tıklayın. CVV veya tutar kutusunu onaylamayın.`,
        );
      }
    };
    temizle = () => {
      for (const t of ['click', 'pointerdown', 'mousedown', 'keydown'])
        window.removeEventListener(t, sec, true);
      iptal.hidden = true;
      onayGizle();
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
