import { useMemo, useState } from 'react';
import { harfKatla } from '../../../../cekirdek/musteriTakip/metin';
import { gecikmisBakiyeVar, kovaTonu } from '../../../../cekirdek/yaslandirma/kovalar';
import type { AracYaslandirmasi, YaslandirmaSonucu } from '../../../../cekirdek/yaslandirma/turler';
import { para, sayi } from '../karlilik/KarlilikTablosu';

type Sutun = 'arac' | 'musteri' | 'bakiye' | 'acik';
const SUTUNLAR: [Sutun, string][] = [
  ['arac', 'Araç No'],
  ['musteri', 'Müşteri Sayısı'],
  ['bakiye', 'Toplam Bakiye'],
  ['acik', 'Açık Hesap'],
];
const deger = (a: AracYaslandirmasi, s: Sutun) =>
  s === 'arac'
    ? Number(a.arac_no)
    : s === 'musteri'
      ? a.musteri_sayisi
      : s === 'bakiye'
        ? a.toplam_bakiye
        : a.acik_hesap;
export const TON_YAZISI = { uyari: 'Uyarı (29–56 gün)', kritik: 'Kritik (57+ gün)' } as const;

export function YaslandirmaOzetKartlari({ sonuc }: { sonuc: YaslandirmaSonucu }) {
  const o = sonuc.ozet;
  return (
    <dl className="musteri-ozet">
      <div>
        <dt>Araç</dt>
        <dd>{sayi(o.vehicle_count)}</dd>
      </div>
      <div>
        <dt>Müşteri</dt>
        <dd>{sayi(o.total_customers)}</dd>
      </div>
      <div>
        <dt>Toplam Bakiye</dt>
        <dd>{para(o.total_balance)}</dd>
      </div>
      <div>
        <dt>Açık Hesap</dt>
        <dd>{para(o.total_open_account)}</dd>
      </div>
    </dl>
  );
}

