import { useState } from 'react';
import { KullaniciHatasi } from '../../../cekirdek/hata';
import { numaraMaskesi, posGirisSifresi, type PosCari } from '../../../cekirdek/posCari';
import { POS_GIRIS_ADRESI, posBilgisiniKopyala, posCariyleGirisYap } from '../../../platform/posGiris';
import { Mesaj } from '../../bilesenler/Mesaj';

interface Ozellikler {
  cari: PosCari;
  izin: () => boolean;
  bildir: (mesaj: string, hata?: boolean) => void;
}

export function PosGirisYardimi({ cari, izin, bildir }: Ozellikler) {
  const [goster, setGoster] = useState(false);
  const [acildi, setAcildi] = useState(false);
  const [dogrulandi, setDogrulandi] = useState(false);
  const kopyala = (tur: 'numara' | 'sifre') => {
    if (!izin()) return;
    const metin = tur === 'numara' ? cari.numara : posGirisSifresi(cari.numara);
    void posBilgisiniKopyala(metin)
      .then(() => {
        if (izin())
          bildir(
            tur === 'numara'
              ? 'Numara kopyalandı. Vergi no ve kullanıcı alanlarına yapıştırın.'
              : 'POS giriş şifresi kopyalandı. POS’taki şifre alanına yapıştırın.',
          );
      })
      .catch((e: unknown) => {
        if (izin()) bildir(e instanceof KullaniciHatasi ? e.message : 'Kopyalanamadı. Elle yazın.', true);
      });
  };

  return (
    <section className="kart one-cikan" aria-labelledby="pos-giris-baslik">
      <span className="etiket">Seçilen cari</span>
      <h2 id="pos-giris-baslik">{cari.ad}</h2>
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
              setAcildi(true);
              setDogrulandi(false);
              bildir(
                'Seçtiğiniz carinin giriş bilgileri POS’a gönderildi. Açılan sekmede firma adını ve numarasını kontrol edin. Giriş ekranında kalırsa bilgileri elle yazın.',
              );
            } catch (e) {
              bildir(e instanceof KullaniciHatasi ? e.message : 'POS giriş isteği açılamadı.', true);
            }
          }}
        >
          POS’u aç
        </button>
        <button className="dugme" type="button" onClick={() => kopyala('numara')}>
          Numarayı kopyala
        </button>
        <button className="dugme" type="button" onClick={() => kopyala('sifre')}>
          Giriş şifresini kopyala
        </button>
      </div>
      <p className="ipucu">
        Bu düğme seçilen carinin numarasını ve giriş şifresini doğrudan POS’a gönderir. Giriş kabul edilirse
        cari hesabı açılır; CAL bup sonucu okuyamaz. Açılan sekmeyi göremiyorsanız tarayıcının açılır pencere
        iznini kontrol edin.
      </p>
      <a
        className="dugme hayalet"
        href={POS_GIRIS_ADRESI}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!izin()) {
            e.preventDefault();
            return;
          }
          setAcildi(true);
          setDogrulandi(false);
        }}
      >
        Giriş sayfasını elle aç
      </a>
      <button
        className="dugme hayalet"
        type="button"
        aria-expanded={goster}
        onClick={() => {
          if (izin()) setGoster(!goster);
        }}
      >
        {goster ? 'Giriş bilgilerini gizle' : 'Giriş bilgilerini göster'}
      </button>
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
      {acildi && (
        <label className="pos-onay">
          <input
            type="checkbox"
            checked={dogrulandi}
            onChange={(e) => {
              if (izin()) setDogrulandi(e.target.checked);
            }}
          />
          POS’taki firma adı ve numaranın seçtiğim cariyle eşleştiğini kontrol ettim.
        </label>
      )}
      <Mesaj ton={dogrulandi ? 'bilgi' : 'uyari'}>
        {dogrulandi
          ? 'Cari kontrolünü siz onayladınız. Kart, CVV, tutar ve banka şifresini POS/banka ekranlarında elle girin.'
          : 'Doğru cari açıldığını kontrol etmeden kart bilgilerini girmeyin. CAL bup POS oturumunu otomatik doğrulayamaz.'}
      </Mesaj>
      <p className="ipucu">POS’taki bakiye ödeme tutarı değildir; tutarı kendiniz belirleyip kontrol edin.</p>
      <p className="ipucu">
        Kopyalanan bilgi bilgisayarın panosuna geçer. İşiniz bitince panoyu temizleyin; bu düğmeler pano
        geçmişini temizleyemez.
      </p>
    </section>
  );
}
