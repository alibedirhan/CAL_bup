import { KullaniciHatasi } from '../cekirdek/hata';
import { BOS_POS_PROFILI, posProfilDogrula, type PosProfilVerisi } from '../cekirdek/posProfil';
import {
  profilBirlestir,
  profilBirlestirmeOzeti,
  type BirlestirmeOzeti,
  type BirlestirmeSecimi,
} from '../cekirdek/posBirlestirme';
import * as idb from './idb';
import { POS_CIHAZ_ONEKI } from './posCihaz';
import { POS_DENEME_ONEKI } from './posDeneme';
import { POS_KASA_ANAHTARI, PosKasasi } from './posKasasi';
import { posSifrelemeDestegi, posZarfiDogrula } from './posSifreleme';
import {
  yeniProfilAnahtari,
  profilAnahtariDogrula,
  profilCoz,
  profilSifrele,
  profilYedegiOlustur,
  profilZarfiDogrula,
  type ProfilZarfi,
} from './posProfilSifreleme';

// Aynı anahtarda sürüm değişimi: eski uygulama yeni kaydı boş kasa sanamaz veya üzerine yazamaz.
export const PROFIL_DEPO_ANAHTARI = POS_KASA_ANAHTARI;
export const PROFIL_ANAHTAR_ONEKI = 'sanal-pos-profil-anahtar-';
export const PROFIL_BEKLEME_SURESI = 45_000;
export type ProfilAcilisi = { eski: true } | { eski: false; veri: PosProfilVerisi };

