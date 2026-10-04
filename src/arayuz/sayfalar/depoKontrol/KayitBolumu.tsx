import { useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import { DriveRaporunuKaydet } from '../drive/DriveRaporu';
import { indir } from '../../../platform/dosya';
import { yedekBaytlari } from '../../../platform/gecmis';
import { Mesaj } from '../../bilesenler/Mesaj';
import { Simge } from '../../bilesenler/Simge';
import type { DepoKontrol } from './useDepoKontrol';

/** 5. adım: kaydetme düğmeleri. */
export function KayitCubugu({ dk }: { dk: DepoKontrol }) {
  const { hedef } = dk.oturum;
  const { plan, kaydedilebilir } = dk.gorunum;
  if (!hedef || !plan) return null;
  const dosyaya = Boolean(hedef.tanitici);
  const mesgul = dk.mesgul !== null;
  return (
    <div className="kayit-cubugu">
      <p>
        {dosyaya
          ? `${dk.gorunum.secim?.tur === 'mevcut' ? 'Mevcut sayfa yeniden doldurularak' : 'Yeni sayfa'} ${hedef.ad} dosyasına yazılacak. Önce dosyanın yedeği alınır.`
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
              : `İndirilen ${s.hedef.ad} dosyasını eski dosyanın yerine koyun.`}
          </p>
        </div>
      </div>
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
