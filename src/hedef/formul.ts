// Excel'de satır eklenince formüllerdeki satır numaralarını kaydırma.
// Excel bunu kendisi yapar; ExcelJS yapmaz, bu yüzden biz yaparız.

// Aynı sayfadaki hücre başvurusu: A1, $A$1, AB12. Önünde harf, rakam, nokta ya da "!" olmamalı
// (başka sayfaya başvuru ya da ad), arkasında harf, rakam ya da "(" olmamalı (işlev adı).
const BASVURU = /(^|[^A-Za-z0-9_.!$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g;

/**
 * `satir` ve altındaki satırlara yapılan başvuruları `adet` kadar aşağı kaydırır.
 * Başka sayfaya ('29.09'!B212) ve tırnak içindeki metinlere dokunmaz.
 * Aralık başvurularında (B4:B211) uçlar ayrı ayrı kaydırılır; böylece eklenen satır
 * aralığın içindeyse aralık genişler, tıpkı Excel'deki gibi.
 */
export function formulKaydir(formul: string, satir: number, adet = 1): string {
  // Başka sayfanın ARALIĞI bütünüyle korunur; ikinci uçta ! bulunması gerekmez.
  const korunan =
    /("(?:[^"]|"")*"|(?:'(?:[^']|'')*'|[\p{L}_][\p{L}\p{N}_.]*)!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|'(?:[^']|'')*'|\[[^\]]*\])/gu;
  return formul
    .split(korunan)
    .map((parca, i) => {
      if (i % 2) return parca;
      return parca.replace(
        BASVURU,
        (tum, once: string, d1: string, sutun: string, d2: string, no: string) => {
          const n = Number(no);
          return n >= satir ? `${once}${d1}${sutun}${d2}${n + adet}` : tum;
        },
      );
    })
    .join('');
}

/** "E4:F211 G22:G23" gibi aralık listeleri (koşullu biçim) için aynı kaydırma. */
export function aralikKaydir(aralik: string, satir: number, adet = 1): string {
  return formulKaydir(aralik, satir, adet);
}
