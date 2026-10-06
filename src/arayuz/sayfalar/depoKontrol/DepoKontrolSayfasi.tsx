import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import { useRef, useState, type DragEvent } from 'react';
import type { Ayarlar } from '../../../cekirdek/ayarlar';
import type { RaporTanimi } from '../../../raporlar/kayit';
import { XLSX_KABUL } from '../../../platform/dosya';
import { Adimlar } from '../../bilesenler/Adimlar';
import { Mesaj } from '../../bilesenler/Mesaj';
import { SayfaBasligi } from '../../bilesenler/SayfaBasligi';
import { Simge } from '../../bilesenler/Simge';
import { HedefBolumu } from './HedefBolumu';
import { KaynakBolumu } from './KaynakBolumu';
import { KayitCubugu, SonucKarti } from './KayitBolumu';
import { KontrolPaneli } from './KontrolPaneli';
import { SatirTablosu, type Suzgec } from './SatirTablosu';
import { SiradakiAdim } from './SiradakiAdim';
import { useDepoKontrol } from './useDepoKontrol';

const ADIMLAR = ['Depo kontrol dosyası', 'Gün', 'LED dosyaları', 'Kontrol', 'Kaydet'] as const;

const MESGUL_METNI = {
  aciliyor: 'Depo kontrol dosyası açılıyor…',
  okunuyor: 'Dosyalar okunuyor…',
  kaydediliyor: 'Kaydediliyor…',
} as const;

export function DepoKontrolSayfasi({ rapor, ayarlar }: { rapor: RaporTanimi; ayarlar: Ayarlar }) {
  const dk = useDepoKontrol(ayarlar);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [suzgec, setSuzgec] = useState<Suzgec>('tumu');
  const derinlik = useRef(0);
  const ledGirdisi = useRef<HTMLInputElement>(null);
  const tablo = useRef<HTMLDivElement>(null);
  const g = dk.gorunum;
  const ledSec = () => {
    if (!dk.mesgul) ledGirdisi.current?.click();
  };
  const farklariGoster = () => {
    setSuzgec('fark');
    tablo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const dosyaVar = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');
  const surukle = {
    onDragEnter: (e: DragEvent) => {
      if (!dosyaVar(e)) return;
      derinlik.current++;
      setSurukleniyor(true);
    },
    onDragLeave: () => {
      derinlik.current = Math.max(0, derinlik.current - 1);
      if (derinlik.current === 0) setSurukleniyor(false);
    },
    onDragOver: (e: DragEvent) => {
      if (dosyaVar(e)) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      derinlik.current = 0;
      setSurukleniyor(false);
      void dk.dosyalarGeldi(e.dataTransfer);
    },
  };

  return (
    <div className="dk" {...surukle}>
      <SayfaBasligi ust="Rapor" baslik={rapor.ad}>
        {rapor.aciklama}
      </SayfaBasligi>

      <Adimlar adlar={ADIMLAR} simdiki={dk.sonuc ? 6 : g.adim} />

      {dk.mesgul && (
        <div className="mesgul" role="status">
          <span className="donen" aria-hidden="true" />
          {MESGUL_METNI[dk.mesgul]}
        </div>
      )}
      <IslemBildirimi islem={dk.islem} />

      <div className="dk-izgara">
        <div className="dk-sol">
          <HedefBolumu dk={dk} />
          <KaynakBolumu dk={dk} ledSec={ledSec} />
        </div>
        <div className="dk-sag">
          {dk.sonuc ? (
            <SonucKarti dk={dk} />
          ) : g.plan && g.secim ? (
            <>
              <KontrolPaneli plan={g.plan} secim={g.secim} farklariGoster={farklariGoster} />
              <KayitCubugu dk={dk} />
              <div ref={tablo}>
                <SatirTablosu plan={g.plan} suzgec={suzgec} suzgecSec={setSuzgec} />
              </div>
            </>
          ) : g.planHatasi ? (
            <Mesaj ton="hata" baslik="Sayfa hazırlanamadı">
              {g.planHatasi}
            </Mesaj>
          ) : (
            <SiradakiAdim dk={dk} ledSec={ledSec} />
          )}
        </div>
      </div>

      <input
        ref={ledGirdisi}
        type="file"
        accept={XLSX_KABUL}
        multiple
        hidden
        aria-label="LED dosyalarını seç"
        onChange={(e) => {
          const dosyalar = [...(e.target.files ?? [])];
          e.target.value = '';
          if (dosyalar.length > 0) void dk.dosyalarGeldi(dosyalar);
        }}
      />

      {surukleniyor && (
        <div className="surukle-ortu" aria-hidden="true">
          <div>
            <Simge ad="kutu" boyut={36} />
            <b>Dosyaları bırakın</b>
            <span>LED dosyaları ve isterseniz depo kontrol dosyası</span>
          </div>
        </div>
      )}
    </div>
  );
}
