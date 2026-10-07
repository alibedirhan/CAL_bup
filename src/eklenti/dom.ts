import { baslikBicimi } from './alanKurallari';

/** Sayfa okuma yardımcıları. Yalnız okur; sayfaya yazmaz, olay üretmez. */
export const PANEL_KIMLIGI = 'cal-bup-pos-yardimcisi';
export const KONTROL = 'input,select,textarea';
const ETIKET_OGESI = /^(LABEL|SPAN|P|B|STRONG|SMALL|DIV|H[1-6]|TD|TH|DT)$/;

/** Seçim listesi seçenekleri ve betikler dışındaki görünen yazı. */
export function yazi(k: Element): string {
  let s = '';
  const w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode())
    if (!n.parentElement?.closest('select,option,script,style,textarea,noscript,template'))
      s += ' ' + (n.nodeValue ?? '');
  return s.replace(/\s+/g, ' ').trim();
}

export function kutuMu(e: Element): e is HTMLInputElement | HTMLSelectElement {
  return e instanceof HTMLInputElement || e instanceof HTMLSelectElement;
}

/** Kutunun yazıları, yakından uzağa: bağlı etiket, aria, hemen önündeki başlık ve yalnız bu kutuyu
 * içeren üst kapsayıcılar (en fazla dört düzey). Kapsayıcıların hepsi alınır: “TL” gibi bir birim
 * yazısı, bir üstteki “Tutar” başlığını gizleyemez. */
export function kutuYazilari(e: Element): string[] {
  const parca: string[] = [];
  if (kutuMu(e)) for (const l of Array.from(e.labels ?? [])) parca.push(yazi(l));
  for (const id of (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) {
    const t = document.getElementById(id)?.textContent?.trim() ?? '';
    if (t && t.length <= 120) parca.push(t);
  }
  const once = e.previousElementSibling;
  if (once && ETIKET_OGESI.test(once.tagName) && !once.querySelector(KONTROL)) {
    const t = yazi(once);
    if (t && t.length <= 60) parca.push(t);
  }
  let p = e.parentElement;
  for (let d = 0; p && p !== document.body && d < 4; d++, p = p.parentElement) {
    if (p.querySelectorAll(KONTROL).length !== 1) break;
    const t = yazi(p);
    if (t && t.length <= 160) parca.push(t);
  }
  return parca.filter(Boolean);
}

/** Kural denetimi için kutunun bütün ipuçları; aksansız, `ı` → `i`. */
export function ipucu(e: Element): string {
  return [
    e.id,
    e.getAttribute('name'),
    e.getAttribute('autocomplete'),
    e.getAttribute('placeholder'),
    e.getAttribute('aria-label'),
    e.getAttribute('title'),
    ...(kutuMu(e) ? kutuYazilari(e) : []),
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

/** Kutuyu yeniden bulmak için kısa, kararlı başlık: en yakın anlamlı yazı (rakamsız). */
export function kutuBasligi(e: Element): string {
  const adaylar = [
    ...kutuYazilari(e),
    e.getAttribute('aria-label') ?? '',
    e.getAttribute('placeholder') ?? '',
  ]
    .map(baslikBicimi)
    .filter((t) => t.length >= 2 && t.length <= 60);
  return adaylar[0] ?? '';
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

/** Yardımcının kendi paneli sayfa taramalarına girmez. */
export function sayfaOgesi(e: Element): boolean {
  return !e.closest('#' + PANEL_KIMLIGI);
}
