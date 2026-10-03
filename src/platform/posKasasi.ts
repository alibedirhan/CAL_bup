import { KullaniciHatasi } from '../cekirdek/hata';
import { posCarileriBirlestir, posVerisiDogrula, type PosCari, type PosVerisi } from '../cekirdek/posCari';
import * as idb from './idb';
import { POS_CIHAZ_ONEKI, yeniPosCihazAnahtari, posCihazAnahtariOku } from './posCihaz';
import { POS_DENEME_ONEKI, posDenemesiniAyir, posDenemeleriniTemizle } from './posDeneme';
import {
  kasaAnahtari,
  kasaCoz,
  kasaSifrele,
  posYedegiOku,
  posZarfiDogrula,
  yeniTuz,
  posSifrelemeDestegi,
  type PosZarfi,
} from './posSifreleme';

export const POS_KASA_ANAHTARI = 'sanal-pos-kasa-v1';
export const POS_BOSTA_SURESI = 30 * 60 * 1000;
export const POS_BEKLEME_SURESI = 45_000;
export type PosAcmaAsamasi = 'depo' | 'sifreleme' | 'kayit';

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
  posSifrelemeDestegi();
  return (await oku()) !== undefined;
}

/** AES anahtarı oturumda; yerel HMAC anahtarı depoda, taşınabilir yedekte yalnızca şifreli veri. */
export class PosKasasi {
  #anahtar: CryptoKey | null = null;
  #zarf: PosZarfi | null = null;
  #nesil = 0;
  #mesgul = false;
  #sonEtkinlik = 0;
  #bekleyenler = new Set<(hata: KullaniciHatasi) => void>();

