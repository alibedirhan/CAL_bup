import { kurulumDogrula, type AlanRolu, type PosKurulumu } from '../cekirdek/posKurulumu';
import { AlanHatasi, alanTanimi, ROL_ADI } from './alanlar';
import { firmaNumarasiOtomatik, firmaYazisiNumarasi } from './firma';
import type { Eylem, Panel } from './panel';

type Adim = 'numara' | 'tarih' | 'yil' | 'ad' | 'cvv' | 'firma';
const TALIMAT: Record<Adim, string> = {
  numara: 'boş Kredi Kartı Numarası kutusunu tıklayın.',
  tarih: 'boş son kullanma (S.K.T) kutusunu tıklayın. Ay ve yıl ayrı kutularsa ay kutusunu tıklayın.',
  yil: 'son kullanma yılı kutusunu tıklayın.',
  ad: 'boş Ad Soyad kutusunu tıklayın. Formda yoksa “Bu adımı atla”.',
  cvv: 'boş CVV kutusunu tıklayın. CVV’yi her ödemede POS’ta kendiniz yazacaksanız “Bu adımı atla”.',
  firma: 'firma adının yanında görünen vergi/TC numarasının yazısını tıklayın.',
};
const ISTEGE_BAGLI: readonly Adim[] = ['ad', 'cvv'];

/** Tek “Alanları tanıt” akışı. Ödeme formunda kutular sırayla tıklanır; tarih kutusunun türüne bakılarak
 * yılın ayrıca sorulup sorulmayacağına yardımcı karar verir. Firma numarası sayfadan kendiliğinden
 * okunabiliyorsa sorulmaz. Seçim sırasında sayfanın tıklama ve tuşları sayfaya iletilmez (ödeme düğmeleri
 * çalışmaz); Escape iptal eder. Değer saklanmaz, yalnız kutuyu yeniden bulmaya yarayan seçiciler. */
export function tanitmayiBaslat(
  panel: Panel,
  bitti: (kurulum: PosKurulumu | null, mesaj: string) => void,
): () => void {
  const adimlar: Adim[] = ['numara', 'tarih', 'ad', 'cvv'];
  const alanlar: PosKurulumu['alanlar'] = {};
  const secilen = new Map<Element, AlanRolu>();
  let no = 0;
  let acik = true;
  let bekleyenOnay: (() => void) | null = null;

  const adim = () => adimlar[no] ?? 'firma';
  const talimat = () => `Adım ${no + 1}: ${TALIMAT[adim()]}`;
  const eylemler = () => {
    const l: Eylem[] = [];
    if (bekleyenOnay) {
      const is = bekleyenOnay;
      l.push(
        {
          ad: `Evet, bu kutu ${ROL_ADI[rolAdi()]} kutusu`,
          birincil: true,
          is: () => {
            bekleyenOnay = null;
            is();
          },
        },
        {
          ad: 'Hayır, başka kutu seçeceğim',
          is: () => {
            bekleyenOnay = null;
            panel.bildir('Doğru kutuya tıklayın. ' + talimat());
            eylemler();
          },
        },
      );
    }
    if (ISTEGE_BAGLI.includes(adim())) l.push({ ad: 'Bu adımı atla', is: ilerle });
    l.push({ ad: 'Tanıtmayı iptal et', is: () => kapat(null, 'Tanıtma iptal edildi. Kurulum değişmedi.') });
    panel.eylemler(l);
  };
  // `tarih` adımında tıklanan kutu yalnız ayı alıyorsa rol `ay` olur.
  let tarihRolu: 'tarih' | 'ay' = 'tarih';
  const rolAdi = (): AlanRolu => (adim() === 'tarih' ? tarihRolu : adim());
  function ilerle() {
    bekleyenOnay = null;
    no++;
    if (no >= adimlar.length && !adimlar.includes('firma')) {
      try {
        firmaNumarasiOtomatik();
      } catch {
        adimlar.push('firma');
      }
    }
    if (no >= adimlar.length) {
      try {
        kapat(kurulumDogrula({ surum: 2, alanlar }), 'Alanlar tanıtıldı.');
      } catch (e) {
        kapat(null, `${e instanceof Error ? e.message : 'Alan seçimi uygun değil.'} Yeniden tanıtın.`);
      }
      return;
    }
    panel.bildir(talimat());
    eylemler();
  }
  const kabul = (e: Element, elle: boolean) => {
    const rol = rolAdi();
    if (secilen.has(e)) {
      const once = secilen.get(e) ?? 'numara';
      throw new AlanHatasi(`Bu kutuyu zaten ${ROL_ADI[once]} olarak seçtiniz.`);
    }
    // Önce güvenlik denetimi (tutar/CVV/şifre), sonra boşluk: dolu tutar kutusunda asıl neden görünür.
    const tanim = alanTanimi(e, rol, elle);
    if (rol !== 'firma' && e instanceof HTMLInputElement && e.value)
      throw new AlanHatasi('Kart bilgisi yazmadan, boş kutuyu seçin.');
    if (rol === 'firma') firmaYazisiNumarasi(e);
    alanlar[rol] = tanim;
    secilen.set(e, rol);
    if (rol === 'ay') adimlar.splice(no + 1, 0, 'yil');
    ilerle();
  };
  const sec = (event: Event) => {
    if (event.composedPath().includes(panel.kok)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event instanceof KeyboardEvent && event.key === 'Escape') {
      kapat(null, 'Tanıtma iptal edildi. Kurulum değişmedi.');
      return;
    }
    if (event.type !== 'click' || !(event.target instanceof Element)) return;
    const e = event.target;
    bekleyenOnay = null;
    if (adim() === 'tarih')
      tarihRolu =
        e instanceof HTMLSelectElement ||
        (e instanceof HTMLInputElement && e.maxLength > 0 && e.maxLength <= 2)
          ? 'ay'
          : 'tarih';
    try {
      kabul(e, false);
    } catch (h) {
      if (h instanceof AlanHatasi && h.onaylanabilir) {
        bekleyenOnay = () => {
          try {
            kabul(e, true);
          } catch (h2) {
            panel.bildir(`${h2 instanceof Error ? h2.message : 'Alan seçilemedi.'} ${talimat()}`, 'uyari');
            eylemler();
          }
        };
        panel.bildir(
          `${h.message} Tıkladığınız kutu gerçekten ${ROL_ADI[rolAdi()]} kutusuysa “Evet” düğmesine basın; değilse doğru kutuya tıklayın. Tutar kutusunu asla onaylamayın.`,
          'uyari',
        );
      } else panel.bildir(`${h instanceof Error ? h.message : 'Alan seçilemedi.'} ${talimat()}`, 'uyari');
      eylemler();
    }
  };
  const OLAYLAR = ['click', 'pointerdown', 'mousedown', 'keydown'];
  function kapat(k: PosKurulumu | null, mesaj: string) {
    if (!acik) return;
    acik = false;
    for (const t of OLAYLAR) window.removeEventListener(t, sec, true);
    bitti(k, mesaj);
  }
  for (const t of OLAYLAR) window.addEventListener(t, sec, true);
  panel.ac();
  panel.bildir(talimat() + ' Seçim sırasında ödeme düğmeleri çalışmaz.');
  eylemler();
  return () => kapat(null, 'Tanıtma iptal edildi. Kurulum değişmedi.');
}
