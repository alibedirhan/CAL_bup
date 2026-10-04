import { POS_KOKENI, posSayfasi, type PosAlanlari, type PosAktarimi } from '../cekirdek/posAktarimi';
import { firmaNumarasi, kartiDoldur } from './alanlar';
import { yardimciPaneli } from './kurulum';
import { eklenti } from './chrome';
type Yanit = {
  durum: string;
  numara?: string;
  sifre?: string;
  alanlar?: PosAlanlari;
  kart?: PosAktarimi;
  id?: string;
  mesaj?: string;
};
/** Tek izinli sayfada login gönderimi. Ödeme gönderimi veya DOM event üretimi yoktur. */
function giris(r: Yanit) {
  if (location.href !== POS_KOKENI + '/login.aspx' || !r.numara || !r.sifre)
    throw new Error('Giriş sayfası uygun değil.');
  const form = document.getElementById('form1');
  const alanlar = ['lvergino', 'lkullaniciadi', 'lsifre'].map((id) => document.getElementById(id));
  if (
    !(form instanceof HTMLFormElement) ||
    form.method.toLowerCase() !== 'post' ||
    !['', '_self'].includes(form.target) ||
    new URL(form.action).href !== POS_KOKENI + '/login.aspx' ||
    !alanlar.every((e) => e instanceof HTMLInputElement && e.form === form)
  )
    throw new Error('Giriş alanları değişmiş.');
  (alanlar[0] as HTMLInputElement).value = r.numara;
  (alanlar[1] as HTMLInputElement).value = r.numara;
  (alanlar[2] as HTMLInputElement).value = r.sifre;
  const b = document.createElement('input');
  b.type = 'hidden';
  b.name = 'btngiris';
  b.value = 'Giriş Yap';
  form.append(b);
  HTMLFormElement.prototype.submit.call(form);
  r.numara = '';
  r.sifre = '';
}
if (window.top === window && posSayfasi(location.href)) {
  const panel = yardimciPaneli();
  let kapali = false;
  let alanlar: PosAlanlari | undefined;
  const son = Date.now() + 125_000;
  window.addEventListener(
    'pagehide',
    () => {
      kapali = true;
    },
    { once: true },
  );
  const dene = async () => {
    if (kapali || Date.now() > son) return;
    try {
      if (panel.seciliyor()) {
        setTimeout(() => void dene(), 1000);
        return;
      }
      let firma = '';
      if (alanlar) {
        try {
          firma = firmaNumarasi(alanlar);
        } catch {
          panel.bildir('Firma numarası veya alanlar doğrulanamadı. Yeniden tanıtın.');
          await eklenti.runtime.sendMessage({ is: 'alanHatasi' });
          return;
        }
      }
      const r = (await eklenti.runtime.sendMessage({ is: 'posDurum', firma })) as Yanit;
      if (kapali) return;
      if (r.alanlar) alanlar = r.alanlar;
      if (r.durum === 'giris') {
        giris(r);
        return;
      }
      if (r.durum === 'doldur' && r.kart && r.alanlar) {
        let tamam = false;
        try {
          kartiDoldur(r.alanlar, r.kart);
          tamam = true;
        } finally {
          r.kart.numara = '';
          r.kart.cariNumarasi = '';
          await eklenti.runtime.sendMessage({ is: 'sonuc', islemId: r.id, durum: tamam ? 'tamam' : 'hata' });
        }
        panel.bildir('Cari eşleşti; kart numarası ve son kullanma dolduruldu. CVV ve tutarı kendiniz girin.');
        return;
      }
      if (r.durum === 'hata') {
        panel.bildir(r.mesaj ?? 'Aktarım durduruldu.');
        return;
      }
      if (r.durum === 'kurulum')
        panel.bildir('Bu ödeme ekranı henüz tanıtılmadı. Boş alanları aşağıdaki düğmeyle bir kez tanıtın.');
    } catch {
      panel.bildir('POS alanları doğrulanamadı. Kart aktarılmadı; alanları ve cari bilgisini kontrol edin.');
    }
    setTimeout(() => void dene(), 1000);
  };
  void dene();
}
