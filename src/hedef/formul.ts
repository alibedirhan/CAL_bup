// Excel'de satır eklenince formüllerdeki satır numaralarını kaydırma.
// Excel bunu kendisi yapar; ExcelJS yapmaz, bu yüzden biz yaparız.

// Aynı sayfadaki hücre başvurusu: A1, $A$1, AB12. Önünde harf, rakam, nokta ya da "!" olmamalı
// (başka sayfaya başvuru ya da ad), arkasında harf, rakam ya da "(" olmamalı (işlev adı).
const BASVURU = /(^|[^\p{L}\p{N}_.!$\\])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\p{L}\p{N}_.\\(])/giu;
const SATIR_ARALIGI = /(^|[^\p{L}\p{N}_.!$\\])(\$?)(\d+):(\$?)(\d+)(?![\p{L}\p{N}_.\\])/gu;

function sutunGecerli(sutun: string): boolean {
  const no = [...sutun.toUpperCase()].reduce((n, h) => n * 26 + h.charCodeAt(0) - 64, 0);
  return no <= 16_384;
}

/**
 * `satir` ve altındaki satırlara yapılan başvuruları `adet` kadar aşağı kaydırır.
 * Başka sayfaya ('29.09'!B212) ve tırnak içindeki metinlere dokunmaz.
 * Aralık başvurularında (B4:B211) uçlar ayrı ayrı kaydırılır; böylece eklenen satır
 * aralığın içindeyse aralık genişler, tıpkı Excel'deki gibi.
 */
export function formulKaydir(formul: string, satir: number, adet = 1): string {
  // Başka sayfanın ARALIĞI bütünüyle korunur; ikinci uçta ! bulunması gerekmez.
  const korunan =
    /("(?:[^"]|"")*"|(?:'(?:[^']|'')*'|[\p{L}_\\][\p{L}\p{N}_.\\]*(?::[\p{L}_\\][\p{L}\p{N}_.\\]*)?)!(?:\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?\d+:\$?\d+|\$?[A-Z]{1,3}:\$?[A-Z]{1,3})|'(?:[^']|'')*'|\[(?:[^[\]]|\[[^[\]]*\])*\])/giu;
  const kaydir = (no: string) => (Number(no) >= satir ? String(Number(no) + adet) : no);
  return formul
    .split(korunan)
    .map((parca, i) => {
      if (i % 2) return parca;
      return parca
        .replace(SATIR_ARALIGI, (tum, once: string, d1: string, n1: string, d2: string, n2: string) => {
          if (Number(n1) < 1 || Number(n2) < 1 || Number(n1) > 1_048_576 || Number(n2) > 1_048_576)
            return tum;
          return `${once}${d1}${kaydir(n1)}:${d2}${kaydir(n2)}`;
        })
        .replace(BASVURU, (tum, once: string, d1: string, sutun: string, d2: string, no: string) => {
          const n = Number(no);
          return n >= satir && n <= 1_048_576 && sutunGecerli(sutun)
            ? `${once}${d1}${sutun}${d2}${n + adet}`
            : tum;
        });
    })
    .join('');
}

/** "E4:F211 G22:G23" gibi aralık listeleri (koşullu biçim) için aynı kaydırma. */
export function aralikKaydir(aralik: string, satir: number, adet = 1): string {
  return formulKaydir(aralik, satir, adet);
}
