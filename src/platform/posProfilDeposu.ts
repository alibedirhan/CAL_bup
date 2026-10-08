import { KullaniciHatasi } from '../cekirdek/hata';
import { BOS_POS_PROFILI, posProfilDogrula, type PosProfilVerisi } from '../cekirdek/posProfil';
import { profilParolasiDogrula, profilParolasiGirdisi } from '../cekirdek/posParola';
import * as idb from './idb';
import { POS_CIHAZ_ONEKI } from './posCihaz';
import {
  POS_DENEME_ONEKI,
  parolaDenemeleriniTemizle,
  parolaDenemesiBasarisiz,
  parolaDenemesiIzni,
} from './posDeneme';
import { POS_KASA_ANAHTARI, PosKasasi } from './posKasasi';
import { posSifrelemeDestegi, posZarfiDogrula } from './posSifreleme';
import {
  parolaAnahtari,
  yeniProfilAnahtari,
  profilAnahtariDogrula,
  profilCoz,
  profilSifrele,
  profilZarfiDogrula,
  yeniParolaTuzu,
  type ProfilZarfi,
} from './posProfilSifreleme';

// Aynı anahtarda sürüm değişimi: eski uygulama yeni kaydı boş kasa sanamaz veya üzerine yazamaz.
export const PROFIL_DEPO_ANAHTARI = POS_KASA_ANAHTARI;
export const PROFIL_ANAHTAR_ONEKI = 'sanal-pos-profil-anahtar-';
export const PROFIL_BEKLEME_SURESI = 45_000;
/** Bu kadar süre programda dokunulmazsa Sanal POS kilitlenir. */
export const KILIT_SURESI = 10 * 60_000;
/** `parolaBelirle`: hiç kayıt yok (`tasima: false`) veya 1.17 ve öncesinin parolasız kaydı (`true`). */
export type ProfilAcilisi =
  | { tur: 'eski' }
  | { tur: 'parolaBelirle'; tasima: boolean }
  | { tur: 'kilitli' }
  | { tur: 'acik'; veri: PosProfilVerisi };

/** Kilit açıkken anahtar yalnız bu sekmenin belleğinde durur; sayfa geçişinde korunur, sekme kapanınca,
 * süre dolunca veya “Kilitle” ile silinir. Hiçbir depoya yazılmaz. */
