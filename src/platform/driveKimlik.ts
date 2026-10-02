import { KullaniciHatasi } from '../cekirdek/hata';
import { oku, yaz } from './saklama';

export const DRIVE_KAPSAMI = 'https://www.googleapis.com/auth/drive.file';
interface TokenYaniti {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
}
interface GoogleKimlik {
  accounts: {
    oauth2: {
      initTokenClient: (a: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (y: TokenYaniti) => void;
        error_callback: () => void;
      }) => { requestAccessToken: (a: { prompt: string }) => void };
      revoke: (token: string, bitti: (r: { successful?: boolean }) => void) => void;
    };
  };
}

let token: { deger: string; bitis: number } | null = null;
let yukleme: Promise<void> | null = null;
let baglaniyor = false;
let nesil = 0;
let zamanlayici: ReturnType<typeof setTimeout> | undefined;
const dinleyiciler = new Set<() => void>();
function bildir() {
  for (const d of dinleyiciler) d();
}
function google(): GoogleKimlik | undefined {
  return (globalThis as typeof globalThis & { google?: GoogleKimlik }).google;
}

export function istemciKimligi(): string {
  return oku('drive-istemci') ?? '';
}
export function istemciGecerli(k: string): boolean {
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test(k) && k.length <= 256;
}
export function istemciKaydet(k: string): void {
  if (!istemciGecerli(k))
    throw new KullaniciHatasi(
      'Google istemci kimliği geçersiz. .apps.googleusercontent.com ile biten kimliği yapıştırın.',
    );
  driveAyir();
  yaz('drive-istemci', k);
}
export function driveDinle(d: () => void): () => void {
  dinleyiciler.add(d);
  return () => {
    dinleyiciler.delete(d);
  };
}
export function driveBagli(): boolean {
  return token !== null && token.bitis > Date.now();
}
export function driveHazir(): boolean {
  return !!google()?.accounts.oauth2;
}
export function driveToken(): string {
  if (!token || !driveBagli()) {
    token = null;
    bildir();
    throw new KullaniciHatasi('Drive oturumu sona erdi. Ayarlar’dan yeniden Drive’a bağlanın.');
  }
  return token.deger;
}
export function driveHesabiDogrula(baslangic: string): void {
  if (baslangic !== driveToken()) throw new KullaniciHatasi('Drive hesabı değişti. İşlemi yeniden başlatın.');
}
export function driveAyir(): void {
  nesil++;
  token = null;
  clearTimeout(zamanlayici);
  bildir();
}
export function driveIzniKaldir(): Promise<void> {
  const t = token?.deger;
  const g = google();
  driveAyir();
  return new Promise((coz, reddet) => {
    if (!t || !g)
      return reddet(
        new KullaniciHatasi(
          'İzni kaldırmak için önce bağlanın veya Google hesabınızın bağlantılar bölümünü kullanın.',
        ),
      );
    const sure = setTimeout(
      () => reddet(new KullaniciHatasi('Google yanıt vermedi. İzni Google hesabınızdan kaldırabilirsiniz.')),
      15000,
    );
    g.accounts.oauth2.revoke(t, (r) => {
      clearTimeout(sure);
      if (r.successful) coz();
      else
        reddet(
          new KullaniciHatasi(
            'Google izni kaldırılamadı. Google hesabınızın bağlantılar bölümünden kaldırın.',
          ),
        );
    });
  });
}

/** Sadece Drive bölümünde hazırlanır; normal rapor kullanımında Google’a bağlantı kurulmaz. */
export function driveHazirla(): Promise<void> {
  if (driveHazir()) return Promise.resolve();
  yukleme ??= new Promise<void>((coz, reddet) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    const sure = setTimeout(() => hata(), 15000);
    const hata = () => {
      clearTimeout(sure);
      s.remove();
      yukleme = null;
      reddet(
        new KullaniciHatasi(
          'Google bağlantısı yüklenemedi. İnternet bağlantısını kontrol edip yeniden deneyin.',
        ),
      );
    };
    s.onload = () => {
      clearTimeout(sure);
      if (driveHazir()) coz();
      else hata();
    };
    s.onerror = hata;
    document.head.append(s);
  });
  return yukleme;
}

/** Açılır pencere aynı düğme tıklamasında açılır; bu işlevden önce await kullanılmaz. */
export function driveBaglan(): Promise<void> {
  if (baglaniyor) return Promise.reject(new KullaniciHatasi('Drive bağlantısı zaten açılıyor.'));
  const g = google();
  const k = istemciKimligi();
  if (!g || !istemciGecerli(k))
    return Promise.reject(new KullaniciHatasi('Önce Drive bağlantısını hazırlayın.'));
  baglaniyor = true;
  const baslangic = ++nesil;
  return new Promise<void>((coz, reddet) => {
    const sure = setTimeout(
      () => bitir(new KullaniciHatasi('Drive bağlantısı tamamlanmadı. Yeniden bağlanın.')),
      60000,
    );
    let bitti = false;
    const bitir = (hata?: Error) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(sure);
      baglaniyor = false;
      if (hata) reddet(hata);
      else coz();
      bildir();
    };
    try {
      const istemci = g.accounts.oauth2.initTokenClient({
        client_id: k,
        scope: DRIVE_KAPSAMI,
        include_granted_scopes: false,
        callback: (y) => {
          if (bitti) return;
          const saniye = Number(y.expires_in);
          if (baslangic !== nesil) return bitir(new KullaniciHatasi('Drive bağlantısı iptal edildi.'));
          if (
            y.error ||
            !y.access_token ||
            !y.scope?.split(' ').includes(DRIVE_KAPSAMI) ||
            !Number.isFinite(saniye) ||
            saniye <= 60
          ) {
            return bitir(new KullaniciHatasi('Drive dosya izni verilmedi. Bağlanıp istenen izni onaylayın.'));
          }
          token = { deger: y.access_token, bitis: Date.now() + (saniye - 30) * 1000 };
          clearTimeout(zamanlayici);
          zamanlayici = setTimeout(driveAyir, (saniye - 30) * 1000);
          bitir();
        },
        error_callback: () =>
          bitir(
            new KullaniciHatasi(
              'Google penceresi kapandı veya engellendi. Açılır pencereye izin verip yeniden bağlanın.',
            ),
          ),
      });
      istemci.requestAccessToken({ prompt: 'select_account' });
    } catch {
      bitir(new KullaniciHatasi('Google bağlantısı açılamadı. Yeniden deneyin.'));
    }
  });
}
