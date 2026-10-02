import { useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';

interface Ozellikler {
  cari: PosCari | null;
  mesgul: boolean;
  kaydet: (cari: PosCari) => Promise<boolean>;
  vazgec: () => void;
}

export function CariFormu({ cari, mesgul, kaydet, vazgec }: Ozellikler) {
  const [ad, setAd] = useState(cari?.ad ?? '');
  const [numara, setNumara] = useState(cari?.numara ?? '');
  const [kontrol, setKontrol] = useState(false);
  return (
    <section className="kart" aria-labelledby="cari-form-baslik">
      <h2 id="cari-form-baslik">{cari ? 'Cariyi düzenle' : 'Yeni cari kaydet'}</h2>
      <form
        className="pos-form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (!kontrol) return;
          void kaydet({ id: cari?.id ?? crypto.randomUUID(), ad, numara }).then((tamam) => {
            if (tamam) vazgec();
          });
        }}
      >
        <label htmlFor="pos-cari-ad">Cari adı</label>
        <input
          id="pos-cari-ad"
          className="girdi"
          required
          minLength={2}
          maxLength={120}
          value={ad}
          disabled={mesgul}
          onChange={(e) => {
            setAd(e.target.value);
            setKontrol(false);
          }}
        />
        <label htmlFor="pos-cari-numara">Vergi/TC numarası</label>
        <input
          id="pos-cari-numara"
          className="girdi rakam"
          required
          inputMode="numeric"
          type="text"
          pattern="[0-9]{10,11}"
          minLength={10}
          maxLength={11}
          autoComplete="off"
          spellCheck={false}
          value={numara}
          disabled={mesgul}
          onChange={(e) => {
            setNumara(e.target.value);
            setKontrol(false);
          }}
          aria-describedby="pos-numara-notu"
        />
        <p id="pos-numara-notu" className="ipucu">
          10 veya 11 rakam. Kaynaktaki numarayı kontrol ederek girin.
        </p>
        <label className="pos-onay">
          <input
            type="checkbox"
            checked={kontrol}
            disabled={mesgul}
            onChange={(e) => setKontrol(e.target.checked)}
          />
          Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.
        </label>
        <div className="satir-dugmeleri">
          <button className="dugme birincil" type="submit" disabled={mesgul || !kontrol}>
            Cariyi kaydet
          </button>
          <button className="dugme" type="button" disabled={mesgul} onClick={vazgec}>
            Vazgeç
          </button>
        </div>
      </form>
    </section>
  );
}
