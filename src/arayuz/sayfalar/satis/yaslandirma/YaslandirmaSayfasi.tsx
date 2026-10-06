import { useRef, useState } from 'react';
import { Bildirim } from '../../../bilesenler/Bildirim';
import { FormHatasi } from '../../../bilesenler/FormHatasi';
import { AnalizPaneli } from './AnalizPaneli';
import { AracDetayiPaneli, GrafiklerPaneli, RaporlarPaneli } from './DetayPanelleri';
import { AtamaPaneli } from './AtamaPaneli';
import { useYaslandirma } from './useYaslandirma';

const SEKMELER = ['Analiz', 'Araç Detayı', 'Grafikler', 'Raporlar', 'Atama'] as const;
type Sekme = (typeof SEKMELER)[number];

export default function YaslandirmaSayfasi({ aktif }: { aktif: boolean }) {
  const m = useYaslandirma(aktif);
  const [sekme, setSekme] = useState<Sekme>('Analiz');
  const [aracNo, setAracNo] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const araclar = m.sonuc?.ozet.vehicles.map((a) => a.arac_no) ?? [];
  const seciliArac = aracNo && araclar.includes(aracNo) ? aracNo : (araclar[0] ?? null);
  return (
    <div className="musteri-takip karlilik yaslandirma">
      <header className="baslik">
        <span className="etiket">Satış</span>
        <h1>Yaşlandırma</h1>
        <p>
          LED cari yaşlandırma raporunu yükleyin; araç bazlı bakiye, açık hesap ve vade kovası dağılımını
          inceleyin.
        </p>
      </header>
      <div className="suzgecler karlilik-sekmeler" aria-label="Yaşlandırma bölümleri">
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
      <FormHatasi id="yaslandirma-hatasi" hata={aktif ? m.hata : ''} />
      {m.mesgul && (
        <div className="kart-ust karlilik-ilerleme" aria-busy="true">
          <p role="status">Yaşlandırma işlemi sürüyor… İlk kullanımda dosya motoru hazırlanır.</p>
          <button className="dugme" onClick={m.durdur}>
            İşlemi durdur
          </button>
        </div>
      )}
      {sekme === 'Analiz' && (
        <div className="musteri-izgara">
          <section className="kart" aria-labelledby="yas-kaynak">
            <h2 id="yas-kaynak">Kaynak dosya</h2>
            <p className="ipucu">
              C01Y Cari Yaşlandırma raporunu .xlsx olarak seçin. Güvenlik denetimi nedeniyle yalnız .xlsx
              kabul edilir; dosya bu bilgisayarda işlenir.
            </p>
            <input
              type="file"
              accept=".xlsx"
              ref={girdi}
              hidden
              disabled={m.mesgul}
              aria-label="Yaşlandırma raporu"
              onChange={(e) => {
                m.sec(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="satir-dugmeleri">
              <button className="dugme" disabled={m.mesgul} onClick={() => girdi.current?.click()}>
                Yaşlandırma raporu seç
              </button>
            </div>
            <p className="karlilik-dosya">{m.dosya?.name ?? 'Seçilmedi'}</p>
            <div className="satir-dugmeleri">
              <button
                className="dugme birincil"
                disabled={m.mesgul || !m.dosya}
                onClick={() => void m.analizEt()}
              >
                Analiz et
              </button>
              <button className="dugme" disabled={m.mesgul || (!m.dosya && !m.sonuc)} onClick={m.temizle}>
                Temizle
              </button>
            </div>
            <p className="ipucu">
              Dosya ve sonuç sayfa yenilenene kadar kalır. Depo, merkez ve kesimhane satırları araç sayılmaz.
            </p>
          </section>
          {m.sonuc ? (
            <AnalizPaneli
              sonuc={m.sonuc}
              mesgul={m.mesgul}
              aktar={m.aktar}
              detayAc={(no) => {
                setAracNo(no);
                setSekme('Araç Detayı');
              }}
            />
          ) : (
            <section className="bos" aria-label="Yaşlandırma analizi bekleniyor">
              <h2>Hangi araçta ne kadar bakiye, kaç gündür bekliyor?</h2>
              <p>
                Raporu seçip Analiz et’e basın. Araç özeti, vade kovaları, araç detayı, grafikler ve raporlar
                aynı analizden hazırlanır.
              </p>
            </section>
          )}
        </div>
      )}
      {sekme !== 'Analiz' && sekme !== 'Atama' && !m.sonuc && (
        <section className="bos">
          <h2>Önce analiz oluşturun</h2>
          <p>Analiz bölümünde yaşlandırma raporunu seçin.</p>
        </section>
      )}
      {sekme === 'Araç Detayı' && m.sonuc && (
        <AracDetayiPaneli sonuc={m.sonuc} aracNo={seciliArac} sec={setAracNo} />
      )}
      {sekme === 'Grafikler' && m.sonuc && <GrafiklerPaneli sonuc={m.sonuc} />}
      {sekme === 'Raporlar' && m.sonuc && <RaporlarPaneli sonuc={m.sonuc} />}
      {sekme === 'Atama' && <AtamaPaneli m={m} araclar={araclar} />}
      <Bildirim mesaj={aktif ? m.bildirim : ''} />
    </div>
  );
}
