import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  ggAaYyyy,
  gunSayfasiMi,
  sayfaAdi,
  sayfaTarihi,
  sayfaTarihiYilli,
  tarihtenCevir,
  yilOf,
  type Tarih,
} from '../../cekirdek/tarih';
import type { Sayfa } from '../../kaynaklar/kitap';
import type { GunSayfasi } from './gunSecimi';

function baslikTarihi(s: Sayfa): Tarih | null {
  const tarihler = [s.hucre(3, 1), s.hucre(3, 3)].flatMap((v) => {
    if (v instanceof Date && Number.isFinite(v.getTime())) return [tarihtenCevir(v)];
    const m = typeof v === 'string' ? /^\s*(\d{1,2}\.\d{1,2}\.\d{4})(?!\d)/.exec(v) : null;
    if (!m) return [];
    const t = ggAaYyyy(m[1] ?? '');
    return t ? [t] : [];
  });
  if (new Set(tarihler).size > 1 || tarihler.some((t) => sayfaTarihi(s.ad, yilOf(t)) !== t)) return null;
  return tarihler[0] ?? null;
}

/** Başlık yılı önceliklidir. Başlıksız yıllık kitapta son sayfanın yılı açıkça onaylanır. */
export function hedefTarihleri(
  sayfalar: readonly Sayfa[],
  bugun: Tarih,
  sonYil?: number,
): {
  gunler: GunSayfasi[];
  yilKaynagi: 'baslik' | 'onay' | 'tahmin';
} {
  const gunler = sayfalar.filter((s) => gunSayfasiMi(s.ad));
  const bilinen = gunler.map(baslikTarihi);
  const son = gunler.at(-1);
  if (!son) throw new KullaniciHatasi('Depo kontrol dosyasında gün sayfası bulunamadı.');
  if (sonYil !== undefined && (!Number.isInteger(sonYil) || sonYil < 1900 || sonYil > 9998))
    throw new KullaniciHatasi('Dosya yılı 1900–9998 arasında dört rakam olmalı.');
  const bilinenSira = bilinen.findLastIndex((t) => t !== null);
  // 29.02 içeren başlıksız eski dosya da açılabilsin; bu yalnızca onay bekleyen taslaktır.
  if (bilinenSira < 0 && sonYil === undefined) {
    const ilkYil = yilOf(sayfaTarihiYilli(son.ad, bugun) ?? bugun);
    let hata: unknown;
    for (let yil = ilkYil; yil >= ilkYil - 4; yil--) {
      try {
        const s = hedefTarihleri(sayfalar, bugun, yil);
        return { gunler: s.gunler, yilKaynagi: 'tahmin' as const };
      } catch (e) {
        hata = e;
      }
    }
    throw hata;
  }
  const dayanak = bilinenSira >= 0 && sonYil === undefined ? bilinenSira : gunler.length - 1;
  const dayanakTarihi =
    sonYil === undefined
      ? (bilinen[dayanak] ?? sayfaTarihiYilli(son.ad, bugun))
      : sayfaTarihi(son.ad, sonYil);
  if (!dayanakTarihi)
    throw new KullaniciHatasi(
      'Gün sayfasının tarihi seçilen yılda geçerli değil. Dosya yılını kontrol edin.',
    );
  const sonuc: GunSayfasi[] = new Array<GunSayfasi>(gunler.length);
  const ata = (i: number, yil: number) => {
    const ad = gunler[i]?.ad ?? '';
    const t = sayfaTarihi(ad, yil);
    if (!t) throw new KullaniciHatasi(`'${ad}' sayfasının tarihi bu yılda geçerli değil.`);
    if (i === gunler.length - 1 && bilinen[i] && bilinen[i] !== t)
      throw new KullaniciHatasi(
        `'${ad}' sayfasının başlık yılı diğer günlerle uyuşmuyor. Dosya yılını ve başlıkları Excel’de kontrol edin.`,
      );
    sonuc[i] = { ad, tarih: t };
    return t;
  };
  ata(dayanak, yilOf(dayanakTarihi));
  for (const yon of [-1, 1]) {
    let onceki = dayanakTarihi;
    for (let i = dayanak + yon; i >= 0 && i < gunler.length; i += yon) {
      let yil = yilOf(onceki);
      const ay = gunler[i]?.ad.trim().slice(3, 5);
      if (yon === -1 && onceki.slice(5, 7) === '01' && ay === '12') yil--;
      if (yon === 1 && onceki.slice(5, 7) === '12' && ay === '01') yil++;
      onceki = ata(i, yil);
    }
  }
  if (new Set(sonuc.map((g) => sayfaAdi(g.tarih))).size !== sonuc.length)
    throw new KullaniciHatasi(
      'Dosyada aynı günü gösteren birden fazla sayfa var. Yıllık dosyaları ayrı tutun.',
    );
  if (sonuc.some((g, i) => i > 0 && g.tarih <= (sonuc[i - 1]?.tarih ?? g.tarih)))
    throw new KullaniciHatasi(
      'Gün sayfalarının sırası tarihlerle uyuşmuyor. Excel’de gün sekmelerini eskiden yeniye sıralayıp yeniden açın.',
    );
  return {
    gunler: sonuc,
    yilKaynagi:
      sonYil !== undefined
        ? ('onay' as const)
        : bilinen.every((t, i) => t !== null && t === sonuc[i]?.tarih)
          ? ('baslik' as const)
          : ('tahmin' as const),
  };
}
