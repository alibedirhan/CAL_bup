import type { AlanRolu, AlanTanimi } from '../cekirdek/posKurulumu';
import { alanEngelli, ipucuUygun } from './alanKurallari';
import { gorunur, ipucu, KONTROL, kutuBasligi, kutuMu, sayfaOgesi } from './dom';

export const ROL_ADI: Record<AlanRolu, string> = {
  firma: 'vergi/TC numarası',
  numara: 'kart numarası',
  tarih: 'son kullanma (S.K.T)',
  ay: 'son kullanma ayı',
  yil: 'son kullanma yılı',
  ad: 'Ad Soyad (kart sahibi)',
  cvv: 'CVV',
};
const YAZI_OGESI = [
  'SPAN',
  'DIV',
  'P',
  'TD',
  'DD',
  'B',
  'STRONG',
  'LABEL',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
];

/** `onaylanabilir`: yalnız ad/yazı tanınmadığında; kullanıcı açıkça onaylayabilir. */
export class AlanHatasi extends Error {
  constructor(
    mesaj: string,
    readonly onaylanabilir = false,
  ) {
    super(mesaj);
  }
}

/** Uygunsa `null`, değilse kullanıcıya gösterilecek neden. `elle`: ad/yazı denetimi kullanıcı onayıyla
 * geçilir; görünürlük, engelli alan (tutar/şifre/SMS; CVV rolü dışında CVV), tür ve uzunluk denetimleri
 * hiçbir durumda atlanmaz. Doldurma anında da aynı denetim yeniden yapılır. */
export function alanSorunu(e: Element, rol: AlanRolu, elle = false): AlanHatasi | null {
  if (!gorunur(e)) return new AlanHatasi('Bu alan görünmüyor veya gizli bir bölümde.');
  const ip = ipucu(e);
  if (alanEngelli(ip, rol))
    return new AlanHatasi(
      rol === 'cvv'
        ? 'Bu alan tutar, taksit, şifre veya SMS alanına benziyor; yardımcı buraya hiçbir şey yazmaz.'
        : 'Bu alan CVV, tutar, taksit, şifre veya güvenlik alanına benziyor; yardımcı buraya bu bilgiyi yazmaz.',
    );
  if (rol === 'firma')
    return YAZI_OGESI.includes(e.tagName) &&
      (e.textContent ?? '').replace(/\s+/g, ' ').trim().length <= 256 &&
      !e.querySelector('input,select,button,textarea')
      ? null
      : new AlanHatasi('Kutu veya düğme değil, vergi/TC numarasının yazdığı düz yazıyı seçin.');
  if (!kutuMu(e))
    return new AlanHatasi('Tıkladığınız yer bir yazı kutusu değil. Boş kutunun içine tıklayın.');
  if (e.disabled || e.matches(':disabled') || (e instanceof HTMLInputElement && e.readOnly))
    return new AlanHatasi('Bu kutu kapalı veya salt okunur; yardımcı yazamaz.');
  const metinKutusu = rol === 'numara' || rol === 'tarih' || rol === 'ad';
  if (e instanceof HTMLSelectElement && (metinKutusu || rol === 'cvv'))
    return new AlanHatasi(`Bu kutu ${ROL_ADI[rol]} için uygun türde değil (yazı kutusu olmalı).`);
  if (e instanceof HTMLInputElement) {
    const turler =
      rol === 'cvv'
        ? ['text', 'tel', 'number', 'password']
        : metinKutusu
          ? ['text', 'tel']
          : ['text', 'tel', 'number'];
    if (!turler.includes(e.type))
      return new AlanHatasi(`Bu kutunun türü (${e.type}) ${ROL_ADI[rol]} için desteklenmiyor.`);
    const enAz = { numara: 12, tarih: 4, ad: 2, cvv: 3, ay: 1, yil: 2 }[rol];
    if (e.maxLength !== -1 && e.maxLength < enAz)
      return new AlanHatasi(
        `Bu kutu en fazla ${e.maxLength} karakter alıyor; ${ROL_ADI[rol]} için kısa.${rol === 'numara' || rol === 'tarih' ? ' CVV kutusu olabilir.' : ''}`,
      );
    if (rol === 'cvv' && e.maxLength > 4)
      return new AlanHatasi('Bu kutu CVV için fazla uzun; CVV kutusu 3–4 karakter alır.');
  }
  // Etiketsiz bir tutar alanı yanlışlıkla seçilse de yazılmaz; tanınmayan ad yalnız açık onayla.
  if (!elle && !ipucuUygun(ip, rol))
    return new AlanHatasi(`Kutunun adı veya yanındaki yazı ${ROL_ADI[rol]} olarak tanınmadı.`, true);
  return null;
}
export function alanUygun(e: Element, rol: AlanRolu, elle = false): boolean {
  return !alanSorunu(e, rol, elle);
}

