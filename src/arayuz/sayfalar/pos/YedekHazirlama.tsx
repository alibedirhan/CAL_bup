import { FormHatasi } from '../../bilesenler/FormHatasi';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { yedekParolasiDogrula } from '../../../cekirdek/posParola';

export function YedekHazirlama({
  mesgul,
  hazirla,
  vazgec,
}: {
  mesgul: boolean;
  hazirla: (parola: string) => Promise<IslemSonucu>;
  vazgec: () => void;
}) {
  const [parola, setParola] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [hata, setHata] = useState('');
  return (
    <form
      className="pos-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (mesgul) return;
        const d = new FormData(e.currentTarget);
        const p = String(d.get('yedekParolasi') ?? '');
        const t = String(d.get('yedekTekrar') ?? '');
        try {
          yedekParolasiDogrula(p, t);
        } catch (e) {
          setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek parolasını kontrol edin.');
          return;
        }
        setParola('');
        setTekrar('');
        setHata('');
        void hazirla(p).then((tamam) => {
          if (tamam.durum === 'tamam') vazgec();
          else setHata(tamam.mesaj);
        });
      }}
    >
      <p>
        Bu yedek başka bilgisayarda açılabilir. En az 14 karakterlik ayrı bir yedek parolası belirleyin. Bu
        parola günlük kullanımda sorulmaz.
      </p>
      <label htmlFor="pos-tasinabilir-parola">Taşınabilir yedek parolası</label>
      <input
        className="girdi"
        id="pos-tasinabilir-parola"
        name="yedekParolasi"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        disabled={mesgul}
        value={parola}
        onChange={(e) => {
          setParola(e.target.value);
          setHata('');
        }}
      />
      <label htmlFor="pos-tasinabilir-tekrar">Taşınabilir yedek parolası tekrar</label>
      <input
        className="girdi"
        id="pos-tasinabilir-tekrar"
        name="yedekTekrar"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        disabled={mesgul}
        value={tekrar}
        onChange={(e) => {
          setTekrar(e.target.value);
          setHata('');
        }}
      />
      <FormHatasi hata={hata} id="YedekHazirlama-hata" />
      <div className="satir-dugmeleri">
        <button className="dugme birincil" type="submit" disabled={mesgul}>
          Yedeği şifrele ve indir
        </button>
        <button className="dugme" type="button" disabled={mesgul} onClick={vazgec}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