  kilitle(sebep = 'Cari kasası kilitlendi. Parolanızla yeniden açın.'): void {
    this.#nesil++;
    this.#anahtar = null;
    this.#zarf = null;
    this.#sonEtkinlik = 0;
    for (const iptal of this.#bekleyenler) iptal(new KullaniciHatasi(sebep));
  }

  #bekle<T>(is: Promise<T>, nesil: number): Promise<T> {
    return new Promise<T>((coz, reddet) => {
      let bitti = false;
      const temizle = () => {
        bitti = true;
        clearTimeout(sure);
        this.#bekleyenler.delete(iptal);
      };
      const iptal = (e: KullaniciHatasi) => {
        if (!bitti) {
          temizle();
          reddet(e);
        }
      };
      const sure = setTimeout(
        () =>
          this.kilitle(
            'Kasa işlemi beklenenden uzun sürdü. İşlem durduruldu; yeniden denemeden önce kasa durumunu kontrol edin.',
          ),
        POS_BEKLEME_SURESI,
      );
      this.#bekleyenler.add(iptal);
      void is.then(
        (sonuc) => {
          if (bitti) return;
          if (nesil !== this.#nesil) {
            iptal(new KullaniciHatasi('Kasa işlemi iptal edildi.'));
            return;
          }
          temizle();
          coz(sonuc);
        },
        (e: unknown) => {
          if (!bitti) {
            temizle();
            reddet(e);
          }
        },
      );
      if (nesil !== this.#nesil) iptal(new KullaniciHatasi('Kasa işlemi iptal edildi.'));
    });
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

  async ac(parola: string, olustur: boolean, asama?: (a: PosAcmaAsamasi) => void): Promise<PosVerisi> {
    if (this.#mesgul) throw new KullaniciHatasi('Cari işleminin bitmesini bekleyin.');
    this.kilitle();
    const nesil = this.#nesil;
    this.#mesgul = true;
    try {
      asama?.('depo');
      const eski = await this.#bekle(oku(), nesil);
      if (olustur && eski) throw new KullaniciHatasi('Cari kasası zaten var. Kasa parolanızla açın.');
      if (!olustur && !eski) throw new KullaniciHatasi('Cari kasası bulunamadı. Sayfayı yenileyin.');
      const tuz = eski?.tuz ?? yeniTuz();
      const cihaz = eski?.cihaz ?? (olustur ? crypto.randomUUID() : undefined);
      const cihazAnahtari = cihaz
        ? await this.#bekle(olustur ? yeniPosCihazAnahtari() : posCihazAnahtariOku(cihaz), nesil)
        : undefined;
      if (cihaz && !olustur) await this.#bekle(posDenemesiniAyir(cihaz), nesil);
      asama?.('sifreleme');
      const anahtar = await this.#bekle(kasaAnahtari(parola, tuz, cihazAnahtari), nesil);
      const veri: PosVerisi = eski
        ? await this.#bekle(kasaCoz(eski, anahtar), nesil)
        : { surum: 1, cariler: [] };
      const zarf = eski ?? (await this.#bekle(kasaSifrele(veri, anahtar, tuz, cihaz), nesil));
      if (nesil !== this.#nesil) throw new KullaniciHatasi('Kasa açma işlemi iptal edildi.');
      if (!eski) {
        await this.#bekle(kasaCoz(zarf, anahtar), nesil);
        asama?.('kayit');
        const yazildi = await this.#bekle(
          idb.guncelle(POS_KASA_ANAHTARI, (mevcut, depo) => {
            if (mevcut !== undefined || nesil !== this.#nesil) throw new Error('Kasa değişti');
            if (cihaz && cihazAnahtari) depo.put(cihazAnahtari, POS_CIHAZ_ONEKI + cihaz);
            return zarf;
          }),
          nesil,
        );
        if (!yazildi)
          throw new KullaniciHatasi('Kasa kaydedilemedi veya başka sekmede oluşturuldu. Sayfayı yenileyin.');
      } else if (JSON.stringify(await this.#bekle(oku(), nesil)) !== JSON.stringify(eski)) {
        throw new KullaniciHatasi('Cari kasası başka sekmede değişti. Yeniden açın.');
      }
      if (nesil !== this.#nesil) throw new KullaniciHatasi('Kasa açma işlemi iptal edildi.');
      if (cihaz && !olustur) await this.#bekle(posDenemeleriniTemizle(cihaz), nesil);
      this.#anahtar = anahtar;
      this.#zarf = zarf;
      this.#sonEtkinlik = Date.now();
      return veri;
    } finally {
      this.#mesgul = false;
    }
  }

  async #yaz(
    veri: PosVerisi,
    anahtar: CryptoKey,
    tuz: string,
    nesil: number,
    yeniCihaz?: { id: string; anahtar: CryptoKey },
  ): Promise<PosVerisi> {
    const beklenen = JSON.stringify(this.#zarf);
    const cihaz = yeniCihaz?.id ?? this.#zarf?.cihaz;
    const zarf = await this.#bekle(kasaSifrele(veri, anahtar, tuz, cihaz), nesil);
    await this.#bekle(kasaCoz(zarf, anahtar), nesil);
    this.#denetle(nesil);
    const yazildi = await this.#bekle(
      idb.guncelle(POS_KASA_ANAHTARI, (onceki, depo) => {
        this.#denetle(nesil);
        if (JSON.stringify(onceki) !== beklenen) throw new Error('Kasa başka sekmede değişti');
        if (yeniCihaz) {
          depo.put(yeniCihaz.anahtar, POS_CIHAZ_ONEKI + yeniCihaz.id);
          if (this.#zarf?.cihaz) {
            depo.delete(POS_CIHAZ_ONEKI + this.#zarf.cihaz);
            depo.delete(POS_DENEME_ONEKI + this.#zarf.cihaz);
          }
        }
        return zarf;
      }),
      nesil,
    );
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

  async #islem<T>(is: (nesil: number, anahtar: CryptoKey, zarf: PosZarfi) => Promise<T>): Promise<T> {
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
      const veri = await this.#bekle(kasaCoz(zarf, eskiAnahtar), n);
      const tuz = yeniTuz();
      const cihaz = { id: crypto.randomUUID(), anahtar: await this.#bekle(yeniPosCihazAnahtari(), n) };
      const anahtar = await this.#bekle(kasaAnahtari(parola, tuz, cihaz.anahtar), n);
      return this.#yaz(veri, anahtar, tuz, n, cihaz);
    });
  }

  async yedektenEkle(baytlar: Uint8Array, parola: string): Promise<PosVerisi> {
    return this.#islem(async (n, kasaAnahtariDegeri, kasaZarfi) => {
      const zarf = posYedegiOku(baytlar);
      const anahtar = await this.#bekle(kasaAnahtari(parola, zarf.tuz), n);
      const gelen = await this.#bekle(kasaCoz(zarf, anahtar), n);
      const mevcut = await this.#bekle(kasaCoz(kasaZarfi, kasaAnahtariDegeri), n);
      const cariler = posCarileriBirlestir(mevcut.cariler, gelen.cariler);
      return this.#yaz({ surum: 1, cariler }, kasaAnahtariDegeri, kasaZarfi.tuz, n);
    });
  }

  yedek(): Uint8Array<ArrayBuffer> {
    this.#denetle();
    if (this.#zarf?.surum === 2)
      throw new KullaniciHatasi(
        'Cihaz kasasının taşınabilir yedeği için ayrı uzun yedek parolası belirleyin.',
      );
    return new TextEncoder().encode(JSON.stringify(this.#zarf));
  }

  async yedekle(parola: string): Promise<Uint8Array<ArrayBuffer>> {
    return this.#islem(async (n, anahtar, zarf) => {
      const veri = await this.#bekle(kasaCoz(zarf, anahtar), n);
      const tuz = yeniTuz();
      const yedekAnahtari = await this.#bekle(kasaAnahtari(parola, tuz), n);
      const yedek = await this.#bekle(kasaSifrele(veri, yedekAnahtari, tuz), n);
      await this.#bekle(kasaCoz(yedek, yedekAnahtari), n);
      this.#denetle(n);
      if (JSON.stringify(await this.#bekle(oku(), n)) !== JSON.stringify(zarf)) {
        this.kilitle();
        throw new KullaniciHatasi('Cari kasası başka sekmede değişti. Yedek hazırlamadan önce yeniden açın.');
      }
      return new TextEncoder().encode(JSON.stringify(yedek));
    });
  }
}
