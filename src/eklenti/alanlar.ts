import {
  alanlariDogrula,
  type AlanRolu,
  type AlanTanimi,
  type PosAlanlari,
  type PosAktarimi,
} from '../cekirdek/posAktarimi';
import { ENGELLI_ALAN, ipucuUygun, tarihMetni } from './alanKurallari';
const KONTROL = 'input,select,textarea';
const ETIKET_OGESI = /^(LABEL|SPAN|P|B|STRONG|SMALL|DIV|H[1-6]|TD|TH|DT)$/;
export const ROL_ADI: Record<AlanRolu, string> = {
  firma: 'vergi/TC numarası',
  numara: 'kart numarası',
  tarih: 'son kullanma (S.K.T)',
  ay: 'son kullanma ayı',
  yil: 'son kullanma yılı',
};

/** Seçim listesi seçenekleri ve betikler dışındaki görünen yazı. */
function yazi(k: Element): string {
  let s = '';
  const w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode())
    if (!n.parentElement?.closest('select,option,script,style,textarea')) s += ' ' + (n.nodeValue ?? '');
  return s.replace(/\s+/g, ' ').trim();
}

/** Kutuya bağlı olmayan ama yalnız ona ait görünen yazı: “S.K.T”, “CVV”, “Tutar” gibi başlıklar. */
function yakinYazi(e: Element): string {
  const parca: string[] = [];
  for (const id of (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) {
    const t = document.getElementById(id)?.textContent?.trim() ?? '';
    if (t && t.length <= 120) parca.push(t);
  }
  // Yalnız bu kutuyu içeren üst kapsayıcıların hepsinin yazısı (en fazla dört düzey). İlk yazıda
  // durulmaz: “TL” gibi bir birim yazısı, bir üstteki “Tutar” başlığını gizleyemez.
  let p = e.parentElement;
  for (let d = 0; p && p !== document.body && d < 4; d++, p = p.parentElement) {
    if (p.querySelectorAll(KONTROL).length !== 1) break;
    const t = yazi(p);
    if (t && t.length <= 160) parca.push(t);
  }
  // Aynı kapsayıcıda birden çok kutu varsa hemen önündeki başlık öğesi.
  const once = e.previousElementSibling;
  if (once && ETIKET_OGESI.test(once.tagName) && !once.querySelector(KONTROL)) {
    const t = yazi(once);
    if (t && t.length <= 60) parca.push(t);
  }
  return parca.join(' ');
}
function ipucu(e: Element): string {
  const label =
    e instanceof HTMLInputElement || e instanceof HTMLSelectElement
      ? Array.from(e.labels ?? [])
          .map((l) => l.textContent ?? '')
          .join(' ')
      : '';
  return [
    e.id,
    e.getAttribute('name'),
    e.getAttribute('autocomplete'),
    e.getAttribute('placeholder'),
    e.getAttribute('aria-label'),
    e.getAttribute('title'),
    label,
    e instanceof HTMLInputElement || e instanceof HTMLSelectElement ? yakinYazi(e) : '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}
export function gorunur(e: Element): boolean {
  const r = e.getBoundingClientRect();
  if (!e.isConnected || r.width <= 0 || r.height <= 0) return false;
  for (let p: Element | null = e; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (
      p.hasAttribute('hidden') ||
      p.hasAttribute('inert') ||
      p.getAttribute('aria-hidden') === 'true' ||
      s.visibility !== 'visible' ||
      s.display === 'none' ||
      Number(s.opacity) === 0 ||
      s.contentVisibility === 'hidden'
    )
      return false;
  }
  return true;
}
/** `onaylanabilir`: yalnız ad/yazı tanınmadığında; kullanıcı açıkça onaylayabilir. */
export class AlanHatasi extends Error {
  constructor(
    mesaj: string,
    readonly onaylanabilir = false,
  ) {
    super(mesaj);
  }
}
/** Uygunsa `null`, değilse kullanıcıya gösterilecek neden. `elle`: ad/yazı denetimi kullanıcı onayıyla geçilir;
 * görünürlük, engelli alan (CVV/tutar/şifre…), tür ve uzunluk denetimleri hiçbir durumda atlanmaz. */
export function alanSorunu(e: Element, rol: AlanRolu, elle = false): AlanHatasi | null {
  if (!gorunur(e)) return new AlanHatasi('Bu alan görünmüyor veya gizli bir bölümde.');
  const ip = ipucu(e);
  if (ENGELLI_ALAN.test(ip))
    return new AlanHatasi(
      'Bu alan CVV, tutar, taksit, şifre veya güvenlik alanına benziyor; yardımcı buraya hiçbir şey yazmaz.',
    );
  if (rol === 'firma')
    return ['SPAN', 'DIV', 'P', 'TD', 'DD', 'B', 'STRONG'].includes(e.tagName) &&
      (e.textContent?.length ?? 0) <= 256 &&
      !e.querySelector('input,select,button,textarea')
      ? null
      : new AlanHatasi('Kutu veya düğme değil, vergi/TC numarasının yazdığı düz yazıyı seçin.');
  if (!(e instanceof HTMLInputElement || e instanceof HTMLSelectElement))
    return new AlanHatasi('Tıkladığınız yer bir yazı kutusu değil. Boş kutunun içine tıklayın.');
  if (e.disabled || e.matches(':disabled') || (e instanceof HTMLInputElement && e.readOnly))
    return new AlanHatasi('Bu kutu kapalı veya salt okunur; yardımcı yazamaz.');
  if (e instanceof HTMLInputElement && !['text', 'tel', 'number'].includes(e.type))
    return new AlanHatasi(`Bu kutunun türü (${e.type}) desteklenmiyor.`);
  if (rol === 'numara' || rol === 'tarih') {
    if (!(e instanceof HTMLInputElement) || e.type === 'number')
      return new AlanHatasi(`Bu kutu ${ROL_ADI[rol]} için uygun türde değil (yazı kutusu olmalı).`);
    const enAz = rol === 'numara' ? 12 : 4;
    if (e.maxLength !== -1 && e.maxLength < enAz)
      return new AlanHatasi(
        `Bu kutu en fazla ${e.maxLength} karakter alıyor; ${ROL_ADI[rol]} için kısa. CVV kutusu olabilir.`,
      );
  }
  // Etiketsiz bir tutar alanı yanlışlıkla seçilse de kart/tarih diye yazılmaz; tanınmayan ad yalnız açık onayla.
  if (!elle && !ipucuUygun(ip, rol))
    return new AlanHatasi(`Kutunun adı veya yanındaki yazı ${ROL_ADI[rol]} olarak tanınmadı.`, true);
  return null;
}
export function alanUygun(e: Element, rol: AlanRolu, elle = false): boolean {
  return !alanSorunu(e, rol, elle);
}
export function alanTanimi(e: Element, rol: AlanRolu, elle = false): AlanTanimi {
  const sorun = alanSorunu(e, rol, elle);
  if (sorun) throw sorun;
  let secici = '';
  if (e.id && !/\d{6}/.test(e.id)) secici = '#' + CSS.escape(e.id);
  if (!secici || document.querySelectorAll(secici).length !== 1) {
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
  if (document.querySelectorAll(secici).length !== 1) throw new AlanHatasi('Alan tek başına tanınamadı.');
  return {
    secici,
    etiket: e.tagName,
    tur: e instanceof HTMLInputElement ? e.type : '',
    ...(elle && rol !== 'firma' ? { elle: true as const } : {}),
  };
}
export function alanBul(a: AlanTanimi, rol: AlanRolu): Element {
  const e = document.querySelectorAll(a.secici);
  const f = e[0];
  if (
    e.length !== 1 ||
    !f ||
    f.tagName !== a.etiket ||
    (f instanceof HTMLInputElement ? f.type : '') !== a.tur ||
    !alanUygun(f, rol, a.elle === true)
  )
    throw new Error('Tanıtılan alan değişmiş veya görünmüyor. Yeniden tanıtın.');
  return f;
}
export function firmaNumarasi(a: PosAlanlari): string {
  alanlariDogrula(a);
  const firma = a.alanlar.firma;
  if (!firma) throw new Error('Firma alanı eksik.');
  const text = alanBul(firma, 'firma').textContent ?? '';
  const sayilar = text.match(/(?<!\d)\d{10,11}(?!\d)/g) ?? [];
  if (sayilar.length !== 1)
    throw new Error('Firma numarası tek ve açık biçimde okunamadı. Kart aktarılmadı.');
  return sayilar[0] ?? '';
}
function yilDegeri(e: HTMLInputElement | HTMLSelectElement, yil: string): string {
  if (e instanceof HTMLSelectElement) {
    const deger = Array.from(e.options).find((o) => o.value === yil || o.value === yil.slice(-2));
    if (!deger || deger.disabled) throw new Error('Son kullanma yılı listede yok.');
    return deger.value;
  }
  return e.maxLength === 2 ? yil.slice(-2) : yil;
}
export function kartiDoldur(a: PosAlanlari, kart: PosAktarimi): void {
  if (firmaNumarasi(a) !== kart.cariNumarasi) throw new Error('Cari eşleşmiyor.');
  const yazilar: { e: HTMLInputElement | HTMLSelectElement; yeni: string; eski: string }[] = [];
  for (const rol of ['numara', 'tarih', 'ay', 'yil'] as const) {
    const t = a.alanlar[rol];
    if (!t) continue;
    const e = alanBul(t, rol) as HTMLInputElement | HTMLSelectElement;
    let yeni =
      rol === 'numara'
        ? kart.numara
        : rol === 'tarih'
          ? tarihMetni(
              kart.ay,
              kart.yil,
              (e as HTMLInputElement).maxLength,
              e.getAttribute('placeholder') ?? '',
            )
          : rol === 'ay'
            ? kart.ay
            : yilDegeri(e, kart.yil);
    if (
      rol === 'ay' &&
      e instanceof HTMLSelectElement &&
      !Array.from(e.options).some((o) => o.value === yeni && !o.disabled)
    )
      yeni = String(Number(kart.ay));
    if (e instanceof HTMLSelectElement && !Array.from(e.options).some((o) => o.value === yeni && !o.disabled))
      throw new Error('Tarih listesinde seçilen değer yok.');
    if (e instanceof HTMLInputElement && e.maxLength !== -1 && yeni.length > e.maxLength)
      throw new Error('Alan uzunluğu uygun değil.');
    if (e.value && e.value.replace(/[ /-]/g, '') !== yeni.replace(/[ /-]/g, ''))
      throw new Error('POS alanında başka bilgi var. Alanlar değiştirilmedi.');
    yazilar.push({ e, yeni, eski: e.value });
  }
  // Bütün alanlar doğrulanmadan hiçbir yazı yapılmaz. input/change/submit/click yok.
  const yaz = (e: HTMLInputElement | HTMLSelectElement, s: string) => {
    const p = e instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(p, 'value')?.set;
    if (!setter) throw new Error('Alan yazıcısı bulunamadı.');
    setter.call(e, s);
  };
  try {
    for (const s of yazilar) yaz(s.e, s.yeni);
    if (firmaNumarasi(a) !== kart.cariNumarasi || yazilar.some((s) => s.e.value !== s.yeni))
      throw new Error('Alan yazısı doğrulanamadı.');
  } catch (e) {
    for (const s of yazilar) yaz(s.e, s.eski);
    throw e;
  }
}
