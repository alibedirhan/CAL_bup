import { useState } from 'react';
import type { DepoKontrolPlani } from '../../../raporlar/depoKontrol/hesapla';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import { DriveRaporunuKaydet } from '../drive/DriveRaporu';
import { indir } from '../../../platform/dosya';
import { yedekBaytlari } from '../../../platform/gecmis';
import { Mesaj } from '../../bilesenler/Mesaj';
import { Simge } from '../../bilesenler/Simge';
import { sayiMetni } from '../../../cekirdek/sayi';
import type { DepoKontrol } from './useDepoKontrol';

/** 5. adım: kaydetme düğmeleri. */
export function KayitCubugu({ dk }: { dk: DepoKontrol }) {
  // Onay yalnızca verildiği plana aittir; dosya ya da gün değişince geçersiz olur.
  const [onayliPlan, setOnayliPlan] = useState<DepoKontrolPlani | null>(null);
  const { hedef } = dk.oturum;
  const { plan } = dk.gorunum;
  if (!hedef || !plan) return null;
  const hataOnayi = onayliPlan === plan;
  const dosyaya = Boolean(hedef.tanitici);
  const mesgul = dk.mesgul !== null;
  const hatali = plan.genelDurum === 'Hata';
  const kaydedilebilir = dk.gorunum.kaydedilebilir && (!hatali || hataOnayi);
  return (
    <div className={`kayit-cubugu ${hatali ? 'hatali' : ''}`}>
      {hatali && (
        <label className="hata-onayi">
          <input
            type="checkbox"
            checked={hataOnayi}
            disabled={mesgul}
            onChange={(e) => setOnayliPlan(e.target.checked ? plan : null)}
          />{' '}
          Toplam kontrolü tutmuyor. Yukarıdaki farkı inceledim, yine de kaydet.
        </label>
      )}
      <p>
        {dosyaya
          ? `${dk.gorunum.secim?.tur === 'mevcut' ? 'Mevcut sayfa yeniden doldurularak' : 'Yeni sayfa'} ${hedef.ad} dosyasına yazılacak; sayfaya sorumluluk notu eklenir. Önce dosyanın yedeği alınır.`
          : 'Güncellenmiş dosya indirilecek. Eski dosyanın yerine koyabilirsiniz.'}
      </p>
      <div className="satir-dugmeleri">
        {dosyaya && (
          <button
            type="button"
            className="dugme"
            disabled={!kaydedilebilir || mesgul}
            onClick={() => dk.kaydetIste('indir')}
          >
            Yeni dosya olarak indir
          </button>
        )}
        <button
          type="button"
          className="dugme birincil"
          disabled={!kaydedilebilir || mesgul}
          onClick={() => dk.kaydetIste(dosyaya ? 'dosyaya' : 'indir')}
        >
          {dk.mesgul === 'kaydediliyor'
            ? 'Kaydediliyor…'
            : dosyaya
              ? 'Depo kontrol dosyasına kaydet'
              : 'İndir'}
        </button>
      </div>
    </div>
  );
}

const DURUM_SINIFI = { Tamam: 'tamam', Uyarı: 'uyari', Hata: 'hata' } as const;

export function SonucKarti({ dk }: { dk: DepoKontrol }) {
  const [hata, setHata] = useState('');
  const s = dk.sonuc;
  if (!s) return null;
  const yedekIndir = async () => {
    if (!s.yedekId) return;
    try {
      const bayt = await yedekBaytlari(s.yedekId, true);
      if (bayt) indir(bayt, `YEDEK ${s.hedef.ad}`);
    } catch (e) {
      setHata(e instanceof KullaniciHatasi ? e.message : 'Yedek açılamadı. Yeniden deneyin.');
    }
  };
  return (
    <section className="kart sonuc" aria-live="polite">
      <FormHatasi hata={hata} id="sonuc-yedek-hata" />
      <div className="sonuc-ust">
        <span className="sonuc-simge">
          <Simge ad="tik" boyut={22} />
        </span>
        <div>
          <h2>
            {s.sayfa} sayfası {s.kayit === 'dosyaya' ? 'kaydedildi' : 'hazır, indirme başlatıldı'}
          </h2>
          <p>
            {s.kayit === 'dosyaya'
              ? `${s.hedef.ad} dosyasını Excel'de açabilirsiniz.`
              : `İndirilen ${s.hedef.ad} dosyasını eski dosyanın yerine koyun.`}{' '}
            Dosya Bilgilendirme sayfasıyla açılır; oradaki “Okudum” bağlantısı {s.sayfa} sayfasına götürür.
          </p>
        </div>
      </div>
      <dl className="bilgi-satirlari sonuc-ozeti">
        <div>
          <dt>Genel durum</dt>
          <dd>
            <span className={`rozet durum ${DURUM_SINIFI[s.plan.genelDurum]}`}>{s.plan.genelDurum}</span>
          </dd>
        </div>
        <div>
          <dt>LED stoğu · depo sayımı</dt>
          <dd className="rakam">
            {sayiMetni(s.plan.bToplam)} · {sayiMetni(s.plan.dToplam)} kg
          </dd>
        </div>
        <div>
          <dt>Gelen mal</dt>
          <dd className="rakam">{sayiMetni(s.plan.gelenMal)} kg</dd>
        </div>
        {s.plan.uyarilar.length > 0 && (
          <div>
            <dt>Uyarılar</dt>
            <dd>{s.plan.uyarilar.length} konu · Geçmiş sayfasında da görünür</dd>
          </div>
        )}
      </dl>
      {s.kayit === 'indirildi' && (
        <ol className="sonraki-adimlar">
          <li>İndirilenler klasöründeki {s.hedef.ad} dosyasını bulun.</li>
          <li>Eski depo kontrol dosyasının bulunduğu klasöre taşıyıp eskisinin yerine koyun.</li>
          <li>Yarın o dosyayı açın; yoksa bugünkü sayfa eksik kalır.</li>
        </ol>
      )}
      <Mesaj ton="bilgi">
        Excel dosyayı açarken formülleri yeniden hesaplar; kapatırken "kaydetmek istiyor musunuz" diye
        sorabilir. Bu normaldir.
      </Mesaj>
      {s.uyari && <Mesaj ton="uyari">{s.uyari}</Mesaj>}
      <DriveRaporunuKaydet key={s.sayfa + s.hedef.sonDegisiklik} sonuc={s} />
      <div className="satir-dugmeleri">
        {s.yedekId && (
          <button type="button" className="dugme" onClick={yedekIndir}>
            Kaydetmeden önceki yedeği indir
          </button>
        )}
        <button type="button" className="dugme birincil" onClick={dk.sonucKapat}>
          Tamam
        </button>
      </div>
    </section>
  );
}
