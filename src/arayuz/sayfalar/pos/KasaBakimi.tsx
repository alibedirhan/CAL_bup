import { useState } from 'react';
import { EN_BUYUK_POS_YEDEK } from '../../../platform/posSifreleme';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { kasaParolasiDogrula, yeniKasaParolasiDogrula } from '../../../cekirdek/posParola';
import { YedekHazirlama } from './YedekHazirlama';

interface Ozellikler {
  mesgul: boolean;
  yedekIndir: (parola: string) => Promise<boolean>;
  yedekEkle: (dosya: File, parola: string) => Promise<boolean>;
  parolaDegistir: (parola: string) => Promise<boolean>;
}

export function KasaBakimi({ mesgul, yedekIndir, yedekEkle, parolaDegistir }: Ozellikler) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [yedekParolasi, setYedekParolasi] = useState('');
  const [yeniParola, setYeniParola] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [hata, setHata] = useState('');
  const [dosyaAnahtari, setDosyaAnahtari] = useState(0);
  const [yedekAcik, setYedekAcik] = useState(false);
  return (
    <section className="kart" aria-labelledby="pos-yedek-baslik">
      <div className="kart-ust">
        <h2 id="pos-yedek-baslik">Cari yedeği</h2>
        <button className="dugme" type="button" disabled={mesgul} onClick={() => setYedekAcik(!yedekAcik)}>
          Şifreli yedeği indir
        </button>
      </div>
      <p>
        Yedek yalnızca cari listesini içerir. Başka bilgisayarda yeni kasa oluşturup yedekten carileri
        ekleyebilirsiniz. Kısa PIN günlük kullanım içindir; taşınabilir yedek ayrı uzun parolayla korunur.
      </p>
      {yedekAcik && (
        <YedekHazirlama mesgul={mesgul} hazirla={yedekIndir} vazgec={() => setYedekAcik(false)} />
      )}
      <details className="pos-bakim">
        <summary>Şifreli yedekten cari ekle</summary>
        <form
          className="pos-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setHata('');
            if (mesgul) return;
            if (!dosya) {
              setHata('Şifreli yedek dosyasını seçin.');
              return;
            }
            const p = String(new FormData(e.currentTarget).get('yedekAcmaParolasi') ?? '');
            try {
              kasaParolasiDogrula(p);
            } catch (e) {
              setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek parolasını yazın.');
              return;
            }
            setYedekParolasi('');
            void yedekEkle(dosya, p).then((tamam) => {
              if (tamam) {
                setDosya(null);
                setDosyaAnahtari((s) => s + 1);
              }
            });
          }}
        >
          <label htmlFor="pos-yedek-dosyasi">Şifreli cari yedeği</label>
          <input
            key={dosyaAnahtari}
            id="pos-yedek-dosyasi"
            type="file"
            accept=".calpos"
            disabled={mesgul}
            onChange={(e) => {
              setHata('');
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > EN_BUYUK_POS_YEDEK) {
                setHata('Yedek dosyası en fazla 256 KB olabilir.');
                setDosya(null);
                e.target.value = '';
              } else setDosya(f);
            }}
          />
          <label htmlFor="pos-yedek-parolasi">Yedeğin uzun parolası</label>
          <input
            id="pos-yedek-parolasi"
            name="yedekAcmaParolasi"
            className="girdi"
            type="password"
            autoComplete="off"
            required
            minLength={14}
            maxLength={128}
            disabled={mesgul}
            value={yedekParolasi}
            onChange={(e) => setYedekParolasi(e.target.value)}
          />
          <p className="ipucu">
            Yedeği hazırlarken seçtiğiniz uzun parolayı yazın. Eski sürüm yedeklerinde eski uzun kasa parolası
            kullanılır. Mevcut cariler silinmez; çelişen kayıt varsa aktarım durur.
          </p>
          <button className="dugme" type="submit" disabled={mesgul}>
            Yedekten carileri ekle
          </button>
        </form>
      </details>
      <details className="pos-bakim">
        <summary>Kasa parolasını değiştir</summary>
        <form
          className="pos-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setHata('');
            if (mesgul) return;
            const d = new FormData(e.currentTarget);
            const p = String(d.get('yeniKasaParolasi') ?? '');
            const t = String(d.get('yeniKasaTekrar') ?? '');
            try {
              yeniKasaParolasiDogrula(p, t);
            } catch (e) {
              setHata(e instanceof KullaniciHatasi ? e.message : 'Yeni PIN veya parolanızı kontrol edin.');
              return;
            }
            setYeniParola('');
            setTekrar('');
            void parolaDegistir(p);
          }}
        >
          <label htmlFor="pos-yeni-parola">Yeni kasa parolası</label>
          <input
            id="pos-yeni-parola"
            name="yeniKasaParolasi"
            className="girdi"
            type="password"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={128}
            disabled={mesgul}
            value={yeniParola}
            onChange={(e) => setYeniParola(e.target.value)}
          />
          <label htmlFor="pos-yeni-parola-tekrar">Yeni kasa parolası tekrar</label>
          <input
            id="pos-yeni-parola-tekrar"
            name="yeniKasaTekrar"
            className="girdi"
            type="password"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={128}
            disabled={mesgul}
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
          />
          <p className="ipucu">
            Bu bilgisayarda 4–12 rakamlık PIN seçebilirsiniz. Mevcut taşınabilir yedeklerin parolası değişmez;
            eski sürüm yedekleri de eski uzun kasa parolasıyla açılır.
          </p>
          <button className="dugme" type="submit" disabled={mesgul}>
            Kasa parolasını değiştir
          </button>
        </form>
      </details>
      {hata && (
        <p className="alan-hatasi" role="alert">
          {hata}
        </p>
      )}
    </section>
  );
}
