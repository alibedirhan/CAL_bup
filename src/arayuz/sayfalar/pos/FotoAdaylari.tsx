import { useState } from 'react';
import type { KartOkumaSonucu } from '../../../cekirdek/posKartFotografi';
import { kartNumarasi } from '../../../cekirdek/posKart';
/** Adaylar fotoğraf oturumuna aittir. Uygulama tek işlemde PAN ve tarihi değiştirir. */
export function FotoAdaylari({
  sonuc,
  uygula,
}: {
  sonuc: KartOkumaSonucu;
  uygula: (n: string, t?: { ay: string; yil: string }) => void;
}) {
  const [numara, setNumara] = useState(sonuc.numaralar.length === 1 ? (sonuc.numaralar[0] ?? '') : '');
  const [tarih, setTarih] = useState(
    sonuc.tarihler.length === 1 ? `${sonuc.tarihler[0]?.ay}/${sonuc.tarihler[0]?.yil}` : '',
  );
  const [onay, setOnay] = useState(false);
  if (!sonuc.numaralar.length && !sonuc.tarihler.length) return null;
  const t = sonuc.tarihler.find((d) => `${d.ay}/${d.yil}` === tarih);
  const eksik = !numara || !t;
  const belirsiz = (sonuc.numaralar.length > 1 && !numara) || (sonuc.tarihler.length > 1 && !t);
  const kanit = sonuc.kanitlar?.filter((k) => k.deger === numara || k.deger === tarih);
  let gecersiz = false;
  if (numara) {
    try {
      kartNumarasi(numara);
    } catch {
      gecersiz = true;
    }
  }
  return (
    <section className="pos-foto-adaylari" aria-label="Fotoğraftan bulunan alanlar">
      <h3>Fotoğraftan bulunan alanlar</h3>
      {sonuc.numaralar.length > 0 && (
        <label>
          Bulunan kart numarası
          <select
            className="girdi"
            value={numara}
            onChange={(e) => {
              setNumara(e.target.value);
              setOnay(false);
            }}
          >
            <option value="">Numarayı seçin</option>
            {sonuc.numaralar.map((n, i) => (
              <option key={n} value={n}>
                {i + 1}. aday · {n.slice(0, 6)} •••• {n.slice(-4)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!sonuc.numaralar.length && (
        <label>
          Okunamayan kart numarasını elle tamamla
          <input
            className="girdi rakam"
            inputMode="numeric"
            maxLength={23}
            autoComplete="off"
            value={numara}
            aria-invalid={gecersiz}
            onChange={(e) => {
              setNumara(e.target.value);
              setOnay(false);
            }}
          />
          <span className="ipucu">
            Tarih okundu, kart numarası okunamadı. Fotoğraftaki numarayı elle yazabilir veya yalnızca numara
            bölgesini kırpıp yeniden okuyabilirsiniz.
          </span>
          {gecersiz && (
            <span className="alan-hatasi">Kart numarası kontrolü geçmedi. Rakamları kontrol edin.</span>
          )}
        </label>
      )}
      {numara && <p className="rakam">{numara.replace(/(.{4})(?=.)/g, '$1 ')}</p>}
      {sonuc.tarihler.length > 0 && (
        <label>
          Bulunan son kullanma tarihi
          <select
            className="girdi"
            value={tarih}
            onChange={(e) => {
              setTarih(e.target.value);
              setOnay(false);
            }}
          >
            <option value="">Tarihi seçin</option>
            {sonuc.tarihler.map((d) => (
              <option key={d.ay + d.yil} value={`${d.ay}/${d.yil}`}>
                {d.ay}/{d.yil}
              </option>
            ))}
          </select>
        </label>
      )}
      {kanit?.some((k) => k.guven < 80) && (
        <p className="alan-hatasi">Okuma puanı düşük. Rakamları fotoğrafla tek tek karşılaştırın.</p>
      )}
      {kanit?.length ? (
        <p className="ipucu">
          Okuma puanı (doğruluk garantisi değildir):{' '}
          {kanit.map((k) => `${k.tur === 'numara' ? 'numara' : 'tarih'} %${Math.round(k.guven)}`).join(', ')}.
          Bu değer kart sahipliğini doğrulamaz.
        </p>
      ) : null}
      <p className="ipucu">
        Uyguladığınızda formdaki eski kart numarası ve tarih birlikte değişir.
        {eksik ? ' Bulunmayan veya seçilmeyen alan boşaltılır; onu elle tamamlayın.' : ''} Kart sahibi ve
        iletişim telefonunu ayrıca kontrol edin.
      </p>
      <label className="pos-onay">
        <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} />
        Bulunan numara ve tarihi fotoğrafla karşılaştırdım.
      </label>
      <button
        className="dugme"
        type="button"
        disabled={!onay || belirsiz || gecersiz}
        onClick={() => uygula(numara.replace(/ /g, ''), t)}
      >
        Kontrol ettiğim alanları uygula
      </button>
    </section>
  );
}