function tek(secici: string): Element | null {
  try {
    const e = document.querySelectorAll(secici);
    return e.length === 1 ? (e[0] ?? null) : null;
  } catch {
    return null;
  }
}
function kutuTuru(e: Element): string {
  return e instanceof HTMLInputElement ? e.type : '';
}

/** Seçici sırası: kalıcı kimlik → `name` → sayfadaki sıra. Kimlik veya ad 6+ rakam içeriyorsa
 * (oturuma göre değişen değer olabilir) kullanılmaz. */
export function alanTanimi(e: Element, rol: AlanRolu, elle = false): AlanTanimi {
  const sorun = alanSorunu(e, rol, elle);
  if (sorun) throw sorun;
  const ad = e.getAttribute('name') ?? '';
  const adUygun = Boolean(ad) && ad.length <= 120 && !/\d{6}/.test(ad);
  let secici: string;
  if (e.id && !/\d{6}/.test(e.id) && tek('#' + CSS.escape(e.id)) === e) secici = '#' + CSS.escape(e.id);
  else if (adUygun && tek(`${e.tagName.toLowerCase()}[name="${CSS.escape(ad)}"]`) === e)
    secici = `${e.tagName.toLowerCase()}[name="${CSS.escape(ad)}"]`;
  else {
    let p: Element | null = e;
    const parc: string[] = [];
    while (p && p !== document.body && parc.length < 12) {
      const tag = p.tagName.toLowerCase();
      const kardesler = Array.from(p.parentElement?.children ?? []).filter((k) => k.tagName === p?.tagName);
      parc.unshift(tag + ':nth-of-type(' + (kardesler.indexOf(p) + 1) + ')');
      p = p.parentElement;
    }
    secici = 'body>' + parc.join('>');
  }
  if (tek(secici) !== e || /\d{6}/.test(secici)) throw new AlanHatasi('Alan tek başına tanınamadı.');
  const baslik = rol === 'firma' ? '' : kutuBasligi(e);
  return {
    secici,
    etiket: e.tagName,
    tur: kutuTuru(e),
    ...(elle && rol !== 'firma' ? { elle: true as const } : {}),
    ...(adUygun && rol !== 'firma' ? { ad } : {}),
    ...(baslik ? { baslik } : {}),
  };
}

/** Tanıtılan kutu bu sayfada var mı (uygunluğuna bakılmadan)? Ödeme formunun olduğu sayfayı ayırt eder;
 * kutu varsa ama gizli/kapalıysa doldurma açık hatayla durur, “sayfaya geçin” denmez. */
export function alanIzi(t: AlanTanimi): boolean {
  if (tek(t.secici)?.tagName === t.etiket) return true;
  if (t.ad && Array.from(document.getElementsByName(t.ad)).some((x) => x.tagName === t.etiket)) return true;
  return Boolean(
    t.baslik &&
    Array.from(document.querySelectorAll(KONTROL)).some(
      (x) => x.tagName === t.etiket && sayfaOgesi(x) && kutuBasligi(x) === t.baslik,
    ),
  );
}

/** Tanıtılan alanı bulur. Kaydedilen seçici bu carinin ekranında kaymışsa (ek satır, eksik satır)
 * `name` ve ardından başlık yazısıyla yeniden bulunur. Her adayda bütün güvenlik denetimleri yinelenir;
 * tek ve uygun aday yoksa hiçbir şey yazılmaz. */
export function alanBul(t: AlanTanimi, rol: AlanRolu): Element {
  const uygun = (f: Element | null | undefined): f is Element =>
    f !== null &&
    f !== undefined &&
    f.tagName === t.etiket &&
    kutuTuru(f) === t.tur &&
    sayfaOgesi(f) &&
    alanUygun(f, rol, t.elle === true);
  const ilk = tek(t.secici);
  if (uygun(ilk)) return ilk;
  if (t.ad && rol !== 'firma') {
    const adlar = Array.from(document.getElementsByName(t.ad)).filter((x) => x.tagName === t.etiket);
    if (adlar.length === 1 && uygun(adlar[0])) return adlar[0];
  }
  if (t.baslik && rol !== 'firma') {
    const adaylar = Array.from(document.querySelectorAll(KONTROL)).filter(
      (x) => x.tagName === t.etiket && kutuTuru(x) === t.tur && sayfaOgesi(x) && kutuBasligi(x) === t.baslik,
    );
    if (adaylar.length === 1 && uygun(adaylar[0])) return adaylar[0];
  }
  throw new Error(`Tanıtılan ${ROL_ADI[rol]} kutusu bu sayfada bulunamadı.`);
}
