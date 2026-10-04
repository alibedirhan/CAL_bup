import { depoAdi } from '../cekirdek/musteriTakip/adlandirma';
import { harfKatla, karakterSayisi, kenarlariTemizle } from '../cekirdek/musteriTakip/metin';
import type { MusteriListesi } from '../cekirdek/musteriTakip/turler';
import { OkumaHatasi, type HucreDegeri, type Kitap, type Sayfa } from './kitap';

export class MusteriOkumaHatasi extends OkumaHatasi {
  constructor(
    public kod: 'BASLIK_YOK' | 'SUTUN_YOK' | 'GECERSIZ',
    mesaj: string,
  ) {
    super(mesaj);
  }
}

function hucre(sayfa: Sayfa, satir: number, sutun: number): HucreDegeri {
  // openpyxl birleşimin yalnız sol üst hücresini okur; ExcelJS diğerlerini tekrarlar.
  const anahtar = sayfa.birlesimAnahtari?.(satir, sutun);
  if (anahtar) {
    let no = sutun;
    let harf = '';
    while (no) {
      harf = String.fromCharCode(65 + ((no - 1) % 26)) + harf;
      no = Math.floor((no - 1) / 26);
    }
    if (anahtar !== `${harf}${satir}`) return null;
  }
  const deger = sayfa.hucre(satir, sutun);
  if (typeof deger === 'string' && karakterSayisi(deger) > 512) {
    throw new MusteriOkumaHatasi('GECERSIZ', 'Excel hücresi 512 karakter sınırını aşıyor.');
  }
  return deger;
}

function musteriMetni(deger: HucreDegeri): string {
  if (deger === null) return '';
  if (typeof deger === 'boolean') return deger ? 'True' : 'False';
  if (deger instanceof Date) {
    const parca = (n: number) => String(n).padStart(2, '0');
    return `${deger.getFullYear()}-${parca(deger.getMonth() + 1)}-${parca(deger.getDate())} ${parca(deger.getHours())}:${parca(deger.getMinutes())}:${parca(deger.getSeconds())}`;
  }
  return kenarlariTemizle(String(deger));
}

export function musteriListesiOku(kitap: Kitap): MusteriListesi {
  const sayfa = kitap.sayfalar[0];
  if (!sayfa || kitap.sayfalar.length > 16 || sayfa.sonSatir > 100_000) {
    throw new MusteriOkumaHatasi(
      'GECERSIZ',
      'Müşteri dosyası en fazla 16 sayfa ve 100.000 satır içerebilir.',
    );
  }
  const basliklar: HucreDegeri[][] = [];
  for (let r = 1; r <= 15; r++) {
    basliklar.push(Array.from({ length: 256 }, (_, c) => hucre(sayfa, r, c + 1)));
  }
  const depo = depoAdi(basliklar.slice(0, 10).map((r) => r[0]));
  const baslikSatiri = basliklar.findIndex((r) =>
    r.some((h) => typeof h === 'string' && harfKatla(h).includes('cari ünvan')),
  );
  if (baslikSatiri === -1)
    throw new MusteriOkumaHatasi(
      'BASLIK_YOK',
      "Excel dosyasında 'Cari Ünvan' başlığı bulunamadı. İlk 15 satırı kontrol edin.",
    );
  const sutun =
    basliklar[baslikSatiri]?.findIndex((h) => typeof h === 'string' && h.includes('Cari Ünvan')) ?? -1;
  if (sutun === -1)
    throw new MusteriOkumaHatasi(
      'SUTUN_YOK',
      "Excel dosyasında 'Cari Ünvan' sütunu bulunamadı. Başlığın yazımını kontrol edin.",
    );
  const musteriler: string[] = [];
  for (let r = baslikSatiri + 2; r <= sayfa.sonSatir; r++) {
    const metin = musteriMetni(hucre(sayfa, r, sutun + 1));
    if (metin) musteriler.push(metin);
  }
  return { depo, baslikSatiri, musteriler };
}
