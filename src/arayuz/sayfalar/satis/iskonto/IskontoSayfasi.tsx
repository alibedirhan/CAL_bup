import { useRef } from 'react';
import { ISKONTO_KATEGORILERI, sifirOranlar } from '../../../../cekirdek/iskonto/turler';
import { Bildirim } from '../../../bilesenler/Bildirim';
import { FormHatasi } from '../../../bilesenler/FormHatasi';
import { IskontoSonuclari } from './IskontoSonuclari';
import { useIskonto } from './useIskonto';

export default function IskontoSayfasi({ aktif }: { aktif: boolean }) {
  const m = useIskonto(aktif);
  const secici = useRef<HTMLInputElement>(null);
  return (
    <div className="musteri-takip iskonto">
      <header className="baslik">
        <span className="etiket">Satış</span>
        <h1>İskonto Hesaplama</h1>
        <p>PDF fiyat listelerini yükleyin, kategori oranlarını uygulayın ve Excel/PDF çıktısı hazırlayın.</p>
      </header>
      <div className="musteri-izgara">
        <section className="kart" aria-labelledby="iskonto-kaynak-baslik" aria-busy={m.mesgul}>
          <h2 id="iskonto-kaynak-baslik">Kaynak ve oranlar</h2>
          <p className="ipucu">
            En fazla üç PDF seçin. Dosyalar bu bilgisayarda işlenir; kaynak liste değiştirilmez.
          </p>
          <input
            ref={secici}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            hidden
            aria-label="PDF fiyat listeleri"
            disabled={m.mesgul || m.belgeler.length === 3}
            onChange={(e) => {
              const dosyalar = [...(e.target.files ?? [])];
              e.target.value = '';
              void m.yukle(dosyalar);
            }}
          />
          <div className="satir-dugmeleri">
            <button
              className="dugme birincil"
              disabled={m.mesgul || m.belgeler.length === 3}
              onClick={() => secici.current?.click()}
            >
              PDF seç
            </button>
            <button className="dugme" disabled={m.mesgul || !m.belgeler.length} onClick={m.temizle}>
              Temizle
            </button>
          </div>
          <ul className="iskonto-dosyalar" aria-label="Yüklenen PDF dosyaları">
            {m.belgeler.length ? (
              m.belgeler.map((b, i) => (
                <li key={i}>
                  <strong>{b.ad}</strong>
                  <span>
                    {Object.values(b.kategoriler)
                      .reduce((s, p) => s + p.length, 0)
                      .toLocaleString('tr')}{' '}
                    ürün ·{' '}
                    {b.tip === 'dondurulmus' ? 'Dondurulmuş' : b.tip === 'gramaj' ? 'Gramaj' : 'Normal'}
                  </span>
                </li>
              ))
            ) : (
              <li>Henüz PDF yüklenmedi.</li>
            )}
          </ul>
          <h3>Kategori iskonto oranları</h3>
          <div className="satir-dugmeleri iskonto-hizli">
            <span>Hızlı ayar:</span>
            {[5, 10, 15, 20].map((o) => (
              <button
                className="dugme kucuk"
                disabled={m.mesgul}
                key={o}
                aria-label={`Tüm kategorileri %${o} yap`}
                onClick={() =>
                  m.oranDegistir(
                    Object.fromEntries(ISKONTO_KATEGORILERI.map((k) => [k, o])) as typeof m.oranlar,
                  )
                }
              >
                %{o}
              </button>
            ))}
            <button
              className="dugme kucuk"
              disabled={m.mesgul}
              onClick={() => m.oranDegistir(sifirOranlar())}
            >
              Sıfırla
            </button>
          </div>
          <div className="iskonto-oranlar">
            {ISKONTO_KATEGORILERI.map((k) => (
              <label key={k}>
                <span>
                  {k}
                  <small>{m.belgeler.reduce((s, b) => s + b.kategoriler[k].length, 0)} ürün</small>
                </span>
                <input
                  className="girdi"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  aria-label={`${k} iskonto oranı`}
                  value={Number.isNaN(m.oranlar[k]) ? '' : m.oranlar[k]}
                  disabled={m.mesgul}
                  onChange={(e) => m.oranDegistir({ ...m.oranlar, [k]: e.target.valueAsNumber })}
                />
              </label>
            ))}
          </div>
          <div className="satir-dugmeleri">
            <button
              className="dugme birincil"
              disabled={m.mesgul || !m.belgeler.length}
              onClick={() => void m.onizle()}
            >
              Önizleme oluştur
            </button>
            {m.mesgul && (
              <button className="dugme" onClick={m.durdur}>
                İşlemi durdur
              </button>
            )}
          </div>
          {m.mesgul && <p role="status">{m.asama}</p>}
          <FormHatasi id="iskonto-hatasi" hata={aktif ? m.hata : ''} />
        </section>
        {m.oturum ? (
          <IskontoSonuclari sonuc={m.oturum.onizleme} mesgul={m.mesgul} aktar={m.aktar} />
        ) : (
          <section className="bos" aria-label="İskonto önizlemesi bekleniyor">
            <h2>Fiyat listeniz, kategoriye göre iskonto</h2>
            <p>
              PDF’leri yükleyip oranları girin. Önizlemede orijinal fiyatı, iskontolu fiyatı ve farkı birlikte
              görebilirsiniz.
            </p>
            <p className="ipucu">
              Normal, gramaj ve dondurulmuş liste ayrımı masaüstü uygulamasındaki kurallarla yapılır. Çıktıda
              KDV yeniden %1 olarak hesaplanır.
            </p>
          </section>
        )}
      </div>
      <Bildirim mesaj={aktif ? m.bildirim : ''} />
    </div>
  );
}
