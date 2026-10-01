import type { RaporTanimi } from '../../raporlar/kayit';
import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { Simge } from '../bilesenler/Simge';

export function YakindaSayfasi({ rapor }: { rapor: RaporTanimi }) {
  return (
    <>
      <SayfaBasligi ust="Rapor · yakında" baslik={rapor.ad}>
        {rapor.aciklama}
      </SayfaBasligi>
      <div className="bos">
        <Simge ad="dosya" boyut={28} />
        <h2>Bu rapor henüz hazır değil</h2>
        <p>
          Hazırlamak için önce bu raporun LED çıktısından bir örnek ve şu an elle doldurduğunuz Excel sayfası
          gerekiyor. Hazır olduğunuzda bu iki dosyayı paylaşmanız yeterli.
        </p>
      </div>
    </>
  );
}
