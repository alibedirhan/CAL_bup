import { KullaniciHatasi } from '../cekirdek/hata';

// Kullanıcı verisi, sorgu parametresi veya oturum belirteci bu adrese eklenmez.
export const POS_GIRIS_ADRESI = 'https://denizpay.bupilic.com.tr/login.aspx';

export async function posBilgisiniKopyala(metin: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Pano yok');
    await navigator.clipboard.writeText(metin);
  } catch {
    throw new KullaniciHatasi(
      'Kopyalama izni verilmedi. “Giriş bilgilerini göster” ile elle yazabilirsiniz.',
    );
  }
}
