import type { PosKurulumu } from '../cekirdek/posKurulumu';
import { baslikBicimi, FIRMA_IPUCU, FIRMA_NUMARASI } from './alanKurallari';
import { alanBul } from './alanlar';
import { gorunur, sayfaOgesi, yazi } from './dom';

const ATLA = 'script,style,noscript,template,select,option,textarea,button,input';

function tekNumara(metin: string): string {
  const sayilar = metin.match(FIRMA_NUMARASI) ?? [];
  if (sayilar.length !== 1)
    throw new Error('Firma numarası tek ve açık biçimde okunamadı. Kart aktarılmadı.');
  return sayilar[0] ?? '';
}

/** “Firma İsmi : AD (numara)” gibi, içinde “firma” geçen ve tek 10–11 haneli numara taşıyan en küçük
 * görünür yazılar aranır. Bütün adaylar aynı numarayı göstermiyorsa okunmuş sayılmaz. */
export function firmaNumarasiOtomatik(): string {
  const adaylar: { e: Element; no: string }[] = [];
  for (const e of Array.from(document.body.querySelectorAll('*'))) {
    if (e.closest(ATLA) || !sayfaOgesi(e)) continue;
    const ham = e.textContent ?? '';
    if (ham.length > 2000 || !/\d{10}/.test(ham)) continue;
    const t = yazi(e);
    if (t.length > 300 || !FIRMA_IPUCU.test(baslikBicimi(t))) continue;
    const no = t.match(FIRMA_NUMARASI);
    if (no?.length !== 1 || !gorunur(e)) continue;
    adaylar.push({ e, no: no[0] ?? '' });
  }
  const enKucuk = adaylar.filter((a) => !adaylar.some((b) => b !== a && a.e.contains(b.e)));
  const numaralar = new Set(enKucuk.map((a) => a.no));
  if (numaralar.size !== 1)
    throw new Error('POS’ta firma numarası okunamadı. Kart aktarılmadı; firma yazısını yardımcıya tanıtın.');
  return [...numaralar][0] ?? '';
}

/** Tanıtılmış firma yazısı varsa o; bulunamazsa sayfadan kendiliğinden okunur. Okunan numara her durumda
 * seçilen carinin numarasıyla birebir karşılaştırılır; eşleşmezse hiçbir şey doldurulmaz. */
export function firmaNumarasi(k: PosKurulumu): string {
  const t = k.alanlar.firma;
  if (t) {
    try {
      return tekNumara(alanBul(t, 'firma').textContent ?? '');
    } catch {
      /* Sayfa düzeni farklı olabilir; kendiliğinden okumaya geçilir. */
    }
  }
  return firmaNumarasiOtomatik();
}

/** Tanıtma sırasında kullanıcının tıkladığı firma yazısı. */
export function firmaYazisiNumarasi(e: Element): string {
  return tekNumara(e.textContent ?? '');
}
