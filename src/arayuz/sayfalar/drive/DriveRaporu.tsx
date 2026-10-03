import { useIslem } from '../../bilesenler/useIslem';
import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import { useState } from 'react';
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
import { useDrive } from './useDrive';

export function DriveRaporunuAc({
  ac,
  mesgul,
}: {
  ac: (d: SecilenDosya, signal?: AbortSignal) => Promise<void>;
  mesgul: boolean;
}) {
  const bagli = useDrive();
  const [liste, setListe] = useState<DriveDosyasi[] | null>(null);
  const islem = useIslem('drive-ac');
  const calisiyor = islem.mesgul;
  const is = (eylem: (signal: AbortSignal) => Promise<void>) =>
    islem.calistir(eylem, 'Drive dosyası hazırlandı.');
  if (!bagli) return null;
  return (
    <div>
      <div className="satir-dugmeleri">
        <button
          className="dugme"
          disabled={mesgul || calisiyor}
          onClick={() =>
            void is(async (signal) => {
              const l = await driveListele('rapor', signal);
              signal.throwIfAborted();
              setListe(l);
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
                  void is(async (signal) => {
                    const bayt = await driveIndir(d, undefined, signal);
                    signal.throwIfAborted();
                    await ac({ ad: d.name, bayt, sonDegisiklik: Date.parse(d.createdTime) }, signal);
                    signal.throwIfAborted();
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
      <IslemBildirimi islem={islem} />
    </div>
  );
}

export function DriveRaporunuKaydet({ sonuc }: { sonuc: KayitSonucu }) {
  const bagli = useDrive();
  const [led, setLed] = useState(false);
  const islem = useIslem('drive-kayit');
  const mesgul = islem.mesgul;
  const [kayit, setKayit] = useState<DriveDosyasi | null>(null);
  const gonder = () =>
    islem.calistir(
      async (signal) => {
        const token = driveToken();
        await driveYukle(`YEDEK ${sonuc.hedef.ad}`, sonuc.oncekiBayt, 'yedek', signal);
        signal.throwIfAborted();
        driveHesabiDogrula(token);
        const d = await driveYukle(sonuc.hedef.ad, sonuc.hedef.bayt, 'rapor', signal);
        if (led)
          for (const kaynak of sonuc.ledDosyalari) {
            signal.throwIfAborted();
            driveHesabiDogrula(token);
            await driveYukle(kaynak.ad, kaynak.bayt, 'led', signal);
          }
        signal.throwIfAborted();
        driveHesabiDogrula(token);
        setKayit(d);
      },
      'Dosya ve yedeği Drive’a kaydedildi.',
      true,
    );
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
      <IslemBildirimi islem={islem} />
      {kayit && (
        <Mesaj ton="tamam">
          Dosya ve yedeği Drive’a kaydedildi{led ? '; LED dosyaları da gönderildi' : ''}.
        </Mesaj>
      )}
    </div>
  );
}