/** İşlemleri sıraya sokar; iptal ve revizyon denetimi geç sonuçların eski veriyi yazmasını engeller. */
export class PosProfilDeposu {
  #zarf: ProfilZarfi | null = null;
  #anahtar: CryptoKey | null = null;
  #nesil = 0;
  #mesgul = false;
  #iptal: (() => void) | null = null;
  #eskiKasa: PosKasasi | null = null;
  kapat(): void {
    this.#nesil++;
    this.#zarf = null;
    this.#anahtar = null;
    this.#eskiKasa?.kilitle();
    this.#iptal?.();
  }
  get acik(): boolean {
    return Boolean(this.#anahtar && this.#zarf);
  }
  #denetle(nesil: number): void {
    if (nesil !== this.#nesil) throw new KullaniciHatasi('Profil işlemi durduruldu. Yeniden kontrol edin.');
  }
  async #islem<T>(is: (nesil: number) => Promise<T>): Promise<T> {
    if (this.#mesgul) throw new KullaniciHatasi('Önceki profil işleminin bitmesini bekleyin.');
    this.#mesgul = true;
    const n = this.#nesil;
    let sure: ReturnType<typeof setTimeout> | undefined;
    try {
      const iptal = new Promise<never>((_, reddet) => {
        this.#iptal = () => reddet(new KullaniciHatasi('Profil işlemi durduruldu. Yeniden kontrol edin.'));
        sure = setTimeout(() => this.kapat(), PROFIL_BEKLEME_SURESI);
      });
      return await Promise.race([is(n), iptal]);
    } finally {
      clearTimeout(sure);
      this.#iptal = null;
      this.#mesgul = false;
    }
  }
  async #oku(): Promise<unknown> {
    try {
      return await idb.okuKesin(PROFIL_DEPO_ANAHTARI);
    } catch {
      throw new KullaniciHatasi(
        'Cari ve kart deposu okunamadı. Tarayıcı izinlerini kontrol edip yeniden deneyin.',
      );
    }
  }
  async ac(): Promise<ProfilAcilisi> {
    posSifrelemeDestegi();
    return this.#islem(async (n) => {
      const ham = await this.#oku();
      this.#denetle(n);
      if (ham === undefined) {
        const veri = await this.#olustur(BOS_POS_PROFILI, undefined, n);
        return { eski: false, veri };
      }
      if ((ham as { bicim?: unknown } | null)?.bicim === 'cal-bup-pos') {
        posZarfiDogrula(ham);
        return { eski: true };
      }
      const z = profilZarfiDogrula(ham);
      if (z.kip !== 'cihaz') throw new KullaniciHatasi('Yerel profil biçimi geçersiz. Kayıtlar korundu.');
      const anahtar = profilAnahtariDogrula(await idb.okuKesin(PROFIL_ANAHTAR_ONEKI + z.kimlik));
      const veri = await profilCoz(z, anahtar);
      this.#denetle(n);
      if (JSON.stringify(await this.#oku()) !== JSON.stringify(z))
        throw new KullaniciHatasi('Profil başka sekmede değişti. Yeniden kontrol edin.');
      this.#denetle(n);
      this.#zarf = z;
      this.#anahtar = anahtar;
      return { eski: false, veri };
    });
  }
  async #olustur(veri: PosProfilVerisi, eski: unknown, n: number): Promise<PosProfilVerisi> {
    const k = await yeniProfilAnahtari();
    const kimlik = crypto.randomUUID();
    const z = await profilSifrele(veri, k, kimlik);
    const dogrulanan = await profilCoz(z, k);
    this.#denetle(n);
    const yazildi = await idb.guncelle(PROFIL_DEPO_ANAHTARI, (onceki, d) => {
      this.#denetle(n);
      if (JSON.stringify(onceki) !== JSON.stringify(eski)) throw new Error('Profil değişti');
      d.put(k, PROFIL_ANAHTAR_ONEKI + kimlik);
      if (eski) {
        const old = posZarfiDogrula(eski);
        if (old.cihaz) {
          d.delete(POS_CIHAZ_ONEKI + old.cihaz);
          d.delete(POS_DENEME_ONEKI + old.cihaz);
        }
      }
      return z;
    });
    if (!yazildi)
      throw new KullaniciHatasi('Profil kaydedilemedi veya başka sekmede değişti. Eski kayıtlar korunuyor.');
    this.#denetle(n);
    this.#zarf = z;
    this.#anahtar = k;
    return dogrulanan;
  }
  async eskiKasayiTasi(parola: string): Promise<PosProfilVerisi> {
    return this.#islem(async (n) => {
      const eski = posZarfiDogrula(await this.#oku());
      const kasa = new PosKasasi();
      this.#eskiKasa = kasa;
      try {
        const veri = await kasa.ac(parola, false);
        this.#denetle(n);
        return await this.#olustur({ surum: 2, cariler: veri.cariler, kartlar: [] }, eski, n);
      } finally {
        kasa.kilitle();
        if (this.#eskiKasa === kasa) this.#eskiKasa = null;
      }
    });
  }
  async kaydet(veri: PosProfilVerisi): Promise<PosProfilVerisi> {
    const v = posProfilDogrula(veri);
    return this.#islem((n) => this.#yaz(v, n));
  }
  async eskiYedekle(eskiParola: string, yedekParolasi: string): Promise<Uint8Array<ArrayBuffer>> {
    return this.#islem(async (n) => {
      posZarfiDogrula(await this.#oku());
      const kasa = new PosKasasi();
      this.#eskiKasa = kasa;
      try {
        await kasa.ac(eskiParola, false);
        this.#denetle(n);
        const b = await kasa.yedekle(yedekParolasi);
        this.#denetle(n);
        return b;
      } finally {
        kasa.kilitle();
        if (this.#eskiKasa === kasa) this.#eskiKasa = null;
      }
    });
  }
  async #yaz(veri: PosProfilVerisi, n: number): Promise<PosProfilVerisi> {
    const eski = this.#zarf;
    const k = this.#anahtar;
    if (!eski || !k) throw new KullaniciHatasi('Profil kapalı. Yeniden kontrol edin.');
    const z = await profilSifrele(veri, k, eski.kimlik);
    await profilCoz(z, k);
    this.#denetle(n);
    const yazildi = await idb.guncelle(PROFIL_DEPO_ANAHTARI, (onceki) => {
      this.#denetle(n);
      if (JSON.stringify(onceki) !== JSON.stringify(eski)) throw new Error('Profil değişti');
      return z;
    });
    if (!yazildi) {
      this.#zarf = null;
      this.#anahtar = null;
      throw new KullaniciHatasi(
        'Kayıt tamamlanmadı veya sonucu doğrulanamadı. Başka sekmede değişmiş olabilir; yeniden kontrol edin.',
      );
    }
    this.#denetle(n);
    this.#zarf = z;
    return veri;
  }
  async #guncel(n: number): Promise<PosProfilVerisi> {
    const z = this.#zarf;
    const k = this.#anahtar;
    if (!z || !k) throw new KullaniciHatasi('Profil kapalı. Yeniden kontrol edin.');
    if (JSON.stringify(await this.#oku()) !== JSON.stringify(z))
      throw new KullaniciHatasi('Profil başka sekmede değişti. Yeniden kontrol edin.');
    this.#denetle(n);
    return profilCoz(z, k);
  }
  async yedekle(parola: string): Promise<Uint8Array<ArrayBuffer>> {
    return this.#islem(async (n) => {
      const z = this.#zarf;
      const b = await profilYedegiOlustur(await this.#guncel(n), parola);
      this.#denetle(n);
      if (JSON.stringify(await this.#oku()) !== JSON.stringify(z))
        throw new KullaniciHatasi('Profil başka sekmede değişti. Yedeği yeniden hazırlayın.');
      this.#denetle(n);
      return b;
    });
  }
  /** Güncel kayıt yeniden okunur; özet incelemedekinden farklıysa hiçbir şey yazılmaz. */
  async yedektenEkle(
    gelen: PosProfilVerisi,
    secim: BirlestirmeSecimi = 'koru',
    onaylananOzet?: string,
  ): Promise<PosProfilVerisi> {
    return this.#islem(async (n) =>
      this.#yaz(profilBirlestir(await this.#guncel(n), gelen, secim, onaylananOzet), n),
    );
  }
  async yedekOzeti(gelen: PosProfilVerisi): Promise<BirlestirmeOzeti> {
    return this.#islem(async (n) => profilBirlestirmeOzeti(await this.#guncel(n), gelen));
  }
}
