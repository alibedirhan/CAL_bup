import { FormHatasi } from '../../bilesenler/FormHatasi';
import { useRef } from 'react';
import { tarihMetni } from '../../../cekirdek/tarih';
import { DOSYA_TURU_ADLARI } from '../../../kaynaklar/tani';
import { XLSX_KABUL } from '../../../platform/dosya';
import { KAYNAK_TURLERI, type KaynakTuru } from '../../../raporlar/depoKontrol/oturum';
import { uyusmazlikSorusu } from '../../../raporlar/depoKontrol/tarihDenetimi';
import { Simge } from '../../bilesenler/Simge';
import type { DepoKontrol } from './useDepoKontrol';

const DENETIM_ADI: Record<KaynakTuru, string> = { d01: 'D01', sayim: 'Sayım fişi', subeAlis: 'Şube alış' };

/** 3. adım: LED dosyaları. Üçü birlikte bırakılır, türleri içeriğinden anlaşılır. */
export function KaynakBolumu({ dk }: { dk: DepoKontrol }) {
  const girdi = useRef<HTMLInputElement>(null);
  const g = dk.gorunum;
  const beklenenTarih = (tur: KaynakTuru) =>
    g.secim ? tarihMetni(tur === 'subeAlis' ? g.secim.onceki.tarih : g.secim.tarih) : null;

  return (
    <section className="kart" aria-labelledby="kaynak-baslik">
      <div className="kart-ust">
        <h2 id="kaynak-baslik">LED dosyaları</h2>
        <button
          type="button"
          className="dugme kucuk"
          onClick={() => girdi.current?.click()}
          disabled={dk.mesgul !== null}
        >
          Dosya seç
        </button>
      </div>
      <input
        ref={girdi}
        type="file"
        accept={XLSX_KABUL}
        multiple
        hidden
        onChange={(e) => {
          const dosyalar = [...(e.target.files ?? [])];
          e.target.value = '';
          if (dosyalar.length > 0) void dk.dosyalarGeldi(dosyalar);
        }}
      />

      <div
        className="birakma-alani"
        onClick={() => {
          if (!dk.mesgul) girdi.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!dk.mesgul) girdi.current?.click();
          }
        }}
        aria-disabled={dk.mesgul !== null}
        role="button"
        tabIndex={dk.mesgul ? -1 : 0}
      >
        <Simge ad="kutu" boyut={22} />
        <span>
          Üç dosyayı birlikte buraya sürükleyin.{' '}
          <small>Hangisinin hangisi olduğu içeriğinden anlaşılır.</small>
        </span>
      </div>

      <ul className="yuvalar">
        {KAYNAK_TURLERI.map((tur) => {
          const y = dk.oturum.kaynaklar[tur];
          const kv = g.okunan[tur];
          const hata = g.okumaHatalari[tur];
          const denetim = g.denetimler.find((d) => d.kaynak === DENETIM_ADI[tur]);
          const bekliyor = g.onayBekleyenler.find((d) => d.kaynak === DENETIM_ADI[tur]);
          const durum = hata || bekliyor ? 'uyari' : kv ? 'tamam' : '';
          return (
            <li key={tur} className={`yuva ${y ? 'dolu' : ''}`}>
              <span className={`dosya-simge ${durum}`}>
                <Simge ad={kv && !bekliyor ? 'tik' : 'dosya'} />
              </span>
              <div>
                <b>{DOSYA_TURU_ADLARI[tur]}</b>
                <span>
                  {y ? y.dosyaAdi : `Bekleniyor${beklenenTarih(tur) ? ` · ${beklenenTarih(tur)}` : ''}`}
                </span>
                {hata && <span className="alan-hatasi">{hata}</span>}
                {bekliyor && (
                  <div className="onay">
                    <p>{uyusmazlikSorusu(bekliyor)}</p>
                    <button
                      type="button"
                      className="dugme kucuk"
                      disabled={dk.mesgul !== null}
                      onClick={() => dk.tarihOnayla(bekliyor.kaynak)}
                    >
                      Evet, devam et
                    </button>
                  </div>
                )}
              </div>
              <div className="yuva-sag">
                {kv?.tarih && (
                  <span className={`rozet ${denetim?.durum === 'uygun' ? 'tamam' : ''}`}>
                    {tarihMetni(kv.tarih).slice(0, 5)}
                  </span>
                )}
                {y && (
                  <button
                    type="button"
                    className="dugme hayalet simge-dugme"
                    disabled={dk.mesgul !== null}
                    onClick={() => dk.kaynakKaldir(tur)}
                    aria-label={`${DOSYA_TURU_ADLARI[tur]} dosyasını kaldır`}
                    title="Kaldır"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <FormHatasi
        id="led-dosya-hata"
        hata={
          dk.oturum.reddedilenler.length
            ? `${dk.oturum.reddedilenler.length} dosya okunamadı. ${dk.oturum.reddedilenler[0]?.mesaj ?? ''}`
            : ''
        }
      />
      {dk.oturum.reddedilenler.map((r) => (
        <p key={r.dosyaAdi} className="alan-hatasi">
          <b>{r.dosyaAdi}:</b> {r.mesaj}
        </p>
      ))}
    </section>
  );
}
