import { useState } from 'react';
import { PROFIL_PAROLA_EN_AZ } from '../../../cekirdek/posParola';

/** Sanal POS parolasının ekranları. Parolalar yalnız form gönderilene kadar bu bileşenin durumunda
 * kalır; gönderilince kutular boşaltılır. Kurtarma yolu yoktur: unutulursa kayıtlar silinir. */
type Is = (f: () => Promise<unknown>, mesaj: string) => Promise<boolean>;
interface Islemler {
  kilidiAc: (p: string) => Promise<unknown>;
  parolaBelirle: (p: string, t: string) => Promise<unknown>;
  sifirla: () => Promise<unknown>;
}

const SILME_ONAYI = 'SİL';

function ParolaKutusu({
  id,
  etiket,
  deger,
  degistir,
  mesgul,
  yeni,
}: {
  id: string;
  etiket: string;
  deger: string;
  degistir: (s: string) => void;
  mesgul: boolean;
  yeni?: boolean;
}) {
  return (
    <>
      <label htmlFor={id}>{etiket}</label>
      <input
        id={id}
        className="girdi"
        type="password"
        autoComplete={yeni ? 'new-password' : 'current-password'}
        maxLength={128}
        value={deger}
        disabled={mesgul}
        onChange={(e) => degistir(e.target.value)}
      />
    </>
  );
}

export function YeniParolaFormu({
  mesgul,
  gonder,
  dugme,
}: {
  mesgul: boolean;
  gonder: (p: string, t: string) => void;
  dugme: string;
}) {
  const [parola, setParola] = useState('');
  const [tekrar, setTekrar] = useState('');
  return (
    <form
      className="pos-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (mesgul) return;
        gonder(parola, tekrar);
        setParola('');
        setTekrar('');
      }}
    >
      <ParolaKutusu
        id="pos-yeni-parola"
        etiket="Yeni Sanal POS parolası"
        deger={parola}
        degistir={setParola}
        mesgul={mesgul}
        yeni
      />
      <ParolaKutusu
        id="pos-yeni-parola-tekrar"
        etiket="Yeni parolayı tekrar yazın"
        deger={tekrar}
        degistir={setTekrar}
        mesgul={mesgul}
        yeni
      />
      <p className="ipucu">
        En az {PROFIL_PAROLA_EN_AZ} karakter; en az bir harf ve bir rakam. Başka yerde kullanmadığınız, size
        özel bir parola seçin.
      </p>
      <button className="dugme birincil" type="submit" disabled={mesgul}>
        {dugme}
      </button>
    </form>
  );
}

