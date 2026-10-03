import { IslemOturumu } from '../../platform/islemOturumu';
import { useIslem } from '../bilesenler/useIslem';
import { IslemBildirimi } from '../bilesenler/IslemBildirimi';
import { FormHatasi } from '../bilesenler/FormHatasi';
import { Bildirim } from '../bilesenler/Bildirim';
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

  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const [yenileme, setYenileme] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const islem = useIslem('gecmis-indirme');
  const indiriliyor = islem.mesgul;
  useEffect(() => {
    let bagli = true;
    const o = new IslemOturumu('gecmis-okuma');
    void o
      .calistir(async (signal) => {
        const s = await Promise.all([gecmisListesi(true), yedekListesi(true)]);
        signal.throwIfAborted();
        return s;
      }, '')
      .then((s) => {
        if (!bagli) return;
        if (s.durum === 'tamam') {
          setKayitlar(s.deger[0]);
          setYedekler(s.deger[1]);
          setHata('');
        } else
          setHata(
            'Geçmiş ve yedekler açılamadı. Tarayıcının site verisi iznini kontrol edip yeniden deneyin.',
          );
        setYukleniyor(false);
      });
    return () => {
      bagli = false;
      o.kapat();
    };
  }, [yenileme]);

  const csvIndir = () => {
    if (!kayitlar) return;
    const bayt = new TextEncoder().encode(gecmisCsv(kayitlar));
    try {
      indir(bayt, gecmisDosyaAdi(), 'text/csv;charset=utf-8');
      setBilgi('Geçmiş indirmesi başlatıldı. Tarayıcının indirmelerini kontrol edin.');
    } catch {
      setHata('İndirme başlatılamadı. Yeniden deneyin.');
    }
  };

  const yedekIndir = (y: Omit<Yedek, 'bayt'>) =>
    islem.calistir(async (signal) => {
      const bayt = await yedekBaytlari(y.id, true);
      signal.throwIfAborted();
      if (bayt) indir(bayt, `YEDEK ${zaman(y.zaman).replace(/[.:]/g, '-')} ${y.dosyaAdi}`);
    }, 'Yedek indirmesi başlatıldı. Tarayıcının indirmelerini kontrol edin.');

  return (
    <>
      <SayfaBasligi ust="Kayıtlar" baslik="Geçmiş">
        Her kaydedilen rapor tarihi, toplamları ve kontrol sonucuyla burada listelenir. Kayıtlar bu
        bilgisayardaki tarayıcıda durur.
      </SayfaBasligi>

      <IslemBildirimi islem={islem} />
      <FormHatasi hata={hata} id="gecmis-hata" />
      {hata && (
        <button
          className="dugme"
          disabled={yukleniyor}
          onClick={() => {
            setYukleniyor(true);
            setYenileme((n) => n + 1);
          }}
        >
          Yeniden dene
        </button>
      )}
      <Bildirim mesaj={bilgi} />
      {yukleniyor && <p role="status">Geçmiş ve yedekler açılıyor…</p>}
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
                        {k.kayit === 'dosyaya' ? 'dosyaya kaydedildi' : 'indirme başlatıldı'}
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
        {!yukleniyor && !hata && yedekler.length === 0 ? (
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
                <button
                  type="button"
                  className="dugme kucuk"
                  disabled={indiriliyor}
                  onClick={() => void yedekIndir(y)}
                >
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
