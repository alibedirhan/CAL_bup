import { cariFormunuDenetle } from '../../../cekirdek/posFormDenetimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';

interface Ozellikler {
  cari: PosCari | null;
  mesgul: boolean;
  kaydet: (cari: PosCari) => Promise<IslemSonucu>;
  vazgec: () => void;
}

export function CariFormu({ cari, mesgul, kaydet, vazgec }: Ozellikler) {
  const [ad, setAd] = useState(cari?.ad ?? '');
  const [numara, setNumara] = useState(cari?.numara ?? '');
  const [kontrol, setKontrol] = useState(false);
  const [hata, setHata] = useState('');
  const [alanlar, setAlanlar] = useState<Record<string, string>>({});
  return (
    <section className="kart" aria-labelledby="cari-form-baslik">
      <h2 id="cari-form-baslik">{cari ? 'Cariyi düzenle' : 'Yeni cari kaydet'}</h2>
      <form
        className="pos-form"
        autoComplete="off"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul) return;
          const taslak = { id: cari?.id ?? crypto.randomUUID(), ad, numara };
          const hatalar = cariFormunuDenetle(taslak, kontrol);
          setAlanlar(hatalar);
          if (Object.keys(hatalar).length) {
            setHata(Object.values(hatalar).join(' '));
            return;
          }
          void kaydet(taslak).then((tamam) => {
            if (tamam.durum === 'tamam') vazgec();
            else setHata(tamam.mesaj);
          });
        }}
      >
        <FormHatasi hata={hata} id="pos-cari-hata" />
        <label htmlFor="pos-cari-ad">Cari adı</label>
        <input
          id="pos-cari-ad"
          aria-invalid={Boolean(alanlar['pos-cari-ad'])}
          aria-describedby={alanlar['pos-cari-ad'] ? 'pos-cari-hata' : undefined}
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
          aria-invalid={Boolean(alanlar['pos-cari-numara'])}
          aria-describedby={alanlar['pos-cari-numara'] ? 'pos-cari-hata' : undefined}
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
          <button className="dugme birincil" type="submit" disabled={mesgul}>
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
