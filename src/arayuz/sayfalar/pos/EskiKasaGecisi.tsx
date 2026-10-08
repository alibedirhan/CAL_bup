import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';

export function EskiKasaGecisi({
  mesgul,
  tasi,
}: {
  mesgul: boolean;
  tasi: (parola: string) => Promise<IslemSonucu | boolean>;
}) {
  const [parola, setParola] = useState('');
  return (
    <section className="kart pos-kilit" aria-labelledby="pos-gecis-baslik">
      <h2 id="pos-gecis-baslik">Mevcut carilerinizi yeni profile taşıyın</h2>
      <p>
        Eski kayıtlarınızı açmak için mevcut kasa PIN’ini veya parolasını bir kez girin. Carileriniz
        korunacak; ardından Sanal POS için yeni bir parola belirleyeceksiniz.
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
      <p className="ipucu">
        Yanlış PIN veya kayıt hatasında eski cari listeniz değiştirilmez. Unutulan eski PIN atlanamaz.
      </p>
    </section>
  );
}
