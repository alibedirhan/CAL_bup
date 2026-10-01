import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { Simge } from '../bilesenler/Simge';

export function GecmisSayfasi() {
  return (
    <>
      <SayfaBasligi ust="Kayıtlar" baslik="Geçmiş">
        Her rapor çalıştırması tarihi, toplamları ve kontrol sonucuyla burada listelenir.
      </SayfaBasligi>
      <div className="bos">
        <Simge ad="gecmis" boyut={28} />
        <h2>Henüz kayıt yok</h2>
        <p>İlk günlük depo kontrolünü kaydettiğinizde burada görünecek.</p>
      </div>
    </>
  );
}
