import { Bildirim } from '../../../bilesenler/Bildirim';
import { FormHatasi } from '../../../bilesenler/FormHatasi';
import { Simge } from '../../../bilesenler/Simge';
import { ExcelDosyaSecimi } from '../../../bilesenler/ExcelDosyaSecimi';
import { PlasiyerAyarlari } from './PlasiyerAyarlari';
import { MusteriSonuclari } from './MusteriSonuclari';
import { useMusteriTakip } from './useMusteriTakip';

export default function MusteriTakipSayfasi({ aktif }: { aktif: boolean }) {
  const m = useMusteriTakip(aktif);
  return (
    <div className="musteri-takip">
      <header className="baslik">
        <span className="etiket">Satış</span>
        <h1>Müşteri Takip</h1>
        <p>Eski ve yeni müşteri listelerini karşılaştırın; eksik ve yeni müşterileri ayrı ayrı inceleyin.</p>
      </header>
      <div className="musteri-izgara">
        <section className="kart" aria-labelledby="musteri-kaynak-baslik" aria-busy={m.mesgul}>
          <h2 id="musteri-kaynak-baslik">Kaynak dosyalar</h2>
          <p className="ipucu">
            İki tarihli LED müşteri raporunu .xlsx biçiminde seçin. İlk sayfadaki “Cari Ünvan” sütunu
            kullanılır.
          </p>
          {(['eski', 'yeni'] as const).map((yon) => (
            <ExcelDosyaSecimi
              key={yon}
              baslik={yon === 'eski' ? '1. Eski tarihli Excel' : '2. Yeni tarihli Excel'}
              alanAdi={yon === 'eski' ? 'Eski tarihli Excel' : 'Yeni tarihli Excel'}
              dosyaAdi={m[yon]?.name ?? null}
              kilitli={m.mesgul}
              degisti={(dosya) => m.dosyaSec(yon, dosya)}
            />
          ))}
          <label className="musteri-harf">
            <input
              type="checkbox"
              checked={m.harfDuyarli}
              disabled={m.mesgul}
              onChange={(e) => m.harfDegisti(e.target.checked)}
            />
            Büyük/küçük harf duyarlı karşılaştırma
          </label>
          <div className="satir-dugmeleri">
            <button
              className="dugme birincil"
              disabled={m.mesgul || !m.eski || !m.yeni || !m.kayit}
              onClick={() => void m.karsilastir()}
            >
              Karşılaştır
            </button>
            <button className="dugme" disabled={m.mesgul || (!m.eski && !m.yeni)} onClick={m.temizle}>
              Temizle
            </button>
            {m.islemMesgul && (
              <button className="dugme" onClick={m.durdur}>
                İşlemi durdur
              </button>
            )}
          </div>
          {m.mesgul && <p role="status">İşlem sürüyor…</p>}
          <FormHatasi id="musteri-islem-hatasi" hata={aktif ? m.hata : ''} />
          <PlasiyerAyarlari
            kayit={m.kayit}
            hata={m.ayarHatasi}
            kilitli={m.mesgul}
            degisti={m.kayitDegisti}
            yenile={m.ayarlariYenile}
            mesgulDegisti={m.setAyarMesgul}
          />
        </section>
        {m.oturum ? (
          <MusteriSonuclari
            sonuc={m.oturum.sonuc}
            plasiyerler={m.kayit?.plasiyerler ?? {}}
            mesgul={m.mesgul}
            aktar={m.disaAktar}
          />
        ) : (
          <section className="bos" aria-label="Karşılaştırma bekleniyor">
            <Simge ad="musteriler" boyut={32} />
            <h2>İki liste, net bir karşılaştırma</h2>
            <p>
              {m.eski && m.yeni
                ? 'İki dosya da seçildi. Soldaki Karşılaştır düğmesine basın.'
                : 'Soldan eski ve yeni tarihli müşteri listesini seçin, sonra Karşılaştır’a basın. Eski listede olup yeni listede bulunmayan müşteriler ve yeni eklenen müşteriler burada gösterilir.'}
            </p>
            <p className="ipucu">
              Müşteri dosyaları bu bilgisayarda işlenir. Liste içeriği tarayıcının kalıcı deposuna
              kaydedilmez.
            </p>
          </section>
        )}
      </div>
      <Bildirim mesaj={aktif ? m.bildirim : ''} />
    </div>
  );
}
