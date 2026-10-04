import { useId, useRef } from 'react';
import { XLSX_KABUL } from '../../platform/dosya';

interface Ozellikler {
  baslik: string;
  alanAdi: string;
  dosyaAdi: string | null;
  kilitli: boolean;
  degisti: (dosya: File | null) => void;
}

/** Dosya adı React metnidir. Yerel seçim kullanıcı düğmesinden açılır. */
export function ExcelDosyaSecimi({ baslik, alanAdi, dosyaAdi, kilitli, degisti }: Ozellikler) {
  const girdi = useRef<HTMLInputElement>(null);
  const aciklama = useId();
  return (
    <div className="excel-dosya-secimi">
      <b>{baslik}</b>
      <span id={aciklama}>{dosyaAdi ?? 'Dosya seçilmedi'}</span>
      <button
        className="dugme kucuk"
        type="button"
        aria-label={`${alanAdi} seç`}
        aria-describedby={aciklama}
        disabled={kilitli}
        onClick={() => girdi.current?.click()}
      >
        {dosyaAdi ? 'Dosyayı değiştir' : 'Dosya seç'}
      </button>
      <input
        ref={girdi}
        hidden
        type="file"
        accept={XLSX_KABUL}
        aria-label={alanAdi}
        disabled={kilitli}
        onChange={(e) => {
          degisti(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </div>
  );
}
