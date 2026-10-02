import { KullaniciHatasi } from '../cekirdek/hata';
import { posCarileriBirlestir, posVerisiDogrula, type PosCari, type PosVerisi } from '../cekirdek/posCari';
import * as idb from './idb';
import {
  kasaAnahtari,
  kasaCoz,
  kasaSifrele,
  posYedegiOku,
  posZarfiDogrula,
  yeniTuz,
  type PosZarfi,
} from './posSifreleme';

export const POS_KASA_ANAHTARI = 'sanal-pos-kasa-v1';
export const POS_BOSTA_SURESI = 5 * 60 * 1000;

async function oku(): Promise<PosZarfi | undefined> {
  let veri: unknown;
  try {
    veri = await idb.okuKesin(POS_KASA_ANAHTARI);
  } catch {
    throw new KullaniciHatasi(
      'Cari deposuna erişilemiyor. Tarayıcı izinlerini kontrol edip yeniden deneyin.',
    );
  }
  return veri === undefined ? undefined : posZarfiDogrula(veri);
}

export async function posKasaVar(): Promise<boolean> {
  return (await oku()) !== undefined;
}

/** Anahtar yalnızca bu oturumda; kalıcı depoya ve yedeğe yalnızca şifreli zarf gider. */
export class PosKasasi {
  #anahtar: CryptoKey | null = null;
  #zarf: PosZarfi | null = null;
  #nesil = 0;
  #mesgul = false;
  #sonEtkinlik = 0;

  kilitle(): void {
    this.#nesil++;
    this.#anahtar = null;
    this.#zarf = null;
    this.#sonEtkinlik = 0;
  }

  etkinlik(): void {
    this.#denetle();
    this.#sonEtkinlik = Date.now();
  }

  get acik(): boolean {
    const gecen = Date.now() - this.#sonEtkinlik;
    return this.#anahtar !== null && gecen >= 0 && gecen < POS_BOSTA_SURESI;
  }

  get suresiDoldu(): boolean {
    return this.#anahtar !== null && !this.acik;
  }

  #denetle(nesil = this.#nesil): void {
    if (!this.acik || nesil !== this.#nesil) {
      this.kilitle();
      throw new KullaniciHatasi('Cari kasası kilitlendi. Parolanızla yeniden açın.');
    }
  }

  async ac(parola: string, olustur: boolean): Promise<PosVerisi> {
    if (this.#mesgul) throw new KullaniciHatasi('Cari işleminin bitmesini bekleyin.');
    this.kilitle();
    const nesil = this.#nesil;
    this.#mesgul = true;
    try {
      const eski = await oku();
      if (olustur && eski) throw new KullaniciHatasi('Cari kasası zaten var. Kasa parolanızla açın.');
      if (!olustur && !eski) throw new KullaniciHatasi('Cari kasası bulunamadı. Sayfayı yenileyin.');
      const tuz = eski?.tuz ?? yeniTuz();
      const anahtar = await kasaAnahtari(parola, tuz);
      const veri: PosVerisi = eski ? await kasaCoz(eski, anahtar) : { surum: 1, cariler: [] };
      const zarf = eski ?? (await kasaSifrele(veri, anahtar, tuz));
      if (nesil !== this.#nesil) throw new KullaniciHatasi('Kasa açma işlemi iptal edildi.');
      if (!eski) {
        const yazildi = await idb.guncelle(POS_KASA_ANAHTARI, (mevcut) => {
          if (mevcut !== undefined || nesil !== this.#nesil) throw new Error('Kasa değişti');
          return zarf;
        });
        if (!yazildi)
          throw new KullaniciHatasi('Kasa kaydedilemedi veya başka sekmede oluşturuldu. Sayfayı yenileyin.');
      } else if (JSON.stringify(await oku()) !== JSON.stringify(eski)) {
        throw new KullaniciHatasi('Cari kasası başka sekmede değişti. Yeniden açın.');
      }
      if (nesil !== this.#nesil) throw new KullaniciHatasi('Kasa açma işlemi iptal edildi.');
      this.#anahtar = anahtar;
      this.#zarf = zarf;
      this.#sonEtkinlik = Date.now();
      return veri;
    } finally {
      this.#mesgul = false;
    }
  }

  async #yaz(veri: PosVerisi, anahtar: CryptoKey, tuz: string, nesil: number): Promise<PosVerisi> {
    const beklenen = JSON.stringify(this.#zarf);
    const zarf = await kasaSifrele(veri, anahtar, tuz);
    this.#denetle(nesil);
    const yazildi = await idb.guncelle(POS_KASA_ANAHTARI, (onceki) => {
      this.#denetle(nesil);
      if (JSON.stringify(onceki) !== beklenen) throw new Error('Kasa başka sekmede değişti');
      return zarf;
    });
    if (!yazildi) {
      this.kilitle();
      throw new KullaniciHatasi(
        'Kayıt tamamlanmadı veya başka sekmede değişti. Kasa kilitlendi; yeniden açıp kontrol edin.',
      );
    }
    this.#denetle(nesil);
    this.#zarf = zarf;
    this.#anahtar = anahtar;
    this.#sonEtkinlik = Date.now();
    return veri;
  }

  async #islem(
    is: (nesil: number, anahtar: CryptoKey, zarf: PosZarfi) => Promise<PosVerisi>,
  ): Promise<PosVerisi> {
    this.#denetle();
    const anahtar = this.#anahtar;
    const zarf = this.#zarf;
    if (!anahtar || !zarf) throw new KullaniciHatasi('Cari kasasını yeniden açın.');
    if (this.#mesgul) throw new KullaniciHatasi('Önceki cari işleminin bitmesini bekleyin.');
    this.#mesgul = true;
    try {
      return await is(this.#nesil, anahtar, zarf);
    } finally {
      this.#mesgul = false;
    }
  }

  async kaydet(cariler: PosCari[]): Promise<PosVerisi> {
    const veri = posVerisiDogrula({ surum: 1, cariler });
    return this.#islem((n, anahtar, zarf) => this.#yaz(veri, anahtar, zarf.tuz, n));
  }

  async parolaDegistir(parola: string): Promise<PosVerisi> {
    return this.#islem(async (n, eskiAnahtar, zarf) => {
      const veri = await kasaCoz(zarf, eskiAnahtar);
      const tuz = yeniTuz();
      const anahtar = await kasaAnahtari(parola, tuz);
      return this.#yaz(veri, anahtar, tuz, n);
    });
  }

  async yedektenEkle(baytlar: Uint8Array, parola: string): Promise<PosVerisi> {
    return this.#islem(async (n, kasaAnahtariDegeri, kasaZarfi) => {
      const zarf = posYedegiOku(baytlar);
      const anahtar = await kasaAnahtari(parola, zarf.tuz);
      const gelen = await kasaCoz(zarf, anahtar);
      const mevcut = await kasaCoz(kasaZarfi, kasaAnahtariDegeri);
      const cariler = posCarileriBirlestir(mevcut.cariler, gelen.cariler);
      return this.#yaz({ surum: 1, cariler }, kasaAnahtariDegeri, kasaZarfi.tuz, n);
    });
  }

  yedek(): Uint8Array<ArrayBuffer> {
    this.#denetle();
    return new TextEncoder().encode(JSON.stringify(this.#zarf));
  }
}