let oturum: { kimlik: string; tuz: string; anahtar: CryptoKey; son: number } | null = null;
export function posEtkinligi(simdi = Date.now()): void {
  if (oturum) oturum.son = simdi;
}
/** Süre dolduysa (veya saat geri alındıysa) oturumu siler; kilitlenmesi gerekiyorsa `true`. */
export function posOturumuSuresiDoldu(simdi = Date.now()): boolean {
  if (!oturum) return false;
  if (simdi - oturum.son < KILIT_SURESI && simdi >= oturum.son) return false;
  oturum = null;
  return true;
}
export function posOturumunuKapat(): void {
  oturum = null;
}

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
  /** Bu sekmedeki oturumu da siler: yeniden açmak için parola gerekir. */
  kilitle(): void {
    posOturumunuKapat();
    this.kapat();
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
  /** Parolalı kayıt yalnız bu sekmede açık bir oturum varsa açılır; yoksa `kilitli` döner. */
  async ac(): Promise<ProfilAcilisi> {
    posSifrelemeDestegi();
    return this.#islem(async (n) => {
      const ham = await this.#oku();
      this.#denetle(n);
      if (ham === undefined) return { tur: 'parolaBelirle', tasima: false };
      if ((ham as { bicim?: unknown } | null)?.bicim === 'cal-bup-pos') {
        posZarfiDogrula(ham);
        return { tur: 'eski' };
      }
      const z = profilZarfiDogrula(ham);
      if (z.kip === 'cihaz') return { tur: 'parolaBelirle', tasima: true };
      const o = oturum;
      if (!o || posOturumuSuresiDoldu() || o.kimlik !== z.kimlik || o.tuz !== z.tuz) {
        // Parola başka sekmede değiştiyse eski oturum geçersizdir.
        if (o && (o.kimlik !== z.kimlik || o.tuz !== z.tuz)) posOturumunuKapat();
        return { tur: 'kilitli' };
      }
      let veri: PosProfilVerisi;
      try {
        veri = await profilCoz(z, o.anahtar);
      } catch {
        posOturumunuKapat();
        return { tur: 'kilitli' };
      }
      this.#denetle(n);
      this.#zarf = z;
      this.#anahtar = o.anahtar;
      return { tur: 'acik', veri };
    });
  }
  #oturumuAc(z: ProfilZarfi, anahtar: CryptoKey): void {
    this.#zarf = z;
    this.#anahtar = anahtar;
    oturum = { kimlik: z.kimlik, tuz: z.tuz, anahtar, son: Date.now() };
  }
  /** Yanlış parola sayılır ve beklemeye yol açar; doğru parola sayacı sıfırlar. */
  async kilidiAc(parola: string): Promise<PosProfilVerisi> {
    profilParolasiGirdisi(parola);
    return this.#islem(async (n) => {
      await parolaDenemesiIzni();
      const z = profilZarfiDogrula(await this.#oku());
      if (z.kip !== 'parola') throw new KullaniciHatasi('Önce Sanal POS parolasını belirleyin.');
      const anahtar = await parolaAnahtari(parola, z.tuz);
      let veri: PosProfilVerisi;
      try {
        veri = await profilCoz(z, anahtar);
      } catch {
        await parolaDenemesiBasarisiz();
        throw new KullaniciHatasi('Parola yanlış.');
      }
      await parolaDenemeleriniTemizle();
      this.#denetle(n);
      this.#oturumuAc(z, anahtar);
      return veri;
    });
  }
  /** İlk parola: boş profil oluşturulur veya parolasız eski kayıt yeni parolayla şifrelenir; eski
   * cihaz anahtarı aynı aktarımda silinir, böylece kayıtlar artık parolasız açılamaz. */
  async parolaBelirle(parola: string, tekrar: string): Promise<PosProfilVerisi> {
    profilParolasiDogrula(parola, tekrar);
    return this.#islem(async (n) => {
      const ham = await this.#oku();
      let eski: ProfilZarfi | undefined;
      let veri = BOS_POS_PROFILI;
      if (ham !== undefined) {
        eski = profilZarfiDogrula(ham);
        if (eski.kip !== 'cihaz')
          throw new KullaniciHatasi('Parola başka sekmede belirlendi. Sayfayı yenileyip parolayı yazın.');
        const k = profilAnahtariDogrula(await idb.okuKesin(PROFIL_ANAHTAR_ONEKI + eski.kimlik));
        veri = await profilCoz(eski, k);
      }
      this.#denetle(n);
      return this.#parolaylaYaz(veri, parola, ham, eski, n);
    });
  }
  /** Eski parola doğrulanmadan değiştirilmez (yanlış deneme sayılır). */
  async parolaDegistir(eskiParola: string, parola: string, tekrar: string): Promise<PosProfilVerisi> {
    profilParolasiGirdisi(eskiParola);
    profilParolasiDogrula(parola, tekrar);
    return this.#islem(async (n) => {
      await parolaDenemesiIzni();
      const ham = await this.#oku();
      const z = profilZarfiDogrula(ham);
      if (z.kip !== 'parola' || JSON.stringify(z) !== JSON.stringify(this.#zarf))
        throw new KullaniciHatasi('Profil başka sekmede değişti. Yeniden kontrol edin.');
      let veri: PosProfilVerisi;
      try {
        veri = await profilCoz(z, await parolaAnahtari(eskiParola, z.tuz));
      } catch {
        await parolaDenemesiBasarisiz();
        throw new KullaniciHatasi('Şu anki parola yanlış. Parola değiştirilmedi.');
      }
      await parolaDenemeleriniTemizle();
      this.#denetle(n);
      return this.#parolaylaYaz(veri, parola, ham, undefined, n);
    });
  }
  async #parolaylaYaz(
    veri: PosProfilVerisi,
    parola: string,
    onceki: unknown,
    cihazli: ProfilZarfi | undefined,
    n: number,
  ): Promise<PosProfilVerisi> {
    const tuz = yeniParolaTuzu();
    const anahtar = await parolaAnahtari(parola, tuz);
    const z = await profilSifrele(veri, anahtar, crypto.randomUUID(), tuz);
    const dogrulanan = await profilCoz(z, anahtar);
    this.#denetle(n);
    const yazildi = await idb.guncelle(PROFIL_DEPO_ANAHTARI, (simdiki, d) => {
      this.#denetle(n);
      if (JSON.stringify(simdiki) !== JSON.stringify(onceki)) throw new Error('Profil değişti');
      if (cihazli) d.delete(PROFIL_ANAHTAR_ONEKI + cihazli.kimlik);
      return z;
    });
    if (!yazildi)
      throw new KullaniciHatasi('Parola kaydedilemedi veya başka sekmede değişti. Kayıtlar değişmedi.');
    this.#denetle(n);
    this.#oturumuAc(z, anahtar);
    return dogrulanan;
  }
  /** Parola unutulunca tek yol: bütün cari ve kartlar kalıcı silinir. Parola sorulmaz, kurtarma yoktur. */
  async sifirla(): Promise<void> {
    await this.#islem(async (n) => {
      const ham = await this.#oku();
      this.#denetle(n);
      const silindi = await idb.guncelle(PROFIL_DEPO_ANAHTARI, (simdiki, d) => {
        if (JSON.stringify(simdiki) !== JSON.stringify(ham)) throw new Error('Profil değişti');
        const b = (simdiki as { bicim?: unknown } | undefined)?.bicim;
        if (b === 'cal-bup-pos-profil') d.delete(PROFIL_ANAHTAR_ONEKI + profilZarfiDogrula(simdiki).kimlik);
        if (b === 'cal-bup-pos') {
          const eski = posZarfiDogrula(simdiki);
          if (eski.cihaz) {
            d.delete(POS_CIHAZ_ONEKI + eski.cihaz);
            d.delete(POS_DENEME_ONEKI + eski.cihaz);
          }
        }
        return idb.KAYDI_SIL;
      });
      if (!silindi)
        throw new KullaniciHatasi('Kayıtlar silinemedi veya başka sekmede değişti. Yeniden deneyin.');
      await parolaDenemeleriniTemizle();
      posOturumunuKapat();
      this.#zarf = null;
      this.#anahtar = null;
    });
  }
  /** 1.3 öncesi PIN'li kasa: cariler taşınır, ardından parola belirlenmesi istenir. */
  async eskiKasayiTasi(parola: string): Promise<void> {
    await this.#islem(async (n) => {
      const eski = posZarfiDogrula(await this.#oku());
      const kasa = new PosKasasi();
      this.#eskiKasa = kasa;
      try {
        const veri = await kasa.ac(parola, false);
        this.#denetle(n);
        const k = await yeniProfilAnahtari();
        const kimlik = crypto.randomUUID();
        const z = await profilSifrele({ surum: 2, cariler: veri.cariler, kartlar: [] }, k, kimlik);
        await profilCoz(z, k);
        this.#denetle(n);
        const yazildi = await idb.guncelle(PROFIL_DEPO_ANAHTARI, (onceki, d) => {
          this.#denetle(n);
          if (JSON.stringify(onceki) !== JSON.stringify(eski)) throw new Error('Profil değişti');
          d.put(k, PROFIL_ANAHTAR_ONEKI + kimlik);
          if (eski.cihaz) {
            d.delete(POS_CIHAZ_ONEKI + eski.cihaz);
            d.delete(POS_DENEME_ONEKI + eski.cihaz);
          }
          return z;
        });
        if (!yazildi)
          throw new KullaniciHatasi(
            'Profil kaydedilemedi veya başka sekmede değişti. Eski kayıtlar korunuyor.',
          );
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
  async #yaz(veri: PosProfilVerisi, n: number): Promise<PosProfilVerisi> {
    const eski = this.#zarf;
    const k = this.#anahtar;
    if (!eski || !k) throw new KullaniciHatasi('Sanal POS kilitli. Parolayı yazıp yeniden deneyin.');
    const z = await profilSifrele(veri, k, eski.kimlik, eski.tuz);
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
    posEtkinligi();
    return veri;
  }
}
