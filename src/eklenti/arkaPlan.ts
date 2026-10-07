import {
  AKTARIM_SURESI,
  aktarimiDogrula,
  girisMesajiTemizle,
  girisSayfasi,
  posSayfasi,
  programAdresi,
  POS_KOKENI,
} from '../cekirdek/posAktarimi';
import { KART_ROLLERI, kurulumDogrula } from '../cekirdek/posKurulumu';
import { POS_KIMLIK } from '../cekirdek/posKart';
import { POS_YARDIMCI_PROTOKOLU } from '../cekirdek/posBaglantisi';
import { eklenti } from './chrome';
import { kurulumKaydi, kurulumOku, kurulumSil, kurulumYaz, panelTercihi } from './kurulumDeposu';
import {
  bitir,
  isler,
  MESAJ,
  ozet,
  posSekmeleri,
  posSekmesiCikar,
  posSekmesiEkle,
  SURUYOR,
  yaz,
  type Islem,
} from './isler';

type Mesaj = {
  is?: string;
  islemId?: string;
  veri?: unknown;
  kurulum?: unknown;
  firma?: unknown;
  alanVar?: unknown;
  durum?: string;
  girisMesaji?: unknown;
  kucuk?: unknown;
  doldurulan?: unknown;
  notlar?: unknown;
};
let kuyruk: Promise<unknown> = Promise.resolve();
const koruma = Promise.all([
  eklenti.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  eklenti.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
]);

/** Program (CAL bup) sekmesinden gelenler: durum, başlat, iptal. */
async function program(m: Mesaj, tab: number): Promise<unknown> {
  const s = await isler();
  if (m.is === 'durum') {
    await yaz(s);
    // Programa kurulumun kopyası verilir: eklenti yeniden kurulsa da tanıtım kaybolmaz.
    if (m.islemId) return ozet(s.find((i) => i.kaynak === tab && i.id === m.islemId));
    const kayit = await kurulumKaydi();
    return { ...ozet(), ...(kayit === undefined ? {} : { kurulum: kayit }) };
  }
  if (!m.islemId || !POS_KIMLIK.test(m.islemId)) throw new Error('İşlem kimliği uygun değil.');
  if (m.is === 'iptal') {
    for (const i of s)
      if (i.kaynak === tab && i.id === m.islemId && SURUYOR.includes(i.durum))
        bitir(i, 'iptal', 'Aktarım durduruldu.');
    await yaz(s);
    return { durum: 'iptal', mesaj: 'Aktarım durduruldu.' };
  }
  if (m.is !== 'baslat') throw new Error('İstek uygun değil.');
  if (s.some((i) => i.kaynak !== tab && SURUYOR.includes(i.durum)))
    return {
      durum: 'hata',
      mesaj: 'Başka program sekmesinde bir POS aktarımı sürüyor. Önce o aktarımı tamamlayın veya durdurun.',
    };
  const kart = aktarimiDogrula(m.veri);
  if (s.some((i) => i.id === m.islemId)) throw new Error('İşlem daha önce başlatıldı.');
  // Yardımcıda kurulum yoksa (yeniden kurulduysa) programın sakladığı kopya geri alınır.
  if (m.kurulum !== undefined && m.kurulum !== null && (await kurulumKaydi()) === undefined) {
    try {
      await kurulumYaz(m.kurulum);
    } catch {
      /* Geçersiz kopya alınmaz; kullanıcı yeniden tanıtır. */
    }
  }
  for (const i of s) if (i.kaynak === tab) bitir(i, 'iptal', 'Yeni seçim eski aktarımı durdurdu.');
  const eskiler = await posSekmeleri();
  const hedef = await eklenti.tabs.create({ url: POS_KOKENI + '/login.aspx' });
  if (hedef.id === undefined) throw new Error('POS sekmesi açılamadı.');
  // Yeni giriş, aynı tarayıcıdaki eski POS sekmelerinin oturumunu da değiştirir; onlar uyarılır.
  for (const id of eskiler)
    if (id !== hedef.id) void eklenti.tabs.sendMessage(id, { is: 'eskiOturum' }).catch(() => undefined);
  const baslangic = Date.now();
  const i: Islem = {
    id: m.islemId,
    kaynak: tab,
    hedef: hedef.id,
    son: baslangic + AKTARIM_SURESI,
    baslangic,
    durum: 'giris',
    kart,
    mesaj: 'POS açıldı. Giriş ve ödeme formu bekleniyor.',
  };
  await yaz([...s.filter((x) => x.kaynak !== tab), i].slice(-20));
  await eklenti.alarms.create('temizle-' + i.id, { when: i.son });
  return ozet(i);
}

