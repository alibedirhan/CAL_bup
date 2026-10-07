import { AKTARIM_SURESI, type PosAktarimi } from '../cekirdek/posAktarimi';
import type { HATA_NEDENLERI } from '../cekirdek/posBaglantisi';
import { eklenti } from './chrome';

export type Durum = 'giris' | 'alanlar' | 'teslim' | 'dolduruldu' | 'hata' | 'iptal';
export type Neden = (typeof HATA_NEDENLERI)[number];
/** Bekleyen aktarım. Kart (CVV dahil) yalnız `storage.session` belleğinde, en fazla AKTARIM_SURESI
 * kadar ve teslimden önce silinmek üzere durur. */
export interface Islem {
  id: string;
  kaynak: number;
  hedef: number;
  son: number;
  baslangic: number;
  teslimSon?: number;
  durum: Durum;
  giris?: boolean;
  kart?: PosAktarimi;
  mesaj: string;
  neden?: Neden;
}
export const SURUYOR: readonly Durum[] = ['giris', 'alanlar', 'teslim'];

export function bitir(s: Islem, durum: Durum, mesaj: string, neden?: Neden) {
  delete s.kart;
  s.durum = durum;
  s.mesaj = mesaj;
  if (neden) s.neden = neden;
  else delete s.neden;
}

/** Süresi dolmuş veya saati geri alınmış işler okunurken düşer; sonuçsuz teslim hataya döner. */
export async function isler(): Promise<Islem[]> {
  const d = await eklenti.storage.session.get('isler');
  const s = (Array.isArray(d.isler) ? d.isler : []) as Islem[];
  const simdi = Date.now();
  const kalan = s.filter(
    (i) =>
      Number.isFinite(i.baslangic) &&
      i.baslangic <= simdi &&
      i.son > simdi &&
      i.son - i.baslangic === AKTARIM_SURESI,
  );
  for (const i of kalan)
    if (i.durum === 'teslim' && (!i.teslimSon || simdi >= i.teslimSon))
      bitir(
        i,
        'hata',
        'Kart tesliminin sonucu doğrulanamadı. POS alanlarını kontrol edin; otomatik tekrar yapılmadı.',
      );
  return kalan;
}
export async function yaz(s: Islem[]) {
  await eklenti.storage.session.set({ isler: s });
}
export function ozet(i?: Islem) {
  return {
    durum: i?.durum ?? 'hazir',
    mesaj: i?.mesaj ?? 'POS yardımcısı bağlı.',
    ...(i?.neden ? { neden: i.neden } : {}),
  };
}

/** Bu yardımcının gördüğü açık POS sekmeleri; yeni cari girişinde eski sekmeler uyarılır. */
export async function posSekmesiEkle(id: number) {
  const d = await eklenti.storage.session.get('sekmeler');
  const s = (Array.isArray(d.sekmeler) ? d.sekmeler : []) as number[];
  if (!s.includes(id)) await eklenti.storage.session.set({ sekmeler: [...s, id].slice(-50) });
}
export async function posSekmeleri(): Promise<number[]> {
  const d = await eklenti.storage.session.get('sekmeler');
  return (Array.isArray(d.sekmeler) ? d.sekmeler : []) as number[];
}
export async function posSekmesiCikar(id: number) {
  const s = await posSekmeleri();
  if (s.includes(id)) await eklenti.storage.session.set({ sekmeler: s.filter((x) => x !== id) });
}

const son4 = (n: string) => '•••' + n.slice(-4);
export const MESAJ = {
  girisReddi(numara: string, neden: string) {
    const ipucu =
      numara.length === 10 ? ' Şahıs carilerinde POS çoğunlukla 11 haneli TC kimlik numarasıyla açılır.' : '';
    return `POS girişi kabul edilmedi${neden ? `: “${neden}”` : ''}. Kart aktarılmadı. “Cariyi düzenle” ile carinin numarasını veya POS giriş bilgilerini düzeltin.${ipucu}`;
  },
  cariFarki(gorunen: string, secilen: string) {
    return `POS’ta görünen numara (${son4(gorunen)}) seçilen carinin numarasıyla (${son4(secilen)}) aynı değil. Hiçbir kart alanı doldurulmadı. POS’ta başka cari açıksa çıkış yapıp yeniden deneyin; carinin numarası yanlış kayıtlıysa “Cariyi düzenle” ile düzeltin.`;
  },
  dolduruldu(doldurulan: readonly string[], notlar: readonly string[]) {
    const adlar: Record<string, string> = {
      numara: 'kart numarası',
      tarih: 'son kullanma',
      ay: 'son kullanma',
      ad: 'Ad Soyad',
      cvv: 'CVV',
    };
    const liste = [...new Set(doldurulan.map((r) => adlar[r]).filter(Boolean))].join(', ');
    return [
      `Cari eşleşti; ${liste} dolduruldu.`,
      ...notlar,
      'Tutar kutusundaki değer POS’un yazdığı bakiyedir: ödenecek tutarı kendiniz yazın ve bilgileri kontrol edin.',
    ].join(' ');
  },
};
