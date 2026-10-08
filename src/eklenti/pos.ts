import {
  AKTARIM_SURESI,
  girisSayfasi,
  POS_KOKENI,
  posSayfasi,
  type PosAktarimi,
} from '../cekirdek/posAktarimi';
import { kurulumDogrula, type PosKurulumu } from '../cekirdek/posKurulumu';
import { alanIzi } from './alanlar';
import { eklenti } from './chrome';
import { kartiDoldur } from './doldurma';
import { firmaNumarasi } from './firma';
import { panelOlustur, type Eylem } from './panel';
import { tanitmayiBaslat } from './tanitma';
import { ekranYapisi } from './tanilama';

type Yanit = {
  durum: string;
  numara?: string;
  kullanici?: string;
  sifre?: string;
  kurulum?: PosKurulumu | null;
  kart?: PosAktarimi;
  id?: string;
  mesaj?: string;
  bekleyen?: boolean;
  kucuk?: boolean;
  goster?: boolean;
};
const sor = (m: Record<string, unknown>) => eklenti.runtime.sendMessage(m) as Promise<Yanit>;

/** Giriş sayfasında yalnız sağlayıcının kendi formu gönderilir. Ödeme sayfasında form gönderimi veya
 * DOM olayı üretilmez. Oturum düşünce gelen `?ReturnUrl=` adresi de giriş sayfasıdır. */
function giris(r: Yanit) {
  if (!girisSayfasi(location.href) || !r.numara || !r.kullanici || !r.sifre)
    throw new Error('Giriş sayfası uygun değil.');
  const form = document.getElementById('form1');
  const alanlar = ['lvergino', 'lkullaniciadi', 'lsifre'].map((id) => document.getElementById(id));
  const hedef = form instanceof HTMLFormElement ? new URL(form.action) : null;
  if (
    !(form instanceof HTMLFormElement) ||
    form.method.toLowerCase() !== 'post' ||
    !['', '_self'].includes(form.target) ||
    hedef?.origin !== POS_KOKENI ||
    hedef.pathname.toLowerCase() !== '/login.aspx' ||
    !alanlar.every((e) => e instanceof HTMLInputElement && e.form === form)
  )
    throw new Error('Giriş alanları değişmiş.');
  (alanlar[0] as HTMLInputElement).value = r.numara;
  (alanlar[1] as HTMLInputElement).value = r.kullanici;
  (alanlar[2] as HTMLInputElement).value = r.sifre;
  const b = document.createElement('input');
  b.type = 'hidden';
  b.name = 'btngiris';
  b.value = 'Giriş Yap';
  form.append(b);
  try {
    HTMLFormElement.prototype.submit.call(form);
  } finally {
    r.numara = r.kullanici = r.sifre = '';
  }
}

interface Calisan {
  durdur(): void;
  eskiOturum(): void;
  gorunur(goster: boolean): void;
}
/** Yardımcı açıkken POS sekmesindeki bütün iş: panel, tanıtma, giriş ve doldurma. Yardımcı araç
 * çubuğundan kapatılınca `durdur` paneli kaldırır ve döngüyü bitirir; yeniden açılınca yenisi kurulur. */
