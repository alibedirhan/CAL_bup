import { useEffect, useRef } from 'react';
import { tarihMetni } from '../../../cekirdek/tarih';
import { DOSYA_TURU_ADLARI } from '../../../kaynaklar/tani';
import { KAYNAK_TURLERI, type KaynakTuru } from '../../../raporlar/depoKontrol/oturum';
import { Simge } from '../../bilesenler/Simge';
import type { DepoKontrol } from './useDepoKontrol';

const DENETIM_ADI: Record<KaynakTuru, string> = { d01: 'D01', sayim: 'Sayım fişi', subeAlis: 'Şube alış' };

/**
 * 3. adım: LED dosyaları. Üçü birlikte bırakılır, türleri içeriğinden anlaşılır.
 * Tarihi uymayan dosyanın sorusu sağdaki “sıradaki adım” kutusunda sorulur; burada yalnız durum görünür.
 */
export function KaynakBolumu({ dk, ledSec }: { dk: DepoKontrol; ledSec: () => void }) {
  const g = dk.gorunum;
  const mesgul = dk.mesgul !== null;
  const reddedilenler = dk.oturum.reddedilenler;
  const hataAlani = useRef<HTMLDivElement>(null);
  // Dar ekranda da görülsün: tanınmayan dosya açıklaması görünür yapılır ve odaklanır.
  useEffect(() => {
    if (reddedilenler.length === 0) return;
    hataAlani.current?.focus();
    hataAlani.current?.scrollIntoView({ block: 'nearest' });
  }, [reddedilenler]);
  const beklenenTarih = (tur: KaynakTuru) =>
    g.secim ? tarihMetni(tur === 'subeAlis' ? g.secim.onceki.tarih : g.secim.tarih) : null;

  return (
    <section className="kart" aria-labelledby="kaynak-baslik">
      <div className="kart-ust">
        <h2 id="kaynak-baslik">LED dosyaları</h2>
        <button type="button" className="dugme kucuk" onClick={ledSec} disabled={mesgul}>
          Dosya seç
        </button>
      </div>

      <div
        className="birakma-alani"
        onClick={ledSec}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ledSec();
          }
        }}
        aria-disabled={mesgul}
        role="button"
        tabIndex={mesgul ? -1 : 0}
      >
        <Simge ad="kutu" boyut={22} />
        <span>
          Üç dosyayı birlikte buraya sürükleyin ya da tıklayıp seçin.{' '}
          <small>Hangisinin hangisi olduğu içeriğinden anlaşılır.</small>
        </span>
      </div>

      <ul className="yuvalar">
        {KAYNAK_TURLERI.map((tur) => {
          const y = dk.oturum.kaynaklar[tur];
          const kv = g.okunan[tur];
          const hata = g.okumaHatalari[tur];
          const denetim = g.denetimler.find((d) => d.kaynak === DENETIM_ADI[tur]);
          const bekliyor = g.onayBekleyenler.some((d) => d.kaynak === DENETIM_ADI[tur]);
          const onaylandi = denetim?.durum === 'uyusmuyor' && !bekliyor;
          const durum = hata || bekliyor ? 'uyari' : kv ? 'tamam' : '';
          const rozet = denetim?.durum === 'uygun' ? 'tamam' : denetim?.durum === 'uyusmuyor' ? 'uyari' : '';
          return (
            <li key={tur} className={`yuva ${y ? 'dolu' : ''}`}>
              <span className={`dosya-simge ${durum}`}>
                <Simge ad={hata || bekliyor ? 'uyari' : kv ? 'tik' : 'dosya'} />
              </span>
              <div>
                <b>{DOSYA_TURU_ADLARI[tur]}</b>
                {y ? (
                  <span className="dosya-adi" title={y.dosyaAdi}>
                    {y.dosyaAdi}
                  </span>
                ) : (
                  <span>Bekleniyor{beklenenTarih(tur) ? ` · ${beklenenTarih(tur)}` : ''}</span>
                )}
                {hata && <span className="alan-hatasi">{hata}</span>}
                {denetim?.durum === 'uyusmuyor' && (
                  <span className="yuva-not">
                    Beklenen {tarihMetni(denetim.beklenen)}
                    {onaylandi ? ' · onaylandı' : ' · onay bekliyor'}
                  </span>
                )}
              </div>
              <div className="yuva-sag">
                {kv?.tarih && <span className={`rozet ${rozet}`}>{tarihMetni(kv.tarih).slice(0, 5)}</span>}
                {y && (
                  <button
                    type="button"
                    className="dugme hayalet simge-dugme"
                    disabled={mesgul}
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

      {reddedilenler.length > 0 && (
        <div id="led-dosya-hata" ref={hataAlani} tabIndex={-1} className="reddedilenler" role="alert">
          <b>{reddedilenler.length} dosya okunamadı:</b>
          {reddedilenler.map((r) => (
            <p key={r.dosyaAdi} className="alan-hatasi">
              <b>{r.dosyaAdi}:</b> {r.mesaj}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
