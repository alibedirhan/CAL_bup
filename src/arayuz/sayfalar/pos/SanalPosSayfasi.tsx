import { basarisiz } from '../../../cekirdek/islemSonucu';
import { Bildirim } from '../../bilesenler/Bildirim';
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
import { Mesaj } from '../../bilesenler/Mesaj';
import { SayfaBasligi } from '../../bilesenler/SayfaBasligi';
import { CariFormu } from './CariFormu';
import { CariProfili } from './CariProfili';
import { EskiKasaGecisi } from './EskiKasaGecisi';
import { PosGuvenlik, PosKilidi } from './PosKilidi';
import { usePosProfili } from './usePosProfili';

type Oturum = ReturnType<typeof usePosProfili>;
function AcikProfil({ oturum }: { oturum: Oturum }) {
  const { depo, veri, mesgul, calistir, seciliId, setSeciliId, gizlilikNo, veriNo, bildir } = oturum;
  const [arama, setArama] = useState('');
  const [form, setForm] = useState<{ cari: PosCari | null } | null>(null);
  // Başka sekmede silinen carinin açık düzenleme formu kapatılır ve nedeni söylenir.
  const formCariSilindi = Boolean(veri && form?.cari && !veri.cariler.some((c) => c.id === form.cari?.id));
  if (!veri) return null;
  const cariler = veri.cariler;
  const cari = cariler.find((c) => c.id === seciliId);
  // Ada veya (en az 3 rakam yazılınca) vergi/TC numarasının bir kısmına göre arar.
  const aranan = arama.trim().toLocaleLowerCase('tr-TR');
  const rakamlar = /^[\d\s]+$/.test(aranan) ? aranan.replace(/\s/g, '') : '';
  const gorunen = cariler.filter(
    (c) =>
      c.ad.toLocaleLowerCase('tr-TR').includes(aranan) ||
      (rakamlar.length >= 3 && c.numara.includes(rakamlar)),
  );
  const guncelle = async (is: () => PosProfilVerisi, mesaj: string, yerel = false) => {
    if (mesgul)
      return basarisiz('dogrulama', 'Başka bir işlem sürüyor.', 'MESGUL', { kapsam: 'pos', islemId: veriNo });
    try {
      return await calistir(() => depo.kaydet(is()), mesaj, yerel);
    } catch (e) {
      if (!yerel) bildir(e instanceof KullaniciHatasi ? e.message : 'Bilgileri kontrol edin.', true);
      return basarisiz(
        'dogrulama',
        e instanceof KullaniciHatasi ? e.message : 'Bilgileri kontrol edin.',
        'DOGRULAMA',
        { kapsam: 'pos', islemId: veriNo },
      );
    }
  };
  const acikForm = formCariSilindi ? null : form;
  /** POS'taki hesaba dokunmaz; yalnız bu tarayıcıdaki cari kaydını ve bağlı kartları siler. */
  const cariyiSil = (c: PosCari) => {
    if (mesgul) return;
    const sayi = veri.kartlar.filter((k) => k.cariId === c.id).length;
    if (
      !window.confirm(
        sayi
          ? `“${c.ad}” ve ona bağlı ${sayi} kart silinsin mi? POS’taki hesap etkilenmez.`
          : `“${c.ad}” silinsin mi? POS’taki hesap etkilenmez.`,
      )
    )
      return;
    void guncelle(
      () => profilCariSil(veri, c.id),
      sayi ? 'Cari ve bağlı kartları silindi.' : 'Cari silindi.',
    ).then((tamam) => {
      if (tamam.durum === 'tamam') {
        setSeciliId(null);
        setForm(null);
      }
    });
  };
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
                setForm({ cari: null });
              }}
            >
              Yeni cari
            </button>
          </div>
          <label className="gorunmez" htmlFor="pos-cari-ara">
            Cari adına veya numarasına göre ara
          </label>
          <input
            id="pos-cari-ara"
            className="girdi"
            type="search"
            autoComplete="off"
            maxLength={120}
            placeholder="Cari adı veya numarası…"
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
                      setForm({ cari: c });
                    }}
                  >
                    Düzenle
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {formCariSilindi ? (
          <div className="bos" role="alert">
            <h2>Düzenlediğiniz cari başka sekmede silindi</h2>
            <p>Değişiklik kaydedilmedi. Güncel listeden devam edin.</p>
            <button className="dugme" type="button" onClick={() => setForm(null)}>
              Tamam
            </button>
          </div>
        ) : acikForm ? (
          <div className="pos-form-alani">
            <CariFormu
              key={acikForm.cari?.id ?? 'yeni'}
              cari={acikForm.cari}
              kartSayisi={
                acikForm.cari ? veri.kartlar.filter((k) => k.cariId === acikForm.cari?.id).length : 0
              }
              mesgul={mesgul}
              vazgec={() => setForm(null)}
              kaydet={async (c, numaraDuzeltme) => {
                const tamam = await guncelle(
                  () => profilCariKaydet(veri, c, acikForm.cari, numaraDuzeltme),
                  'Cari kaydedildi. Kartlarını profiline ekleyebilirsiniz.',
                  true,
                );
                if (tamam.durum === 'tamam') {
                  setSeciliId(c.id);
                  setForm(null);
                }
                return tamam;
              }}
            />
            {acikForm.cari && (
              <button
                className="dugme tehlike"
                type="button"
                disabled={mesgul}
                onClick={() => {
                  if (acikForm.cari) cariyiSil(acikForm.cari);
                }}
              >
                Cariyi sil
              </button>
            )}
          </div>
        ) : cari ? (
          <CariProfili
            key={`${cari.id}-${cari.numara}`}
            cari={cari}
            kartlar={veri.kartlar.filter((k) => k.cariId === cari.id)}
            gizlilikNo={gizlilikNo}
            mesgul={mesgul}
            bildir={bildir}
            duzenle={() => setForm({ cari })}
            sil={() => cariyiSil(cari)}
            kartKaydet={(k, beklenen) =>
              guncelle(
                () => profilKartKaydet(veri, k, new Date(), beklenen),
                'Kart bu carinin profiline kaydedildi.',
                true,
              )
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
      <PosGuvenlik
        mesgul={mesgul}
        kilitle={oturum.kilitle}
        degistir={(eski, p, t) => {
          void oturum.kilitIsi(
            () => depo.parolaDegistir(eski, p, t),
            'Parola değiştirildi. Bundan sonra yeni parolayı kullanın.',
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
    if (oturum.hata && !document.querySelector('dialog[open]')) hataKutusu.current?.focus();
  }, [oturum.hata]);
  return (
    <>
      <SayfaBasligi ust="İşlemler" baslik="Sanal POS">
        Carinizi seçin, kartını hazırlayın ve tutarı POS’ta kendiniz girin.
      </SayfaBasligi>
      <Mesaj ton="bilgi">
        Cari ve kart bilgileri (kaydettiyseniz CVV de) yalnız bu tarayıcıda, Sanal POS parolanızla şifreli
        saklanır; yedeği alınmaz ve hiçbir yere gönderilmez. Banka şifresi ve SMS kodları kaydedilmez.
      </Mesaj>
      {oturum.hata && (
        <div ref={hataKutusu} tabIndex={-1}>
          <Mesaj ton="hata">{oturum.hata}</Mesaj>
        </div>
      )}
      <Bildirim mesaj={oturum.bilgi} />
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
      {!oturum.yukleniyor && !oturum.yenileniyor && oturum.veri && !oturum.depo.acik && (
        <button className="dugme" disabled={oturum.mesgul} onClick={() => void oturum.kontrol()}>
          Profil durumunu yeniden kontrol et
        </button>
      )}
      {!oturum.yukleniyor &&
        (oturum.durum === 'eski' ? (
          <EskiKasaGecisi
            key={oturum.gizlilikNo}
            mesgul={oturum.mesgul}
            tasi={(p) =>
              oturum.kilitIsi(
                () => oturum.depo.eskiKasayiTasi(p),
                'Carileriniz taşındı. Şimdi Sanal POS parolası belirleyin.',
              )
            }
          />
        ) : oturum.durum === 'kilitli' || oturum.durum === 'parolaBelirle' ? (
          <PosKilidi
            key={oturum.durum}
            durum={oturum.durum}
            tasima={oturum.tasima}
            mesgul={oturum.mesgul}
            is={oturum.kilitIsi}
            islemler={{
              kilidiAc: (p) => oturum.depo.kilidiAc(p),
              parolaBelirle: (p, t) => oturum.depo.parolaBelirle(p, t),
              sifirla: () => oturum.depo.sifirla(),
            }}
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
