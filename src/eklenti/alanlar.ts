import {
  alanlariDogrula,
  type AlanRolu,
  type AlanTanimi,
  type PosAlanlari,
  type PosAktarimi,
} from '../cekirdek/posAktarimi';
const engelli = /cvv|cvc|csc|security|guvenlik|tutar|amount|bedel|miktar|sms|otp|sifre|password|pin/i;
const rolIpucu = {
  numara: /(?:kart|card).*(?:num|no)|(?:num|no).*(?:kart|card)|\bpan\b|cc-number/i,
  tarih: /tarih|son\s*kullan|s[.\s_-]*k[.\s_-]*t|expir|valid|cc-exp/i,
  ay: /(^|[^a-z])ay([^a-z]|$)|month|cc-exp-month/i,
  yil: /yil|year|cc-exp-year/i,
};
function ipucu(e: Element): string {
  let label =
    e instanceof HTMLInputElement || e instanceof HTMLSelectElement
      ? Array.from(e.labels ?? [])
          .map((l) => l.textContent ?? '')
          .join(' ')
      : '';
  if (!label && e.parentElement?.querySelectorAll('input,select').length === 1) {
    const l = e.parentElement.querySelectorAll('label');
    if (l.length === 1 && (l[0]?.textContent?.length ?? 0) <= 120) label = l[0]?.textContent ?? '';
  }
  return [
    e.id,
    e.getAttribute('name'),
    e.getAttribute('autocomplete'),
    e.getAttribute('placeholder'),
    e.getAttribute('aria-label'),
    label,
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
export function alanUygun(e: Element, rol: AlanRolu): boolean {
  if (!gorunur(e) || engelli.test(ipucu(e))) return false;
  if (rol === 'firma')
    return (
      ['SPAN', 'DIV', 'P', 'TD', 'DD', 'B', 'STRONG'].includes(e.tagName) &&
      (e.textContent?.length ?? 0) <= 256 &&
      !e.querySelector('input,select,button,textarea')
    );
  if (
    !(e instanceof HTMLInputElement || e instanceof HTMLSelectElement) ||
    e.disabled ||
    e.matches(':disabled') ||
    (e instanceof HTMLInputElement && (e.readOnly || !['text', 'tel', 'number'].includes(e.type)))
  )
    return false;
  // Etiketsiz bir tutar alanı yanlışlıkla seçilse de kart/tarih diye yazılmaz.
  if (!rolIpucu[rol].test(ipucu(e))) return false;
  if (rol === 'numara')
    return e instanceof HTMLInputElement && e.type !== 'number' && (e.maxLength === -1 || e.maxLength >= 12);
  if (rol === 'tarih')
    return e instanceof HTMLInputElement && e.type !== 'number' && (e.maxLength === -1 || e.maxLength >= 5);
  return true;
}
export function alanTanimi(e: Element, rol: AlanRolu): AlanTanimi {
  if (!alanUygun(e, rol))
    throw new Error('Bu alan uygun değil. Kart, tarih veya firma numarası alanını seçin.');
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
  if (document.querySelectorAll(secici).length !== 1) throw new Error('Alan tek başına tanınamadı.');
  return { secici, etiket: e.tagName, tur: e instanceof HTMLInputElement ? e.type : '' };
}
export function alanBul(a: AlanTanimi, rol: AlanRolu): Element {
  const e = document.querySelectorAll(a.secici);
  const f = e[0];
  if (
    e.length !== 1 ||
    !f ||
    f.tagName !== a.etiket ||
    (f instanceof HTMLInputElement ? f.type : '') !== a.tur ||
    !alanUygun(f, rol)
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
          ? kart.ay + '/' + kart.yil.slice(-2)
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
