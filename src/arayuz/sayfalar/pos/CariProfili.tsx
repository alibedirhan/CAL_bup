import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useEffect, useState } from 'react';
import { numaraMaskesi, type PosCari } from '../../../cekirdek/posCari';
import { kartMaskesi, type PosKart } from '../../../cekirdek/posKart';
import { CariKartlari } from './CariKartlari';
import { PosGirisYardimi } from './PosGirisYardimi';

/** Firma beyanı POS oturumuyla ilgilidir; sekme geçişinde korunur, en fazla bu kadar geçerlidir. */
export const FIRMA_ONAYI_SURESI = 30 * 60_000;

export function CariProfili({
  cari,
  kartlar,
  mesgul,
  gizlilikNo,
  duzenle,
  kartKaydet,
  kartSil,
  bildir,
}: {
  cari: PosCari;
  kartlar: PosKart[];
  mesgul: boolean;
  gizlilikNo: number;
  duzenle: () => void;
  kartKaydet: (k: PosKart, beklenen: PosKart | null) => Promise<IslemSonucu>;
  kartSil: (k: PosKart) => Promise<IslemSonucu>;
  bildir: (m: string, h?: boolean) => void;
}) {
  // Sayaç: her onay ayrı bir süre başlatır; eski zamanlayıcı yeni onayı kapatamaz.
  const [onay, setOnay] = useState(0);
  const [onayNo, setOnayNo] = useState(0);
  const [aktarimNo, setAktarimNo] = useState(0);
  const firmaOnay = onay > 0 && onay === onayNo;
  useEffect(() => {
    if (!firmaOnay) return;
    const t = window.setTimeout(() => setOnay(0), FIRMA_ONAYI_SURESI);
    return () => {
      window.clearTimeout(t);
    };
  }, [firmaOnay, onayNo]);
  const onayla = (evet: boolean) => {
    if (!evet) {
      setOnay(0);
      return;
    }
    const yeni = onayNo + 1;
    setOnayNo(yeni);
    setOnay(yeni);
  };
  return (
    <div className="pos-profil-grid">
      <section className="kart">
        <div className="kart-ust">
          <div>
            <span className="etiket">Seçilen cari</span>
            <h2>{cari.ad}</h2>
            <p className="rakam">{numaraMaskesi(cari.numara)}</p>
          </div>
          <button className="dugme" type="button" disabled={mesgul} onClick={duzenle}>
            Cariyi düzenle
          </button>
        </div>
        <ol className="pos-adimlar pos-sira">
          <li>Aşağıdan kullanacağınız kartı seçin. Önce açık kalan eski POS sekmelerini kapatın.</li>
          <li>
            İsterseniz CVV’yi yazın (kaydedilmez) ve <b>Seçili kartla POS’u aç</b> düğmesine basın. POS
            yardımcısı kuruluysa kart bilgileri POS’a kendiliğinden yazılır.
          </li>
          <li>Tutarı ve banka onayını POS ekranında siz girin.</li>
        </ol>
        <p className="ipucu">Yardımcı kurulu değilse en alttaki “Elle POS’a giriş” bölümünü kullanın.</p>
      </section>
      <CariKartlari
        cari={cari}
        kartlar={kartlar}
        mesgul={mesgul}
        gizlilikNo={gizlilikNo}
        aktarimNo={aktarimNo}
        firmaOnay={firmaOnay}
        kaydet={kartKaydet}
        kartDegisti={() => onayla(false)}
        cariyiDuzenle={duzenle}
        sil={(k) => {
          if (
            !mesgul &&
            window.confirm(`“${cari.ad}” profilindeki “${k.ad}” (${kartMaskesi(k)}) kartı silinsin mi?`)
          )
            void kartSil(k);
        }}
      />
      <PosGirisYardimi
        cari={cari}
        baslik="Elle POS’a giriş"
        izin={() => !mesgul}
        bildir={bildir}
        gizlilikNo={gizlilikNo}
        firmaDogrulandi={firmaOnay}
        firmaKontrolu={onayla}
        girisBasladi={() => {
          onayla(false);
          setAktarimNo((n) => n + 1);
        }}
      />
    </div>
  );
}
