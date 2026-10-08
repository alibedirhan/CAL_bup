import { useEffect, useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import { kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import { usePosAktarimi } from './usePosAktarimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
import type { Yardimci } from './useYardimci';

/** CVV kutusu yazılmadan bu kadar beklerse boşaltılır. */
export const CVV_SURESI = 120_000;

export function PosKartAktarimi({
  cari,
  kart,
  mesgul,
  yardimci,
  cariyiDuzenle,
}: {
  cari: PosCari;
  kart: PosKart;
  mesgul: boolean;
  yardimci: Yardimci;
  cariyiDuzenle?: () => void;
}) {
  const { durum, hata, neden, uyari, bekliyor, baslat, durdur, tanitilan, kurulum } = usePosAktarimi(
    cari,
    kart,
    mesgul,
    yardimci,
  );
  // Kartta CVV kayıtlı değilse ödeme anında yazılan CVV yalnız bu bileşenin belleğindedir; gönderilince,
  // kart değişince veya 2 dakika dokunulmazsa silinir.
  const [cvv, setCvv] = useState('');
  useEffect(() => {
    if (!cvv) return;
    const t = window.setTimeout(() => setCvv(''), CVV_SURESI);
    return () => {
      window.clearTimeout(t);
    };
  }, [cvv]);
  const ac = () => {
    const yazilan = cvv;
    // Geçerli CVV gönderilir gönderilmez kutudan silinir; eksik yazılmışsa düzeltilsin diye kalır.
    if (/^\d{3,4}$/.test(yazilan)) setCvv('');
    void baslat(false, yazilan);
  };
  const kontrolDugmesi = (
    <button type="button" className="dugme" disabled={mesgul || bekliyor} onClick={() => void baslat(true)}>
      Yardımcı bağlantısını kontrol et
    </button>
  );
  return (
    <section aria-label="Seçili kartı POS’a aktar">
      <p className="ipucu">
        POS yardımcısı cari numarasını karşılaştırır; kart numarası, son kullanma
        {tanitilan.ad ? ', Ad Soyad' : ''}
        {tanitilan.cvv ? (kart.cvv ? ' ve kayıtlı CVV' : ' ve yazdığınız CVV') : ''} POS’a kendiliğinden
        yazılır. Tutar ve onay sizde kalır.
      </p>
      {kart.cvv ? (
        <p className="ipucu">
          CVV bu kartta kayıtlı (•••).{' '}
          {tanitilan.cvv
            ? 'POS’taki CVV kutusuna kendiliğinden yazılır.'
            : kurulum
              ? 'Kendiliğinden dolması için uzantı simgesinden “POS sayfasında pencereyi göster”i açıp POS penceresindeki “Kurulumu yenile” ile CVV kutusunu da tanıtın.'
              : ''}
        </p>
      ) : tanitilan.cvv ? (
        <div className="pos-cvv">
          <label htmlFor="pos-cvv">CVV (bu ödeme için, kaydedilmez)</label>
          <input
            id="pos-cvv"
            className="girdi rakam pos-gizli-girdi"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={4}
            pattern="[0-9]{3,4}"
            value={cvv}
            disabled={mesgul || bekliyor}
            aria-describedby="pos-cvv-notu"
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
          />
          <p id="pos-cvv-notu" className="ipucu">
            Bu CVV yalnız bu aktarımda POS’a yazılır. Her seferinde yazmak istemiyorsanız “Düzenle” ile kartın
            CVV’sini kaydedin. Boş bırakırsanız CVV’yi POS’ta kendiniz yazarsınız.
          </p>
        </div>
      ) : (
        kurulum && (
          <p className="ipucu">
            CVV’nin de dolması için uzantı simgesinden “POS sayfasında pencereyi göster”i açıp POS
            penceresindeki “Kurulumu yenile” ile CVV kutusunu tanıtın.
          </p>
        )
      )}
      <div className="satir-dugmeleri">
        <button
          type="button"
          className="dugme birincil"
          disabled={mesgul || bekliyor || kartSuresiGecti(kart)}
          onClick={ac}
        >
          Seçili kartla POS’u aç
        </button>
        {!yardimci.hazir && kontrolDugmesi}
        {bekliyor && (
          <button type="button" className="dugme" onClick={durdur}>
            Aktarımı durdur
          </button>
        )}
        {hata && neden && cariyiDuzenle && (
          <button type="button" className="dugme" disabled={mesgul} onClick={cariyiDuzenle}>
            Cariyi düzenle
          </button>
        )}
      </div>
      <FormHatasi id="pos-aktarim-hatasi" hata={hata} />
      {durum && <p role="status">{durum}</p>}
      {uyari && <p className="ipucu">{uyari}</p>}
      {/* Kurulum tamamsa anlatım kapalı ve küçük bir “güncelle” satırına iner. */}
      <details
        key={String(yardimci.hazir)}
        className={yardimci.hazir ? 'pos-kurulum-kapali' : undefined}
        open={Boolean(hata) && !neden}
      >
        <summary>
          {yardimci.hazir ? 'Yardımcıyı güncelle veya yeniden kur' : 'POS yardımcısını bir kez kur'}
        </summary>
        {yardimci.hazir && <p>{kontrolDugmesi}</p>}
        <p>
          <a
            href={import.meta.env.BASE_URL + 'POS-Yardimcisi-Windows-Kurulum.cmd'}
            download="POS-Yardimcisi-Windows-Kurulum.cmd"
          >
            Windows kolay kurulum dosyasını indir
          </a>
        </p>
        <p className="ipucu">
          Windows’ta bu dosya yardımcıyı indirip klasörüne çıkarır ve seçtiğiniz tarayıcının eklenti sayfasını
          açar. İlk kurulumda “Paketlenmemiş öğe yükle” ile gösterilen klasörü seçin. Güncellemede yardımcıyı
          kaldırmayın; dosyayı yeniden çalıştırıp eklenti sayfasında “Yeniden yükle” deyin. Böylece alan
          kurulumu korunur.
        </p>
        <p className="ipucu">
          ZIP’i indirmek yeterli değildir. Yardımcı programı kullandığınız aynı Chrome/Edge/Brave
          tarayıcısında yüklü ve etkin olmalıdır.
        </p>
        <a href="https://alibedirhan.github.io/CAL_bup/" target="_blank" rel="noopener noreferrer">
          Yayımlanmış programı aç
        </a>
        <ol>
          <li>
            <a href={import.meta.env.BASE_URL + 'pos-yardimcisi.zip'} download="CAL-bup-POS-yardimcisi.zip">
              POS yardımcısını indir
            </a>{' '}
            ve ZIP’i kalıcı bir klasöre çıkarın.
          </li>
          <li>
            Edge’de <b>edge://extensions</b>, Chrome’da <b>chrome://extensions</b>, Brave’de{' '}
            <b>brave://extensions</b> açın; geliştirici modunu açıp “Paketlenmemiş öğe yükle” ile klasörü
            seçin.
          </li>
          <li>
            Herhangi bir cariyle POS’a girin. Ödeme formunda, kart bilgisi yazmadan, yardımcı panelindeki
            “Alanları tanıt” ile kutuları sırayla tıklayın. Bu <b>bir kez</b> yapılır; bütün cariler için
            geçerlidir.
          </li>
          <li>
            Bu sayfayı yenileyip cari ve kartı seçin. Kurumunuz kurulum izni vermiyorsa bilgi işlemle görüşün.
          </li>
        </ol>
        <p className="ipucu">
          Firma numarası POS ekranından kendiliğinden okunur ve seçilen cariyle eşleşmezse hiçbir şey
          doldurulmaz. Başka çerçevedeki alanlar doldurulmaz.
        </p>
      </details>
    </section>
  );
}
