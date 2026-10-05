import {
  AKTARIM_SURESI,
  POS_KOKENI,
  posSayfasi,
  type PosAlanlari,
  type PosAktarimi,
} from '../cekirdek/posAktarimi';
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
  tanitilmis?: boolean;
  bekleyen?: boolean;
  kucuk?: boolean;
};
const GIRIS_SAYFASI = POS_KOKENI + '/login.aspx';
/** Tek izinli sayfada login gönderimi. Ödeme gönderimi veya DOM event üretimi yoktur. */
function giris(r: Yanit) {
  if (location.href !== GIRIS_SAYFASI || !r.numara || !r.sifre) throw new Error('Giriş sayfası uygun değil.');
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
  try {
    HTMLFormElement.prototype.submit.call(form);
  } finally {
    r.numara = '';
    r.sifre = '';
  }
}
if (window.top === window && posSayfasi(location.href)) {
  const panel = yardimciPaneli((kucuk) => {
    void eklenti.runtime.sendMessage({ is: 'panel', kucuk }).catch(() => undefined);
  });
  void eklenti.runtime
    .sendMessage({ is: 'panel' })
    .then((r) => {
      if ((r as Yanit | undefined)?.kucuk === true) panel.kucult(true);
    })
    .catch(() => undefined);
  let kapali = false;
  let alanlar: PosAlanlari | undefined;
  const son = performance.now() + AKTARIM_SURESI + 5_000;
  // Giriş sayfasına geri dönüldüyse sağlayıcının hata yazısı (yalnız metin) arka plana iletilir.
  const girisMesaji = () =>
    location.href === GIRIS_SAYFASI ? (document.getElementById('lblgizleme')?.textContent ?? '') : '';
  window.addEventListener(
    'pagehide',
    () => {
      kapali = true;
    },
    { once: true },
  );
  const dene = async () => {
    if (kapali || performance.now() > son) return;
    let dolduruldu = false;
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
      const r = (await eklenti.runtime.sendMessage({
        is: 'posDurum',
        firma,
        girisMesaji: girisMesaji(),
      })) as Yanit;
      if (kapali) return;
      if (r.alanlar) alanlar = r.alanlar;
      if (r.durum === 'giris') {
        try {
          giris(r);
        } catch {
          await eklenti.runtime.sendMessage({ is: 'girisHatasi' });
          panel.bildir('POS giriş alanları değişmiş. Kart aktarılmadı; giriş sayfasını kontrol edin.');
        }
        return;
      }
      if (r.durum === 'doldur' && r.kart && r.alanlar) {
        let tamam = false;
        let onayDurumu = '';
        try {
          kartiDoldur(r.alanlar, r.kart);
          tamam = dolduruldu = true;
        } finally {
          r.kart.numara = '';
          r.kart.cariNumarasi = '';
          const onay = (await eklenti.runtime.sendMessage({
            is: 'sonuc',
            islemId: r.id,
            durum: tamam ? 'tamam' : 'hata',
          })) as Yanit;
          onayDurumu = onay.durum;
        }
        if (onayDurumu !== 'tamam') throw new Error('Teslim sonucu doğrulanamadı.');
        panel.bildir('Cari eşleşti; kart numarası ve son kullanma dolduruldu. CVV ve tutarı kendiniz girin.');
        return;
      }
      if (r.durum === 'hata') {
        panel.bildir(r.mesaj ?? 'Aktarım durduruldu.');
        return;
      }
      if (r.durum === 'kurulum')
        panel.bildir(
          r.bekleyen && r.tanitilmis
            ? 'POS’ta ödeme sayfasına geçin; kart numarası ve son kullanma orada, cari numarası eşleşirse doldurulacak.'
            : r.bekleyen
              ? 'Ödeme sayfasını açın ve boş kart alanlarını aşağıdaki düğmeyle bir kez tanıtın.'
              : 'Bu sayfada tanıtılmış kart alanı yok. Ödeme sayfasındaysanız boş alanları bir kez tanıtın; değilse bir şey yapmanız gerekmez.',
        );
    } catch {
      panel.bildir(
        dolduruldu
          ? 'Alanlar dolduruldu ancak aktarım sonucu doğrulanamadı. POS alanlarını kontrol edin; otomatik tekrar yapılmadı.'
          : 'POS alanları doğrulanamadı. Kart aktarılmadı; alanları ve cari bilgisini kontrol edin.',
      );
      return;
    }
    setTimeout(() => void dene(), 1000);
  };
  void dene();
}
