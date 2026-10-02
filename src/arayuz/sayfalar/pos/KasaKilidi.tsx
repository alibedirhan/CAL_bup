import { useState } from 'react';

interface Ozellikler {
  varMi: boolean;
  mesgul: boolean;
  ac: (parola: string) => Promise<boolean>;
}

export function KasaKilidi({ varMi, mesgul, ac }: Ozellikler) {
  const [parola, setParola] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [hata, setHata] = useState('');

  return (
    <section className="kart pos-kilit" aria-labelledby="kasa-baslik">
      <h2 id="kasa-baslik">{varMi ? 'Cari kasasını aç' : 'Cari kasanı oluştur'}</h2>
      <p>
        {varMi
          ? 'Bu tarayıcıdaki cari listesini kasa parolanızla açın.'
          : 'Cari adlarını ve vergi numaralarını elle kaydedebilirsiniz. Liste bu tarayıcıda şifreli tutulur.'}
      </p>
      <form
        className="pos-form"
        onSubmit={(e) => {
          e.preventDefault();
          setHata('');
          if (!varMi && parola !== tekrar) {
            setHata('İki kasa parolası aynı olmalı.');
            return;
          }
          const p = parola;
          setParola('');
          setTekrar('');
          void ac(p);
        }}
      >
        <label htmlFor="kasa-parolasi">Kasa parolası</label>
        <input
          className="girdi"
          id="kasa-parolasi"
          type="password"
          autoComplete={varMi ? 'current-password' : 'new-password'}
          minLength={14}
          maxLength={128}
          required
          value={parola}
          disabled={mesgul}
          onChange={(e) => setParola(e.target.value)}
          aria-describedby="kasa-parola-notu"
        />
        {!varMi && (
          <>
            <label htmlFor="kasa-parolasi-tekrar">Kasa parolası tekrar</label>
            <input
              className="girdi"
              id="kasa-parolasi-tekrar"
              type="password"
              autoComplete="new-password"
              minLength={14}
              maxLength={128}
              required
              value={tekrar}
              disabled={mesgul}
              onChange={(e) => setTekrar(e.target.value)}
            />
          </>
        )}
        <p id="kasa-parola-notu" className="ipucu">
          Bu, POS giriş şifresi değildir. En az 14 karakterlik, size özel bir parola kullanın. Unutulan kasa
          parolasını geri getiremeyiz.
        </p>
        {hata && (
          <p className="alan-hatasi" role="alert">
            {hata}
          </p>
        )}
        <button className="dugme birincil" type="submit" disabled={mesgul}>
          {mesgul ? 'Kasa hazırlanıyor…' : varMi ? 'Kasayı aç' : 'Kasayı oluştur'}
        </button>
      </form>
      <p className="ipucu">
        Başka bölüme geçtiğinizde veya 5 dakika kullanmadığınızda kasa kilitlenir. Tarayıcı verileri
        temizlenirse liste silinir; şifreli yedeğinizi indirin.
      </p>
    </section>
  );
}
