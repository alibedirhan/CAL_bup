import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import type { PosProfilVerisi } from '../../../cekirdek/posProfil';
import { kartMaskesi } from '../../../cekirdek/posKart';
import { profilYedeginiAc, EN_BUYUK_PROFIL_YEDEGI } from '../../../platform/posProfilSifreleme';
import { kasaParolasiDogrula } from '../../../cekirdek/posParola';
import { YedekHazirlama } from './YedekHazirlama';

export function ProfilYedegi({
  mesgul,
  indir,
  ekle,
}: {
  mesgul: boolean;
  indir: (parola: string) => Promise<boolean>;
  ekle: (veri: PosProfilVerisi) => Promise<boolean>;
}) {
  const [acik, setAcik] = useState(false);
  const [parola, setParola] = useState('');
  const [hata, setHata] = useState('');
  const [inceleniyor, setInceleniyor] = useState(false);
  const [onizleme, setOnizleme] = useState<PosProfilVerisi | null>(null);
  const dosya = useRef<HTMLInputElement>(null);
  const bagli = useRef(false);
  const kilit = useRef(false);
  useEffect(() => {
    bagli.current = true;
    return () => {
      bagli.current = false;
    };
  }, []);
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
      {acik && (
        <YedekHazirlama mesgul={mesgul || inceleniyor} hazirla={indir} vazgec={() => setAcik(false)} />
      )}
      <details className="pos-bakim">
        <summary>Şifreli yedekten kayıt ekle</summary>
        <form
          className="pos-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (mesgul || kilit.current) return;
            setHata('');
            setOnizleme(null);
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
              kasaParolasiDogrula(p);
            } catch (e) {
              setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek parolasını kontrol edin.');
              return;
            }
            setParola('');
            setInceleniyor(true);
            kilit.current = true;
            void (async () => {
              let b: Uint8Array | undefined;
              try {
                b = new Uint8Array(await f.arrayBuffer());
                const v = await profilYedeginiAc(b, p);
                if (bagli.current) setOnizleme(v);
              } catch (e) {
                if (bagli.current) setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek okunamadı.');
              } finally {
                b?.fill(0);
                kilit.current = false;
                if (bagli.current) setInceleniyor(false);
              }
            })();
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
              setOnizleme(null);
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
              setOnizleme(null);
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
              {onizleme.cariler.length} cari, {onizleme.kartlar.length} kart. Mevcut kayıtlar silinmez;
              çelişki varsa bütün ekleme durur.
            </p>
            <ul>
              {onizleme.cariler.map((c) => (
                <li key={c.id}>
                  <b>{c.ad}</b>
                  <ul>
                    {onizleme.kartlar
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
            <div className="satir-dugmeleri">
              <button
                className="dugme birincil"
                type="button"
                disabled={mesgul}
                onClick={() => {
                  void ekle(onizleme).then((tamam) => {
                    if (tamam && bagli.current) setOnizleme(null);
                  });
                }}
              >
                İnceledim, kayıtları ekle
              </button>
              <button className="dugme" type="button" disabled={mesgul} onClick={() => setOnizleme(null)}>
                Vazgeç
              </button>
            </div>
          </div>
        )}
        {hata && (
          <p className="alan-hatasi" role="alert">
            {hata}
          </p>
        )}
      </details>
    </section>
  );
}