function Sifirlama({ mesgul, is, islemler }: { mesgul: boolean; is: Is; islemler: Islemler }) {
  const [acik, setAcik] = useState(false);
  const [onay, setOnay] = useState('');
  if (!acik)
    return (
      <button className="dugme hayalet" type="button" disabled={mesgul} onClick={() => setAcik(true)}>
        Parolamı unuttum
      </button>
    );
  return (
    <div className="pos-sifirlama" role="alertdialog" aria-labelledby="pos-sifirla-baslik">
      <h3 id="pos-sifirla-baslik">Parolayı unuttuysanız</h3>
      <p>
        Parola hiçbir yerde saklanmaz ve kurtarılamaz. Yeniden başlarsanız bu tarayıcıdaki{' '}
        <b>bütün cariler, kartlar ve kayıtlı CVV’ler kalıcı olarak silinir</b>; sonra yeni parola belirleyip
        carileri yeniden girersiniz. POS’taki hesaplar etkilenmez.
      </p>
      <label htmlFor="pos-sifirla-onay">Onaylamak için büyük harflerle {SILME_ONAYI} yazın</label>
      <input
        id="pos-sifirla-onay"
        className="girdi"
        autoComplete="off"
        value={onay}
        disabled={mesgul}
        onChange={(e) => setOnay(e.target.value)}
      />
      <div className="satir-dugmeleri">
        <button
          className="dugme tehlike"
          type="button"
          disabled={mesgul || onay.trim().toLocaleUpperCase('tr-TR') !== SILME_ONAYI}
          onClick={() => {
            void is(islemler.sifirla, 'Eski kayıtlar silindi. Yeni parola belirleyin.');
          }}
        >
          Bütün kayıtları sil ve yeniden başla
        </button>
        <button
          className="dugme"
          type="button"
          disabled={mesgul}
          onClick={() => {
            setAcik(false);
            setOnay('');
          }}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

export function PosKilidi({
  durum,
  tasima,
  mesgul,
  is,
  islemler,
}: {
  durum: 'kilitli' | 'parolaBelirle';
  tasima: boolean;
  mesgul: boolean;
  is: Is;
  islemler: Islemler;
}) {
  const [parola, setParola] = useState('');
  if (durum === 'parolaBelirle')
    return (
      <section className="kart pos-kilit" aria-labelledby="pos-kilit-baslik">
        <h2 id="pos-kilit-baslik">Sanal POS parolası belirleyin</h2>
        <p>
          {tasima
            ? 'Kayıtlı cari ve kartlarınız bundan sonra yalnız bu parolayla açılacak. Parolayı belirleyince kayıtlarınız bu parolayla yeniden şifrelenir.'
            : 'Cari ve kart bilgileri bu parolayla şifrelenir. Sanal POS her açılışta ve 10 dakika işlem yapılmayınca parola sorar.'}
        </p>
        <p className="ipucu">
          <b>Parolayı unutursanız kayıtlar geri getirilemez</b>; tek yol hepsini silip yeniden başlamaktır.
        </p>
        <YeniParolaFormu
          mesgul={mesgul}
          dugme="Parolayı belirle"
          gonder={(p, t) => {
            void is(
              () => islemler.parolaBelirle(p, t),
              tasima ? 'Parola belirlendi; kayıtlarınız artık parolayla korunuyor.' : 'Parola belirlendi.',
            );
          }}
        />
      </section>
    );
  return (
    <section className="kart pos-kilit" aria-labelledby="pos-kilit-baslik">
      <h2 id="pos-kilit-baslik">Sanal POS kilitli</h2>
      <p>Cari ve kartları görmek için Sanal POS parolanızı yazın.</p>
      <form
        className="pos-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul) return;
          const p = parola;
          setParola('');
          void is(() => islemler.kilidiAc(p), 'Sanal POS açıldı.');
        }}
      >
        <ParolaKutusu
          id="pos-parola"
          etiket="Sanal POS parolası"
          deger={parola}
          degistir={setParola}
          mesgul={mesgul}
        />
        <button className="dugme birincil" type="submit" disabled={mesgul}>
          Kilidi aç
        </button>
      </form>
      <Sifirlama mesgul={mesgul} is={is} islemler={islemler} />
    </section>
  );
}

/** Açık profilin altında: elle kilitleme ve parola değiştirme. Yedek veya dışa aktarma yoktur. */
export function PosGuvenlik({
  mesgul,
  kilitle,
  degistir,
}: {
  mesgul: boolean;
  kilitle: () => void;
  degistir: (eski: string, p: string, t: string) => void;
}) {
  const [eski, setEski] = useState('');
  return (
    <section className="kart" aria-labelledby="pos-guvenlik-baslik">
      <div className="kart-ust">
        <h2 id="pos-guvenlik-baslik">Güvenlik</h2>
        <button className="dugme" type="button" disabled={mesgul} onClick={kilitle}>
          Şimdi kilitle
        </button>
      </div>
      <p className="ipucu">
        Kayıtlar yalnız bu tarayıcıda ve yalnız Sanal POS parolanızla açılır; yedeği alınmaz, başka yere
        gönderilmez. 10 dakika işlem yapılmazsa veya tarayıcı kapanırsa kilitlenir. Bilgisayardan kalkarken
        Windows’u da Win+L ile kilitleyin.
      </p>
      <details>
        <summary>Parolayı değiştir</summary>
        <ParolaKutusu
          id="pos-eski-sifre"
          etiket="Şu anki parola"
          deger={eski}
          degistir={setEski}
          mesgul={mesgul}
        />
        <YeniParolaFormu
          mesgul={mesgul}
          dugme="Parolayı değiştir"
          gonder={(p, t) => {
            const e = eski;
            setEski('');
            degistir(e, p, t);
          }}
        />
      </details>
    </section>
  );
}
