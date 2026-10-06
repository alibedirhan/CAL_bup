import { useIslem } from '../../bilesenler/useIslem';
// Günlük depo kontrol ekranının durumu ve eylemleri.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import {
  dosyalariTani,
  hedefAc,
  kaydet,
  type KayitSonucu,
} from '../../../raporlar/depoKontrol/dosyaIslemleri';

export type Mesgul = null | 'aciliyor' | 'okunuyor' | 'kaydediliyor';

export function useDepoKontrol(ayarlar: Ayarlar) {
  const islem = useIslem('depo-kontrol');
  const [oturum, gonder] = useReducer(azalt, BOS_OTURUM);
  const [motor, setMotor] = useState<Motor | null>(null);
  const [mesgul, setMesgul] = useState<Mesgul>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<KayitSonucu | null>(null);
  const [hatirlanan, setHatirlanan] = useState<FileSystemFileHandle | null>(null);
  const etkin = useRef(false);
  const oncekiAyar = useRef(ayarlar);
  const durdur = islem.durdur;
  useEffect(() => {
    if (oncekiAyar.current === ayarlar) return;
    oncekiAyar.current = ayarlar;
    durdur();
    gonder({ tur: 'ayarlarDegisti', pazarAtla: ayarlar.pazarAtla });
    setSonuc(null);
  }, [ayarlar, durdur]);
  const bugun = useMemo(() => tarihtenCevir(new Date()), []);

  useEffect(() => {
    let bagli = true;
    void hatirlananHedef().then((h) => {
      if (bagli) setHatirlanan(h);
    });
    return () => {
      bagli = false;
    };
  }, []);

  const gorunum = useMemo(
    () => turet(oturum, ayarlar, bugun, motor?.planla),
    [oturum, ayarlar, bugun, motor],
  );

  const calistir = async (tur: Exclude<Mesgul, null>, is: (signal: AbortSignal) => Promise<void>) => {
    if (etkin.current) return false;
    etkin.current = true;
    setMesgul(tur);
    setHata(null);
    const s = await islem.calistir(
      async (signal) => {
        await is(signal);
        signal.throwIfAborted();
        const m = await motorYukle();
        signal.throwIfAborted();
        setMotor(m);
      },
      tur === 'kaydediliyor' ? 'Rapor hazır. Sonuç bölümünü kontrol edin.' : '',
      tur === 'kaydediliyor',
    );
    etkin.current = false;
    if (!islem.uygulanabilir(s)) return false;
    setMesgul(null);
    if (s.durum !== 'tamam') setHata(s.mesaj);
    return s.durum === 'tamam';
  };

  const hedefYukle = useCallback(
    async (d: SecilenDosya, signal?: AbortSignal) => {
      const hedef = await hedefAc(d, ayarlar, bugun, signal);
      signal?.throwIfAborted();
      gonder({ tur: 'hedefYuklendi', hedef });
      setSonuc(null);
      if (d.tanitici) setHatirlanan(d.tanitici);
    },
    [ayarlar, bugun],
  );

  /** Kaydedilebilir dosya seçici (Chrome/Edge); yoksa false döner ve arayüz dosya girişini açar. */
  const hedefSec = async () => {
    let secildi = false;
    await calistir('aciliyor', async (signal) => {
      const d = await kaydedilebilirDosyaSec();
      if (d) {
        secildi = true;
        await hedefYukle(d, signal);
      }
    });
    return secildi;
  };

  const hatirlananiAc = async () => {
    if (!hatirlanan) return;
    await calistir('aciliyor', async (signal) => {
      if (!(await yazmaIzni(hatirlanan))) throw new KullaniciHatasi('Dosyaya erişim izni verilmedi.');
      signal.throwIfAborted();
      await hedefYukle(await dosyaOku(await hatirlanan.getFile(), hatirlanan), signal);
    });
  };

  const hatirlananiUnut = () =>
    calistir('aciliyor', async (signal) => {
      await hedefiUnut();
      signal.throwIfAborted();
      setHatirlanan(null);
    });

  /** Sürüklenip bırakılan ya da seçilen dosyalar. */
  const dosyalarGeldi = async (kaynak: DataTransfer | File[]) => {
    await calistir('okunuyor', async (signal) => {
      const dosyalar = Array.isArray(kaynak)
        ? kaynak.map((dosya) => ({ dosya }))
        : await birakilanDosyalar(kaynak);
      if (dosyalar.length === 0) return;
      const s = await dosyalariTani(dosyalar, ayarlar, signal);
      signal.throwIfAborted();
      if (s.hedef) await hedefYukle(s.hedef, signal);
      gonder({ tur: 'kaynaklarEklendi', kaynaklar: s.kaynaklar, reddedilenler: s.reddedilenler });
      if (Object.keys(s.kaynaklar).length > 0) setSonuc(null);
    });
  };

  const kaydetIste = async (kip: 'dosyaya' | 'indir') => {
    const { hedef } = oturum;
    const { secim, plan } = gorunum;
    if (!hedef || !secim || !plan || !gorunum.kaydedilebilir) return;
    await calistir('kaydediliyor', async (signal) => {
      const s = await kaydet(hedef, secim, plan, ayarlar, bugun, kip, signal);
      signal.throwIfAborted();
      gonder({ tur: 'kaydedildi', hedef: s.hedef });
      s.ledDosyalari = Object.values(oturum.kaynaklar).flatMap((k) =>
        k.bayt ? [{ ad: k.dosyaAdi, bayt: k.bayt }] : [],
      );
      setSonuc(s);
    });
  };

  const degistir = (e: Parameters<typeof azalt>[1]) => {
    if (etkin.current) return;
    setSonuc(null);
    gonder(e);
  };
  return {
    oturum,
    gorunum,
    mesgul,
    hata,
    islem,
    sonuc,
    hatirlanan,
    bugun,
    hataKapat: () => setHata(null),
    sonucKapat: () => setSonuc(null),
    driveHedefAc: async (d: SecilenDosya, disSignal?: AbortSignal) => {
      if (
        !(await calistir('aciliyor', (signal) =>
          hedefYukle(d, disSignal ? AbortSignal.any([disSignal, signal]) : signal),
        ))
      )
        throw new KullaniciHatasi('Depo kontrol dosyası açılamadı. Ekrandaki hata açıklamasına bakın.');
    },
    hedefSec,
    hatirlananiAc,
    hatirlananiUnut,
    dosyalarGeldi,
    hedefKaldir: () => degistir({ tur: 'hedefKaldirildi' }),
    tarihDegistir: (girdi: string) => degistir({ tur: 'tarihDegisti', girdi }),
    oneriyeDon: () => degistir({ tur: 'tarihDegisti', girdi: '' }),
    yilDegistir: (girdi: string) => degistir({ tur: 'yilDegisti', girdi }),
    yilOnayla: () => degistir({ tur: 'yilOnaylandi' }),
    mevcutOnayla: () => degistir({ tur: 'mevcutOnaylandi' }),
    tarihleriOnayla: (kaynaklar: readonly string[]) => {
      for (const kaynak of kaynaklar) degistir({ tur: 'tarihOnaylandi', kaynak });
    },
    kaynakKaldir: (kaynak: KaynakTuru) => degistir({ tur: 'kaynakKaldirildi', kaynak }),
    kaydetIste,
  };
}

export type DepoKontrol = ReturnType<typeof useDepoKontrol>;
