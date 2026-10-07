import { KullaniciHatasi } from '../cekirdek/hata';
import { posGirisBilgisi, type PosCari } from '../cekirdek/posCari';

// Kullanıcı verisi, sorgu parametresi veya oturum belirteci bu adrese eklenmez.
export const POS_GIRIS_ADRESI = 'https://denizpay.bupilic.com.tr/login.aspx';

/** Yalnızca kullanıcı tıklamasında çağrılır; POS yanıtı/ödeme sonucu okunmaz. */
export function posCariyleGirisYap(cari: Pick<PosCari, 'numara' | 'girisKullanici' | 'girisSifresi'>): void {
  const g = posGirisBilgisi(cari);
  const form = document.createElement('form');
  form.method = 'post';
  form.action = POS_GIRIS_ADRESI;
  form.target = '_blank';
  form.rel = 'noopener noreferrer';
  form.acceptCharset = 'UTF-8';
  form.autocomplete = 'off';
  form.hidden = true;
  for (const [ad, deger] of Object.entries({
    // ASP.NET'in isteği giriş formu gönderimi olarak işlemesi için boş durum alanı.
    // Sağlayıcının imzalı sayfa/oturum değerleri kopyalanmaz veya sabitlenmez.
    __VIEWSTATE: '',
    lvergino: g.vergiNo,
    lkullaniciadi: g.kullanici,
    lsifre: g.sifre,
    btngiris: 'Giriş Yap',
  })) {
    const alan = document.createElement('input');
    alan.type = 'hidden';
    alan.name = ad;
    alan.value = deger;
    form.append(alan);
  }
  const temizle = () => {
    for (const alan of Array.from(form.elements)) {
      if (alan instanceof HTMLInputElement) alan.value = '';
    }
    form.remove();
  };
  try {
    document.body.append(form);
    form.submit();
    // Tarayıcının form gezinmesini başlatmasından sonra geçici alanları kaldır.
    window.setTimeout(temizle, 0);
  } catch {
    temizle();
    throw new KullaniciHatasi(
      'POS giriş isteği açılamadı. Giriş sayfasını açıp bilgileri elle yazabilirsiniz.',
    );
  }
}

export async function posBilgisiniKopyala(metin: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Pano yok');
    await navigator.clipboard.writeText(metin);
  } catch {
    throw new KullaniciHatasi(
      'Kopyalama izni verilmedi. İlgili bilgiyi ekranda gösterip elle yazabilirsiniz.',
    );
  }
}
