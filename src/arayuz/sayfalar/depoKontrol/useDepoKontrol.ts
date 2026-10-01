// Günlük depo kontrol ekranının durumu ve eylemleri.

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Ayarlar } from '../../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { tarihtenCevir } from '../../../cekirdek/tarih';
import {
  birakilanDosyalar,
  dosyaOku,
  hatirlananHedef,
  hedefiUnut,
  kaydedilebilirDosyaSec,
  yazmaIzni,
  type SecilenDosya,
} from '../../../platform/dosya';
import { motorYukle, type Motor } from '../../../raporlar/depoKontrol/motorYukle';
import { azalt, BOS_OTURUM, turet, type KaynakTuru } from '../../../raporlar/depoKontrol/oturum';
import { dosyalariTani, hedefAc, kaydet, type KayitSonucu } from './islemler';

export type Mesgul = null | 'aciliyor' | 'okunuyor' | 'kaydediliyor';

function hataMetni(e: unknown): string {
  if (e instanceof KullaniciHatasi) return e.message;
  console.error(e);
  return 'Beklenmeyen bir hata oluştu. Sayfayı yenileyip yeniden deneyin.';
}

export function useDepoKontrol(ayarlar: Ayarlar) {
  const [oturum, gonder] = useReducer(azalt, BOS_OTURUM);
  const [motor, setMotor] = useState<Motor | null>(null);
  const [mesgul, setMesgul] = useState<Mesgul>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<KayitSonucu | null>(null);
  const [hatirlanan, setHatirlanan] = useState<FileSystemFileHandle | null>(null);
  const bugun = useMemo(() => tarihtenCevir(new Date()), []);

  useEffect(() => {
    void hatirlananHedef().then(setHatirlanan);
  }, []);

  const gorunum = useMemo(
    () => turet(oturum, ayarlar, bugun, motor?.planla),
    [oturum, ayarlar, bugun, motor],
  );

  const calistir = useCallback(async (tur: Exclude<Mesgul, null>, is: () => Promise<void>) => {
    setMesgul(tur);
    setHata(null);
    try {
      setMotor(await motorYukle());
      await is();
    } catch (e) {
      setHata(hataMetni(e));
    } finally {
      setMesgul(null);
    }
  }, []);

  const hedefYukle = useCallback(
    async (d: SecilenDosya) => {
      const hedef = await hedefAc(d, ayarlar, bugun);
      gonder({ tur: 'hedefYuklendi', hedef });
      setSonuc(null);
      if (d.tanitici) setHatirlanan(d.tanitici);
    },
    [ayarlar, bugun],
  );

  /** Kaydedilebilir dosya seçici (Chrome/Edge); yoksa false döner ve arayüz dosya girişini açar. */
  const hedefSec = useCallback(async () => {
    let secildi = false;
    await calistir('aciliyor', async () => {
      const d = await kaydedilebilirDosyaSec();
      if (d) {
        secildi = true;
        await hedefYukle(d);
      }
    });
    return secildi;
  }, [calistir, hedefYukle]);

  const hatirlananiAc = useCallback(async () => {
    if (!hatirlanan) return;
    await calistir('aciliyor', async () => {
      if (!(await yazmaIzni(hatirlanan))) throw new KullaniciHatasi('Dosyaya erişim izni verilmedi.');
      await hedefYukle(await dosyaOku(await hatirlanan.getFile(), hatirlanan));
    });
  }, [calistir, hatirlanan, hedefYukle]);

  const hatirlananiUnut = useCallback(async () => {
    await hedefiUnut();
    setHatirlanan(null);
  }, []);

  /** Sürüklenip bırakılan ya da seçilen dosyalar. */
  const dosyalarGeldi = useCallback(
    async (kaynak: DataTransfer | File[]) => {
      await calistir('okunuyor', async () => {
        const dosyalar = Array.isArray(kaynak)
          ? kaynak.map((dosya) => ({ dosya }))
          : await birakilanDosyalar(kaynak);
        if (dosyalar.length === 0) return;
        const s = await dosyalariTani(dosyalar, ayarlar);
        if (s.hedef) await hedefYukle(s.hedef);
        gonder({ tur: 'kaynaklarEklendi', kaynaklar: s.kaynaklar, reddedilenler: s.reddedilenler });
        if (Object.keys(s.kaynaklar).length > 0) setSonuc(null);
      });
    },
    [ayarlar, calistir, hedefYukle],
  );

  const kaydetIste = useCallback(
    async (kip: 'dosyaya' | 'indir') => {
      const { hedef } = oturum;
      const { secim, plan } = gorunum;
      if (!hedef || !secim || !plan) return;
      await calistir('kaydediliyor', async () => {
        const s = await kaydet(hedef, secim, plan, ayarlar, bugun, kip);
        gonder({ tur: 'kaydedildi', hedef: s.hedef });
        setSonuc(s);
      });
    },
    [ayarlar, bugun, calistir, gorunum, oturum],
  );

  return {
    oturum,
    gorunum,
    mesgul,
    hata,
    sonuc,
    hatirlanan,
    bugun,
    hataKapat: () => setHata(null),
    sonucKapat: () => setSonuc(null),
    hedefSec,
    hatirlananiAc,
    hatirlananiUnut,
    dosyalarGeldi,
    hedefKaldir: () => gonder({ tur: 'hedefKaldirildi' }),
    tarihDegistir: (girdi: string) => gonder({ tur: 'tarihDegisti', girdi }),
    mevcutOnayla: () => gonder({ tur: 'mevcutOnaylandi' }),
    tarihOnayla: (kaynak: string) => gonder({ tur: 'tarihOnaylandi', kaynak }),
    kaynakKaldir: (kaynak: KaynakTuru) => gonder({ tur: 'kaynakKaldirildi', kaynak }),
    kaydetIste,
  };
}

export type DepoKontrol = ReturnType<typeof useDepoKontrol>;
