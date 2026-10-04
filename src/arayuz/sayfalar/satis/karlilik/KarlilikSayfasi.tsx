import { useRef, useState } from 'react';
import { Bildirim } from '../../../bilesenler/Bildirim';
import { FormHatasi } from '../../../bilesenler/FormHatasi';
import { useKarlilik } from './useKarlilik';
import { KarlilikTablosu } from './KarlilikTablosu';
import { GenelBakisPaneli } from './GenelBakisPaneli';
import { SenaryoPaneli } from './SenaryoPaneli';
import { EslesmePaneli } from './EslesmePaneli';
import { DonemPaneli } from './DonemPaneli';

const SEKMELER = ['Analiz', 'Genel Bakış', 'Senaryo', 'Eşleşme Merkezi', 'Dönem Analizi'] as const;
export default function KarlilikSayfasi({ aktif }: { aktif: boolean }) {
  const m = useKarlilik(aktif);
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]>('Analiz');
  const satis = useRef<HTMLInputElement>(null),
    fiyat = useRef<HTMLInputElement>(null);
  return (
    <div className="musteri-takip karlilik">
      <header className="baslik">
        <span className="etiket">Satış</span>
        <h1>Kârlılık Analizi</h1>
        <p>LED satış ve fiyat raporlarını eşleştirin; maliyet, kâr ve dönem değişimlerini inceleyin.</p>
      </header>
      <div className="suzgecler karlilik-sekmeler" aria-label="Kârlılık bölümleri">
        {SEKMELER.map((s) => (
          <button
            key={s}
            className="suzgec"
            aria-pressed={sekme === s}
            disabled={m.mesgul}
            onClick={() => setSekme(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <FormHatasi id="karlilik-hatasi" hata={aktif ? m.hata : ''} />
      {m.mesgul && (
        <div className="kart-ust karlilik-ilerleme" aria-busy="true">
          <p role="status">Kârlılık işlemi sürüyor… İlk kullanımda dosya motoru hazırlanır.</p>
          <button className="dugme" onClick={m.durdur}>
            İşlemi durdur
          </button>
        </div>
      )}
      {sekme === 'Analiz' && (
        <div className="musteri-izgara">
          <section className="kart" aria-labelledby="karlilik-kaynak">
            <h2 id="karlilik-kaynak">Kaynak dosyalar</h2>
            <p className="ipucu">İki .xlsx dosyası seçin. Dosyalar bu bilgisayarda işlenir.</p>
            {(['satis', 'fiyat'] as const).map((tur) => (
              <div className="karlilik-kaynak" key={tur}>
                <h3>{tur === 'satis' ? 'Satış raporu' : 'Fiyat raporu'}</h3>
                <p className="ipucu">
                  {tur === 'satis'
                    ? 'S01S Kârlılık Analizi (Stok Dağılımlı)'
                    : 'Bupiliç Dönemsel İskonto (Şube Alış)'}
                </p>
                <input
                  type="file"
                  accept=".xlsx"
                  ref={tur === 'satis' ? satis : fiyat}
                  hidden
                  disabled={m.mesgul}
                  aria-label={tur === 'satis' ? 'Kârlılık satış raporu' : 'Kârlılık fiyat raporu'}
                  onChange={(e) => {
                    m.sec(tur, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  className="dugme"
                  disabled={m.mesgul}
                  onClick={() => (tur === 'satis' ? satis : fiyat).current?.click()}
                >
                  {tur === 'satis' ? 'Satış raporu seç' : 'Fiyat raporu seç'}
                </button>
                <p className="karlilik-dosya">{(tur === 'satis' ? m.satis : m.fiyat)?.name ?? 'Seçilmedi'}</p>
              </div>
            ))}
            <div className="satir-dugmeleri">
              <button
                className="dugme birincil"
                disabled={m.mesgul || !m.satis || !m.fiyat}
                onClick={() => void m.calistir('analiz')}
              >
                Analiz et
              </button>
              <button className="dugme" disabled={m.mesgul || (!m.satis && !m.fiyat)} onClick={m.temizle}>
                Temizle
              </button>
            </div>
            <p className="ipucu">
              Dosyalar ve sonuçlar sayfa yenilenene kadar kalır. Dönem kaydı ve onayladığınız stok
              eşleştirmeleri bu tarayıcıda saklanır.
            </p>
          </section>
          {m.sonuc ? (
            <KarlilikTablosu
              sonuc={m.sonuc}
              mesgul={m.mesgul}
              aktar={(eylem, satirlar) => m.calistir(eylem, satirlar ? { satirlar } : {})}
            />
          ) : (
            <section className="bos" aria-label="Kârlılık analizi bekleniyor">
              <h2>Satışın karşılığı, ürünün maliyeti</h2>
              <p>
                Satış ve fiyat raporlarını seçip Analiz et’e basın. Eşleşen ürünleri, birim kârı ve net kârı
                birlikte göreceksiniz.
              </p>
              <p className="ipucu">
                Fiyat bulunamayan ürünler ayrıca gösterilir; maliyeti sıfır kabul edilen sonuçlar uyarı taşır.
              </p>
            </section>
          )}
        </div>
      )}
      {sekme !== 'Analiz' && sekme !== 'Dönem Analizi' && !m.sonuc && (
        <section className="bos">
          <h2>Önce analiz oluşturun</h2>
          <p>Analiz bölümünde satış ve fiyat raporlarını seçin.</p>
        </section>
      )}
      {sekme === 'Genel Bakış' && m.sonuc && <GenelBakisPaneli sonuc={m.sonuc} />}
      {sekme === 'Senaryo' && m.sonuc && <SenaryoPaneli m={m} />}
      {sekme === 'Eşleşme Merkezi' && m.sonuc && <EslesmePaneli m={m} />}
      {sekme === 'Dönem Analizi' && <DonemPaneli m={m} />}
      <Bildirim mesaj={aktif ? m.bildirim : ''} />
    </div>
  );
}
