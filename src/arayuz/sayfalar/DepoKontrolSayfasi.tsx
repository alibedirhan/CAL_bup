import type { RaporTanimi } from '../../raporlar/kayit';
import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { Simge } from '../bilesenler/Simge';

const ADIMLAR = ['Depo kontrol dosyası', 'Tarih', 'LED dosyaları', 'Kontrol', 'Kaydet'] as const;

type AsamaDurumu = 'bitti' | 'simdi' | 'sirada';

// Yapım süresince gösterilir; rapor çalışır hâle gelince bu bölüm kalkar.
const ASAMALAR: readonly { ad: string; durum: AsamaDurumu }[] = [
  { ad: 'Temel: iskelet, tema, yayın', durum: 'bitti' },
  { ad: 'Hesap kuralları ve testler', durum: 'bitti' },
  { ad: 'Excel okuma ve yazma', durum: 'simdi' },
  { ad: 'Arayüz: adımlar ve kontrol ekranı', durum: 'sirada' },
  { ad: 'İş yerinde 30.09 denemesi', durum: 'sirada' },
  { ad: "Google Drive'a kaydetme", durum: 'sirada' },
];

const KULLANIM = [
  ['Sayfayı açın', 'Depo kontrol dosyanızı ilk seferde seçersiniz, sonra hatırlanır.'],
  ['Dosyaları bırakın', 'Üç LED dosyasını birlikte sürükleyin. Hangisinin hangisi olduğunu sayfa anlar.'],
  ['Kontrole bakın', 'Toplamlar, tarih uyumu ve eklenecek ürünler kaydetmeden önce görünür.'],
  ['Kaydedin', 'Yeni gün sayfası depo kontrol dosyanıza yazılır. Önce yedek alınır.'],
] as const;

export function DepoKontrolSayfasi({ rapor }: { rapor: RaporTanimi }) {
  return (
    <>
      <SayfaBasligi ust="Rapor" baslik={rapor.ad}>
        {rapor.aciklama}
      </SayfaBasligi>

      <ol className="adimlar" aria-label="Adımlar">
        {ADIMLAR.map((a, i) => (
          <li key={a} className="adim">
            <span className="adim-no">{i + 1}</span>
            {a}
          </li>
        ))}
      </ol>

      <div className="izgara-2">
        <section className="kart one-cikan" aria-labelledby="kaynaklar-baslik">
          <div className="kart-ust">
            <h2 id="kaynaklar-baslik">LED dosyaları</h2>
            <span className="rozet durum bilgi">Yapım aşamasında</span>
          </div>
          <p>
            Bu ekran yakında çalışır hâle gelecek. Üç dosyayı buraya birlikte bırakacaksınız; şimdilik
            yalnızca görünümü hazır.
          </p>
          <div className="yuvalar">
            {rapor.kaynaklar.map((k) => (
              <div key={k} className="yuva">
                <span className="yuva-simge">
                  <Simge ad="dosya" />
                </span>
                <div>
                  <b>{k}</b>
                  <span>Bekleniyor</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="kart" aria-labelledby="durum-baslik">
          <h2 id="durum-baslik">Yapım durumu</h2>
          <ol className="asamalar">
            {ASAMALAR.map((a) => (
              <li key={a.ad} className={`asama ${a.durum}`}>
                <span className="asama-isaret">{a.durum === 'bitti' && <Simge ad="tik" boyut={13} />}</span>
                {a.ad}
                {a.durum === 'simdi' && <span className="rozet">sırada</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="kart" aria-labelledby="kullanim-baslik">
        <h2 id="kullanim-baslik">Her gün nasıl kullanılacak</h2>
        <ol className="akis">
          {KULLANIM.map(([b, a], i) => (
            <li key={b}>
              <span className="akis-no">{i + 1}</span>
              <div>
                <b>{b}</b>
                <span>{a}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
