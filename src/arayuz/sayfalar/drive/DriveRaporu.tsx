import { useRef, useState } from 'react';
import {
  driveDosyaAdresi,
  driveIndir,
  driveListele,
  driveYukle,
  type DriveDosyasi,
} from '../../../platform/drive';
import { driveHesabiDogrula, driveToken } from '../../../platform/driveKimlik';
import type { SecilenDosya } from '../../../platform/dosya';
import type { KayitSonucu } from '../depoKontrol/islemler';
import { Mesaj } from '../../bilesenler/Mesaj';
import { driveHatasi, useDrive } from './useDrive';

export function DriveRaporunuAc({ ac, mesgul }: { ac: (d: SecilenDosya) => Promise<void>; mesgul: boolean }) {
  const bagli = useDrive();
  const [liste, setListe] = useState<DriveDosyasi[] | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const kilit = useRef(false);
  const [hata, setHata] = useState('');
  const is = async (eylem: () => Promise<void>) => {
    if (kilit.current) return;
    kilit.current = true;
    setCalisiyor(true);
    setHata('');
    try {
      await eylem();
    } catch (e) {
      setHata(driveHatasi(e));
    } finally {
      kilit.current = false;
      setCalisiyor(false);
    }
  };
  if (!bagli) return null;
  return (
    <div>
      <div className="satir-dugmeleri">
        <button
          className="dugme"
          disabled={mesgul || calisiyor}
          onClick={() =>
            void is(async () => {
              setListe(await driveListele('rapor'));
            })
          }
        >
          Drive’dan depo kontrol dosyası aç
        </button>
        {liste && (
          <button className="dugme hayalet" onClick={() => setListe(null)}>
            Listeyi kapat
          </button>
        )}
      </div>
      {liste?.length === 0 && (
        <p className="ipucu">
          Drive’da henüz CAL bup raporu yok. İlk raporu kaydettikten sonra Drive’a gönderin.
        </p>
      )}
      {liste && liste.length > 0 && (
        <ul className="yedek-listesi">
          {liste.slice(0, 20).map((d) => (
            <li key={d.id} className="dosya-satiri">
              <div>
                <b>{d.name}</b>
                <span>{new Date(d.createdTime).toLocaleString('tr-TR')}</span>
              </div>
              <button
                className="dugme kucuk"
                disabled={mesgul || calisiyor}
                onClick={() =>
                  void is(async () => {
                    const bayt = await driveIndir(d);
                    await ac({ ad: d.name, bayt, sonDegisiklik: Date.parse(d.createdTime) });
                    setListe(null);
                  })
                }
              >
                Aç
              </button>
            </li>
          ))}
        </ul>
      )}
      {calisiyor && <p role="status">Drive dosyası hazırlanıyor…</p>}
      {hata && <Mesaj ton="hata">{hata}</Mesaj>}
    </div>
  );
}

export function DriveRaporunuKaydet({ sonuc }: { sonuc: KayitSonucu }) {
  const bagli = useDrive();
  const [led, setLed] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const kilit = useRef(false);
  const [hata, setHata] = useState('');
  const [kayit, setKayit] = useState<DriveDosyasi | null>(null);
  const gonder = async () => {
    if (kilit.current) return;
    kilit.current = true;
    setMesgul(true);
    setHata('');
    try {
      const token = driveToken();
      await driveYukle(`YEDEK ${sonuc.hedef.ad}`, sonuc.oncekiBayt, 'yedek');
      driveHesabiDogrula(token);
      const d = await driveYukle(sonuc.hedef.ad, sonuc.hedef.bayt, 'rapor');
      if (led)
        for (const kaynak of sonuc.ledDosyalari) {
          driveHesabiDogrula(token);
          await driveYukle(kaynak.ad, kaynak.bayt, 'led');
        }
      driveHesabiDogrula(token);
      setKayit(d);
    } catch (e) {
      setHata(
        `${driveHatasi(e)} İşlem kısmen tamamlanmış olabilir. Yeniden göndermek aynı içeriği çoğaltmaz.`,
      );
    } finally {
      kilit.current = false;
      setMesgul(false);
    }
  };
  return (
    <div className="drive-sonuc">
      {bagli ? (
        <>
          {!kayit && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={led}
                  disabled={mesgul}
                  onChange={(e) => setLed(e.target.checked)}
                />{' '}
                LED dosyalarını da Drive’a gönder
              </label>
              <p className="ipucu">
                Depo kontrol dosyası ve kaydetmeden önceki yedeği CAL bup klasörüne ayrı kopyalar olarak
                gönderilir.
              </p>
            </>
          )}
          <div className="satir-dugmeleri">
            <button className="dugme" disabled={mesgul || !!kayit} onClick={() => void gonder()}>
              {mesgul
                ? 'Drive’a gönderiliyor…'
                : kayit
                  ? 'Drive’a kaydedildi'
                  : 'Dosyayı ve yedeğini Drive’a kaydet'}
            </button>
            {kayit && (
              <a className="dugme" href={driveDosyaAdresi(kayit)} target="_blank" rel="noreferrer">
                Drive’da göster
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="ipucu">
          Drive kopyası için Ayarlar’dan Google Drive’a bağlanın, sonra bu ekrana dönün.
        </p>
      )}
      {hata && <Mesaj ton="hata">{hata}</Mesaj>}
      {kayit && (
        <Mesaj ton="tamam">
          Dosya ve yedeği Drive’a kaydedildi{led ? '; LED dosyaları da gönderildi' : ''}.
        </Mesaj>
      )}
    </div>
  );
}
