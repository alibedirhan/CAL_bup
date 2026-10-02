// Ekranın dosya ve kayıt işlemleri: dosyaları açıp tanıma, kaydetme, yedek, geçmiş.

import type { Ayarlar } from '../../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { Tarih } from '../../../cekirdek/tarih';
import { dosyaTuru } from '../../../kaynaklar/tani';
import {
  dosyaOku,
  dosyayaYaz,
  hedefiHatirla,
  indir,
  yazmaIzni,
  type SecilenDosya,
} from '../../../platform/dosya';
import { gecmiseEkle, yedekAl } from '../../../platform/gecmis';
import type { GunSecimi } from '../../../raporlar/depoKontrol/gunSecimi';
import type { DepoKontrolPlani } from '../../../raporlar/depoKontrol/hesapla';
import { motorYukle } from '../../../raporlar/depoKontrol/motorYukle';
import type { HedefDosya, KaynakTuru, Oturum, YuklenenKaynak } from '../../../raporlar/depoKontrol/oturum';

export async function hedefAc(d: SecilenDosya, ayarlar: Ayarlar, bugun: Tarih): Promise<HedefDosya> {
  const motor = await motorYukle();
  const acik = await motor.kitapAc(d.bayt, d.ad);
  const bilgi = motor.hedefiIncele(acik, ayarlar, bugun);
  if (d.tanitici) await hedefiHatirla(d.tanitici);
  return { ...d, acik, bilgi };
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
): Promise<BirakmaSonucu> {
  const motor = await motorYukle();
  const sonuc: BirakmaSonucu = { hedef: null, kaynaklar: {}, reddedilenler: [] };
  for (const { dosya, tanitici } of dosyalar) {
    try {
      if (!/\.xlsx$/i.test(dosya.name)) {
        throw new KullaniciHatasi('Excel dosyası (.xlsx) değil.');
      }
      const okunan = await dosyaOku(dosya, tanitici);
      const { kitap } = await motor.kitapAc(okunan.bayt, okunan.ad);
      const tur = dosyaTuru(kitap, ayarlar);
      if ((tur === 'depoKontrol' && sonuc.hedef) || (tur && tur !== 'depoKontrol' && sonuc.kaynaklar[tur]))
        throw new KullaniciHatasi(
          'Aynı türden iki dosya bırakıldı. İlk dosya korundu; değiştirmek istediğiniz dosyayı tek başına bırakın.',
        );
      if (tur === 'depoKontrol') sonuc.hedef = okunan;
      else if (tur) sonuc.kaynaklar[tur] = { dosyaAdi: dosya.name, kitap, bayt: okunan.bayt };
      else throw new KullaniciHatasi('LED raporu ya da depo kontrol dosyası olarak tanınmadı.');
    } catch (e) {
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
 * hesaplanır (aynı sonucu verir) ve yazılır. Dosyaya yazmadan önce yedek alınır.
 */
export async function kaydet(
  hedef: HedefDosya,
  secim: GunSecimi,
  plan: DepoKontrolPlani,
  ayarlar: Ayarlar,
  bugun: Tarih,
  kip: 'dosyaya' | 'indir',
): Promise<KayitSonucu> {
  const motor = await motorYukle();

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
  const sayfa = motor.uygula(taze, secim, plan, ayarlar);
  const bayt = await motor.kitapYaz(taze.excel);

  // Oluşan dosya tekrar açılabilir olmalı; bu kontrol indirme/yazmadan önce yapılır.
  const yeniHedef = await hedefAc({ ad: hedef.ad, bayt, sonDegisiklik: Date.now() }, ayarlar, bugun);
  let yenidenAcUyarisi: string | null = null;
  let yedekId: string | null = null;
  if (kip === 'dosyaya' && hedef.tanitici) {
    yedekId = await yedekAl(hedef.ad, hedef.bayt);
    if (!yedekId)
      throw new KullaniciHatasi(
        'Dosyanın yedeği tarayıcıya kaydedilemedi. Üzerine yazılmadı. Yeni dosya olarak indirin veya tarayıcıda site verisine izin verin.',
      );
    const sonDisk = await dosyaOku(await hedef.tanitici.getFile());
    if (sonDisk.bayt.length !== hedef.bayt.length || !sonDisk.bayt.every((b, i) => b === hedef.bayt[i]))
      throw new KullaniciHatasi('Depo kontrol dosyası işlem sırasında değişti. Yeniden açın.');
    await dosyayaYaz(hedef.tanitici, bayt);
  } else {
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
