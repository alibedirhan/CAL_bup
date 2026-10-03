import { kartFormunuDenetle } from '../../../cekirdek/posFormDenetimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import { KartFotografi } from './KartFotografi';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { kartDogrula, kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import type { PosCari } from '../../../cekirdek/posCari';

export function KartFormu({
  cari,
  kart,
  mesgul,
  kaydet,
  vazgec,
}: {
  cari: PosCari;
  kart: PosKart | null;
  mesgul: boolean;
  kaydet: (kart: PosKart) => Promise<IslemSonucu>;
  vazgec: () => void;
}) {
  const [ad, setAd] = useState(kart?.ad ?? '');
  const [numara, setNumara] = useState(kart?.numara ?? '');
  const [sahibi, setSahibi] = useState(kart?.sahibi ?? '');
  const [ay, setAy] = useState(kart?.ay ?? '');
  const [yil, setYil] = useState(kart?.yil ?? '');
  const [telefon, setTelefon] = useState(kart?.telefon ?? '');
  const [kontrol, setKontrol] = useState(false);
  const [hata, setHata] = useState('');
  const [alanlar, setAlanlar] = useState<Record<string, string>>({});
  const [formNo, setFormNo] = useState(0);
  const [okunuyor, setOkunuyor] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const bagli = useRef(false);
  useEffect(() => {
    bagli.current = true;
    const pencere = dialog.current;
    pencere?.showModal();
    return () => {
      bagli.current = false;
      pencere?.close();
    };
  }, []);
  const degistir = (f: (s: string) => void, deger: string) => {
    f(deger);
    setFormNo((n) => n + 1);
    setKontrol(false);
    setHata('');
    setAlanlar({});
  };
  const simdi = new Date().getFullYear();
  const yillar = [
    ...new Set([
      ...(kart ? [kart.yil] : []),
      ...(yil ? [yil] : []),
      ...Array.from({ length: 15 }, (_, i) => String(simdi + i)),
    ]),
  ].sort();
  return (
    <dialog
      className="pos-kart-dialog"
      ref={dialog}
      aria-labelledby="pos-kart-form-baslik"
      onCancel={(e) => {
        e.preventDefault();
        if (!mesgul) vazgec();
      }}
    >
      <div className="kart-ust">
        <h2 id="pos-kart-form-baslik">{kart ? 'Kartı düzenle' : 'Kart ekle'}</h2>
        <button
          className="dugme kucuk"
          type="button"
          disabled={mesgul}
          aria-label="Kart formunu kapat"
          onClick={vazgec}
        >
          Kapat
        </button>
      </div>
      <p>
        Bu kart <b>{cari.ad}</b> profiline kaydedilecek.
      </p>
      <KartFotografi
        mesgul={mesgul}
        formNo={formNo}
        durum={setOkunuyor}
        uygula={(n, t) => {
          setNumara(n);
          setAy(t?.ay ?? '');
          setYil(t?.yil ?? '');
          setKontrol(false);
          setHata('');
          setAlanlar({});
        }}
      />
      <FormHatasi hata={hata} id="pos-kart-hata" />
      <form
        className="pos-form"
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul || okunuyor) return;
          setHata('');
          try {
            const taslak = {
              id: kart?.id ?? crypto.randomUUID(),
              cariId: cari.id,
              ad,
              numara,
              sahibi,
              ay,
              yil,
              telefon,
              onayTarihi: new Date().toISOString(),
            };
            const hatalar = kartFormunuDenetle(taslak, kontrol);
            setAlanlar(hatalar);
            if (Object.keys(hatalar).length) {
              setHata(Object.values(hatalar).join(' '));
              return;
            }
            const k = kartDogrula(taslak);
            if (kartSuresiGecti(k)) throw new KullaniciHatasi('Kartın son kullanma tarihi geçmiş.');
            void kaydet(k).then((tamam) => {
              if (!bagli.current) return;
              if (tamam.durum === 'tamam') vazgec();
              else setHata(tamam.mesaj);
            });
          } catch (e) {
            setHata(e instanceof KullaniciHatasi ? e.message : 'Kart bilgilerini kontrol edin.');
          }
        }}
      >
        <label htmlFor="pos-kart-ad">Karta vereceğiniz isim</label>
        <input
          id="pos-kart-ad"
          aria-invalid={Boolean(alanlar['pos-kart-ad'])}
          aria-describedby={alanlar['pos-kart-ad'] ? 'pos-kart-hata' : undefined}
          className="girdi"
          maxLength={80}
          placeholder="Örn. Şirket kartı"
          value={ad}
          disabled={mesgul || okunuyor}
          onChange={(e) => degistir(setAd, e.target.value)}
          autoFocus
        />
        <label htmlFor="pos-kart-numara">Kart numarası</label>
        <input
          id="pos-kart-numara"
          aria-invalid={Boolean(alanlar['pos-kart-numara'])}
          aria-describedby={alanlar['pos-kart-numara'] ? 'pos-kart-hata' : undefined}
          className="girdi rakam"
          inputMode="numeric"
          maxLength={23}
          autoComplete="off"
          spellCheck={false}
          value={numara}
          disabled={mesgul || okunuyor}
          onChange={(e) => degistir(setNumara, e.target.value)}
        />
        <label htmlFor="pos-kart-sahibi">Kart üzerindeki ad</label>
        <input
          id="pos-kart-sahibi"
          aria-invalid={Boolean(alanlar['pos-kart-sahibi'])}
          aria-describedby={alanlar['pos-kart-sahibi'] ? 'pos-kart-hata' : undefined}
          className="girdi"
          maxLength={120}
          value={sahibi}
          disabled={mesgul || okunuyor}
          onChange={(e) => degistir(setSahibi, e.target.value)}
        />
        <div className="pos-tarih-alanlari">
          <label>
            Son kullanma ayı
            <select
              className="girdi"
              id="pos-kart-ay"
              aria-invalid={Boolean(alanlar['pos-kart-ay'])}
              aria-describedby={alanlar['pos-kart-ay'] ? 'pos-kart-hata' : undefined}
              aria-label="Son kullanma ayı"
              value={ay}
              disabled={mesgul || okunuyor}
              onChange={(e) => degistir(setAy, e.target.value)}
            >
              <option value="">Ay seçin</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Son kullanma yılı
            <select
              className="girdi"
              id="pos-kart-yil"
              aria-invalid={Boolean(alanlar['pos-kart-yil'])}
              aria-describedby={alanlar['pos-kart-yil'] ? 'pos-kart-hata' : undefined}
              aria-label="Son kullanma yılı"
              value={yil}
              disabled={mesgul || okunuyor}
              onChange={(e) => degistir(setYil, e.target.value)}
            >
              <option value="">Yıl seçin</option>
              {yillar.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        <label htmlFor="pos-kart-telefon">Kart sahibinin iletişim telefonu (isteğe bağlı)</label>
        <input
          id="pos-kart-telefon"
          aria-invalid={Boolean(alanlar['pos-kart-telefon'])}
          className="girdi"
          inputMode="tel"
          maxLength={24}
          value={telefon}
          disabled={mesgul || okunuyor}
          placeholder="05xx xxx xx xx"
          onChange={(e) => degistir(setTelefon, e.target.value)}
          aria-describedby={
            alanlar['pos-kart-telefon'] ? 'pos-kart-hata pos-kart-telefon-notu' : 'pos-kart-telefon-notu'
          }
        />
        <p id="pos-kart-telefon-notu" className="ipucu">
          Bu kayıt bankadaki telefonu değiştirmez. Doğrulama SMS’inin veya mobil onayın gideceği yeri banka
          belirler.
        </p>
        <p className="ipucu">
          CVV, banka şifresi ve doğrulama kodu kaydedilmez. Kart sahibi ve kart numarasını kontrol edin.
        </p>
        <label className="pos-onay">
          <input
            id="pos-kart-onay"
            aria-invalid={Boolean(alanlar['pos-kart-onay'])}
            aria-describedby={alanlar['pos-kart-onay'] ? 'pos-kart-hata' : undefined}
            type="checkbox"
            checked={kontrol}
            disabled={mesgul || okunuyor}
            onChange={(e) => setKontrol(e.target.checked)}
          />
          Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.
        </label>
        <div className="satir-dugmeleri">
          <button className="dugme birincil" type="submit" disabled={mesgul || okunuyor}>
            Kartı kaydet
          </button>
          <button className="dugme" type="button" disabled={mesgul} onClick={vazgec}>
            Vazgeç
          </button>
        </div>
      </form>
    </dialog>
  );
}
