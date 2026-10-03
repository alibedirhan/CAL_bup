import { useRef, useState, useEffect } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { numaraMaskesi, type PosCari } from '../../../cekirdek/posCari';
import {
  profilCariKaydet,
  profilCariSil,
  profilKartKaydet,
  profilKartSil,
  type PosProfilVerisi,
} from '../../../cekirdek/posProfil';
import { indir } from '../../../platform/dosya';
import { Mesaj } from '../../bilesenler/Mesaj';
import { SayfaBasligi } from '../../bilesenler/SayfaBasligi';
import { CariFormu } from './CariFormu';
import { CariProfili } from './CariProfili';
import { EskiKasaGecisi } from './EskiKasaGecisi';
import { ProfilYedegi } from './ProfilYedegi';
import { usePosProfili } from './usePosProfili';

type Oturum = ReturnType<typeof usePosProfili>;
function AcikProfil({ oturum }: { oturum: Oturum }) {
  const { depo, veri, mesgul, calistir, seciliId, setSeciliId, gizlilikNo, veriNo, bildir } = oturum;
  const [arama, setArama] = useState('');
  const [form, setForm] = useState<{ cari: PosCari | null; no: number } | null>(null);
  if (!veri) return null;
  const cariler = veri.cariler;
  const cari = cariler.find((c) => c.id === seciliId);
  const gorunen = cariler.filter((c) =>
    c.ad.toLocaleLowerCase('tr-TR').includes(arama.trim().toLocaleLowerCase('tr-TR')),
  );
  const guncelle = async (is: () => PosProfilVerisi, mesaj: string) => {
    if (mesgul) return false;
    try {
      return await calistir(() => depo.kaydet(is()), mesaj);
    } catch (e) {
      bildir(e instanceof KullaniciHatasi ? e.message : 'Bilgileri kontrol edin.', true);
      return false;
    }
  };
  const acikForm = form?.no === gizlilikNo ? form : null;
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
                setSeciliId(null);
                setForm({ cari: null, no: gizlilikNo });
              }}
            >
              Yeni cari
            </button>
          </div>
          <label className="gorunmez" htmlFor="pos-cari-ara">
            Cari adına göre ara
          </label>
          <input
            id="pos-cari-ara"
            className="girdi"
            type="search"
            autoComplete="off"
            maxLength={120}
            placeholder="Cari adına göre ara…"
            value={arama}
            disabled={mesgul}
            onChange={(e) => setArama(e.target.value)}
          />
          {!gorunen.length ? (
            <p>
              {cariler.length
                ? 'Bu adla cari bulunamadı.'
                : 'Henüz cari yok. “Yeni cari” ile adını ve numarasını kaydedin.'}
            </p>
          ) : (
            <ul className="pos-cari-listesi">
              {gorunen.map((c) => (
                <li key={c.id}>
                  <button
                    className="pos-cari"
                    type="button"
                    aria-pressed={c.id === seciliId}
                    disabled={mesgul}
                    onClick={() => {
                      setSeciliId(c.id);
                      setForm(null);
                    }}
                  >
                    <b>{c.ad}</b>
                    <span className="rakam">{numaraMaskesi(c.numara)}</span>
                    <span>{veri.kartlar.filter((k) => k.cariId === c.id).length} kayıtlı kart</span>
                  </button>
                  <button
                    className="dugme kucuk"
                    type="button"
                    disabled={mesgul}
                    aria-label={`${c.ad} kaydını düzenle`}
                    onClick={() => {
                      setSeciliId(c.id);
                      setForm({ cari: c, no: gizlilikNo });
                    }}
                  >
                    Düzenle
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {acikForm ? (
          <div className="pos-form-alani">
            <CariFormu
              key={acikForm.cari?.id ?? 'yeni'}
              cari={acikForm.cari}
              mesgul={mesgul}
              vazgec={() => setForm(null)}
              kaydet={async (c) => {
                const tamam = await guncelle(
                  () => profilCariKaydet(veri, c),
                  'Cari kaydedildi. Kartlarını profiline ekleyebilirsiniz.',
                );
                if (tamam) {
                  setSeciliId(c.id);
                  setForm(null);
                }
                return tamam;
              }}
            />
            {acikForm.cari && (
              <button
                className="dugme hayalet"
                type="button"
                disabled={mesgul}
                onClick={() => {
                  const c = acikForm.cari;
                  if (!c) return;
                  const sayi = veri.kartlar.filter((k) => k.cariId === c.id).length;
                  if (
                    !window.confirm(
                      `“${c.ad}” ve ona bağlı ${sayi} kart silinsin mi? POS’taki hesap etkilenmez.`,
                    )
                  )
                    return;
                  void guncelle(() => profilCariSil(veri, c.id), 'Cari ve bağlı kartları silindi.').then(
                    (tamam) => {
                      if (tamam) {
                        setSeciliId(null);
                        setForm(null);
                      }
                    },
                  );
                }}
              >
                Bu cari ve bağlı kartlarını sil
              </button>
            )}
          </div>
        ) : cari ? (
          <CariProfili
            key={`${cari.id}-${cari.numara}-${veriNo}`}
            cari={cari}
            kartlar={veri.kartlar.filter((k) => k.cariId === cari.id)}
            gizlilikNo={gizlilikNo}
            mesgul={mesgul}
            bildir={bildir}
            duzenle={() => setForm({ cari, no: gizlilikNo })}
            kartKaydet={(k) =>
              guncelle(() => profilKartKaydet(veri, k), 'Kart bu carinin profiline kaydedildi.')
            }
            kartSil={(k) =>
              guncelle(() => profilKartSil(veri, cari.id, k.id), 'Kart bu carinin profilinden silindi.')
            }
          />
        ) : (
          <div className="bos">
            <h2>İşlem yapacağınız cariyi seçin</h2>
            <p>Cariyi seçince kayıtlı kartları ve “Kart ekle” bölümü görünür.</p>
          </div>
        )}
      </div>
      <ProfilYedegi
        key={gizlilikNo}
        mesgul={mesgul}
        ekle={(gelen) => calistir(() => depo.yedektenEkle(gelen), 'Yedekteki cari ve kartlar eklendi.')}
        indir={async (parola) => {
          if (mesgul) return false;
          return oturum.dosyaCalistir(
            () => depo.yedekle(parola),
            (b) =>
              indir(
                b,
                `CAL-bup-profil-yedegi-${new Date().toISOString().slice(0, 10)}.calpos`,
                'application/octet-stream',
              ),
            'Şifreli cari ve kart yedeği indirildi. Yedek parolasını ayrı saklayın.',
          );
        }}
      />
    </>
  );
}
export function SanalPosSayfasi() {
  const oturum = usePosProfili();
  const hataKutusu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (oturum.hata) hataKutusu.current?.focus();
  }, [oturum.hata]);
  return (
    <>
      <SayfaBasligi ust="İşlemler" baslik="Sanal POS">
        Carinizi seçin, kartını hazırlayın ve tutarı POS’ta kendiniz girin.
      </SayfaBasligi>
      <Mesaj ton="bilgi">
        Cari ve kart bilgileri bu tarayıcıda şifreli tutulur. Günlük PIN sorulmaz; bu tarayıcıyı kullanan
        kişiler kayıtlara erişebilir. CVV ve banka doğrulama kodları kaydedilmez.
      </Mesaj>
      {oturum.hata && (
        <div ref={hataKutusu} tabIndex={-1}>
          <Mesaj ton="hata">{oturum.hata}</Mesaj>
        </div>
      )}
      {oturum.bilgi && <Mesaj ton="bilgi">{oturum.bilgi}</Mesaj>}
      {(oturum.yukleniyor || oturum.mesgul) && (
        <Mesaj
          ton="bilgi"
          eylem={
            <button className="dugme" type="button" onClick={oturum.durdur}>
              İşlemi durdur
            </button>
          }
        >
          {oturum.yukleniyor ? 'Cari ve kart profili açılıyor…' : 'Şifreli profil işlemi yürütülüyor…'}
        </Mesaj>
      )}
      {!oturum.yukleniyor &&
        (oturum.eski && !oturum.veri ? (
          <EskiKasaGecisi
            key={oturum.gizlilikNo}
            mesgul={oturum.mesgul}
            tasi={(p) =>
              oturum.calistir(
                () => oturum.depo.eskiKasayiTasi(p),
                'Carileriniz taşındı. Artık günlük PIN gerekmiyor.',
              )
            }
            yedekle={(eski, p) =>
              oturum.dosyaCalistir(
                () => oturum.depo.eskiYedekle(eski, p),
                (b) => indir(b, 'CAL-bup-eski-cari-yedegi.calpos', 'application/octet-stream'),
                'Eski cari listenizin şifreli yedeği indirildi. Geçişe devam edebilirsiniz.',
              )
            }
          />
        ) : oturum.veri ? (
          <AcikProfil oturum={oturum} />
        ) : (
          <button
            className="dugme"
            type="button"
            disabled={oturum.mesgul}
            onClick={() => {
              void oturum.kontrol();
            }}
          >
            Profil durumunu yeniden kontrol et
          </button>
        ))}
    </>
  );
}
