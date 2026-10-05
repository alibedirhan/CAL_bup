import { useRef, useState } from 'react';
import type { KartGoruntuDuzeltmesi } from '../../../cekirdek/posKartFotografi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import { useKartFotografi } from './useKartFotografi';
import { FotoAdaylari } from './FotoAdaylari';
export function KartFotografi({
  mesgul,
  formNo,
  durum,
  gizli,
  uygula,
}: {
  mesgul: boolean;
  gizli: boolean;
  formNo: number;
  durum: (okunuyor: boolean) => void;
  uygula: (n: string, t?: { ay: string; yil: string }) => void;
}) {
  const [kirpmaHatasi, setKirpmaHatasi] = useState('');
  const f = useKartFotografi(formNo, durum);
  const girdi = useRef<HTMLInputElement>(null);
  const kilitli = mesgul || f.mesgul;
  return (
    <div className="pos-fotograf">
      <label htmlFor="pos-kart-fotograf">Kart fotoğrafından numara ve tarih oku</label>
      <input
        ref={girdi}
        id="pos-kart-fotograf"
        type="file"
        className="gorunmez"
        accept="image/jpeg,image/png,image/webp"
        disabled={kilitli}
        onChange={(e) => {
          const dosya = e.target.files?.[0];
          e.target.value = '';
          if (dosya) f.sec(dosya);
        }}
      />
      <button className="dugme" type="button" disabled={kilitli} onClick={() => girdi.current?.click()}>
        {f.dosya ? 'Başka fotoğraf seç' : 'Fotoğraf seç'}
      </button>
      <p className="ipucu">
        İsteğe bağlı. Fotoğraf yalnızca bu tarayıcıda okunur; kaydedilmez ve gönderilmez. CVV çıkarılmaz.
        JPG/PNG/WebP, en fazla 10 MB ve 20 megapiksel.
      </p>
      {f.onizleme && (
        <img
          className={gizli ? 'pos-foto-onizleme pos-foto-gizli' : 'pos-foto-onizleme'}
          src={f.onizleme}
          alt="Seçilen kart fotoğrafının geçici önizlemesi"
        />
      )}
      {f.dosya && (
        <details>
          <summary>Fotoğrafı döndür veya kırp</summary>
          <div className="satir-dugmeleri">
            <button
              className="dugme kucuk"
              type="button"
              disabled={kilitli}
              onClick={() => f.duzelt({ ...f.duzeltme, donus: (f.duzeltme.donus + 90) % 360 })}
            >
              90° döndür
            </button>
          </div>
          <p className="ipucu">
            Numara ve tarih kadrajda kalsın. Eğiklik −20° ile 20° arasında düzeltilebilir.
          </p>
          <div className="pos-foto-kirpma">
            {(
              [
                ['egim', 'Eğiklik (derece)', -20, 20],
                ['sol', 'Soldan kes (%)', 0, 90],
                ['ust', 'Üstten kes (%)', 0, 90],
                ['genislik', 'Genişlik (%)', 10, 100],
                ['yukseklik', 'Yükseklik (%)', 10, 100],
              ] as const
            ).map(([alan, etiket, min, max]) => (
              <label key={alan}>
                {etiket}
                <input
                  className="girdi"
                  type="number"
                  min={min}
                  max={max}
                  step="1"
                  defaultValue={f.duzeltme[alan]}
                  key={f.duzeltme[alan]}
                  disabled={kilitli}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    const d: KartGoruntuDuzeltmesi = { ...f.duzeltme, [alan]: v };
                    if (!e.target.value || v < min || v > max || !Number.isFinite(v)) {
                      setKirpmaHatasi(
                        `${etiket}: ${min}–${max} arasında bir değer yazın. Önizleme değiştirilmedi.`,
                      );
                      return;
                    }
                    if (alan === 'sol') d.genislik = Math.min(d.genislik, 100 - v);
                    if (alan === 'ust') d.yukseklik = Math.min(d.yukseklik, 100 - v);
                    setKirpmaHatasi('');
                    f.duzelt(d);
                  }}
                />
              </label>
            ))}
          </div>
        </details>
      )}
      {f.mesgul && (
        <div className="satir-dugmeleri">
          <p role="status">
            {f.asama === 'okuma'
              ? `Fotoğraf okunuyor… %${f.yuzde}`
              : f.asama === 'model'
                ? 'Fotoğraf okuma bileşeni hazırlanıyor…'
                : 'Fotoğraf denetleniyor ve hazırlanıyor…'}
          </p>
          <button className="dugme kucuk" type="button" onClick={f.durdur}>
            Okumayı durdur
          </button>
        </div>
      )}
      <FormHatasi hata={kirpmaHatasi} id="pos-kirpma-hata" />
      <FormHatasi hata={f.hata} id="pos-foto-hata" />
      {f.bilgi && <p role="status">{f.bilgi}</p>}
      {f.eskiAday && (
        <p role="status">
          Formu elle değiştirdiniz; önceki fotoğraf adayları kaldırıldı. Gerekirse yeniden okuyun.
        </p>
      )}
      {f.aday && (
        <FotoAdaylari
          sonuc={f.aday}
          gizli={gizli}
          uygula={(n, t) => {
            uygula(n, t);
            f.uygulandi();
          }}
        />
      )}
      {f.dosya && !f.mesgul && (
        <div className="satir-dugmeleri">
          <button className="dugme kucuk" type="button" disabled={mesgul} onClick={f.oku}>
            Fotoğrafı yeniden oku
          </button>
          <button className="dugme kucuk" type="button" disabled={mesgul} onClick={f.kaldir}>
            Fotoğrafı kaldır
          </button>
        </div>
      )}
    </div>
  );
}
