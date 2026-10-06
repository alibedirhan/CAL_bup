import { useState } from 'react';
import { kovaTonu } from '../../../../cekirdek/yaslandirma/kovalar';
import type { YaslandirmaSonucu } from '../../../../cekirdek/yaslandirma/turler';
import { para, sayi } from '../karlilik/KarlilikTablosu';
import { TON_YAZISI } from './AnalizPaneli';

const yuzde = (n: number) =>
  '%' + n.toLocaleString('tr', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Masaüstü “Araç Detayı”: seçilen aracın beş göstergesi ve en yüksek bakiyeli 10 müşterisi. */
export function AracDetayiPaneli({
  sonuc,
  aracNo,
  sec,
}: {
  sonuc: YaslandirmaSonucu;
  aracNo: string | null;
  sec: (aracNo: string) => void;
}) {
  const detaylar = sonuc.raporlar.detaylar;
  const d = detaylar.find((x) => x.arac_no === aracNo) ?? null;
  return (
    <section className="kart" aria-labelledby="yas-detay">
      <h2 id="yas-detay">Araç detayı</h2>
      {detaylar.length ? (
        <label className="yas-secim">
          Araç seçin
          <select className="girdi" value={d?.arac_no ?? ''} onChange={(e) => sec(e.target.value)}>
            <option value="" disabled>
              Araç seçin
            </option>
            {detaylar.map((x) => (
              <option key={x.arac_no} value={x.arac_no}>
                Araç {x.arac_no}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>Raporda araç bulunamadı.</p>
      )}
      {!d ? (
        detaylar.length > 0 && <p className="ipucu">Analiz sonucundaki bir aracı seçin.</p>
      ) : (
        <>
          <dl className="musteri-ozet yas-detay-ozet">
            {(
              [
                ['Müşteri Sayısı', sayi(d.musteri_sayisi)],
                ['Toplam Bakiye', para(d.toplam_bakiye)],
                ['Ort. Bakiye', para(d.ortalama_bakiye)],
                ['Max Bakiye', para(d.max_bakiye)],
                ['Min Bakiye', para(d.min_bakiye)],
              ] as const
            ).map(([ad, v]) => (
              <div key={ad}>
                <dt>{ad}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>En Yüksek Bakiyeli Müşteriler</h3>
          <div className="tablo-kap" tabIndex={0} aria-label="Müşteri tablosu kaydırma alanı">
            <table className="tablo" aria-label={`Araç ${d.arac_no} en yüksek bakiyeli müşteriler`}>
              <thead>
                <tr>
                  <th scope="col">Cari Ünvan</th>
                  <th scope="col">Toplam Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {d.top_customers.map((m, i) => (
                  <tr key={i}>
                    <td className="musteri-adi">{m.cari_unvan}</td>
                    <td className="sayi">{para(m.toplam_bakiye)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

const RAPORLAR = [
  ['ozet', 'Özet'],
  ['detay', 'Detaylı'],
  ['karsilastirma', 'Karşılaştırma'],
  ['yaslandirma', 'Yaşlandırma'],
] as const;
type RaporTuru = (typeof RAPORLAR)[number][0];
const SAYFA = 100;

function raporTablosu(rapor: RaporTuru, sonuc: YaslandirmaSonucu) {
  const r = sonuc.raporlar;
  let b: string[];
  let t: (string | number)[][];
  if (rapor === 'ozet') {
    b = ['Araç', 'Müşteri', 'Toplam Bakiye', 'Açık Hesap', 'Ort. Bakiye'];
    t = r.detaylar.map((d) => [
      `Araç ${d.arac_no}`,
      sayi(d.musteri_sayisi),
      para(d.toplam_bakiye),
      para(d.acik_hesap),
      para(d.ortalama_bakiye),
    ]);
  } else if (rapor === 'detay') {
    b = ['Araç', 'Cari Ünvan', 'Toplam Bakiye'];
    // Kaynak: araç sırası, her araçta bakiyeye göre azalan; eşitlikte kaynak sırası (kararlı sıralama).
    t = sonuc.ozet.vehicles.flatMap((a) =>
      [...a.musteri_detaylari]
        .sort((x, y) => y.toplam_bakiye - x.toplam_bakiye)
        .map((m) => [`Araç ${a.arac_no}`, m.cari_unvan, para(m.toplam_bakiye)]),
    );
  } else if (rapor === 'karsilastirma') {
    b = ['Araç', 'Sıra', 'Toplam Bakiye', 'Müşteri', 'Ort. Bakiye'];
    t = r.siralama.map((d, i) => [
      `Araç ${d.arac_no}`,
      String(i + 1),
      para(d.toplam_bakiye),
      sayi(d.musteri_sayisi),
      para(d.ortalama_bakiye),
    ]);
  } else {
    b = ['Vade Kovası', 'Toplam Bakiye', 'Pay'];
    const genel = r.kovalar.reduce((top, [, v]) => top + v, 0) || 1;
    t = r.kovalar.map(([k, v]) => [k, para(v), yuzde((v / genel) * 100)]);
  }
  return { basliklar: b, satirlar: t };
}

/** Masaüstü “Raporlar”: dört rapor, kaynak `vehicle_details`/`balance_ranking`/`bucket_totals` çıktısıyla. */
export function RaporlarPaneli({ sonuc }: { sonuc: YaslandirmaSonucu }) {
  const [rapor, setRapor] = useState<RaporTuru>('ozet');
  const [sayfa, setSayfa] = useState(0);
  const { basliklar, satirlar } = raporTablosu(rapor, sonuc);
  const son = Math.max(0, Math.ceil(satirlar.length / SAYFA) - 1),
    no = Math.min(sayfa, son);
  return (
    <section className="kart" aria-labelledby="yas-raporlar">
      <h2 id="yas-raporlar">Raporlar</h2>
      <div className="suzgecler" aria-label="Rapor seçimi">
        {RAPORLAR.map(([k, ad]) => (
          <button
            key={k}
            className="suzgec"
            aria-pressed={rapor === k}
            onClick={() => {
              setRapor(k);
              setSayfa(0);
            }}
          >
            {ad}
          </button>
        ))}
      </div>
      <div className="tablo-kap" tabIndex={0} aria-label="Rapor tablosu kaydırma alanı">
        <table className="tablo" aria-label={`${RAPORLAR.find(([k]) => k === rapor)?.[1] ?? ''} raporu`}>
          <thead>
            <tr>
              {basliklar.map((b) => (
                <th scope="col" key={b}>
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {satirlar.length ? (
              satirlar.slice(no * SAYFA, (no + 1) * SAYFA).map((s, i) => (
                <tr key={i}>
                  {s.map((h, j) => (
                    <td key={j} className={j === 0 || (rapor === 'detay' && j === 1) ? undefined : 'sayi'}>
                      {h}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={basliklar.length} className="bos-satir">
                  Raporda gösterilecek satır yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {son > 0 && (
        <div className="kart-ust">
          <p className="ipucu">
            {sayi(satirlar.length)} satır · Sayfa {no + 1} / {son + 1}
          </p>
          <div className="satir-dugmeleri">
            <button className="dugme kucuk" disabled={no === 0} onClick={() => setSayfa(no - 1)}>
              Önceki
            </button>
            <button className="dugme kucuk" disabled={no === son} onClick={() => setSayfa(no + 1)}>
              Sonraki
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Cubuklar({ baslik, veri, ton }: { baslik: string; veri: [string, number][]; ton?: boolean }) {
  const enBuyuk = Math.max(1, ...veri.map(([, v]) => Math.abs(v)));
  return (
    <figure className="yas-grafik">
      <figcaption>{baslik}</figcaption>
      {veri.length ? (
        <ul className="karlilik-cubuklar" aria-label={baslik}>
          {veri.map(([ad, v]) => {
            const t = ton ? kovaTonu(ad, v) : null;
            return (
              <li key={ad} title={`${ad}: ${para(v)}`}>
                <div>
                  <span>
                    {ad}
                    {t && <span className={`yas-etiket yas-${t}`}> · {TON_YAZISI[t]}</span>}
                  </span>
                  <strong>{para(v)}</strong>
                </div>
                <div className="karlilik-cubuk-iz" aria-hidden="true">
                  <span
                    className={v < 0 ? 'yas-cubuk-negatif' : undefined}
                    style={{ width: `${(Math.abs(v) / enBuyuk) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ipucu">Veri yok.</p>
      )}
    </figure>
  );
}

/** Masaüstü “Grafikler”: en yüksek bakiyeli 10 araç ve vade kovası dağılımı (tek seri, yazılı değerler). */
export function GrafiklerPaneli({ sonuc }: { sonuc: YaslandirmaSonucu }) {
  const araclar = [...sonuc.ozet.vehicles]
    .sort((a, b) => b.toplam_bakiye - a.toplam_bakiye)
    .slice(0, 10)
    .map((a): [string, number] => [`Araç ${a.arac_no}`, a.toplam_bakiye]);
  return (
    <section className="kart" aria-labelledby="yas-grafikler">
      <h2 id="yas-grafikler">Grafikler</h2>
      <p className="ipucu">Negatif bakiyeler soluk çubukla gösterilir; tutarlar her satırda yazılıdır.</p>
      <div className="yas-grafikler">
        <Cubuklar baslik="Araç Bazlı Bakiye (en yüksek 10)" veri={araclar} />
        <Cubuklar baslik="Vade Kovası Dağılımı" veri={sonuc.raporlar.kovalar} ton />
      </div>
    </section>
  );
}
