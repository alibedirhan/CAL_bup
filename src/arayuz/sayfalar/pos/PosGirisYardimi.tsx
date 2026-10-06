import { useIslem } from '../../bilesenler/useIslem';
import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import { useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { numaraMaskesi, posGirisSifresi, type PosCari } from '../../../cekirdek/posCari';
import { POS_GIRIS_ADRESI, posBilgisiniKopyala, posCariyleGirisYap } from '../../../platform/posGiris';
import { Mesaj } from '../../bilesenler/Mesaj';

interface Ozellikler {
  cari: PosCari;
  izin: () => boolean;
  bildir: (mesaj: string, hata?: boolean) => void;
  firmaKontrolu?: (onay: boolean) => void;
  girisBasladi?: () => void;
  gizlilikNo?: number;
  firmaDogrulandi?: boolean;
  baslik?: string;
}

export function PosGirisYardimi({
  cari,
  izin,
  bildir,
  firmaKontrolu,
  girisBasladi,
  gizlilikNo = 0,
  firmaDogrulandi,
  baslik,
}: Ozellikler) {
  const kopyalama = useIslem('pos-kopyalama');
  const [gosterNo, setGosterNo] = useState<number | null>(null);
  const goster = gosterNo === gizlilikNo;
  const [onayNo, setOnayNo] = useState<number | null>(null);
  const dogrulandi = firmaDogrulandi ?? onayNo === gizlilikNo;
  const kopyala = (tur: 'numara' | 'sifre') => {
    if (!izin()) return;
    const metin = tur === 'numara' ? cari.numara : posGirisSifresi(cari.numara);
    void kopyalama.calistir(
      async (signal) => {
        await posBilgisiniKopyala(metin);
        signal.throwIfAborted();
      },
      tur === 'numara'
        ? 'Numara kopyalandı. Vergi no ve kullanıcı alanlarına yapıştırın.'
        : 'POS giriş şifresi kopyalandı. POS’taki şifre alanına yapıştırın.',
    );
  };

  return (
    <section className="kart one-cikan" aria-labelledby="pos-giris-baslik">
      <span className="etiket">{baslik ? 'Yardımcı kurulu değilse' : 'Seçilen cari'}</span>
      <h2 id="pos-giris-baslik">{baslik ?? cari.ad}</h2>
      <p className="rakam">{numaraMaskesi(cari.numara)}</p>
      <ol className="pos-adimlar">
        <li>POS’ta başka cari açıksa önce o oturumdan çıkın.</li>
        <li>“POS’u aç” ile bu carinin giriş bilgilerini POS’a gönderin.</li>
        <li>Girişten sonra üstteki firma adı ve numarayı bu kayıtla karşılaştırın.</li>
      </ol>
      <div className="satir-dugmeleri">
        <button
          className="dugme birincil"
          type="button"
          onClick={() => {
            if (!izin()) return;
            try {
              posCariyleGirisYap(cari.numara);
              setOnayNo(null);
              firmaKontrolu?.(false);
              girisBasladi?.();
              // CAL bup sağlayıcının yanıtını okuyamaz; giriş başarılı diye bildirilmez.
              bildir(
                'Giriş isteği yeni sekmede açıldı. CAL bup girişin sonucunu göremez: açılan sekmede firma adı ve numarayı kontrol edin. Giriş ekranında kalırsanız oradaki uyarıyı okuyun, POS’ta başka cari açıksa önce çıkış yapın; bilgileri “Giriş bilgilerini göster” ile karşılaştırıp elle deneyin.',
              );
            } catch (e) {
              bildir(e instanceof KullaniciHatasi ? e.message : 'POS giriş isteği açılamadı.', true);
            }
          }}
        >
          POS’u aç
        </button>
        <button className="dugme" type="button" disabled={kopyalama.mesgul} onClick={() => kopyala('numara')}>
          Numarayı kopyala
        </button>
        <button className="dugme" type="button" disabled={kopyalama.mesgul} onClick={() => kopyala('sifre')}>
          Giriş şifresini kopyala
        </button>
      </div>
      <IslemBildirimi islem={kopyalama} />
      <div className="satir-dugmeleri">
        <a
          className="dugme kucuk"
          href={POS_GIRIS_ADRESI}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!izin()) {
              e.preventDefault();
              return;
            }
            setOnayNo(null);
            firmaKontrolu?.(false);
            girisBasladi?.();
          }}
        >
          Giriş sayfasını elle aç
        </a>
        <button
          className="dugme kucuk"
          type="button"
          aria-expanded={goster}
          onClick={() => {
            if (izin()) setGosterNo(goster ? null : gizlilikNo);
          }}
        >
          {goster ? 'Giriş bilgilerini gizle' : 'Giriş bilgilerini göster'}
        </button>
      </div>
      {goster && (
        <dl className="bilgi-satirlari">
          <div>
            <dt>Vergi no / Kullanıcı</dt>
            <dd className="rakam">{cari.numara}</dd>
          </div>
          <div>
            <dt>POS giriş şifresi</dt>
            <dd className="rakam">{posGirisSifresi(cari.numara)}</dd>
          </div>
        </dl>
      )}
      <label className="pos-onay">
        <input
          type="checkbox"
          checked={dogrulandi}
          onChange={(e) => {
            if (izin()) {
              setOnayNo(e.target.checked ? gizlilikNo : null);
              firmaKontrolu?.(e.target.checked);
            }
          }}
        />
        POS’taki firma adı ve numaranın seçtiğim cariyle eşleştiğini kontrol ettim.
      </label>
      <Mesaj ton={dogrulandi ? 'bilgi' : 'uyari'}>
        {dogrulandi
          ? 'Cari kontrolünü siz onayladınız. Kart, CVV, tutar ve banka şifresini POS/banka ekranlarında elle girin.'
          : 'Elle girişte doğru cari açıldığını kendiniz kontrol edin. Bu giriş yöntemi POS oturumunu otomatik doğrulamaz.'}
      </Mesaj>
      <details className="pos-ayrinti">
        <summary>Ayrıntılar</summary>
        <p className="ipucu">
          Buradaki “POS’u aç” yalnız seçilen carinin numarasını ve giriş şifresini POS’a gönderir; kart
          bilgisi doldurmaz. Giriş kabul edilirse cari hesabı açılır; CAL bup sonucu okuyamaz. Açılan sekmeyi
          göremiyorsanız tarayıcının açılır pencere iznini kontrol edin.
        </p>
        <p className="ipucu">
          POS’taki bakiye ödeme tutarı değildir; tutarı kendiniz belirleyip kontrol edin.
        </p>
        <p className="ipucu">
          Kopyalanan bilgi bilgisayarın panosuna geçer. İşiniz bitince panoyu temizleyin; bu düğmeler pano
          geçmişini temizleyemez.
        </p>
      </details>
    </section>
  );
}
