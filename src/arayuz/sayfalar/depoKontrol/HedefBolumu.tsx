import { useRef } from 'react';
import { gunAdi, sayfaAdi, tarihMetni } from '../../../cekirdek/tarih';
import { dogrudanKayitVar, XLSX_KABUL } from '../../../platform/dosya';
import { DriveRaporunuAc } from '../drive/DriveRaporu';
import { Simge } from '../../bilesenler/Simge';
import type { DepoKontrol } from './useDepoKontrol';

/** 1. ve 2. adım: depo kontrol dosyası ve gün. */
export function HedefBolumu({ dk }: { dk: DepoKontrol }) {
  const girdi = useRef<HTMLInputElement>(null);
  const { hedef } = dk.oturum;
  const g = dk.gorunum;

  const sec = async () => {
    if (!(await dk.hedefSec()) && !dogrudanKayitVar()) girdi.current?.click();
  };

  return (
    <section className="kart" aria-labelledby="hedef-baslik">
      <h2 id="hedef-baslik">Depo kontrol dosyası</h2>
      <input
        ref={girdi}
        type="file"
        accept={XLSX_KABUL}
        hidden
        onChange={(e) => {
          const dosyalar = [...(e.target.files ?? [])];
          e.target.value = '';
          if (dosyalar.length > 0) void dk.dosyalarGeldi(dosyalar);
        }}
      />

      {hedef ? (
        <div className="dosya-satiri secili">
          <span className="dosya-simge tamam">
            <Simge ad="tik" />
          </span>
          <div>
            <b>{hedef.ad}</b>
            <span>
              {hedef.bilgi.gunler.length} gün sayfası · son sayfa {hedef.bilgi.son.ad}
              {!hedef.tanitici && ' · kaydedince yeni dosya olarak iner'}
            </span>
          </div>
          <button type="button" className="dugme kucuk" onClick={sec} disabled={dk.mesgul !== null}>
            Değiştir
          </button>
        </div>
      ) : (
        <div className="hedef-sec">
          {dk.hatirlanan && (
            <div className="dosya-satiri">
              <span className="dosya-simge">
                <Simge ad="depo" />
              </span>
              <div>
                <b>{dk.hatirlanan.name}</b>
                <span>Son kullandığınız dosya</span>
              </div>
              <div className="satir-dugmeleri">
                <button
                  type="button"
                  className="dugme birincil kucuk"
                  onClick={dk.hatirlananiAc}
                  disabled={dk.mesgul !== null}
                >
                  Aç
                </button>
                <button
                  type="button"
                  className="dugme hayalet kucuk"
                  onClick={dk.hatirlananiUnut}
                  disabled={dk.mesgul !== null}
                  title="Bu dosyayı unut"
                >
                  Unut
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className={dk.hatirlanan ? 'dugme' : 'dugme birincil'}
            onClick={sec}
            disabled={dk.mesgul !== null}
          >
            <Simge ad="dosya" boyut={16} />
            {dk.hatirlanan ? 'Başka dosya seç' : 'Depo kontrol dosyasını seç'}
          </button>
          <p className="ipucu">Dosyayı LED dosyalarıyla birlikte aşağıya da sürükleyebilirsiniz.</p>
        </div>
      )}

      <DriveRaporunuAc ac={dk.driveHedefAc} mesgul={dk.mesgul !== null} />

      {hedef?.bilgi.yilKaynagi === 'tahmin' && (
        <div className="onay">
          <p>
            Gün başlıklarından yıl bütünüyle doğrulanamadı. Son gün sayfasının ({hedef.bilgi.son.ad}) yılını
            dosyayla karşılaştırın.
          </p>
          <label htmlFor="dosya-yili">Dosyanın son gün yılı</label>
          <input
            id="dosya-yili"
            className="girdi rakam kisa"
            inputMode="numeric"
            maxLength={4}
            disabled={dk.mesgul !== null}
            value={dk.oturum.yilGirdisi}
            aria-invalid={g.yilOnayiGerekli && !!g.tarihHatasi}
            aria-describedby={g.yilOnayiGerekli && g.tarihHatasi ? 'gun-hatasi' : undefined}
            onChange={(e) => dk.yilDegistir(e.target.value)}
          />
          <button
            type="button"
            className="dugme kucuk"
            disabled={dk.mesgul !== null || !!g.tarihHatasi || dk.oturum.yilOnayi}
            onClick={dk.yilOnayla}
          >
            {dk.oturum.yilOnayi ? 'Dosya yılı kontrol edildi' : 'Dosya yılını kontrol ettim'}
          </button>
        </div>
      )}

      {hedef && (
        <div className="tarih-alani">
          <label htmlFor="gun-girdisi">Oluşturulacak gün</label>
          <div className="tarih-satiri">
            <input
              id="gun-girdisi"
              disabled={dk.mesgul !== null}
              className="girdi rakam"
              inputMode="numeric"
              autoComplete="off"
              placeholder={sayfaAdi(g.oneri ?? hedef.bilgi.oneri)}
              value={dk.oturum.tarihGirdisi}
              onChange={(e) => dk.tarihDegistir(e.target.value)}
              aria-describedby={g.tarih ? 'gun-aciklama' : undefined}
            />
            {g.tarih && !g.tarihHatasi && (
              <span id="gun-aciklama" className="tarih-aciklama">
                {tarihMetni(g.tarih)} {gunAdi(g.tarih)}
                {g.secim?.tur === 'yeni' && ` · ${g.secim.onceki.ad} sayfasından yeni sayfa`}
                {g.secim?.tur === 'mevcut' && ' · bu sayfa zaten var'}
              </span>
            )}
          </div>
          {!dk.oturum.tarihGirdisi && (
            <p className="ipucu">
              Son sayfadan sonraki iş günü önerildi. Başka bir gün için yazın (ör. 30.09).
            </p>
          )}
          {g.tarihHatasi && (
            <p id="gun-hatasi" className="alan-hatasi">
              {g.tarihHatasi}
            </p>
          )}
          {g.mevcutOnayiGerekli && g.secim && (
            <div className="onay">
              <p>
                <b>'{g.secim.ad}' sayfası zaten var.</b> Kaynak dosyalardan yeniden doldurulsun mu? Miktarlar,
                tarihler ve formüller yeniden yazılır; eksik ürünler listeye eklenebilir.
              </p>
              <button
                type="button"
                className="dugme kucuk"
                disabled={dk.mesgul !== null}
                onClick={dk.mevcutOnayla}
              >
                Evet, yeniden doldur
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
