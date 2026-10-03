import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { cariKaydet, numaraMaskesi, type PosCari } from '../../../cekirdek/posCari';
import { indir } from '../../../platform/dosya';
import { EN_BUYUK_POS_YEDEK } from '../../../platform/posSifreleme';
import { Mesaj } from '../../bilesenler/Mesaj';
import { SayfaBasligi } from '../../bilesenler/SayfaBasligi';
import { Simge } from '../../bilesenler/Simge';
import { CariFormu } from './CariFormu';
import { KasaBakimi } from './KasaBakimi';
import { KasaKilidi } from './KasaKilidi';
import { PosGirisYardimi } from './PosGirisYardimi';
import { usePosKasasi } from './usePosKasasi';

type Oturum = ReturnType<typeof usePosKasasi>;

function AcikKasa({ oturum }: { oturum: Oturum }) {
  const { kasa, veri, mesgul, calistir, setHata, setBilgi, kilitle } = oturum;
  const [arama, setArama] = useState('');
  const { seciliId: secili, setSeciliId: setSecili } = oturum;
  const [form, setForm] = useState<{ cari: PosCari | null } | null>(null);
  const cariler = veri?.cariler ?? [];
  const cari = cariler.find((c) => c.id === secili);

  const izin = () => {
    if (mesgul) return false;
    try {
      kasa.etkinlik();
      return true;
    } catch {
      kilitle();
      return false;
    }
  };

  const kaydet = async (c: PosCari) => {
    if (!izin()) return false;
    try {
      const yeni = cariKaydet(cariler, c);
      const tamam = await calistir(() => kasa.kaydet(yeni), 'Cari kaydedildi.');
      if (tamam) setSecili(c.id);
      return tamam;
    } catch (e) {
      setHata(e instanceof KullaniciHatasi ? e.message : 'Cari kaydedilemedi.');
      return false;
    }
  };

  const sil = (c: PosCari) => {
    if (!izin() || !window.confirm(`“${c.ad}” cari kaydı silinsin mi? POS’taki hesap etkilenmez.`)) return;
    void calistir(() => kasa.kaydet(cariler.filter((s) => s.id !== c.id)), 'Cari kaydı silindi.').then(
      (tamam) => {
        if (tamam) {
          setSecili(null);
          setForm(null);
        }
      },
    );
  };

  const gorunen = cariler.filter((c) =>
    c.ad.toLocaleLowerCase('tr-TR').includes(arama.trim().toLocaleLowerCase('tr-TR')),
  );

  return (
    <>
      <div className="pos-yerlesim">
        <section className="kart" aria-labelledby="pos-cariler-baslik">
          <div className="kart-ust">
            <h2 id="pos-cariler-baslik">
              Cariler <span className="rozet">{cariler.length}</span>
            </h2>
            <button
              className="dugme kucuk"
              type="button"
              disabled={mesgul}
              onClick={() => {
                if (izin()) {
                  setSecili(null);
                  setForm({ cari: null });
                }
              }}
            >
              Yeni cari
            </button>
          </div>
          <label className="gorunmez" htmlFor="pos-cari-ara">
            Cari adına göre ara
          </label>
          <input
            className="girdi"
            id="pos-cari-ara"
            type="search"
            autoComplete="off"
            maxLength={120}
            placeholder="Cari adına göre ara…"
            value={arama}
            disabled={mesgul}
            onChange={(e) => setArama(e.target.value)}
          />
          {gorunen.length === 0 ? (
            <p>
              {cariler.length === 0
                ? 'Henüz cari yok. “Yeni cari” ile adını ve numarasını kaydedin.'
                : 'Bu adla cari bulunamadı.'}
            </p>
          ) : (
            <ul className="pos-cari-listesi">
              {gorunen.map((c) => (
                <li key={c.id}>
                  <button
                    className="pos-cari"
                    type="button"
                    aria-pressed={secili === c.id}
                    disabled={mesgul}
                    onClick={() => {
                      if (izin()) {
                        setSecili(c.id);
                        setForm(null);
                      }
                    }}
                  >
                    <b>{c.ad}</b>
                    <span className="rakam">{numaraMaskesi(c.numara)}</span>
                  </button>
                  <button
                    className="dugme kucuk"
                    type="button"
                    aria-label={`${c.ad} kaydını düzenle`}
                    disabled={mesgul}
                    onClick={() => {
                      if (izin()) {
                        setSecili(null);
                        setForm({ cari: c });
                      }
                    }}
                  >
                    Düzenle
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {form ? (
          <div className="pos-form-alani">
            <CariFormu
              key={form.cari?.id ?? 'yeni'}
              cari={form.cari}
              mesgul={mesgul}
              kaydet={kaydet}
              vazgec={() => setForm(null)}
            />
            {form.cari && (
              <button
                className="dugme hayalet"
                type="button"
                disabled={mesgul}
                onClick={() => {
                  if (form.cari) sil(form.cari);
                }}
              >
                Bu cari kaydını sil
              </button>
            )}
          </div>
        ) : cari ? (
          <PosGirisYardimi
            key={`${cari.id}-${cari.numara}`}
            cari={cari}
            izin={izin}
            bildir={(m, h) => {
              if (h) {
                setHata(m);
                setBilgi('');
              } else {
                setBilgi(m);
                setHata('');
              }
            }}
          />
        ) : (
          <div className="bos">
            <Simge ad="kart" boyut={32} />
            <h2>İşlem yapacağınız cariyi seçin</h2>
            <p>Giriş bilgilerini hazırlayın, POS’ta firma adını doğrulayın ve ödemeyi orada tamamlayın.</p>
          </div>
        )}
      </div>
      <KasaBakimi
        mesgul={mesgul}
        yedekIndir={(parola) => {
          if (!izin() || !veri) return Promise.resolve(false);
          return calistir(
            async () => {
              const yedek = await kasa.yedekle(parola);
              indir(
                yedek,
                `CAL-bup-cari-yedegi-${new Date().toISOString().slice(0, 10)}.calpos`,
                'application/octet-stream',
              );
              return veri;
            },
            'Taşınabilir şifreli yedek hazırlandı. Yedek dosyasını ve uzun yedek parolasını ayrı saklayın.',
            false,
          );
        }}
        yedekEkle={(dosya, parola) =>
          calistir(async () => {
            if (dosya.size > EN_BUYUK_POS_YEDEK)
              throw new KullaniciHatasi('Cari yedeği en fazla 256 KB olabilir.');
            return kasa.yedektenEkle(new Uint8Array(await dosya.arrayBuffer()), parola);
          }, 'Yedekteki cariler eklendi. Mevcut kayıtlar korundu.')
        }
        parolaDegistir={(parola) =>
          calistir(
            () => kasa.parolaDegistir(parola),
            'Kasa parolası değiştirildi. Yeni bir şifreli yedek indirin.',
          )
        }
      />
    </>
  );
}

export function SanalPosSayfasi() {
  const oturum = usePosKasasi();
  const {
    veri,
    varMi,
    mesgul,
    hata,
    bilgi,
    kasa,
    calistir,
    kilitle,
    yukleniyor,
    kontrol,
    asama,
    asamayiBildir,
  } = oturum;
  const hataKutusu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hata) hataKutusu.current?.focus();
  }, [hata]);
  return (
    <>
      <div className="kart-ust">
        <SayfaBasligi ust="İşlemler" baslik="Sanal POS">
          Carilerinizi elle kaydedin, giriş bilgilerini hazırlayın ve POS’ta işleminizi tamamlayın.
        </SayfaBasligi>
        {veri && (
          <button className="dugme" type="button" onClick={kilitle}>
            <Simge ad="kilit" />
            Kasayı kilitle
          </button>
        )}
      </div>
      {veri && (
        <p className="ipucu">
          Kasa 30 dakika kullanılmayınca kilitlenir. Açık POS sekmesi etkilenmez; kasayı yeniden açınca
          seçtiğiniz cari geri gelir.
        </p>
      )}
      <Mesaj ton="bilgi">
        Kart numarası, kart fotoğrafı, CVV ve banka şifresi bu bölümde alınmaz. Cari listesi Drive’a
        gönderilmez.
      </Mesaj>
      {hata && (
        <div ref={hataKutusu} tabIndex={-1}>
          <Mesaj
            ton="hata"
            eylem={
              !veri && (
                <button
                  className="dugme"
                  type="button"
                  disabled={mesgul || yukleniyor}
                  onClick={() => void kontrol()}
                >
                  Kasa durumunu yeniden kontrol et
                </button>
              )
            }
          >
            {hata}
          </Mesaj>
        </div>
      )}
      {bilgi && <Mesaj ton="bilgi">{bilgi}</Mesaj>}
      {mesgul && (
        <Mesaj
          ton="bilgi"
          eylem={
            <button className="dugme" type="button" onClick={kilitle}>
              İşlemi durdur
            </button>
          }
        >
          {asama}
        </Mesaj>
      )}
      {veri ? (
        <AcikKasa oturum={oturum} />
      ) : yukleniyor || varMi === null ? (
        yukleniyor && <p role="status">Cari deposu kontrol ediliyor…</p>
      ) : (
        <KasaKilidi
          varMi={varMi}
          mesgul={mesgul}
          ac={(p) => calistir(() => kasa.ac(p, !varMi, asamayiBildir), 'Cari kasası açıldı.', !varMi)}
        />
      )}
    </>
  );
}
