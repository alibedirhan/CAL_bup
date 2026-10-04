import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { useIslem } from '../../bilesenler/useIslem';
import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import { Bildirim } from '../../bilesenler/Bildirim';
import { useState } from 'react';
import type { Ayarlar } from '../../../cekirdek/ayarlar';
import { driveListele, type DriveDosyasi } from '../../../platform/drive';
import {
  driveEsitle,
  driveGecmisiUygula,
  driveOturumOku,
  type DriveOturumu,
} from '../../../platform/driveEsitleme';
import {
  driveAyir,
  driveBaglan,
  driveHazir,
  driveHazirla,
  driveIzniKaldir,
  istemciKaydet,
  istemciKimligi,
} from '../../../platform/driveKimlik';
import { Mesaj } from '../../bilesenler/Mesaj';
import { useDrive, useDriveOturumu } from './useDrive';

export function DriveAyarlari({
  ayarlar,
  ayarDegisti,
}: {
  ayarlar: Ayarlar;
  ayarDegisti: (a: Ayarlar) => IslemSonucu;
}) {
  const bagli = useDrive();
  const oturumNo = useDriveOturumu();
  const [kimlik, setKimlik] = useState(istemciKimligi);
  const [hazir, setHazir] = useState(driveHazir);
  const islem = useIslem('drive-ayar');
  const mesgul = islem.mesgul;
  const [mesaj, setMesaj] = useState('');
  const [liste, setListe] = useState<DriveDosyasi[]>([]);
  const [gorunen, setGorunen] = useState(20);
  const [secim, setSecim] = useState<DriveOturumu | null>(null);
  const [izinOnayi, setIzinOnayi] = useState(false);
  const [oncekiOturum, setOncekiOturum] = useState(oturumNo);
  if (oncekiOturum !== oturumNo) {
    setOncekiOturum(oturumNo);
    setListe([]);
    setSecim(null);
    setIzinOnayi(false);
    setGorunen(20);
  }
  const is = async (eylem: (signal: AbortSignal) => Promise<void>, yazma = false) => {
    setMesaj('');
    return islem.calistir(eylem, '', yazma);
  };
  return (
    <section className="kart" aria-labelledby="drive-baslik">
      <div className="kart-ust">
        <div>
          <h2 id="drive-baslik">Google Drive</h2>
          <p>
            Depo kontrol dosyanızı ve yedeğini kendi Drive’ınızda saklayın. Dosyalar yalnızca düğmeye
            bastığınızda gönderilir.
          </p>
        </div>
        <span className={`rozet durum ${bagli ? 'tamam' : 'uyari'}`}>{bagli ? 'Bağlı' : 'Bağlı değil'}</span>
      </div>
      <p className="ipucu">
        CAL bup kendi oluşturduğu dosyalara erişir. Tarayıcıdaki geçmiş ve yedekler korunur. Sayfayı
        yenilediğinizde yeniden bağlanmanız gerekir.
      </p>
      <p className="ipucu">
        <a href={`${import.meta.env.BASE_URL}gizlilik.html`} target="_blank" rel="noreferrer">
          Dosyalar ve gizlilik
        </a>
      </p>
      {!bagli && (
        <>
          <details className="gelismis" open={!istemciKimligi()}>
            <summary>
              <h3>İlk bağlantı kurulumu</h3>
            </summary>
            <ol>
              <li>
                <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
                  Google Cloud
                </a>
                ’da bir proje oluşturun ve Google Drive API’yi etkinleştirin.
              </li>
              <li>
                Google Auth Platform’da uygulama adını CAL bup yapın. Test aşamasındaysa kendi Google
                hesabınızı test kullanıcısı olarak ekleyin.
              </li>
              <li>
                İstemciler bölümünde Web uygulaması oluşturun. JavaScript kaynağına{' '}
                <b>https://alibedirhan.github.io</b> yazın.
              </li>
              <li>Oluşan istemci kimliğini aşağıya yapıştırın. İstemci gizli anahtarı gerekmez.</li>
            </ol>
            <label htmlFor="drive-kimlik">Google istemci kimliği</label>
            <input
              id="drive-kimlik"
              className="girdi"
              value={kimlik}
              disabled={mesgul}
              maxLength={256}
              placeholder="…apps.googleusercontent.com"
              onChange={(e) => {
                setKimlik(e.target.value);
                setHazir(false);
              }}
            />
            <p className="ipucu">Bu kimlik yalnızca bu tarayıcıda saklanır.</p>
          </details>
          <div className="satir-dugmeleri">
            <button
              type="button"
              className="dugme"
              disabled={mesgul || !kimlik.trim()}
              onClick={() =>
                void is(async (signal) => {
                  istemciKaydet(kimlik.trim());
                  await driveHazirla(signal);
                  signal.throwIfAborted();
                  setHazir(true);
                  setMesaj('Bağlantı hazır. Şimdi Drive’a bağlanın.');
                })
              }
            >
              Bağlantıyı hazırla
            </button>
            <button
              type="button"
              className="dugme birincil"
              disabled={mesgul || !hazir}
              onClick={() =>
                void is(async (signal) => {
                  await driveBaglan(signal);
                  signal.throwIfAborted();
                  setListe([]);
                  setSecim(null);
                  setMesaj('Drive’a bağlandınız. Raporu kaydettikten sonra Drive’a da gönderebilirsiniz.');
                })
              }
            >
              Drive’a bağlan
            </button>
          </div>
        </>
      )}
      {bagli && (
        <>
          <div className="satir-dugmeleri">
            <button
              type="button"
              className="dugme birincil"
              disabled={mesgul}
              onClick={() =>
                void is(async (signal) => {
                  await driveEsitle(ayarlar, signal);
                  signal.throwIfAborted();
                  setMesaj('Ayarlar Drive’a kaydedildi, geçmiş iki taraftan birleştirildi.');
                }, true)
              }
            >
              Ayarları ve geçmişi eşitle
            </button>
            <button
              type="button"
              className="dugme"
              disabled={mesgul}
              onClick={() =>
                void is(async (signal) => {
                  setSecim(null);
                  const l = await driveListele('oturum', signal);
                  signal.throwIfAborted();
                  setListe(l);
                  setGorunen(20);
                  setMesaj('Drive kayıtları aşağıda listelendi.');
                })
              }
            >
              Drive’daki kayıtları göster
            </button>
            <button
              type="button"
              className="dugme hayalet"
              disabled={mesgul}
              onClick={() => {
                driveAyir();
                setListe([]);
                setSecim(null);
                setMesaj('Bu oturumda Drive bağlantısı kapatıldı.');
              }}
            >
              Bağlantıyı kes
            </button>
            <button
              type="button"
              className="dugme hayalet"
              disabled={mesgul}
              onClick={() => setIzinOnayi(true)}
            >
              Google iznini kaldır
            </button>
          </div>
          {izinOnayi && (
            <Mesaj ton="uyari">
              CAL bup’ın Google izni kaldırılsın mı? Drive’daki dosyalar silinmez.
              <div className="satir-dugmeleri">
                <button
                  className="dugme"
                  disabled={mesgul}
                  onClick={() =>
                    void is(async (signal) => {
                      await driveIzniKaldir();
                      signal.throwIfAborted();
                      setIzinOnayi(false);
                      setListe([]);
                      setSecim(null);
                      setMesaj('Google izni kaldırıldı.');
                    }, true)
                  }
                >
                  Evet, izni kaldır
                </button>
                <button className="dugme" onClick={() => setIzinOnayi(false)}>
                  Vazgeç
                </button>
              </div>
            </Mesaj>
          )}
          {liste.length > 0 && (
            <ul className="yedek-listesi">
              {liste.slice(0, gorunen).map((d) => (
                <li key={d.id} className="dosya-satiri">
                  <div>
                    <b>Ayarlar ve geçmiş</b>
                    <span>{new Date(d.createdTime).toLocaleString('tr-TR')}</span>
                  </div>
                  <button
                    type="button"
                    className="dugme kucuk"
                    disabled={mesgul}
                    onClick={() =>
                      void is(async (signal) => {
                        setSecim(null);
                        const o = await driveOturumOku(d, signal);
                        signal.throwIfAborted();
                        setSecim(o);
                      })
                    }
                  >
                    İncele
                  </button>
                </li>
              ))}
            </ul>
          )}
          {liste.length > gorunen && (
            <button className="dugme" disabled={mesgul} onClick={() => setGorunen((n) => n + 20)}>
              Daha fazla kayıt göster
            </button>
          )}
          {secim && (
            <Mesaj ton="bilgi" baslik="Seçilen Drive kaydı">
              <p>
                {new Date(secim.zaman).toLocaleString('tr-TR')} · {secim.gecmis.length} geçmiş kaydı ·
                tolerans {secim.ayarlar.tolerans} kg
              </p>
              <p>
                Geçmiş mevcut kayıtlarla birleştirilir. Ayarları da getirirseniz bu bilgisayardaki rapor
                ayarları değişir.
              </p>
              <div className="satir-dugmeleri">
                <button
                  className="dugme"
                  disabled={mesgul}
                  onClick={() =>
                    void is(async (signal) => {
                      await driveGecmisiUygula(secim, signal);
                      signal.throwIfAborted();
                      setSecim(null);
                      setMesaj('Geçmiş bu tarayıcıya getirildi.');
                    }, true)
                  }
                >
                  Yalnız geçmişi getir
                </button>
                <button
                  className="dugme"
                  disabled={mesgul}
                  onClick={() =>
                    void is(async (signal) => {
                      await driveGecmisiUygula(secim, signal);
                      signal.throwIfAborted();
                      const kayit = ayarDegisti(secim.ayarlar);
                      if (kayit.durum !== 'tamam')
                        throw new KullaniciHatasi('Geçmiş birleştirildi. ' + kayit.mesaj);
                      setSecim(null);
                      setMesaj('Ayarlar getirildi, geçmiş birleştirildi.');
                    }, true)
                  }
                >
                  Ayarları ve geçmişi getir
                </button>
                <button className="dugme hayalet" onClick={() => setSecim(null)}>
                  Vazgeç
                </button>
              </div>
            </Mesaj>
          )}
        </>
      )}
      <IslemBildirimi islem={islem} />
      <Bildirim mesaj={mesaj} />
    </section>
  );
}