function rolListesi(d: unknown): string[] {
  return Array.isArray(d)
    ? d.filter((r): r is string => (KART_ROLLERI as readonly unknown[]).includes(r))
    : [];
}
function notListesi(d: unknown): string[] {
  return Array.isArray(d)
    ? d.filter((n): n is string => typeof n === 'string' && n.length <= 120).slice(0, 3)
    : [];
}

/** POS sekmesindeki içerik betiğinden gelenler. */
async function pos(m: Mesaj, tab: number, adres: string): Promise<unknown> {
  posSayfasi(adres);
  await posSekmesiEkle(tab);
  const s = await isler();
  await yaz(s); // Okuma isteği de süresi dolmuş kartı fiziksel kuyruktan çıkarır.
  const i = s.find((x) => x.hedef === tab && x.kart && (x.durum === 'giris' || x.durum === 'alanlar'));
  if (m.is === 'panel') return { durum: 'hazir', kucuk: await panelTercihi(m.kucuk) };
  if (m.is === 'kurulumAl') return { durum: 'hazir', kurulum: await kurulumOku(), bekleyen: Boolean(i) };
  if (m.is === 'kurulum') {
    const k = await kurulumYaz(kurulumDogrula(m.veri));
    return { durum: 'hazir', kurulum: k };
  }
  if (m.is === 'kurulumuSil') {
    await kurulumSil();
    return { durum: 'hazir', kurulum: null };
  }
  if (m.is === 'alanHatasi' || m.is === 'girisHatasi') {
    if (i)
      bitir(
        i,
        'hata',
        m.is === 'girisHatasi'
          ? 'POS giriş sayfası beklenen yapıda değil. Kart aktarılmadı; POS girişini elle yapın.'
          : 'POS’taki firma numarası okunamadı. Kart aktarılmadı; POS ekranındaki yardımcı panelinden “Kurulumu yenile” ile firma yazısını tanıtın.',
      );
    await yaz(s);
    return ozet(i);
  }
  if (m.is === 'sonuc') {
    const once = s.find((x) => x.hedef === tab && x.id === m.islemId && x.durum === 'teslim' && !x.kart);
    if (once)
      bitir(
        once,
        m.durum === 'tamam' ? 'dolduruldu' : 'hata',
        m.durum === 'tamam'
          ? MESAJ.dolduruldu(rolListesi(m.doldurulan), notListesi(m.notlar))
          : 'Alanlar doldurulamadı. POS ekranını kontrol edin; otomatik tekrar yapılmadı.',
      );
    await yaz(s);
    return { durum: once ? 'tamam' : 'hata' };
  }
  if (m.is !== 'posDurum') throw new Error('İstek uygun değil.');
  const kurulum = await kurulumOku();
  if (girisSayfasi(adres)) {
    if (!i?.kart) return { durum: 'bekle', kurulum, bekleyen: false };
    if (i.giris) {
      // Giriş sayfası yeniden geldiyse giriş kabul edilmemiştir; sağlayıcının yazısı aktarılır.
      bitir(i, 'hata', MESAJ.girisReddi(i.kart.cariNumarasi, girisMesajiTemizle(m.girisMesaji)), 'giris');
      await yaz(s);
      return ozet(i);
    }
    i.giris = true;
    i.mesaj = 'POS’a giriş yapılıyor…';
    await yaz(s);
    return {
      durum: 'giris',
      numara: i.kart.cariNumarasi,
      kullanici: i.kart.kullanici,
      sifre: i.kart.sifre,
    };
  }
  if (!kurulum) {
    if (i)
      i.mesaj =
        'POS’taki ödeme formunda yardımcı panelinden “Alanları tanıt” ile kutuları bir kez tanıtın; bütün cariler için geçerli olur.';
    await yaz(s);
    return { durum: 'kurulum', kurulum: null, bekleyen: Boolean(i) };
  }
  if (!i?.kart) return { durum: 'hazir', kurulum, bekleyen: false };
  if (m.alanVar !== true) {
    i.mesaj = i.giris
      ? 'POS’a giriş yapıldı. Ödeme formunun olduğu sayfaya geçin; kart orada doldurulacak.'
      : 'POS açık bir oturumla açıldı. Ödeme formuna geçin; cari numarası orada karşılaştırılacak.';
    await yaz(s);
    return { durum: 'bekle', kurulum, bekleyen: true };
  }
  i.durum = 'alanlar';
  if (typeof m.firma !== 'string' || !/^\d{10,11}$/.test(m.firma)) {
    await yaz(s);
    return { durum: 'bekle', kurulum, bekleyen: true };
  }
  if (m.firma !== i.kart.cariNumarasi) {
    bitir(i, 'hata', MESAJ.cariFarki(m.firma, i.kart.cariNumarasi), 'cari');
    await yaz(s);
    return ozet(i);
  }
  const kart = i.kart;
  delete i.kart; // Tek kullanımlık: teslimden önce kalıcı olmayan kuyruktan silinir (CVV dahil).
  i.durum = 'teslim';
  i.teslimSon = Date.now() + 5000;
  i.mesaj = 'Cari eşleşti; kart alanlarının doldurulma sonucu bekleniyor.';
  await yaz(s);
  return { durum: 'doldur', id: i.id, kurulum, kart };
}

