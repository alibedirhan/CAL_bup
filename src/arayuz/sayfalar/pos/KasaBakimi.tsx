import { useState } from 'react';
import { EN_BUYUK_POS_YEDEK } from '../../../platform/posSifreleme';

interface Ozellikler {
  mesgul: boolean;
  yedekIndir: () => void;
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
  return (
    <section className="kart" aria-labelledby="pos-yedek-baslik">
      <div className="kart-ust">
        <h2 id="pos-yedek-baslik">Cari yedeği</h2>
        <button className="dugme" type="button" disabled={mesgul} onClick={yedekIndir}>
          Şifreli yedeği indir
        </button>
      </div>
      <p>
        Yedek yalnızca cari listesini içerir. Başka bilgisayarda yeni kasa oluşturup yedekten carileri
        ekleyebilirsiniz. Yedeği açmak için indirildiği zamanki kasa parolası gerekir.
      </p>
      <details className="pos-bakim">
        <summary>Şifreli yedekten cari ekle</summary>
        <form
          className="pos-form"
          onSubmit={(e) => {
            e.preventDefault();
            setHata('');
            if (!dosya) return;
            const p = yedekParolasi;
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
          <label htmlFor="pos-yedek-parolasi">Yedeğin kasa parolası</label>
          <input
            id="pos-yedek-parolasi"
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
          <p className="ipucu">Mevcut cariler silinmez. Çelişen kayıt varsa aktarım durur.</p>
          <button className="dugme" type="submit" disabled={mesgul || !dosya}>
            Yedekten carileri ekle
          </button>
        </form>
      </details>
      <details className="pos-bakim">
        <summary>Kasa parolasını değiştir</summary>
        <form
          className="pos-form"
          onSubmit={(e) => {
            e.preventDefault();
            setHata('');
            if (yeniParola !== tekrar) {
              setHata('Yeni kasa parolaları aynı olmalı.');
              return;
            }
            const p = yeniParola;
            setYeniParola('');
            setTekrar('');
            void parolaDegistir(p);
          }}
        >
          <label htmlFor="pos-yeni-parola">Yeni kasa parolası</label>
          <input
            id="pos-yeni-parola"
            className="girdi"
            type="password"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={128}
            disabled={mesgul}
            value={yeniParola}
            onChange={(e) => setYeniParola(e.target.value)}
          />
          <label htmlFor="pos-yeni-parola-tekrar">Yeni kasa parolası tekrar</label>
          <input
            id="pos-yeni-parola-tekrar"
            className="girdi"
            type="password"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={128}
            disabled={mesgul}
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
          />
          <p className="ipucu">
            Önceki yedekler eski parolayla açılır. Değişiklikten sonra yeni bir yedek indirin.
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
