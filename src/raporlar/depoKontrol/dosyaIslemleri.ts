// Ekranın dosya ve kayıt işlemleri: dosyaları açıp tanıma, kaydetme, yedek, geçmiş.

import type { Ayarlar } from '../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../cekirdek/hata';
import { yilOf, type Tarih } from '../../cekirdek/tarih';
import { gunSec } from './gunSecimi';
import { dosyaTuru } from '../../kaynaklar/tani';
import {
  dosyaOku,
  dosyayaYaz,
  hedefiHatirla,
  indir,
  yazmaIzni,
  type SecilenDosya,
} from '../../platform/dosya';
import { gecmiseEkle, yedekAl } from '../../platform/gecmis';
import type { GunSecimi } from './gunSecimi';
import type { DepoKontrolPlani } from './hesapla';
import { motorYukle } from './motorYukle';
import type { HedefDosya, KaynakTuru, Oturum, YuklenenKaynak } from './oturum';

export async function hedefAc(
  d: SecilenDosya,
  ayarlar: Ayarlar,
  bugun: Tarih,
  signal?: AbortSignal,
  sonYil?: number,
): Promise<HedefDosya> {
  signal?.throwIfAborted();
  const motor = await motorYukle();
  signal?.throwIfAborted();
  const acik = await motor.kitapAc(d.bayt, d.ad);
  signal?.throwIfAborted();
  const bilgi = motor.hedefiIncele(acik, ayarlar, bugun, sonYil);
  signal?.throwIfAborted();
  if (d.tanitici) await hedefiHatirla(d.tanitici);
  return { ...d, acik, bilgi, ...(sonYil !== undefined ? { onayliSonYil: sonYil } : {}) };
}

export interface BirakmaSonucu {
  hedef: SecilenDosya | null;
  kaynaklar: Partial<Record<KaynakTuru, YuklenenKaynak>>;
  reddedilenler: Oturum['reddedilenler'];
}

/** Bırakılan dosyaları açar ve türünü içeriğinden anlar. Depo kontrol dosyası da aralarında olabilir. */
export async function dosyalariTani(
  dosyalar: { dosya: File; tanitici?: FileSystemFileHandle }[],
  ayarlar: Ayarlar,
  signal?: AbortSignal,
): Promise<BirakmaSonucu> {
  const motor = await motorYukle();
  signal?.throwIfAborted();
  if (dosyalar.length > 10 || dosyalar.reduce((n, d) => n + d.dosya.size, 0) > 100 * 1024 * 1024)
    throw new KullaniciHatasi('Bir seferde en fazla 10 dosya ve toplam 100 MB seçin.');
  const sonuc: BirakmaSonucu = { hedef: null, kaynaklar: {}, reddedilenler: [] };
  for (const { dosya, tanitici } of dosyalar) {
    signal?.throwIfAborted();
    try {
      if (!/\.xlsx$/i.test(dosya.name)) {
        throw new KullaniciHatasi('Excel dosyası (.xlsx) değil.');
      }
      const okunan = await dosyaOku(dosya, tanitici);
      signal?.throwIfAborted();
      const { kitap } = await motor.kitapAc(okunan.bayt, okunan.ad);
      signal?.throwIfAborted();
      const tur = dosyaTuru(kitap, ayarlar);
      if ((tur === 'depoKontrol' && sonuc.hedef) || (tur && tur !== 'depoKontrol' && sonuc.kaynaklar[tur]))
        throw new KullaniciHatasi(
          'Aynı türden iki dosya bırakıldı. İlk dosya korundu; değiştirmek istediğiniz dosyayı tek başına bırakın.',
        );
      if (tur === 'depoKontrol') sonuc.hedef = okunan;
      else if (tur) sonuc.kaynaklar[tur] = { dosyaAdi: dosya.name, kitap, bayt: okunan.bayt };
      else throw new KullaniciHatasi('LED raporu ya da depo kontrol dosyası olarak tanınmadı.');
    } catch (e) {
      signal?.throwIfAborted();
      sonuc.reddedilenler.push({
        dosyaAdi: dosya.name,
        mesaj: e instanceof KullaniciHatasi ? e.message.replace(`${dosya.name} `, '') : 'Dosya okunamadı.',
      });
    }
  }
  return sonuc;
}

export interface KayitSonucu {
  sayfa: string;
  kayit: 'dosyaya' | 'indirildi';
  hedef: HedefDosya;
  yedekId: string | null;
  oncekiBayt: Uint8Array;
  ledDosyalari: { ad: string; bayt: Uint8Array }[];
  uyari: string | null;
}

/**
 * Planı dosyaya uygular. Önizlemedeki kitaba dokunulmaz: dosya baştan açılır, plan yeniden
 * önizlemedeki plan uygulanır ve yazılır. Dosyaya yazmadan önce yedek alınır.
 */