eklenti.runtime.onMessage.addListener((veri, sender, yanit) => {
  const tab = sender.tab?.id;
  if (sender.id !== eklenti.runtime.id || tab === undefined || sender.frameId !== 0 || !sender.url)
    return false;
  const url = sender.url;
  const m = veri as Mesaj | null;
  if (!m || typeof m.is !== 'string') return false;
  const is = async () => {
    await koruma;
    if (programAdresi(url)) return program(m, tab);
    return pos(m, tab, url);
  };
  const cevap = (r: unknown) =>
    yanit(
      programAdresi(url)
        ? { ...(r as object), protokol: POS_YARDIMCI_PROTOKOLU, surum: eklenti.runtime.getManifest().version }
        : r,
    );
  kuyruk = kuyruk.then(is, is).then(cevap, () =>
    cevap({
      durum: 'hata',
      mesaj: 'POS yardımcısı işlemi tamamlayamadı. Seçimi ve kurulumu kontrol edin.',
    }),
  );
  return true;
});
function temizle(tab?: number, dis = false) {
  const is = async () => {
    const s = await isler();
    for (const i of s)
      if ((i.kaynak === tab || i.hedef === tab) && SURUYOR.includes(i.durum))
        bitir(i, 'iptal', 'Sekme kapandı veya izinli siteden ayrıldı.');
    await yaz(dis ? s : s.filter((i) => i.kaynak !== tab));
    if (tab !== undefined) await posSekmesiCikar(tab);
  };
  kuyruk = kuyruk.then(is, is).catch(() => undefined);
}
eklenti.alarms.onAlarm.addListener(() => temizle());
eklenti.tabs.onRemoved.addListener((id) => temizle(id));
eklenti.tabs.onUpdated.addListener((id, d) => {
  if (!d.url) return;
  try {
    posSayfasi(d.url);
  } catch {
    temizle(id, true);
  }
});
