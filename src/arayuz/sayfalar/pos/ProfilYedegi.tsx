import { useIslem } from '../../bilesenler/useIslem';
import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosProfilVerisi } from '../../../cekirdek/posProfil';
import { ozetImzasi, type BirlestirmeOzeti, type BirlestirmeSecimi } from '../../../cekirdek/posBirlestirme';
import { kartMaskesi } from '../../../cekirdek/posKart';
import { profilYedeginiAc, EN_BUYUK_PROFIL_YEDEGI } from '../../../platform/posProfilSifreleme';
import { yedekParolasiDogrula } from '../../../cekirdek/posParola';
import { Mesaj } from '../../bilesenler/Mesaj';
import { YedekHazirlama } from './YedekHazirlama';

export function ProfilYedegi({
  mesgul,
  hatirlatma,
  indir,
  ozetle,
  ekle,
}: {
  mesgul: boolean;
  hatirlatma: string;
  indir: (parola: string) => Promise<IslemSonucu>;
  ozetle: (veri: PosProfilVerisi) => Promise<BirlestirmeOzeti>;
  ekle: (veri: PosProfilVerisi, secim: BirlestirmeSecimi, ozet: string) => Promise<IslemSonucu>;
}) {
  const [acik, setAcik] = useState(false);
  const [parola, setParola] = useState('');
  const [hata, setHata] = useState('');
  const islem = useIslem('profil-yedek-inceleme');
  const inceleniyor = islem.mesgul;
  const [onizleme, setOnizleme] = useState<{ veri: PosProfilVerisi; ozet: BirlestirmeOzeti } | null>(null);
  const [secim, setSecim] = useState<BirlestirmeSecimi | null>(null);
  const dosya = useRef<HTMLInputElement>(null);
  const bagli = useRef(false);
  useEffect(() => {
    bagli.current = true;
    return () => {
      bagli.current = false;
    };
  }, []);
  const temizle = () => {
    setOnizleme(null);
    setSecim(null);
  };
  const catisma = onizleme?.ozet.catismalar.length ?? 0;
  // Çatışma varsa kullanıcı açıkça seçmeden hiçbir kayıt yazılmaz.
  const secilen: BirlestirmeSecimi | null = catisma ? secim : 'koru';
  return (
    <section className="kart" aria-labelledby="pos-profil-yedek-baslik">
      <div className="kart-ust">
        <h2 id="pos-profil-yedek-baslik">Cari ve kart yedeği</h2>
        <button
          className="dugme"
          type="button"
          disabled={mesgul || inceleniyor}
          onClick={() => setAcik(!acik)}
        >
          Şifreli yedeği indir
        </button>
      </div>
      <p>
        Yedek carileri, kart numaralarını ve iletişim telefonlarını içerir; ayrı uzun parolayla şifrelenir. Bu
        parola günlük açılışta sorulmaz. Tarayıcı verileri silinirse yedekten geri getirebilirsiniz.
      </p>
      {hatirlatma && <p className="ipucu">{hatirlatma}</p>}
      {acik && (
        <YedekHazirlama mesgul={mesgul || inceleniyor} hazirla={indir} vazgec={() => setAcik(false)} />
      )}
      <details className="pos-bakim">
        <summary>Şifreli yedekten kayıt ekle</summary>
        <p className="ipucu">
          Başka bilgisayardaki kayıtları buraya eklemek için kullanın. Mevcut kayıtlar silinmez; aynı bilgiler
          atlanır, farklı bilgiler eklemeden önce size gösterilir.
        </p>
        <form
          className="pos-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (mesgul || inceleniyor) return;
            setHata('');
            temizle();
            const f = dosya.current?.files?.[0];
            if (!f) {
              setHata('Şifreli yedek dosyasını seçin.');
              return;
            }
            if (f.size > EN_BUYUK_PROFIL_YEDEGI) {
              setHata('Yedek en fazla 2 MB olabilir.');
              return;
            }
            const p = String(new FormData(e.currentTarget).get('profilYedekParolasi') ?? '');
            try {
              yedekParolasiDogrula(p);
            } catch (e) {
              setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek parolasını kontrol edin.');
              return;
            }
            setParola('');
            void islem.calistir(async (signal) => {
              let b: Uint8Array | undefined;
              try {
                b = new Uint8Array(await f.arrayBuffer());
                signal.throwIfAborted();
                const veri = await profilYedeginiAc(b, p);
                signal.throwIfAborted();
                const ozet = await ozetle(veri);
                signal.throwIfAborted();
                setOnizleme({ veri, ozet });
              } finally {
                b?.fill(0);
              }
            }, 'Yedek açıldı. Kayıtları inceleyip açıkça ekleyebilirsiniz.');
          }}
        >
          <label htmlFor="pos-profil-yedek-dosyasi">Şifreli profil veya eski cari yedeği</label>
          <input
            ref={dosya}
            id="pos-profil-yedek-dosyasi"
            type="file"
            accept=".calpos"
            disabled={mesgul || inceleniyor}
            onChange={() => {
              temizle();
              setHata('');
            }}
          />
          <label htmlFor="pos-profil-yedek-parola">Yedeğin uzun parolası</label>
          <input
            id="pos-profil-yedek-parola"
            className="girdi"
            name="profilYedekParolasi"
            type="password"
            autoComplete="off"
            maxLength={128}
            value={parola}
            disabled={mesgul || inceleniyor}
            onChange={(e) => {
              setParola(e.target.value);
              temizle();
            }}
          />
          <button className="dugme" type="submit" disabled={mesgul || inceleniyor}>
            {inceleniyor ? 'Yedek açılıyor…' : 'Yedeği incele'}
          </button>
        </form>
        {onizleme && (
          <div className="pos-yedek-onizleme">
            <h3>Eklenmeden önce kontrol edin</h3>
            <p>
              Yedekte {onizleme.veri.cariler.length} cari, {onizleme.veri.kartlar.length} kart var. Eklenecek:{' '}
              {onizleme.ozet.yeniCari} yeni cari, {onizleme.ozet.yeniKart} yeni kart. Burada zaten aynı olan:{' '}
              {onizleme.ozet.ayniCari} cari, {onizleme.ozet.ayniKart} kart. Mevcut kayıtlar silinmez.
            </p>
            <ul>
              {onizleme.veri.cariler.map((c) => (
                <li key={c.id}>
                  <b>{c.ad}</b>
                  <ul>
                    {onizleme.veri.kartlar
                      .filter((k) => k.cariId === c.id)
                      .map((k) => (
                        <li key={k.id}>
                          {k.ad} · {kartMaskesi(k)}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
            {catisma > 0 && (
              <fieldset className="pos-yedek-catisma">
                <legend>Bu bilgisayardakinden farklı {catisma} kayıt var</legend>
                <ul>
                  {onizleme.ozet.catismalar.map((c, i) => (
                    <li key={i}>{c.metin}</li>
                  ))}
                </ul>
                <label className="pos-onay">
                  <input
                    type="radio"
                    name="pos-yedek-secim"
                    checked={secim === 'koru'}
                    onChange={() => setSecim('koru')}
                  />
                  Farklı kayıtlarda bu bilgisayardakileri koru; yalnız yeni kayıtları ekle
                </label>
                <label className="pos-onay">
                  <input
                    type="radio"
                    name="pos-yedek-secim"
                    checked={secim === 'yedek'}
                    onChange={() => setSecim('yedek')}
                  />
                  Farklı kayıtlarda yedektekileri kullan
                </label>
              </fieldset>
            )}
            {catisma > 0 && !secim && (
              <Mesaj ton="uyari">Farklı kayıtlar için yukarıdaki iki seçenekten birini işaretleyin.</Mesaj>
            )}
            <div className="satir-dugmeleri">
              <button
                className="dugme birincil"
                type="button"
                disabled={mesgul || !secilen}
                onClick={() => {
                  if (!secilen) return;
                  void ekle(onizleme.veri, secilen, ozetImzasi(onizleme.ozet)).then((tamam) => {
                    if (!bagli.current) return;
                    if (tamam.durum === 'tamam') temizle();
                    else setHata(tamam.mesaj);
                  });
                }}
              >
                İnceledim, kayıtları ekle
              </button>
              <button className="dugme" type="button" disabled={mesgul} onClick={temizle}>
                Vazgeç
              </button>
            </div>
          </div>
        )}
        <IslemBildirimi islem={islem} />
        <FormHatasi hata={hata} id="ProfilYedegi-hata" />
      </details>
    </section>
  );
}
