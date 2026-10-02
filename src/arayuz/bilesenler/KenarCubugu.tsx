import { RAPORLAR } from '../../raporlar/kayit';
import { SURUM } from '../../surum';
import { rotaAdresi, type Rota } from '../rota';
import type { TemaTercihi } from '../tema';
import { Simge, type SimgeAdi } from './Simge';
import { TemaSecici } from './TemaSecici';

const RAPOR_SIMGELERI: Record<string, SimgeAdi> = {
  'depo-kontrol': 'depo',
  envanter: 'kutu',
  bakiye: 'terazi',
  'palet-kasa': 'palet',
};

interface Ozellikler {
  rota: Rota;
  tema: TemaTercihi;
  temaDegisti: (t: TemaTercihi) => void;
}

export function KenarCubugu({ rota, tema, temaDegisti }: Ozellikler) {
  const secili = (r: Rota) => rotaAdresi(r) === rotaAdresi(rota);

  return (
    <aside className="kenar">
      <a className="marka" href={rotaAdresi({ tur: 'rapor', id: 'depo-kontrol' })}>
        <span className="marka-isaret" aria-hidden="true">
          C
        </span>
        <span className="marka-ad">
          CAL bup
          <small>İzmir Bölge Deposu</small>
        </span>
      </a>

      <nav className="menu" aria-label="Raporlar">
        <div className="etiket">Raporlar</div>
        {RAPORLAR.map((r) => {
          const hedef: Rota = { tur: 'rapor', id: r.id };
          return (
            <a
              key={r.id}
              className={r.durum === 'yakinda' ? 'menu-oge pasif' : 'menu-oge'}
              href={rotaAdresi(hedef)}
              aria-current={secili(hedef) ? 'page' : undefined}
            >
              <Simge ad={RAPOR_SIMGELERI[r.id] ?? 'dosya'} />
              {r.ad}
              {r.durum === 'yakinda' && <span className="rozet">yakında</span>}
            </a>
          );
        })}
      </nav>

      <nav className="menu" aria-label="İşlemler">
        <div className="etiket">İşlemler</div>
        <a
          className="menu-oge"
          href="#/sanal-pos"
          aria-current={rota.tur === 'sanal-pos' ? 'page' : undefined}
        >
          <Simge ad="kart" />
          Sanal POS
        </a>
      </nav>

      <nav className="menu" aria-label="Kayıtlar">
        <div className="etiket">Kayıtlar</div>
        <a className="menu-oge" href="#/gecmis" aria-current={rota.tur === 'gecmis' ? 'page' : undefined}>
          <Simge ad="gecmis" />
          Geçmiş
        </a>
        <a className="menu-oge" href="#/ayarlar" aria-current={rota.tur === 'ayarlar' ? 'page' : undefined}>
          <Simge ad="ayar" />
          Ayarlar
        </a>
      </nav>

      <div className="kenar-alt">
        <p className="yerel-not">
          <Simge ad="kilit" boyut={15} />
          Dosyalarınız bu bilgisayarda işlenir. Drive’a yalnızca siz gönderirsiniz.
        </p>
        <TemaSecici tercih={tema} degisti={temaDegisti} />
        <span className="surum">Sürüm {SURUM}</span>
      </div>
    </aside>
  );
}
