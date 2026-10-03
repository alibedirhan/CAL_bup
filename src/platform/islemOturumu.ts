import { IslemHatasi, basarisiz, hataSonucu, tamam, type IslemSonucu } from '../cekirdek/islemSonucu';
/** Tek işlem + iptal + nesil. Değişiklik yapan portlar her await sonrasında signal denetler.
 * Durdurulan yazı geri alındı sayılmaz; eski sonuç yeni ekrana taşınmaz. */
export class IslemOturumu {
  private no = 0;
  private denetleyici: AbortController | null = null;
  get islemId(): number {
    return this.no;
  }
  get mesgul(): boolean {
    return this.denetleyici !== null;
  }
  constructor(
    private kapsam: string,
    private sure = 120_000,
  ) {}
  durdur(): void {
    this.denetleyici?.abort();
  }
  kapat(): void {
    this.durdur();
    this.no++;
  }
  async calistir<T>(
    is: (signal: AbortSignal) => Promise<T>,
    mesaj: string,
    yazma = false,
  ): Promise<IslemSonucu<T>> {
    if (this.denetleyici)
      return basarisiz('dogrulama', 'Başka bir işlem sürüyor.', 'MESGUL', {
        kapsam: this.kapsam,
        islemId: this.no,
      });
    const baglam = { kapsam: this.kapsam, islemId: ++this.no };
    const c = new AbortController();
    this.denetleyici = c;
    let sureDoldu = false;
    const zaman = setTimeout(() => {
      sureDoldu = true;
      c.abort();
    }, this.sure);
    const iptalEt = () =>
      new IslemHatasi(
        yazma ? 'belirsiz' : 'iptal',
        sureDoldu ? 'SURE_DOLDU' : 'IPTAL',
        (sureDoldu ? 'İşlemin süresi doldu.' : 'İşlem durduruldu.') +
          (yazma
            ? ' Bazı kayıtlar tamamlanmış olabilir; yeniden işlem yapmadan güncel kayıtları kontrol edin.'
            : ' Yeniden deneyebilirsiniz.'),
      );
    let iptal!: () => void;
    const durdu = new Promise<never>((_, reddet) => {
      iptal = () => reddet(iptalEt());
      c.signal.addEventListener('abort', iptal, { once: true });
    });
    try {
      // Aynı tıklama içinde başlar; Google açılır penceresi için önemlidir.
      const deger = await Promise.race([is(c.signal), durdu]);
      c.signal.throwIfAborted();
      if (baglam.islemId !== this.no) throw iptalEt();
      return tamam(deger, mesaj, baglam);
    } catch (e) {
      return hataSonucu(e, baglam, yazma);
    } finally {
      clearTimeout(zaman);
      c.signal.removeEventListener('abort', iptal);
      if (this.denetleyici === c) this.denetleyici = null;
    }
  }
}