function calistir(kucukBasla: boolean, goster: boolean): Calisan {
  const panel = panelOlustur((kucuk) => void sor({ is: 'panel', kucuk }).catch(() => undefined));
  if (kucukBasla) panel.kucult(true);
  panel.gorunur(goster);

  let kurulum: PosKurulumu | null = null;
  let mod: 'bosta' | 'tanitma' | 'sil' | 'rapor' = 'bosta';
  let gorunum = '';
  let kapali = false;
  let eskiOturum = false;
  let iptalTanitma = () => {};
  const son = performance.now() + AKTARIM_SURESI + 5_000;

  const kurulumuAl = (d: unknown) => {
    try {
      kurulum = d === null || d === undefined ? null : kurulumDogrula(d);
    } catch {
      kurulum = null;
    }
  };
  const formVar = () => {
    if (!kurulum?.alanlar.numara || girisSayfasi(location.href)) return false;
    return alanIzi(kurulum.alanlar.numara);
  };
  /** Boştaki panel: kurulum varsa “tamam” der ve tanıtmayı ikinci plana alır. */
  const bosta = (zorla = false) => {
    if (mod !== 'bosta') return;
    const form = formVar();
    const yeni = `${Boolean(kurulum)}-${form}`;
    if (!zorla && yeni === gorunum) return;
    gorunum = yeni;
    const rapor: Eylem = { ad: 'Ekran yapısı raporu', is: raporAc };
    // Giriş sayfasında tanıtılacak kart formu yoktur.
    const giriste = girisSayfasi(location.href);
    if (!kurulum) {
      panel.kurulumYazisi('');
      panel.eylemler(giriste ? [] : [{ ad: 'Alanları tanıt', birincil: true, is: tanit }, rapor]);
      if (!giriste && !eskiOturum)
        panel.bildir(
          'Ödeme formu bu sayfadaysa kutuları “Alanları tanıt” ile bir kez tanıtın; bütün cariler için geçerli olur.',
        );
      return;
    }
    panel.kurulumYazisi(
      form
        ? 'Kurulum tamam: bu ödeme formu tanınıyor. Her cari için geçerlidir; yeniden tanıtmanız gerekmez.'
        : 'Kurulum tamam. Bu sayfada kart formu yok; burada yapmanız gereken bir şey yok.',
    );
    panel.eylemler(
      giriste ? [] : [{ ad: 'Kurulumu yenile', is: tanit }, { ad: 'Kurulumu sil', is: silSor }, rapor],
    );
  };
  /** Boştaki görünüme dönülür; sonucun yazısı boştaki davet yazısının üstüne yazılır, kaybolmaz. */
  const bostayaDon = (mesaj: string, ton: 'bilgi' | 'uyari' = 'bilgi') => {
    mod = 'bosta';
    bosta(true);
    panel.bildir(mesaj, ton);
  };
  function tanit() {
    mod = 'tanitma';
    panel.kurulumYazisi('');
    iptalTanitma = tanitmayiBaslat(panel, (k, mesaj) => {
      panel.eylemler([]);
      if (!k) {
        bostayaDon(mesaj);
        return;
      }
      panel.bildir('Kurulum kaydediliyor…');
      void sor({ is: 'kurulum', veri: k })
        .then((r) => {
          kurulumuAl(r?.kurulum);
          if (kurulum)
            bostayaDon(
              'Alanlar tanıtıldı. Bu kurulum bütün cariler için geçerli; CAL bup’tan cari ve kart seçerek POS’u açabilirsiniz.',
            );
          else bostayaDon('Kurulum kaydedilemedi. Yeniden deneyin.', 'uyari');
        })
        .catch(() => bostayaDon('Kurulum kaydedilemedi. Yeniden deneyin.', 'uyari'));
    });
  }
  function silSor() {
    mod = 'sil';
    panel.bildir('Kurulum silinsin mi? Silerseniz ödeme formunu yeniden tanıtmanız gerekir.', 'uyari');
    panel.eylemler([
      {
        ad: 'Evet, kurulumu sil',
        is: () =>
          void sor({ is: 'kurulumuSil' })
            .then((r) => {
              // Arka plan hatası red değil, `hata` yanıtı olarak gelir.
              if (r?.durum !== 'hazir') throw new Error('Kurulum silinemedi.');
              kurulum = null;
              bostayaDon('Kurulum silindi. Kart doldurmak için ödeme formunu yeniden tanıtın.');
            })
            .catch(() => bostayaDon('Kurulum silinemedi. Yeniden deneyin.', 'uyari')),
      },
      { ad: 'Vazgeç', is: () => bostayaDon('Kurulum değişmedi.') },
    ]);
  }
  function raporAc() {
    mod = 'rapor';
    const metin = ekranYapisi(kurulum);
    panel.metin(metin);
    panel.bildir(
      'Rapor kutu değerlerini içermez; rakamlar # ile gizlidir. Göndermeden önce okuyun. Gerçek POS’a istek gönderilmez.',
    );
    panel.eylemler([
      {
        ad: 'Kopyala',
        is: () =>
          void navigator.clipboard
            .writeText(metin)
            .then(() => panel.bildir('Rapor kopyalandı.'))
            .catch(() => panel.bildir('Kopyalanamadı; metni seçip Ctrl+C ile kopyalayın.', 'uyari')),
      },
      {
        ad: 'Raporu kapat',
        is: () => {
          panel.metin(null);
          bostayaDon('Rapor kapatıldı.');
        },
      },
    ]);
  }

  // Başka sekmede yeni cariyle giriş başladı: bu sekmenin oturumu değişmiş olabilir.
  const eskiOturumUyarisi = () => {
    eskiOturum = true;
    panel.bildir(
      'Başka sekmede yeni bir cariyle POS girişi başladı. Bu sekme önceki cariye ait olabilir: buradan ödeme yapmayın, sekmeyi kapatın.',
      'hata',
    );
  };
  window.addEventListener(
    'pagehide',
    () => {
      kapali = true;
      iptalTanitma();
    },
    { once: true },
  );

  const girisMesaji = () =>
    girisSayfasi(location.href) ? (document.getElementById('lblgizleme')?.textContent ?? '') : '';
  const dene = async () => {
    if (kapali || performance.now() > son) return;
    let dolduruldu = false;
    try {
      if (mod === 'tanitma') {
        setTimeout(() => void dene(), 1000);
        return;
      }
      const alanVar = formVar();
      let firma = '';
      if (alanVar && kurulum)
        try {
          firma = firmaNumarasi(kurulum);
        } catch {
          firma = '';
        }
      const r = await sor({ is: 'posDurum', alanVar, firma, girisMesaji: girisMesaji() });
      if (kapali || r.durum === 'kapali') return;
      if ('kurulum' in r) kurulumuAl(r.kurulum);
      if (alanVar && !firma && r.bekleyen) {
        await sor({ is: 'alanHatasi' });
        panel.bildir(
          'Firma numarası okunamadı; kart aktarılmadı. “Kurulumu yenile” ile firma yazısını da tanıtın.',
          'uyari',
        );
        bosta(true);
        return;
      }
      if (r.durum === 'giris') {
        try {
          giris(r);
        } catch {
          await sor({ is: 'girisHatasi' });
          panel.bildir('POS giriş alanları değişmiş. Kart aktarılmadı; girişi elle yapın.', 'uyari');
        }
        return;
      }
      if (r.durum === 'doldur' && r.kart && r.kurulum) {
        let sonuc: ReturnType<typeof kartiDoldur> | null = null;
        let onay = '';
        try {
          sonuc = kartiDoldur(kurulumDogrula(r.kurulum), r.kart);
          dolduruldu = true;
        } finally {
          r.kart.numara = r.kart.cvv = r.kart.sifre = r.kart.cariNumarasi = '';
          onay = (
            await sor({
              is: 'sonuc',
              islemId: r.id,
              durum: sonuc ? 'tamam' : 'hata',
              doldurulan: sonuc?.doldurulan ?? [],
              notlar: sonuc?.notlar ?? [],
            })
          ).durum;
        }
        if (onay !== 'tamam') throw new Error('Teslim sonucu doğrulanamadı.');
        panel.bildir(
          [
            'Cari eşleşti; kart bilgileri dolduruldu.',
            ...(sonuc?.notlar ?? []),
            'Tutar kutusundaki değer POS’un yazdığı bakiyedir: ödenecek tutarı kendiniz yazın.',
          ].join(' '),
        );
        bosta(true);
        return;
      }
      if (r.durum === 'hata') {
        panel.bildir(r.mesaj ?? 'Aktarım durduruldu.', 'uyari');
        bosta(true);
        return;
      }
      if (r.bekleyen)
        panel.bildir(
          !kurulum
            ? 'Ödeme formunda “Alanları tanıt” ile kutuları bir kez tanıtın; kart sonra doldurulacak.'
            : 'Ödeme formunun olduğu sayfaya geçin; cari numarası eşleşirse kart doldurulacak.',
        );
      bosta();
    } catch {
      panel.bildir(
        dolduruldu
          ? 'Alanlar dolduruldu ancak aktarım sonucu doğrulanamadı. POS alanlarını kontrol edin; otomatik tekrar yapılmadı.'
          : 'POS alanları doğrulanamadı. Kart aktarılmadı; alanları ve cari bilgisini kontrol edin.',
        'uyari',
      );
      bosta(true);
      return;
    }
    setTimeout(() => void dene(), 1000);
  };
  void sor({ is: 'kurulumAl' })
    .then((r) => kurulumuAl(r?.kurulum))
    .catch(() => undefined)
    .finally(() => void dene());
  return {
    durdur() {
      kapali = true;
      iptalTanitma();
      panel.kok.remove();
    },
    eskiOturum: eskiOturumUyarisi,
    gorunur: (g) => panel.gorunur(g),
  };
}

if (window.top === window) {
  posSayfasi(location.href);
  let calisan: Calisan | null = null;
  const ac = (kucuk = false, goster = true) => {
    calisan ??= calistir(kucuk, goster);
  };
  eklenti.runtime.onMessage.addListener((m, s) => {
    if (s.id !== eklenti.runtime.id || s.tab) return false;
    const mesaj = m as { is?: string; kapali?: unknown; goster?: unknown } | null;
    if (mesaj?.is === 'eskiOturum') calisan?.eskiOturum();
    else if (mesaj?.is === 'panelGorunum') calisan?.gorunur(mesaj.goster === true);
    else if (mesaj?.is === 'acKapa') {
      if (mesaj.kapali === true) {
        calisan?.durdur();
        calisan = null;
      } else
        void sor({ is: 'panel' })
          .then((r) => ac(r?.kucuk === true, r?.goster !== false))
          .catch(() => ac());
    }
    return false;
  });
  // Yardımcı kapalıysa POS sayfasında hiçbir şey görünmez ve yapılmaz.
  void sor({ is: 'panel' })
    .then((r) => {
      if (r?.durum !== 'kapali') ac(r?.kucuk === true, r?.goster !== false);
    })
    .catch(() => ac());
}
