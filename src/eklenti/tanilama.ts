import type { PosKurulumu } from '../cekirdek/posKurulumu';
import { alanBul, ROL_ADI } from './alanlar';
import { gorunur, kutuBasligi, sayfaOgesi } from './dom';
import { firmaNumarasiOtomatik } from './firma';

/** Rakamlar ve e-posta benzeri yazılar maskelenir; değerler hiç okunmaz. */
function maske(s: string | null | undefined, sinir = 60): string {
  return (s ?? '')
    .replace(/[^\s@]+@[^\s@]+/g, '<e-posta>')
    .replace(/\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, sinir);
}

/** Gerçek POS'a hiç istek göndermeden taklit sayfa kurabilmek için ekranın yapısı: kutuların türü,
 * kimliği, adı, uzunluğu, başlığı ve dolu olup olmadığı. Kutu değerleri, cari adı, bakiye veya numara
 * yazılmaz; rakamlar `#` olur. Kullanıcı göndermeden önce metni kendisi görür. */
export function ekranYapisi(kurulum: PosKurulumu | null): string {
  const satir: string[] = [
    'CAL bup POS yardımcısı — ekran yapısı (değer içermez)',
    `Sayfa: ${maske(location.pathname, 120)}`,
  ];
  for (const e of Array.from(document.querySelectorAll('input,select,textarea,button'))) {
    if (!sayfaOgesi(e)) continue;
    const tur = e instanceof HTMLInputElement ? e.type : e.tagName.toLowerCase();
    if (tur === 'hidden') {
      satir.push(`- gizli ad="${maske(e.getAttribute('name'))}"`);
      continue;
    }
    const uzunluk = e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement ? e.maxLength : '';
    const dolu =
      e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement
        ? Boolean(e.value)
        : '';
    satir.push(
      [
        `- ${e.tagName.toLowerCase()}`,
        `tür=${tur}`,
        `kimlik="${maske(e.id)}"`,
        `ad="${maske(e.getAttribute('name'))}"`,
        uzunluk !== '' ? `uzunluk=${uzunluk}` : '',
        e.getAttribute('placeholder') ? `yer="${maske(e.getAttribute('placeholder'))}"` : '',
        e.getAttribute('autocomplete') ? `otomatik="${maske(e.getAttribute('autocomplete'))}"` : '',
        e instanceof HTMLButtonElement
          ? `yazı="${maske(e.textContent)}"`
          : `başlık="${maske(kutuBasligi(e))}"`,
        `görünür=${gorunur(e) ? 'evet' : 'hayır'}`,
        dolu !== '' ? `dolu=${dolu ? 'evet' : 'hayır'}` : '',
        e.closest('form') ? '' : 'form-dışı',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  satir.push(`Çerçeve (iframe) sayısı: ${document.querySelectorAll('iframe').length}`);
  let firma = 'okunamadı';
  try {
    firmaNumarasiOtomatik();
    firma = 'okundu';
  } catch {
    /* Raporda yalnız sonuç yazılır. */
  }
  satir.push(`Firma numarası kendiliğinden: ${firma}`);
  if (kurulum)
    for (const [rol, t] of Object.entries(kurulum.alanlar)) {
      let sonuc = 'bulundu';
      try {
        alanBul(t, rol as keyof typeof ROL_ADI);
      } catch {
        sonuc = 'bulunamadı';
      }
      satir.push(`Kurulum ${ROL_ADI[rol as keyof typeof ROL_ADI]}: ${sonuc}`);
    }
  else satir.push('Kurulum: yok');
  return satir.join('\n');
}
