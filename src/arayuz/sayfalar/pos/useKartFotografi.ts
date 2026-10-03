import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import {
  DUZ_KART_GORUNTUSU,
  type KartGoruntuDuzeltmesi,
  type KartOkumaSonucu,
} from '../../../cekirdek/posKartFotografi';
import { kartFotografiniOku } from '../../../platform/posKartOkuma';
import { kartGoruntusu } from '../../../platform/ocr/goruntu';
import type { OkumaAsamasi } from '../../../platform/ocr/motor';
export function useKartFotografi(formNo: number, durum: (okunuyor: boolean) => void) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [duzeltme, setDuzeltme] = useState<KartGoruntuDuzeltmesi>(DUZ_KART_GORUNTUSU);
  const [onizleme, setOnizleme] = useState('');
  const [aday, setAday] = useState<{ sonuc: KartOkumaSonucu; formNo: number } | null>(null);
  const [bilgi, setBilgi] = useState('');
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [asama, setAsama] = useState<OkumaAsamasi>('denetim');
  const [yuzde, setYuzde] = useState(0);
  const iptal = useRef<AbortController | null>(null);
  const nesil = useRef(0);
  const url = useRef('');
  useEffect(
    () => () => {
      nesil.current++;
      iptal.current?.abort();
      URL.revokeObjectURL(url.current);
    },
    [],
  );
  const calistir = async (f: File, d: KartGoruntuDuzeltmesi, sadeceOnizleme = false) => {
    const n = ++nesil.current;
    iptal.current?.abort();
    const c = new AbortController();
    iptal.current = c;
    setAday(null);
    setHata('');
    setBilgi('');
    setMesgul(true);
    durum(true);
    setAsama('denetim');
    setYuzde(0);
    let canvas: HTMLCanvasElement | undefined;
    try {
      canvas = await kartGoruntusu(f, c.signal, d);
      const blob = await new Promise<Blob>((coz, reddet) =>
        canvas?.toBlob((b) => (b ? coz(b) : reddet(new KullaniciHatasi('Önizleme hazırlanamadı.')))),
      );
      if (n !== nesil.current || c.signal.aborted) return;
      URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      setOnizleme(url.current);
      canvas.width = 0;
      canvas.height = 0;
      canvas = undefined;
      if (sadeceOnizleme) {
        setBilgi('Önizleme güncellendi. Düzeltilmiş fotoğrafı yeniden okuyun.');
        return;
      }
      const sonuc = await kartFotografiniOku(
        f,
        c.signal,
        (p) => {
          if (n === nesil.current) setYuzde(p);
        },
        (a) => {
          if (n === nesil.current) setAsama(a);
        },
        d,
      );
      if (n !== nesil.current || c.signal.aborted) return;
      setAday({ sonuc, formNo });
      setBilgi(
        sonuc.numaralar.length || sonuc.tarihler.length
          ? 'Okuma tamamlandı. Bulunan alanları aşağıda fotoğrafla karşılaştırıp uygulayın.'
          : sonuc.gecersizNumara
            ? 'Rakamlar bulundu ancak kart numarası kontrolü geçmedi. Rakam tahmin edilmedi; daha yakın fotoğrafla veya elle devam edin.'
            : 'Numara veya tarih okunamadı. Kartı kırpıp döndürerek yeniden okuyabilir veya elle ekleyebilirsiniz.',
      );
    } catch (e) {
      if (n === nesil.current) {
        if (c.signal.aborted) setBilgi('Fotoğraf okuma durduruldu. Bilgileri elle ekleyebilirsiniz.');
        else setHata(e instanceof KullaniciHatasi ? e.message : 'Fotoğraf okunamadı. Elle devam edin.');
      }
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (n === nesil.current) {
        setMesgul(false);
        durum(false);
      }
    }
  };
  const sec = (f: File) => {
    URL.revokeObjectURL(url.current);
    url.current = '';
    setOnizleme('');
    setDosya(f);
    setDuzeltme(DUZ_KART_GORUNTUSU);
    void calistir(f, DUZ_KART_GORUNTUSU);
  };
  const duzelt = (d: KartGoruntuDuzeltmesi) => {
    setDuzeltme(d);
    if (dosya) void calistir(dosya, d, true);
  };
  const kaldir = () => {
    nesil.current++;
    iptal.current?.abort();
    URL.revokeObjectURL(url.current);
    url.current = '';
    setDosya(null);
    setOnizleme('');
    setAday(null);
    setHata('');
    setBilgi('Fotoğraf kaldırıldı.');
    setMesgul(false);
    durum(false);
  };
  return {
    dosya,
    duzeltme,
    onizleme,
    aday: aday?.formNo === formNo ? aday.sonuc : null,
    eskiAday: Boolean(aday && aday.formNo !== formNo),
    bilgi,
    hata,
    mesgul,
    asama,
    yuzde,
    sec,
    duzelt,
    kaldir,
    oku: () => {
      if (dosya) void calistir(dosya, duzeltme);
    },
    durdur: () => iptal.current?.abort(),
    uygulandi: () => {
      setAday(null);
      setBilgi('Seçtiğiniz alanlar forma aktarıldı. Kartı kaydetmeden önce tüm bilgileri kontrol edin.');
    },
  };
}
