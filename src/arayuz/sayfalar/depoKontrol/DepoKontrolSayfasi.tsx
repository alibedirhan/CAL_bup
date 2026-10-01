import { useRef, useState, type DragEvent } from 'react';
import type { Ayarlar } from '../../../cekirdek/ayarlar';
import type { RaporTanimi } from '../../../raporlar/kayit';
import { KAYNAK_TURLERI } from '../../../raporlar/depoKontrol/oturum';
import { DOSYA_TURU_ADLARI } from '../../../kaynaklar/tani';
import { Adimlar } from '../../bilesenler/Adimlar';
import { Mesaj } from '../../bilesenler/Mesaj';
import { SayfaBasligi } from '../../bilesenler/SayfaBasligi';
import { Simge } from '../../bilesenler/Simge';
import { HedefBolumu } from './HedefBolumu';
import { KaynakBolumu } from './KaynakBolumu';
import { KayitCubugu, SonucKarti } from './KayitBolumu';
import { KontrolPaneli } from './KontrolPaneli';
import { SatirTablosu } from './SatirTablosu';
import { useDepoKontrol, type DepoKontrol } from './useDepoKontrol';

const ADIMLAR = ['Depo kontrol dosyası', 'Gün', 'LED dosyaları', 'Kontrol', 'Kaydet'] as const;

const MESGUL_METNI = {
  aciliyor: 'Depo kontrol dosyası açılıyor…',
  okunuyor: 'Dosyalar okunuyor…',
  kaydediliyor: 'Kaydediliyor…',
} as const;

/** Kontrol hazır olmadan sağ tarafta ne eksik olduğunu söyler. */
function Bekleme({ dk }: { dk: DepoKontrol }) {
  const g = dk.gorunum;
  let baslik = 'Kontrol burada görünecek';
  let metin = 'Depo kontrol dosyasını seçin, sonra üç LED dosyasını bırakın.';
  if (dk.oturum.hedef) {
    const eksik = KAYNAK_TURLERI.filter((t) => !g.okunan[t]).map((t) => DOSYA_TURU_ADLARI[t]);
    if (g.tarihHatasi || g.mevcutOnayiGerekli) {
      baslik = 'Gün seçimi bekleniyor';
      metin = 'Soldaki gün alanına bakın.';
    } else if (eksik.length > 0) {
      baslik = `${eksik.length} LED dosyası bekleniyor`;
      metin = eksik.join(', ');
    } else if (g.onayBekleyenler.length > 0) {
      baslik = 'Tarih onayı bekleniyor';
      metin =
        'Bir ya da daha fazla dosyanın tarihi seçilen günle uyuşmuyor. Soldan onaylayın ya da doğru dosyayı bırakın.';
    }
  }
  return (
    <div className="bos">
      <Simge ad="depo" boyut={28} />
      <h2>{baslik}</h2>
      <p>{metin}</p>
    </div>
  );
}

export function DepoKontrolSayfasi({ rapor, ayarlar }: { rapor: RaporTanimi; ayarlar: Ayarlar }) {
  const dk = useDepoKontrol(ayarlar);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const derinlik = useRef(0);
  const g = dk.gorunum;

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
      {dk.hata && (
        <Mesaj
          ton="hata"
          baslik="İşlem tamamlanamadı"
          eylem={
            <button type="button" className="dugme kucuk" onClick={dk.hataKapat}>
              Kapat
            </button>
          }
        >
          {dk.hata}
        </Mesaj>
      )}

      <div className="dk-izgara">
        <div className="dk-sol">
          <HedefBolumu dk={dk} />
          <KaynakBolumu dk={dk} />
        </div>
        <div className="dk-sag">
          {dk.sonuc ? (
            <SonucKarti dk={dk} />
          ) : g.plan && g.secim ? (
            <>
              <KontrolPaneli plan={g.plan} secim={g.secim} />
              <KayitCubugu dk={dk} />
              <SatirTablosu plan={g.plan} />
            </>
          ) : g.planHatasi ? (
            <Mesaj ton="hata" baslik="Sayfa hazırlanamadı">
              {g.planHatasi}
            </Mesaj>
          ) : (
            <Bekleme dk={dk} />
          )}
        </div>
      </div>

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
