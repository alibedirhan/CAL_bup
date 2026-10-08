import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import { numaraMaskesi, type PosCari } from '../../../cekirdek/posCari';
import { kartMaskesi, type PosKart } from '../../../cekirdek/posKart';
import { CariKartlari } from './CariKartlari';
import { PosGirisYardimi } from './PosGirisYardimi';
import { useYardimci } from './useYardimci';

export function CariProfili({
  cari,
  kartlar,
  mesgul,
  gizlilikNo,
  duzenle,
  sil,
  kartKaydet,
  kartSil,
  bildir,
}: {
  cari: PosCari;
  kartlar: PosKart[];
  mesgul: boolean;
  gizlilikNo: number;
  duzenle: () => void;
  sil: () => void;
  kartKaydet: (k: PosKart, beklenen: PosKart | null) => Promise<IslemSonucu>;
  kartSil: (k: PosKart) => Promise<IslemSonucu>;
  bildir: (m: string, h?: boolean) => void;
}) {
  const [aktarimNo, setAktarimNo] = useState(0);
  const yardimci = useYardimci();
  const elleGiris = (
    <PosGirisYardimi
      cari={cari}
      baslik="Elle POS’a giriş"
      izin={() => !mesgul}
      bildir={bildir}
      gizlilikNo={gizlilikNo}
      girisBasladi={() => {
        setAktarimNo((n) => n + 1);
      }}
    />
  );
  return (
    <div className="pos-profil-grid">
      <section className="kart">
        <div className="kart-ust">
          <div>
            <span className="etiket">Seçilen cari</span>
            <h2>{cari.ad}</h2>
            <p className="rakam">{numaraMaskesi(cari.numara)}</p>
          </div>
          <div className="satir-dugmeleri">
            <button className="dugme" type="button" disabled={mesgul} onClick={duzenle}>
              Cariyi düzenle
            </button>
            <button className="dugme tehlike" type="button" disabled={mesgul} onClick={sil}>
              Cariyi sil
            </button>
          </div>
        </div>
        {yardimci.hazir ? (
          <p className="pos-yardimci-hazir" role="status">
            ✓ POS yardımcısı kurulu ve ödeme formu tanıtılmış. Yeniden kurmanız gerekmez.
          </p>
        ) : yardimci.kapali ? (
          <p className="ipucu" role="status">
            POS yardımcısı kapalı. Açmak için tarayıcının sağ üstündeki uzantı simgesinden “CAL bup POS
            yardımcısı”na tıklayıp anahtarı açın, sonra bu sayfayı yenileyin.
          </p>
        ) : (
          yardimci.kurulum &&
          yardimci.bagli === false && (
            <p className="ipucu" role="status">
              POS yardımcısına ulaşılamadı. Tarayıcının eklenti sayfasında yardımcının açık olduğunu kontrol
              edip bu sayfayı yenileyin.
            </p>
          )
        )}
        <ol className="pos-adimlar pos-sira">
          <li>Aşağıdan kullanacağınız kartı seçin. Önce açık kalan eski POS sekmelerini kapatın.</li>
          <li>
            <b>Seçili kartla POS’u aç</b> düğmesine basın. Kart numarası, son kullanma ve kayıtlı CVV POS’a
            kendiliğinden yazılır{yardimci.hazir ? '' : ' (POS yardımcısı kuruluysa)'}.
          </li>
          <li>Tutarı ve banka onayını POS ekranında siz girin.</li>
        </ol>
        {!yardimci.hazir && (
          <p className="ipucu">Yardımcı kurulu değilse en alttaki “Elle POS’a giriş” bölümünü kullanın.</p>
        )}
      </section>
      <CariKartlari
        cari={cari}
        kartlar={kartlar}
        mesgul={mesgul}
        gizlilikNo={gizlilikNo}
        aktarimNo={aktarimNo}
        kaydet={kartKaydet}
        cariyiDuzenle={duzenle}
        yardimci={yardimci}
        sil={(k) => {
          if (
            !mesgul &&
            window.confirm(`“${cari.ad}” profilindeki “${k.ad}” (${kartMaskesi(k)}) kartı silinsin mi?`)
          )
            void kartSil(k);
        }}
      />
      {yardimci.hazir ? (
        <details className="pos-elle-giris">
          <summary>Elle POS’a giriş (yardımcı çalışmazsa)</summary>
          {elleGiris}
        </details>
      ) : (
        elleGiris
      )}
    </div>
  );
}
