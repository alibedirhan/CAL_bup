// Tarihler "YYYY-AA-GG" metni olarak taşınır: saat dilimi derdi yoktur,
// doğrudan karşılaştırılabilir ve kaydedilebilir.

export type Tarih = string & { readonly __tarih: unique symbol };

function olustur(yil: number, ay: number, gun: number): Tarih | null {
  if (!Number.isInteger(yil) || !Number.isInteger(ay) || !Number.isInteger(gun)) return null;
  if (ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
  const d = new Date(Date.UTC(yil, ay - 1, gun));
  if (d.getUTCDate() !== gun || d.getUTCMonth() !== ay - 1) return null;
  return d.toISOString().slice(0, 10) as Tarih;
}

function parcalar(t: Tarih): [number, number, number] {
  const [y, a, g] = t.split('-').map(Number);
  return [y ?? 0, a ?? 0, g ?? 0];
}

export function tarih(yil: number, ay: number, gun: number): Tarih {
  const t = olustur(yil, ay, gun);
  if (!t) throw new RangeError(`Geçersiz tarih: ${gun}.${ay}.${yil}`);
  return t;
}

export function yilOf(t: Tarih): number {
  return parcalar(t)[0];
}

/** JavaScript Date (yerel saat) → Tarih. Excel'den gelen tarih hücreleri için. */
export function tarihtenCevir(d: Date): Tarih {
  return tarih(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function gunEkle(t: Tarih, gun: number): Tarih {
  const [y, a, g] = parcalar(t);
  const d = new Date(Date.UTC(y, a - 1, g + gun));
  return d.toISOString().slice(0, 10) as Tarih;
}

export function gunFarki(a: Tarih, b: Tarih): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/** Pazartesi = 1 … Pazar = 7 */
export function haftaninGunu(t: Tarih): number {
  const g = new Date(Date.parse(t)).getUTCDay();
  return g === 0 ? 7 : g;
}

const GUN_ADLARI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export function gunAdi(t: Tarih): string {
  return GUN_ADLARI[haftaninGunu(t) - 1] ?? '';
}

const iki = (n: number) => String(n).padStart(2, '0');

/** "30.09.2026" */
export function tarihMetni(t: Tarih): string {
  const [y, a, g] = parcalar(t);
  return `${iki(g)}.${iki(a)}.${y}`;
}

/** "30.09" — gün sayfasının adı */
export function sayfaAdi(t: Tarih): string {
  const [, a, g] = parcalar(t);
  return `${iki(g)}.${iki(a)}`;
}

/** "30.09.2026" ya da "1.10.26" → Tarih; geçersizse null. */
export function ggAaYyyy(s: string): Tarih | null {
  const p = s.trim().split('.');
  if (p.length < 3) return null;
  const sayi = (x: string) => (/^\s*\d+\s*$/.test(x) ? Number(x) : Number.NaN);
  const g = sayi(p[0] ?? '');
  const a = sayi(p[1] ?? '');
  let y = sayi((p[2] ?? '').slice(0, 4));
  if (Number.isNaN(g) || Number.isNaN(a) || Number.isNaN(y)) return null;
  if (y < 100) y += 2000;
  return olustur(y, a, g);
}

/** LED başlığındaki "Bitiş Tarihi : 30.09.2026" ifadesinden tarih. */
export function tarihBul(metin: unknown, etiket: string): Tarih | null {
  const m = String(metin ?? '');
  const p = m.toLocaleLowerCase('tr').indexOf(etiket.toLocaleLowerCase('tr'));
  if (p < 0) return null;
  const kalan = m.slice(p + etiket.length);
  const iki = kalan.indexOf(':');
  if (iki < 0) return null;
  return ggAaYyyy(
    kalan
      .slice(iki + 1)
      .trim()
      .slice(0, 10),
  );
}

/** "29.09.2026 LED DEPO STOĞU" içindeki baştaki tarihi değiştirir; tarih yoksa başa ekler. */
export function tarihDegistir(metin: unknown, t: Tarih): string {
  const s = String(metin ?? '').trim();
  if (s.length >= 10 && ggAaYyyy(s.slice(0, 10))) return tarihMetni(t) + s.slice(10);
  return `${tarihMetni(t)} ${s}`.trim();
}

/** Gün sayfası adı ("30.09", "01.08 DEPO") → verilen yıldaki tarih. */
export function sayfaTarihi(ad: string, yil: number): Tarih | null {
  const s = ad.trim();
  if (s.length < 5) return null;
  if (s.length > 5 && s[5] !== ' ') return null;
  if (s[2] !== '.') return null;
  return ggAaYyyy(`${s.slice(0, 5)}.${yil}`);
}

/** Sayfa adında yıl yoktur; bugüne göre en makul yıl seçilir. */
export function sayfaTarihiYilli(ad: string, bugun: Tarih): Tarih | null {
  const t = sayfaTarihi(ad, yilOf(bugun));
  if (t && gunFarki(t, bugun) > 31) return sayfaTarihi(ad, yilOf(bugun) - 1);
  return t;
}

export function gunSayfasiMi(ad: string): boolean {
  return sayfaTarihi(ad, 2000) !== null; // 2000 artık yıl: 29.02 de geçerli
}

/**
 * Dosya adındaki tarih: "SAYIM_30_09.xlsx", "Sayım 30.09.2026.xlsx".
 * Adın içindeki ilk geçerli "gün ayraç ay" rakam çifti; ardından dört haneli yıl
 * varsa o yıl, yoksa bugüne en yakın yıl.
 */
export function dosyaAdiTarihi(yol: string, bugun: Tarih): Tarih | null {
  let ad = yol.split(/[\\/]/).pop() ?? '';
  const nokta = ad.lastIndexOf('.');
  if (nokta >= 0) ad = ad.slice(0, nokta);
  const gruplar = (ad.match(/\d+/g) ?? []).slice(0, 20);
  for (let i = 0; i < gruplar.length - 1; i++) {
    const g = gruplar[i] ?? '';
    const a = gruplar[i + 1] ?? '';
    if (g.length > 2 || a.length > 2) continue;
    const yil = gruplar[i + 2];
    const t =
      yil?.length === 4
        ? ggAaYyyy(`${g}.${a}.${yil}`)
        : sayfaTarihiYilli(`${iki(Number(g))}.${iki(Number(a))}`, bugun);
    if (t) return t;
  }
  return null;
}

/** Bir sonraki iş günü (Ayarlar: pazar atlansın mı). */
export function sonrakiGun(t: Tarih, pazarAtla: boolean): Tarih {
  const d = gunEkle(t, 1);
  return pazarAtla && haftaninGunu(d) === 7 ? gunEkle(d, 1) : d;
}

/**
 * Kullanıcının yazdığı tarih: "30.09", "30/09", "30-09-2026", "1.10".
 * Yıl yazılmamışsa önerilen tarihin yılı kullanılır.
 */
export function girilenTarih(girdi: string, oneri: Tarih): Tarih | null {
  const s = girdi.trim().replace(/[/,-]/g, '.');
  if (!s) return null;
  return ggAaYyyy(s.split('.').length === 2 ? `${s}.${yilOf(oneri)}` : s);
}
