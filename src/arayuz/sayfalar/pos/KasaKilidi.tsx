import { useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { kasaAcilisBilgisiDogrula, yeniKasaParolasiDogrula } from '../../../cekirdek/posParola';

interface Ozellikler {
  varMi: boolean;
  mesgul: boolean;
  ac: (parola: string) => Promise<boolean>;
}

export function KasaKilidi({ varMi, mesgul, ac }: Ozellikler) {
  const [parola, setParola] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [hata, setHata] = useState('');
  const [goster, setGoster] = useState(false);
  const parolaAlani = useRef<HTMLInputElement>(null);
  const tekrarAlani = useRef<HTMLInputElement>(null);

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
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul) return;
          setHata('');
          // Parola yöneticisinin DOM'a doldurduğu değer de doğrulanır; React olayına bağlı değildir.
          const alanlar = new FormData(e.currentTarget);
          const p = String(alanlar.get('kasaParolasi') ?? '');
          const t = String(alanlar.get('kasaTekrar') ?? '');
          try {
            if (varMi) kasaAcilisBilgisiDogrula(p);
            else yeniKasaParolasiDogrula(p, t);
          } catch (e) {
            setHata(e instanceof KullaniciHatasi ? e.message : 'Parolanın yazımını kontrol edin.');
            if (p && t !== p && !varMi) tekrarAlani.current?.focus();
            else parolaAlani.current?.focus();
            return;
          }
          setParola('');
          setTekrar('');
          setGoster(false);
          void ac(p);
        }}
      >
        <label htmlFor="kasa-parolasi">Kasa parolası</label>
        <input
          className="girdi"
          id="kasa-parolasi"
          ref={parolaAlani}
          name="kasaParolasi"
          type={goster ? 'text' : 'password'}
          autoComplete={varMi ? 'current-password' : 'new-password'}
          minLength={4}
          maxLength={128}
          required
          value={parola}
          disabled={mesgul}
          onChange={(e) => {
            setParola(e.target.value);
            setHata('');
          }}
          aria-describedby="kasa-parola-notu"
          aria-invalid={Boolean(hata)}
          spellCheck={false}
        />
        {!varMi && (
          <>
            <label htmlFor="kasa-parolasi-tekrar">Kasa parolası tekrar</label>
            <input
              className="girdi"
              id="kasa-parolasi-tekrar"
              ref={tekrarAlani}
              name="kasaTekrar"
              type={goster ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={4}
              maxLength={128}
              required
              value={tekrar}
              disabled={mesgul}
              onChange={(e) => {
                setTekrar(e.target.value);
                setHata('');
              }}
              aria-invalid={Boolean(hata)}
              spellCheck={false}
            />
          </>
        )}
        <label className="pos-onay">
          <input
            type="checkbox"
            checked={goster}
            disabled={mesgul}
            onChange={(e) => setGoster(e.target.checked)}
          />
          Kasa parolasını göster
        </label>
        <p id="kasa-parola-notu" className="ipucu">
          Bu, POS giriş şifresi değildir. Bu bilgisayarda 4–12 rakamlık PIN veya en az 14 karakterlik uzun
          parola kullanabilirsiniz. Önceki sürümde oluşturduğunuz kasa mevcut parolasıyla açılır.
        </p>
        {!varMi && (
          <p className="ipucu">
            {/^\d*$/.test(parola)
              ? `PIN uzunluğu: ${parola.length} / 4–12 rakam.`
              : `Parola uzunluğu: ${parola.trim().length} / en az 14 karakter.`}
          </p>
        )}
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
        Başka bölüme geçtiğinizde veya 30 dakika kullanmadığınızda kasa kilitlenir. Kilit POS sekmesini
        kapatmaz ve oradaki bilgileri silmez. Tarayıcı verileri temizlenirse liste silinir; ayrı uzun parola
        ile taşınabilir yedeğinizi hazırlayın. Unutulan PIN veya parola kurtarılamaz.
      </p>
    </section>
  );
}