export async function kaydet(
  hedef: HedefDosya,
  secim: GunSecimi,
  plan: DepoKontrolPlani,
  ayarlar: Ayarlar,
  bugun: Tarih,
  kip: 'dosyaya' | 'indir',
  signal?: AbortSignal,
): Promise<KayitSonucu> {
  signal?.throwIfAborted();
  const motor = await motorYukle();
  signal?.throwIfAborted();

  if (kip === 'dosyaya') {
    if (!hedef.tanitici) throw new KullaniciHatasi('Bu tarayıcı dosyanın üzerine kaydedemiyor; indirin.');
    if (!(await yazmaIzni(hedef.tanitici)))
      throw new KullaniciHatasi('Dosyaya yazma izni verilmedi. Yeni dosya olarak indirebilirsiniz.');
    const disk = await hedef.tanitici.getFile();
    if (disk.lastModified !== hedef.sonDegisiklik) {
      throw new KullaniciHatasi(
        "Depo kontrol dosyası siz açtıktan sonra değişmiş (büyük olasılıkla Excel'de kaydedildi). " +
          'Üzerine yazıp o değişiklikleri kaybetmemek için dosyayı yeniden açın.',
      );
    }
  }

  const taze = await motor.kitapAc(hedef.bayt, hedef.ad);
  signal?.throwIfAborted();
  const kontrol = motor.hedefiIncele(taze, ayarlar, bugun, hedef.onayliSonYil);
  if (kontrol.yilKaynagi === 'tahmin')
    throw new KullaniciHatasi('Kaydetmeden önce depo kontrol dosyasının yılını kontrol edin.');
  const tazeSecim = gunSec(kontrol.gunler, secim.tarih);
  if (
    tazeSecim.ad !== secim.ad ||
    tazeSecim.tur !== secim.tur ||
    tazeSecim.onceki.ad !== secim.onceki.ad ||
    tazeSecim.onceki.tarih !== secim.onceki.tarih
  )
    throw new KullaniciHatasi('Dosyanın gün seçimi değişmiş. Dosyayı yeniden açıp raporu hazırlayın.');
  const sayfa = motor.uygula(taze, secim, plan, ayarlar);
  signal?.throwIfAborted();
  const bayt = await motor.kitapYaz(taze.excel);

  // Oluşan dosya tekrar açılabilir olmalı; bu kontrol indirme/yazmadan önce yapılır.
  const yeniHedef = await hedefAc(
    { ad: hedef.ad, bayt, sonDegisiklik: Date.now() },
    ayarlar,
    bugun,
    signal,
    yilOf(secim.tur === 'yeni' ? secim.tarih : kontrol.son.tarih),
  );
  signal?.throwIfAborted();
  let yenidenAcUyarisi: string | null = null;
  let yedekId: string | null = null;
  if (kip === 'dosyaya' && hedef.tanitici) {
    signal?.throwIfAborted();
    yedekId = await yedekAl(hedef.ad, hedef.bayt);
    if (!yedekId)
      throw new KullaniciHatasi(
        'Dosyanın yedeği tarayıcıya kaydedilemedi. Üzerine yazılmadı. Yeni dosya olarak indirin veya tarayıcıda site verisine izin verin.',
      );
    const sonDisk = await dosyaOku(await hedef.tanitici.getFile());
    if (sonDisk.bayt.length !== hedef.bayt.length || !sonDisk.bayt.every((b, i) => b === hedef.bayt[i]))
      throw new KullaniciHatasi('Depo kontrol dosyası işlem sırasında değişti. Yeniden açın.');
    signal?.throwIfAborted();
    await dosyayaYaz(hedef.tanitici, bayt, signal);
  } else {
    signal?.throwIfAborted();
    indir(bayt, hedef.ad);
  }

  if (hedef.tanitici && kip === 'dosyaya') {
    try {
      yeniHedef.sonDegisiklik = (await hedef.tanitici.getFile()).lastModified;
      yeniHedef.tanitici = hedef.tanitici;
    } catch {
      // Yazma tamamlandı; tekrar yazmayı öneren başarısızlık mesajı gösterilmez.
      yenidenAcUyarisi = 'Dosya kaydedildi fakat yeniden okunamadı. Sonraki işlem için dosyayı yeniden açın.';
    }
  }

  const gecmisYazildi = await gecmiseEkle({
    zaman: new Date().toISOString(),
    rapor: 'Günlük depo kontrol',
    dosya: hedef.ad,
    sayfa,
    durum: plan.genelDurum,
    ledStogu: plan.bToplam,
    depoSayimi: plan.dToplam,
    gelenMal: plan.gelenMal,
    uyariSayisi: plan.uyarilar.length,
    aciklama: [...plan.uyarilar, ...plan.notlar].join(' | '),
    kayit: kip === 'dosyaya' ? 'dosyaya' : 'indirildi',
    ...(yedekId ? { yedekId } : {}),
  });

  return {
    sayfa,
    kayit: kip === 'dosyaya' ? 'dosyaya' : 'indirildi',
    hedef: yeniHedef,
    yedekId,
    oncekiBayt: hedef.bayt,
    ledDosyalari: [],
    uyari: gecmisYazildi
      ? yenidenAcUyarisi
      : 'Dosya hazır ancak geçmiş bu tarayıcıda saklanamadı. Site verisi iznini kontrol edin.',
  };
}
