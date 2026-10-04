import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import { numaraMaskesi, type PosCari } from '../../../cekirdek/posCari';
import { kartMaskesi, type PosKart } from '../../../cekirdek/posKart';
import { CariKartlari } from './CariKartlari';
import { PosGirisYardimi } from './PosGirisYardimi';

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
  kartKaydet: (k: PosKart) => Promise<IslemSonucu>;
  kartSil: (k: PosKart) => Promise<IslemSonucu>;
  bildir: (m: string, h?: boolean) => void;
}) {
  const [onayNo, setOnayNo] = useState<number | null>(null);
  const firmaOnay = onayNo === gizlilikNo;
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
        <p className="ipucu">
          Kart bilgileri bu carinin altında saklanır. Tutarı POS’ta kendiniz gireceksiniz.
        </p>
      </section>
      <CariKartlari
        cari={cari}
        kartlar={kartlar}
        mesgul={mesgul}
        gizlilikNo={gizlilikNo}
        firmaOnay={firmaOnay}
        kaydet={kartKaydet}
        kartDegisti={() => setOnayNo(null)}
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
        firmaKontrolu={(onay) => setOnayNo(onay ? gizlilikNo : null)}
        girisBasladi={() => setOnayNo(null)}
      />
    </div>
  );
}
