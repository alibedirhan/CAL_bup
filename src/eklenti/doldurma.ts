import type { PosAktarimi } from '../cekirdek/posAktarimi';
import type { KartRolu, PosKurulumu } from '../cekirdek/posKurulumu';
import { tarihMetni } from './alanKurallari';
import { alanBul } from './alanlar';
import { firmaNumarasi } from './firma';

type Kutu = HTMLInputElement | HTMLSelectElement;
export interface DoldurmaSonucu {
  doldurulan: KartRolu[];
  /** Kullanıcıya söylenecek, doldurulmayan isteğe bağlı alanlar. */
  notlar: string[];
}

function yilDegeri(e: Kutu, yil: string): string {
  if (e instanceof HTMLSelectElement) {
    const deger = Array.from(e.options).find((o) => o.value === yil || o.value === yil.slice(-2));
    if (!deger || deger.disabled) throw new Error('Son kullanma yılı listede yok.');
    return deger.value;
  }
  return e.maxLength === 2 ? yil.slice(-2) : yil;
}
function deger(rol: KartRolu, e: Kutu, k: PosAktarimi): string {
  if (rol === 'numara') return k.numara;
  if (rol === 'tarih')
    return tarihMetni(k.ay, k.yil, (e as HTMLInputElement).maxLength, e.getAttribute('placeholder') ?? '');
  if (rol === 'ay')
    return e instanceof HTMLSelectElement &&
      !Array.from(e.options).some((o) => o.value === k.ay && !o.disabled)
      ? String(Number(k.ay))
      : k.ay;
  if (rol === 'yil') return yilDegeri(e, k.yil);
  if (rol === 'ad') return k.sahibi;
  return k.cvv;
}
const ayni = (a: string, b: string) =>
  a.replace(/[ /-]/g, '').toLocaleLowerCase('tr-TR') === b.replace(/[ /-]/g, '').toLocaleLowerCase('tr-TR');

/** Önce cari numarası karşılaştırılır, sonra bütün kutular bulunup denetlenir; hiçbiri yazılmadan önce
 * hepsi doğrulanır. Yalnız yerleşik `value` yazıcısı kullanılır: input/change/click/submit üretilmez,
 * böylece alan değişimine bağlı SMS/ödeme kodu yardımcı tarafından tetiklenmez. Başarısız doğrulamada
 * eski değerler geri konur. Numara/tarihte POS'ta farklı bilgi varsa hiçbir şey yazılmaz. */
export function kartiDoldur(kurulum: PosKurulumu, k: PosAktarimi): DoldurmaSonucu {
  if (firmaNumarasi(kurulum) !== k.cariNumarasi) throw new Error('Cari eşleşmiyor.');
  const yazilar: { rol: KartRolu; e: Kutu; yeni: string; eski: string }[] = [];
  const notlar: string[] = [];
  for (const rol of ['numara', 'tarih', 'ay', 'yil', 'ad', 'cvv'] as const) {
    const t = kurulum.alanlar[rol];
    if (rol === 'ad' && !k.sahibi) {
      if (t) notlar.push('Kartta kart sahibi kayıtlı olmadığından Ad Soyad’ı kendiniz yazın.');
      continue;
    }
    if (rol === 'cvv' && !k.cvv) continue;
    if (!t) {
      if (rol === 'cvv') notlar.push('CVV kutusu tanıtılmadığı için CVV’yi POS’ta kendiniz yazın.');
      continue;
    }
    const e = alanBul(t, rol) as Kutu;
    const yeni = deger(rol, e, k);
    if (e instanceof HTMLSelectElement && !Array.from(e.options).some((o) => o.value === yeni && !o.disabled))
      throw new Error('Tarih listesinde seçilen değer yok.');
    if (e instanceof HTMLInputElement && e.maxLength !== -1 && yeni.length > e.maxLength) {
      if (rol !== 'ad') throw new Error('Alan uzunluğu uygun değil.');
      notlar.push('Kart sahibinin adı Ad Soyad kutusuna sığmadı; kendiniz yazın.');
      continue;
    }
    if (e.value && !ayni(e.value, yeni)) {
      if (rol !== 'ad') throw new Error('POS alanında başka bilgi var. Alanlar değiştirilmedi.');
      notlar.push('Ad Soyad kutusunda başka bir ad yazılı; değiştirilmedi.');
      continue;
    }
    yazilar.push({ rol, e, yeni, eski: e.value });
  }
  const yaz = (e: Kutu, s: string) => {
    const p = e instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(p, 'value')?.set;
    if (!setter) throw new Error('Alan yazıcısı bulunamadı.');
    setter.call(e, s);
  };
  try {
    for (const s of yazilar) yaz(s.e, s.yeni);
    if (firmaNumarasi(kurulum) !== k.cariNumarasi || yazilar.some((s) => s.e.value !== s.yeni))
      throw new Error('Alan yazısı doğrulanamadı.');
  } catch (e) {
    for (const s of yazilar) yaz(s.e, s.eski);
    throw e;
  }
  return { doldurulan: yazilar.map((s) => s.rol), notlar };
}
