import { useEffect, useState } from 'react';
import { sayiMetni } from '../../cekirdek/sayi';
import { indir } from '../../platform/dosya';
import {
  EN_FAZLA_YEDEK,
  gecmisCsv,
  gecmisDosyaAdi,
  gecmisListesi,
  yedekBaytlari,
  yedekListesi,
  type GecmisKaydi,
  type Yedek,
} from '../../platform/gecmis';
import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { Simge } from '../bilesenler/Simge';

const DURUM = { Tamam: 'tamam', Uyarı: 'uyari', Hata: 'hata' } as const;
const zaman = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function GecmisSayfasi() {
  const [kayitlar, setKayitlar] = useState<GecmisKaydi[] | null>(null);
  const [yedekler, setYedekler] = useState<Omit<Yedek, 'bayt'>[]>([]);

  useEffect(() => {
    void gecmisListesi().then(setKayitlar);
    void yedekListesi().then(setYedekler);
  }, []);

  const csvIndir = () => {
    if (!kayitlar) return;
    const bayt = new TextEncoder().encode(gecmisCsv(kayitlar));
    indir(bayt, gecmisDosyaAdi());
  };

  const yedekIndir = async (y: Omit<Yedek, 'bayt'>) => {
    const bayt = await yedekBaytlari(y.id);
    if (bayt) indir(bayt, `YEDEK ${zaman(y.zaman).replace(/[.:]/g, '-')} ${y.dosyaAdi}`);
  };

  return (
    <>
      <SayfaBasligi ust="Kayıtlar" baslik="Geçmiş">
        Her kaydedilen rapor tarihi, toplamları ve kontrol sonucuyla burada listelenir. Kayıtlar bu
        bilgisayardaki tarayıcıda durur.
      </SayfaBasligi>

      {kayitlar && kayitlar.length === 0 ? (
        <div className="bos">
          <Simge ad="gecmis" boyut={28} />
          <h2>Henüz kayıt yok</h2>
          <p>İlk günlük depo kontrolünü kaydettiğinizde burada görünecek.</p>
        </div>
      ) : (
        <section className="kart" aria-labelledby="gecmis-baslik">
          <div className="kart-ust">
            <h2 id="gecmis-baslik">Çalıştırmalar</h2>
            <button type="button" className="dugme kucuk" onClick={csvIndir} disabled={!kayitlar?.length}>
              Excel için indir (CSV)
            </button>
          </div>
          <div className="tablo-kap">
            <table className="tablo">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Sayfa</th>
                  <th>Durum</th>
                  <th className="sayi">LED stoğu</th>
                  <th className="sayi">Depo sayımı</th>
                  <th className="sayi">Gelen mal</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {(kayitlar ?? []).map((k) => (
                  <tr key={k.zaman}>
                    <td className="rakam soluk">{zaman(k.zaman)}</td>
                    <td>
                      <b>{k.sayfa}</b>
                      <span className="hucre-alt">
                        {k.kayit === 'dosyaya' ? 'dosyaya kaydedildi' : 'indirildi'}
                      </span>
                    </td>
                    <td>
                      <span className={`rozet durum ${DURUM[k.durum]}`}>{k.durum}</span>
                    </td>
                    <td className="sayi">{sayiMetni(k.ledStogu)}</td>
                    <td className="sayi">{sayiMetni(k.depoSayimi)}</td>
                    <td className="sayi">{sayiMetni(k.gelenMal)}</td>
                    <td className="aciklama-hucresi">{k.aciklama || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="kart" aria-labelledby="yedek-baslik">
        <h2 id="yedek-baslik">Yedekler</h2>
        <p>
          Depo kontrol dosyasının üzerine her kaydetmeden önce dosyanın o anki hâli yedeklenir. Son{' '}
          {EN_FAZLA_YEDEK} yedek saklanır.
        </p>
        {yedekler.length === 0 ? (
          <p className="ipucu">Henüz yedek yok.</p>
        ) : (
          <ul className="yedek-listesi">
            {yedekler.map((y) => (
              <li key={y.id} className="dosya-satiri">
                <span className="dosya-simge">
                  <Simge ad="dosya" />
                </span>
                <div>
                  <b>{y.dosyaAdi}</b>
                  <span>{zaman(y.zaman)} öncesi</span>
                </div>
                <button type="button" className="dugme kucuk" onClick={() => void yedekIndir(y)}>
                  İndir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
