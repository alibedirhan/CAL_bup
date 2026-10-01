// Ekranın dosya ve kayıt işlemleri: dosyaları açıp tanıma, kaydetme, yedek, geçmiş.

import type { Ayarlar } from '../../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { Tarih } from '../../../cekirdek/tarih';
import { dosyaTuru } from '../../../kaynaklar/tani';
import { dosyaOku, dosyayaYaz, hedefiHatirla, indir, type SecilenDosya } from '../../../platform/dosya';
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
      if (!/\.xls[xm]$/i.test(dosya.name)) {
        throw new KullaniciHatasi('Excel dosyası (.xlsx) değil.');
      }
      const okunan = await dosyaOku(dosya, tanitici);
      const { kitap } = await motor.kitapAc(okunan.bayt, okunan.ad);
      const tur = dosyaTuru(kitap, ayarlar);
      if (tur === 'depoKontrol') sonuc.hedef = okunan;
      else if (tur) sonuc.kaynaklar[tur] = { dosyaAdi: dosya.name, kitap };
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

  let yedekId: string | null = null;
  if (kip === 'dosyaya' && hedef.tanitici) {
    yedekId = await yedekAl(hedef.ad, hedef.bayt);
    await dosyayaYaz(hedef.tanitici, bayt);
  } else {
    indir(bayt, hedef.ad);
  }

  const sonDegisiklik =
    hedef.tanitici && kip === 'dosyaya' ? (await hedef.tanitici.getFile()).lastModified : Date.now();
  const yeniHedef = await hedefAc(
    {
      ad: hedef.ad,
      bayt,
      sonDegisiklik,
      ...(kip === 'dosyaya' && hedef.tanitici ? { tanitici: hedef.tanitici } : {}),
    },
    ayarlar,
    bugun,
  );

  await gecmiseEkle({
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

  return { sayfa, kayit: kip === 'dosyaya' ? 'dosyaya' : 'indirildi', hedef: yeniHedef, yedekId };
}
