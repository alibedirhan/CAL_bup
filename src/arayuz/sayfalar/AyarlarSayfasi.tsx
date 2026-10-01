import { SURUM } from '../../surum';
import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { TemaSecici } from '../bilesenler/TemaSecici';
import type { TemaTercihi } from '../tema';

interface Ozellikler {
  tema: TemaTercihi;
  temaDegisti: (t: TemaTercihi) => void;
}

export function AyarlarSayfasi({ tema, temaDegisti }: Ozellikler) {
  return (
    <>
      <SayfaBasligi ust="Kayıtlar" baslik="Ayarlar" />

      <section className="kart" aria-labelledby="gorunum-baslik">
        <div className="kart-ust">
          <div>
            <h2 id="gorunum-baslik">Görünüm</h2>
            <p>Sistem seçiliyse bilgisayarınızın açık/koyu ayarı izlenir.</p>
          </div>
          <TemaSecici tercih={tema} degisti={temaDegisti} genis />
        </div>
      </section>

      <section className="kart" aria-labelledby="rapor-ayar-baslik">
        <h2 id="rapor-ayar-baslik">Rapor ayarları</h2>
        <p>
          Pazar gününü atlama, kontrol toleransı, donuk ürün öneki gibi ayarlar günlük depo kontrol raporu
          çalışır hâle geldiğinde burada olacak.
        </p>
      </section>

      <section className="kart" aria-labelledby="hakkinda-baslik">
        <h2 id="hakkinda-baslik">Hakkında</h2>
        <dl className="bilgi-satirlari">
          <div>
            <dt>Sürüm</dt>
            <dd className="rakam">{SURUM}</dd>
          </div>
          <div>
            <dt>Dosyalarınız</dt>
            <dd>Yalnızca bu bilgisayarda işlenir</dd>
          </div>
          <div>
            <dt>Kaynak kod</dt>
            <dd>
              <a href="https://github.com/alibedirhan/Bup_Excel_Rapor" target="_blank" rel="noreferrer">
                github.com/alibedirhan/Bup_Excel_Rapor
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
