import { useState } from 'react';
import { YedekHazirlama } from './YedekHazirlama';

export function EskiKasaGecisi({
  mesgul,
  tasi,
  yedekle,
}: {
  mesgul: boolean;
  tasi: (parola: string) => Promise<boolean>;
  yedekle: (eskiParola: string, yedekParolasi: string) => Promise<boolean>;
}) {
  const [parola, setParola] = useState('');
  const [yedekAcik, setYedekAcik] = useState(false);
  return (
    <section className="kart pos-kilit" aria-labelledby="pos-gecis-baslik">
      <h2 id="pos-gecis-baslik">Mevcut carilerinizi yeni profile taşıyın</h2>
      <p>
        Eski kayıtlarınızı açmak için mevcut kasa PIN’ini veya parolasını bir kez girin. Carileriniz
        korunacak; bundan sonraki açılışlarda PIN sorulmayacak.
      </p>
      <form
        className="pos-form"
        autoComplete="off"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul) return;
          const p = String(new FormData(e.currentTarget).get('eskiParola') ?? '');
          setParola('');
          void tasi(p);
        }}
      >
        <label htmlFor="pos-eski-parola">Mevcut kasa PIN’i veya parolası</label>
        <input
          id="pos-eski-parola"
          className="girdi"
          name="eskiParola"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={parola}
          disabled={mesgul}
          onChange={(e) => setParola(e.target.value)}
        />
        <button className="dugme birincil" type="submit" disabled={mesgul}>
          Carilerimi taşı
        </button>
      </form>
      <button className="dugme" type="button" disabled={mesgul} onClick={() => setYedekAcik(!yedekAcik)}>
        Geçişten önce eski cari yedeğini indir
      </button>
      {yedekAcik && (
        <>
          <p className="ipucu">
            Yukarıdaki mevcut PIN’i yazın; yedek için aşağıda ayrı uzun parola belirleyin.
          </p>
          <YedekHazirlama
            mesgul={mesgul}
            hazirla={async (p) => {
              const eskiParola = parola;
              setParola('');
              return yedekle(eskiParola, p);
            }}
            vazgec={() => setYedekAcik(false)}
          />
        </>
      )}
      <p className="ipucu">
        Yanlış PIN veya kayıt hatasında eski cari listeniz değiştirilmez. Unutulan eski PIN atlanamaz. Bu
        tarayıcıyı kullanan kişiler yeni profile erişebilir.
      </p>
    </section>
  );
}