/** Masaüstü Analiz sekmesi: Araç Özeti (arama/sıralama/29+ süzgeci) ve Yaşlandırma Kovaları. */
export function AnalizPaneli({
  sonuc,
  mesgul,
  aktar,
  detayAc,
}: {
  sonuc: YaslandirmaSonucu;
  mesgul: boolean;
  aktar: (tur: 'excel' | 'gorunen', araclar?: string[]) => Promise<void>;
  detayAc: (aracNo: string) => void;
}) {
  const [bolum, setBolum] = useState<'arac' | 'kova'>('arac');
  const [arama, setArama] = useState('');
  const [gecikmis, setGecikmis] = useState(false);
  const [sira, setSira] = useState<{ sutun: Sutun; artan: boolean }>({ sutun: 'arac', artan: true });
  const araclar = useMemo(() => {
    const aranan = harfKatla(arama.trim());
    const s = sonuc.ozet.vehicles.filter(
      (a) =>
        (!aranan ||
          harfKatla(a.arac_no).includes(aranan) ||
          a.musteri_detaylari.some((m) => harfKatla(m.cari_unvan).includes(aranan))) &&
        (!gecikmis || gecikmisBakiyeVar(a.yaslanding_analizi)),
    );
    const yon = sira.artan ? 1 : -1;
    return s.sort(
      (a, b) => (deger(a, sira.sutun) - deger(b, sira.sutun)) * yon || Number(a.arac_no) - Number(b.arac_no),
    );
  }, [sonuc, arama, gecikmis, sira]);
  return (
    <section className="kart karlilik-sonuc" aria-labelledby="yaslandirma-sonuc">
      <div className="kart-ust">
        <h2 id="yaslandirma-sonuc">Yaşlandırma sonuçları</h2>
        <span className="rozet durum bilgi">
          {sonuc.ozet.vehicle_count ? 'Analiz tamamlandı' : 'Araç bulunamadı'}
        </span>
      </div>
      <YaslandirmaOzetKartlari sonuc={sonuc} />
      <div className="suzgecler" aria-label="Analiz tabloları">
        <button className="suzgec" aria-pressed={bolum === 'arac'} onClick={() => setBolum('arac')}>
          Araç Özeti
        </button>
        <button className="suzgec" aria-pressed={bolum === 'kova'} onClick={() => setBolum('kova')}>
          Yaşlandırma Kovaları
        </button>
      </div>
      {bolum === 'arac' ? (
        <>
          <div className="musteri-tablo-araclari">
            <label>
              Araç no veya cari ara
              <input
                type="search"
                className="girdi"
                value={arama}
                maxLength={120}
                onChange={(e) => setArama(e.target.value)}
              />
            </label>
          </div>
          <div className="satir-dugmeleri">
            <label>
              <input type="checkbox" checked={gecikmis} onChange={(e) => setGecikmis(e.target.checked)} />{' '}
              Sadece 29+ gün bakiyesi olan araçlar
            </label>
          </div>
          <div className="tablo-kap" tabIndex={0} aria-label="Araç özeti kaydırma alanı">
            <table className="tablo" aria-label="Araç bazlı yaşlandırma özeti">
              <thead>
                <tr>
                  {SUTUNLAR.map(([s, ad]) => (
                    <th
                      scope="col"
                      key={s}
                      aria-sort={sira.sutun === s ? (sira.artan ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        className="tablo-siralama"
                        onClick={() => setSira((o) => ({ sutun: s, artan: o.sutun === s ? !o.artan : true }))}
                      >
                        {ad}
                        <span aria-hidden="true">{sira.sutun === s ? (sira.artan ? ' ▲' : ' ▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {araclar.length ? (
                  araclar.map((a) => (
                    <tr key={a.arac_no}>
                      <td>
                        <button
                          className="yas-arac-dugme"
                          aria-label={`Araç ${a.arac_no} detayını aç`}
                          onClick={() => detayAc(a.arac_no)}
                        >
                          {a.arac_no}
                        </button>
                      </td>
                      <td className="sayi">{sayi(a.musteri_sayisi)}</td>
                      <td className="sayi">{para(a.toplam_bakiye)}</td>
                      <td className="sayi">{para(a.acik_hesap)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="bos-satir">
                      {sonuc.ozet.vehicle_count
                        ? 'Aramanıza ve süzgece uyan araç yok.'
                        : 'Raporda araç kategorisi bulunamadı. Depo/merkez satırları araç sayılmaz.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="ipucu">
            {sayi(araclar.length)} / {sayi(sonuc.ozet.vehicle_count)} araç. Araç no ile ilişkili cari
            adlarında da aranır. Sütun başlığına basarak sıralayın.
          </p>
        </>
      ) : (
        <>
          <p className="ipucu">
            Tüm araçların vade kovası toplamları; 29–56 gün uyarı, 57+ gün kritik olarak gösterilir.
          </p>
          <div className="tablo-kap" tabIndex={0} aria-label="Kova tablosu kaydırma alanı">
            <table className="tablo" aria-label="Yaşlandırma kovası toplamları">
              <thead>
                <tr>
                  <th scope="col">Vade Kovası</th>
                  <th scope="col">Toplam Bakiye</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sonuc.raporlar.kovalar.length ? (
                  sonuc.raporlar.kovalar.map(([kova, tutar]) => {
                    const ton = kovaTonu(kova, tutar);
                    return (
                      <tr key={kova} className={ton ? `yas-${ton}` : undefined}>
                        <td>{kova}</td>
                        <td className="sayi">{para(tutar)}</td>
                        <td>{ton ? TON_YAZISI[ton] : '—'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="bos-satir">
                      Kova toplamı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="ipucu">
        Excel tam analizi (Araç Özeti ve Yaşlandırma Kovaları) içerir; Görünenler etkin arama, süzgeç ve
        sıralamayı kullanır.
      </p>
      <div className="satir-dugmeleri">
        <button className="dugme birincil" disabled={mesgul} onClick={() => void aktar('excel')}>
          Excel’e aktar
        </button>
        <button
          className="dugme"
          disabled={mesgul || bolum !== 'arac' || !araclar.length}
          onClick={() =>
            void aktar(
              'gorunen',
              araclar.map((a) => a.arac_no),
            )
          }
        >
          Görünenleri Excel’e aktar ({bolum === 'arac' ? araclar.length : 0})
        </button>
      </div>
    </section>
  );
}
