import {
  AKTARIM_SURESI,
  alanlariDogrula,
  aktarimiDogrula,
  programAdresi,
  posSayfasi,
  POS_KOKENI,
  type PosAktarimi,
  type PosAlanlari,
} from '../cekirdek/posAktarimi';
import { POS_KIMLIK } from '../cekirdek/posKart';
import { posGirisSifresi } from '../cekirdek/posCari';
import { eklenti } from './chrome';
import { POS_YARDIMCI_PROTOKOLU } from '../cekirdek/posBaglantisi';
type Durum = 'giris' | 'alanlar' | 'teslim' | 'dolduruldu' | 'hata' | 'iptal';
interface Islem {
  id: string;
  kaynak: number;
  hedef: number;
  son: number;
  baslangic: number;
  teslimSon?: number;
  durum: Durum;
  giris?: boolean;
  kart?: PosAktarimi;
  mesaj: string;
}
type Mesaj = { is?: string; id?: string; islemId?: string; veri?: unknown; firma?: string; durum?: string };
let kuyruk: Promise<unknown> = Promise.resolve();
const koruma = Promise.all([
  eklenti.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  eklenti.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
]);
function bitir(s: Islem, durum: Durum, mesaj: string) {
  delete s.kart;
  s.durum = durum;
  s.mesaj = mesaj;
}
async function isler(): Promise<Islem[]> {
  const d = await eklenti.storage.session.get('isler');
  const s = (Array.isArray(d.isler) ? d.isler : []) as Islem[];
  const simdi = Date.now();
  const kalan = s.filter(
    (i) =>
      Number.isFinite(i.baslangic) &&
      i.baslangic <= simdi &&
      i.son > simdi &&
      i.son - i.baslangic === AKTARIM_SURESI,
  );
  for (const i of kalan)
    if (i.durum === 'teslim' && (!i.teslimSon || simdi >= i.teslimSon))
      bitir(
        i,
        'hata',
        'Kart tesliminin sonucu doğrulanamadı. POS alanlarını kontrol edin; otomatik tekrar yapılmadı.',
      );
  return kalan;
}
async function yaz(s: Islem[]) {
  await eklenti.storage.session.set({ isler: s });
}
function ozet(i?: Islem) {
  return { durum: i?.durum ?? 'hazir', mesaj: i?.mesaj ?? 'POS yardımcısı bağlı.' };
}
async function program(m: Mesaj, tab: number): Promise<unknown> {
  const s = await isler();
  if (m.is === 'durum') {
    await yaz(s);
    return ozet(s.find((i) => i.kaynak === tab && i.id === m.islemId));
  }
  if (!m.islemId || !POS_KIMLIK.test(m.islemId)) throw new Error('İşlem kimliği uygun değil.');
  if (m.is === 'iptal') {
    for (const i of s)
      if (i.kaynak === tab && i.id === m.islemId && ['giris', 'alanlar', 'teslim'].includes(i.durum))
        bitir(i, 'iptal', 'Aktarım durduruldu.');
    await yaz(s);
    return { durum: 'iptal', mesaj: 'Aktarım durduruldu.' };
  }
  if (m.is !== 'baslat') throw new Error('İstek uygun değil.');
  if (s.some((i) => i.kaynak !== tab && ['giris', 'alanlar', 'teslim'].includes(i.durum)))
    return {
      durum: 'hata',
      mesaj: 'Başka program sekmesinde bir POS aktarımı sürüyor. Önce o aktarımı tamamlayın veya durdurun.',
    };
  const kart = aktarimiDogrula(m.veri);
  if (s.some((i) => i.id === m.islemId)) throw new Error('İşlem daha önce başlatıldı.');
  for (const i of s) if (i.kaynak === tab) bitir(i, 'iptal', 'Yeni seçim eski aktarımı durdurdu.');
  const hedef = await eklenti.tabs.create({ url: POS_KOKENI + '/login.aspx' });
  if (hedef.id === undefined) throw new Error('POS sekmesi açılamadı.');
  const baslangic = Date.now();
  const i: Islem = {
    id: m.islemId,
    kaynak: tab,
    hedef: hedef.id,
    son: baslangic + AKTARIM_SURESI,
    baslangic,
    durum: 'giris',
    kart,
    mesaj: 'POS açıldı. Cari eşleşmesi ve ödeme alanları bekleniyor.',
  };
  await yaz([...s.filter((x) => x.kaynak !== tab), i].slice(-20));
  await eklenti.alarms.create('temizle-' + i.id, { when: i.son });
  return ozet(i);
}
async function pos(m: Mesaj, tab: number, adres: string): Promise<unknown> {
  const sayfa = posSayfasi(adres);
  const s = await isler();
  await yaz(s); // Okuma isteği de süresi dolmuş kartı fiziksel kuyruktan çıkarır.
  const i = s.find((i) => i.hedef === tab && i.kart && ['giris', 'alanlar'].includes(i.durum));
  const a = await eklenti.storage.local.get('alanlar');
  const tum = (a.alanlar ?? {}) as Record<string, PosAlanlari>;
  if (m.is === 'kurulum') {
    const alanlar = alanlariDogrula(m.veri);
    if (alanlar.sayfa !== sayfa) throw new Error('Kurulum farklı sayfaya ait.');
    await eklenti.storage.local.set({ alanlar: { ...tum, [sayfa]: alanlar } });
    return { durum: 'hazir', mesaj: 'Alanlar tanıtıldı.' };
  }
  if (m.is === 'kurulumuSil') {
    const kalan = Object.fromEntries(Object.entries(tum).filter(([ad]) => ad !== sayfa));
    await eklenti.storage.local.set({ alanlar: kalan });
    return { durum: 'hazir', mesaj: 'Bu sayfanın alan seçimi silindi.' };
  }
  if (m.is === 'alanHatasi' || m.is === 'girisHatasi') {
    if (i)
      bitir(
        i,
        'hata',
        m.is === 'girisHatasi'
          ? 'POS giriş sayfası veya giriş sonucu doğrulanamadı. Kart aktarılmadı; POS girişini kontrol edin.'
          : 'POS’taki cari alanı okunamadı veya değişmiş. Kart aktarılmadı; alanları yeniden tanıtın.',
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
          ? 'Cari eşleşti; numara ve son kullanma dolduruldu. CVV ve tutarı kendiniz girin.'
          : 'Alanlar doldurulamadı. POS ekranını kontrol edin; otomatik tekrar yapılmadı.',
      );
    await yaz(s);
    return { durum: once ? 'tamam' : 'hata' };
  }
  if (m.is !== 'posDurum') throw new Error('İstek uygun değil.');
  if (sayfa === POS_KOKENI + '/login.aspx') {
    if (!i?.kart) return { durum: 'bekle' };
    if (i.giris) {
      bitir(
        i,
        'hata',
        'POS girişinden sonra ödeme ekranı açılmadı. Kart aktarılmadı; POS girişini kontrol edin.',
      );
      await yaz(s);
      return ozet(i);
    }
    i.giris = true;
    await yaz(s);
    return { durum: 'giris', numara: i.kart.cariNumarasi, sifre: posGirisSifresi(i.kart.cariNumarasi) };
  }
  const alanlar = tum[sayfa];
  if (!alanlar) {
    if (i) i.mesaj = 'POS ödeme ekranı henüz tanıtılmadı. Yardımcı panelinden boş alanları bir kez tanıtın.';
    await yaz(s);
    return { durum: 'kurulum' };
  }
  alanlariDogrula(alanlar);
  if (!i?.kart) return { durum: 'hazir', alanlar };
  i.durum = 'alanlar';
  if (!m.firma) {
    await yaz(s);
    return { durum: 'bekle', alanlar };
  }
  if (m.firma !== i.kart.cariNumarasi) {
    bitir(i, 'hata', 'POS’taki cari numarası seçtiğiniz cariyle eşleşmiyor. Hiçbir kart alanı doldurulmadı.');
    await yaz(s);
    return ozet(i);
  }
  const kart = i.kart;
  delete i.kart; // Tek kullanımlık: teslimden önce kalıcı olmayan kuyruktan sil.
  i.durum = 'teslim';
  i.teslimSon = Date.now() + 5000;
  i.mesaj = 'Cari eşleşti; kart alanlarının doldurulma sonucu bekleniyor.';
  await yaz(s);
  return { durum: 'doldur', id: i.id, alanlar, kart };
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
    if (posSayfasi(url)) return pos(m, tab, url);
    throw new Error('Adres uygun değil.');
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
      if (i.kaynak === tab || i.hedef === tab)
        bitir(i, 'iptal', 'Sekme kapandı veya izinli siteden ayrıldı.');
    await yaz(dis ? s : s.filter((i) => i.kaynak !== tab));
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
