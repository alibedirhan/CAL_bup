import type { ReactNode } from 'react';
import { sayfaAdi, tarihMetni } from '../../../cekirdek/tarih';
import { DOSYA_TURU_ADLARI } from '../../../kaynaklar/tani';
import { KAYNAK_TURLERI } from '../../../raporlar/depoKontrol/oturum';
import { Simge } from '../../bilesenler/Simge';
import type { DepoKontrol } from './useDepoKontrol';

/**
 * Kontrol hazır olmadan sağ tarafta sıradaki işi söyler. Kullanıcıdan beklenen sorular
 * (var olan sayfa, uyuşmayan dosya tarihi) burada, düğmeleriyle birlikte sorulur.
 */
export function SiradakiAdim({ dk, ledSec }: { dk: DepoKontrol; ledSec: () => void }) {
  const g = dk.gorunum;
  const mesgul = dk.mesgul !== null;
  const reddedilen = dk.oturum.reddedilenler;

  if (!dk.oturum.hedef)
    return (
      <Kutu baslik="Kontrol burada görünecek">
        <p>
          Önce depo kontrol dosyasını açın, sonra üç LED dosyasını bırakın. Dört dosyayı birlikte de
          sürükleyebilirsiniz; hangisinin hangisi olduğu içeriğinden anlaşılır.
        </p>
      </Kutu>
    );

  if (g.yilOnayiGerekli)
    return (
      <Kutu baslik="Dosya yılı kontrolü bekleniyor">
        <p>Depo kontrol dosyası bölümündeki yılı kontrol edip onaylayın.</p>
      </Kutu>
    );

  if (g.tarihHatasi)
    return (
      <Kutu baslik="Gün seçimi bekleniyor" ton="uyari">
        <p>{g.tarihHatasi}</p>
        {dk.oturum.tarihGirdisi && (
          <button type="button" className="dugme" disabled={mesgul} onClick={dk.oneriyeDon}>
            Önerilen güne dön
          </button>
        )}
      </Kutu>
    );

  if (g.mevcutOnayiGerekli && g.secim)
    return (
      <Kutu baslik={`'${g.secim.ad}' sayfası zaten var`} ton="uyari">
        <p>
          Bu sayfa LED dosyalarından yeniden doldurulsun mu? Miktarlar, tarihler ve formüller yeniden yazılır;
          eksik ürünler listeye eklenebilir. Kaydetmeden önce kontrolü yine göreceksiniz.
        </p>
        <div className="satir-dugmeleri">
          <button type="button" className="dugme birincil" disabled={mesgul} onClick={dk.mevcutOnayla}>
            Evet, yeniden doldur
          </button>
          {g.oneri && (
            <button type="button" className="dugme" disabled={mesgul} onClick={dk.oneriyeDon}>
              Hayır, yeni gün ({sayfaAdi(g.oneri)}) hazırla
            </button>
          )}
        </div>
      </Kutu>
    );

  const eksik = KAYNAK_TURLERI.filter((t) => !g.okunan[t]);
  if (eksik.length > 0)
    return (
      <Kutu baslik={`${eksik.length} LED dosyası bekleniyor`}>
        <ul className="eksik-listesi">
          {eksik.map((t) => (
            <li key={t}>
              <b>{DOSYA_TURU_ADLARI[t]}</b>
              {g.secim && (
                <span> · {tarihMetni(t === 'subeAlis' ? g.secim.onceki.tarih : g.secim.tarih)} tarihli</span>
              )}
              {g.okumaHatalari[t] && <span className="alan-hatasi">{g.okumaHatalari[t]}</span>}
            </li>
          ))}
        </ul>
        <button type="button" className="dugme birincil" disabled={mesgul} onClick={ledSec}>
          <Simge ad="dosya" boyut={16} />
          LED dosyalarını seç
        </button>
        <p className="ipucu">Dosyaları bu sayfanın herhangi bir yerine de sürükleyebilirsiniz.</p>
        {reddedilen.length > 0 && (
          <p className="alan-hatasi">
            Son bıraktığınız {reddedilen.length === 1 ? 'dosya' : `${reddedilen.length} dosya`} tanınmadı.
            Nedeni LED dosyaları bölümünde yazıyor.
          </p>
        )}
      </Kutu>
    );

  if (g.onayBekleyenler.length > 0)
    return (
      <Kutu baslik="Dosya tarihleri seçilen günle uyuşmuyor" ton="uyari">
        <ul className="eksik-listesi">
          {g.onayBekleyenler.map((d) => (
            <li key={d.kaynak}>
              <b>{d.kaynak}</b>: dosyada {d.bulunan ? tarihMetni(d.bulunan) : '?'}, beklenen{' '}
              {tarihMetni(d.beklenen)}
            </li>
          ))}
        </ul>
        <p>
          {g.dosyaGunu
            ? `Dosyalar ${tarihMetni(g.dosyaGunu)} gününe ait görünüyor. Günü değiştirebilir, yanlış dosyanın yerine doğrusunu bırakabilir ya da bu dosyalarla devam edebilirsiniz.`
            : 'Yanlış dosyanın yerine doğrusunu bırakabilir ya da bu dosyalarla devam edebilirsiniz.'}
        </p>
        <div className="satir-dugmeleri">
          {g.dosyaGunu && (
            <button
              type="button"
              className="dugme birincil"
              disabled={mesgul}
              onClick={() => g.dosyaGunu && dk.tarihDegistir(tarihMetni(g.dosyaGunu))}
            >
              Günü {sayfaAdi(g.dosyaGunu)} yap
            </button>
          )}
          <button
            type="button"
            className={g.dosyaGunu ? 'dugme' : 'dugme birincil'}
            disabled={mesgul}
            onClick={() => dk.tarihleriOnayla(g.onayBekleyenler.map((d) => d.kaynak))}
          >
            Evet, bu dosyalarla devam et
          </button>
        </div>
      </Kutu>
    );

  return (
    <Kutu baslik="Kontrol hazırlanıyor">
      <p>Dosyalar okunuyor, birazdan burada görünecek.</p>
    </Kutu>
  );
}

function Kutu({ baslik, ton, children }: { baslik: string; ton?: 'uyari'; children: ReactNode }) {
  return (
    <section className={`bos siradaki ${ton ?? ''}`} aria-live="polite">
      <Simge ad={ton ? 'uyari' : 'depo'} boyut={28} />
      <h2>{baslik}</h2>
      {children}
    </section>
  );
}
