import { useEffect, useRef, useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { kartDogrula, kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import type { PosCari } from '../../../cekirdek/posCari';
import { EN_BUYUK_KART_FOTOGRAFI, type KartOkumaSonucu } from '../../../cekirdek/posKartFotografi';
import { kartFotografiniOku } from '../../../platform/posKartOkuma';

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
  kaydet: (kart: PosKart) => Promise<boolean>;
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
  const [bilgi, setBilgi] = useState('');
  const [okunuyor, setOkunuyor] = useState(false);
  const [yuzde, setYuzde] = useState(0);
  const [adaylar, setAdaylar] = useState<KartOkumaSonucu | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const iptal = useRef<AbortController | null>(null);
  const bagli = useRef(false);
  const kilit = useRef(false);
  useEffect(() => {
    bagli.current = true;
    const pencere = dialog.current;
    pencere?.showModal();
    return () => {
      bagli.current = false;
      iptal.current?.abort();
      pencere?.close();
    };
  }, []);
  const degistir = (f: (s: string) => void, deger: string) => {
    f(deger);
    setKontrol(false);
    setHata('');
  };
  const oku = async (dosya: File) => {
    if (kilit.current || mesgul) return;
    if (dosya.size > EN_BUYUK_KART_FOTOGRAFI) {
      setHata('Fotoğraf en fazla 10 MB olabilir.');
      return;
    }
    iptal.current?.abort();
    const c = new AbortController();
    iptal.current = c;
    kilit.current = true;
    setOkunuyor(true);
    setYuzde(0);
    setHata('');
    setBilgi('');
    setKontrol(false);
    setAdaylar(null);
    try {
      const sonuc = await kartFotografiniOku(dosya, c.signal, (p) => {
        if (bagli.current && !c.signal.aborted) setYuzde(p);
      });
      if (!bagli.current || c.signal.aborted) return;
      setAdaylar(sonuc);
      const n = sonuc.numaralar[0];
      const t = sonuc.tarihler[0];
      if (sonuc.numaralar.length === 1 && n) setNumara(n);
      if (sonuc.tarihler.length === 1 && t) {
        setAy(t.ay);
        setYil(t.yil);
      }
      setBilgi(
        sonuc.numaralar.length || sonuc.tarihler.length
          ? 'Bulunan alanları fotoğrafla karşılaştırın. Eksik veya yanlış alanları elle düzeltin.'
          : 'Numara veya tarih okunamadı. Daha net bir fotoğraf seçebilir veya elle ekleyebilirsiniz.',
      );
    } catch (e) {
      if (bagli.current && !c.signal.aborted)
        setHata(e instanceof KullaniciHatasi ? e.message : 'Fotoğraf okunamadı. Elle devam edin.');
    } finally {
      kilit.current = false;
      if (bagli.current) setOkunuyor(false);
    }
  };
  const simdi = new Date().getFullYear();
  const yillar = [
    ...new Set([
      ...(kart ? [kart.yil] : []),
      ...(adaylar?.tarihler.map((t) => t.yil) ?? []),
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
      <div className="pos-fotograf">
        <label htmlFor="pos-kart-fotograf">Kart fotoğrafından numara ve tarih oku</label>
        <input
          id="pos-kart-fotograf"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={mesgul || okunuyor}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void oku(f);
          }}
        />
        <p className="ipucu">
          İsteğe bağlı. Fotoğraf bu tarayıcıda okunur, kaydedilmez ve gönderilmez. CVV çıkarılmaz.
          JPG/PNG/WebP, en fazla 10 MB.
        </p>
        {okunuyor && (
          <div className="satir-dugmeleri">
            <p role="status">Fotoğraf okunuyor… %{yuzde}</p>
            <button className="dugme kucuk" type="button" onClick={() => iptal.current?.abort()}>
              Okumayı durdur
            </button>
          </div>
        )}
        {bilgi && <p role="status">{bilgi}</p>}
        {adaylar && adaylar.numaralar.length > 1 && (
          <label>
            Birden fazla numara bulundu
            <select
              className="girdi"
              value=""
              onChange={(e) => {
                const n = adaylar.numaralar[Number(e.target.value)];
                if (n) degistir(setNumara, n);
              }}
            >
              <option value="">Numarayı son dört rakamına göre seçin</option>
              {adaylar.numaralar.map((n, i) => (
                <option key={i} value={i}>
                  •••• {n.slice(-4)}
                </option>
              ))}
            </select>
          </label>
        )}
        {adaylar && adaylar.tarihler.length > 1 && (
          <p className="ipucu">Birden fazla tarih bulundu. Son kullanma tarihini aşağıda elle seçin.</p>
        )}
      </div>
      <form
        className="pos-form"
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (mesgul || okunuyor) return;
          setHata('');
          try {
            if (!kontrol)
              throw new KullaniciHatasi(
                'Kaydetmeden önce kartı ve bağlı cariyi kontrol edip kutuyu işaretleyin.',
              );
            const k = kartDogrula({
              id: kart?.id ?? crypto.randomUUID(),
              cariId: cari.id,
              ad,
              numara,
              sahibi,
              ay,
              yil,
              telefon,
              onayTarihi: new Date().toISOString(),
            });
            if (kartSuresiGecti(k)) throw new KullaniciHatasi('Kartın son kullanma tarihi geçmiş.');
            void kaydet(k).then((tamam) => {
              if (tamam && bagli.current) vazgec();
            });
          } catch (e) {
            setHata(e instanceof KullaniciHatasi ? e.message : 'Kart bilgilerini kontrol edin.');
          }
        }}
      >
        <label htmlFor="pos-kart-ad">Karta vereceğiniz isim</label>
        <input
          id="pos-kart-ad"
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
          className="girdi"
          inputMode="tel"
          maxLength={24}
          value={telefon}
          disabled={mesgul || okunuyor}
          placeholder="05xx xxx xx xx"
          onChange={(e) => degistir(setTelefon, e.target.value)}
          aria-describedby="pos-kart-telefon-notu"
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
            type="checkbox"
            checked={kontrol}
            disabled={mesgul || okunuyor}
            onChange={(e) => setKontrol(e.target.checked)}
          />
          Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.
        </label>
        {hata && (
          <p className="alan-hatasi" role="alert">
            {hata}
          </p>
        )}
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
