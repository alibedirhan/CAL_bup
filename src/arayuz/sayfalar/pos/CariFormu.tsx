import { cariFormunuDenetle } from '../../../cekirdek/posFormDenetimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import { Mesaj } from '../../bilesenler/Mesaj';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';

interface Ozellikler {
  cari: PosCari | null;
  /** Düzenlenen cariye bağlı kart sayısı; numara değişirse açık düzeltme onayı istenir. */
  kartSayisi: number;
  mesgul: boolean;
  kaydet: (cari: PosCari, numaraDuzeltme: boolean) => Promise<IslemSonucu>;
  vazgec: () => void;
}

export function CariFormu({ cari, kartSayisi, mesgul, kaydet, vazgec }: Ozellikler) {
  const [ad, setAd] = useState(cari?.ad ?? '');
  const [numara, setNumara] = useState(cari?.numara ?? '');
  const [kullanici, setKullanici] = useState(cari?.girisKullanici ?? '');
  const [sifre, setSifre] = useState(cari?.girisSifresi ?? '');
  const [sifreGoster, setSifreGoster] = useState(false);
  const [kontrol, setKontrol] = useState(false);
  const [duzeltme, setDuzeltme] = useState(false);
  const [hata, setHata] = useState('');
  const [alanlar, setAlanlar] = useState<Record<string, string>>({});
  const numaraDegisti = Boolean(cari) && numara.trim() !== cari?.numara;
  const duzeltmeGerekli = numaraDegisti && kartSayisi > 0;
  const hataId = (alan: string) => (alanlar[alan] ? 'pos-cari-hata' : undefined);
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
          const taslak: PosCari = {
            id: cari?.id ?? crypto.randomUUID(),
            ad,
            numara,
            girisKullanici: kullanici,
            girisSifresi: sifre,
          };
          const hatalar = cariFormunuDenetle(taslak, kontrol, { gerekli: duzeltmeGerekli, onay: duzeltme });
          setAlanlar(hatalar);
          if (Object.keys(hatalar).length) {
            setHata(Object.values(hatalar).join(' '));
            return;
          }
          void kaydet(taslak, duzeltmeGerekli && duzeltme).then((tamam) => {
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
          aria-describedby={hataId('pos-cari-ad')}
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
          aria-describedby={hataId('pos-cari-numara') ?? 'pos-numara-notu'}
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
            setDuzeltme(false);
          }}
        />
        <p id="pos-numara-notu" className="ipucu">
          POS’a giriş yapılan ve POS’ta firma adının yanında görünen numara (10 veya 11 rakam). Şahıs
          carilerinde bu çoğunlukla 11 haneli TC kimlik numarasıdır.
        </p>
        {duzeltmeGerekli && (
          <>
            <Mesaj ton="uyari">
              Bu carinin {kartSayisi} kayıtlı kartı var. Numara düzeltmesi yalnız <b>aynı kişinin</b> yanlış
              girilmiş numarası için yapılır; kartlar bu caride kalır. Farklı bir kişi için “Yeni cari”
              oluşturun.
            </Mesaj>
            <label className="pos-onay">
              <input
                type="checkbox"
                checked={duzeltme}
                disabled={mesgul}
                aria-invalid={Boolean(alanlar['pos-cari-duzeltme'])}
                onChange={(e) => setDuzeltme(e.target.checked)}
              />
              Aynı kişinin numarasını düzeltiyorum; kartlar bu caride kalsın.
            </label>
          </>
        )}
        <details className="pos-ayrinti" open={Boolean(cari?.girisKullanici || cari?.girisSifresi)}>
          <summary>POS girişi bu cari için farklıysa</summary>
          <div className="pos-cari-giris">
            <p className="ipucu">
              Boş bırakırsanız POS’a lisans numarası olarak vergi/TC numarası, şifre olarak numaranın ilk 2 ve
              son 2 hanesi gönderilir. Bu cari POS’a başka bilgilerle giriyorsa buraya yazın; şifreli
              saklanır.
            </p>
            <label htmlFor="pos-cari-kullanici">Lisans numarası (kullanıcı)</label>
            <input
              id="pos-cari-kullanici"
              className="girdi rakam"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={kullanici}
              disabled={mesgul}
              aria-invalid={Boolean(alanlar['pos-cari-kullanici'])}
              aria-describedby={hataId('pos-cari-kullanici')}
              onChange={(e) => setKullanici(e.target.value)}
            />
            <label htmlFor="pos-cari-sifre">POS şifresi</label>
            <input
              id="pos-cari-sifre"
              className={'girdi rakam' + (sifreGoster ? '' : ' pos-gizli-girdi')}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              value={sifre}
              disabled={mesgul}
              aria-invalid={Boolean(alanlar['pos-cari-sifre'])}
              aria-describedby={hataId('pos-cari-sifre')}
              onChange={(e) => setSifre(e.target.value)}
            />
            <div className="satir-dugmeleri">
              <button
                className="dugme kucuk"
                type="button"
                aria-pressed={sifreGoster}
                onClick={() => setSifreGoster((g) => !g)}
              >
                {sifreGoster ? 'Şifreyi gizle' : 'Şifreyi göster'}
              </button>
            </div>
          </div>
        </details>
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
