import type { PosCari } from '../../../cekirdek/posCari';
import { kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import { usePosAktarimi } from './usePosAktarimi';
import { FormHatasi } from '../../bilesenler/FormHatasi';
export function PosKartAktarimi({ cari, kart, mesgul }: { cari: PosCari; kart: PosKart; mesgul: boolean }) {
  const { durum, hata, bekliyor, baslat, durdur } = usePosAktarimi(cari, kart, mesgul);
  return (
    <section aria-label="Seçili kartı POS’a aktar">
      <h3>Seçili kartla POS’a geç</h3>
      <p className="ipucu">
        Yardımcı cari numarasını karşılaştırır; yalnızca kart numarası ve son kullanmayı doldurur. CVV, tutar
        ve şifre gönderme işlemi sizde kalır.
      </p>
      <div className="satir-dugmeleri">
        <button
          type="button"
          className="dugme birincil"
          disabled={mesgul || bekliyor || kartSuresiGecti(kart)}
          onClick={() => void baslat()}
        >
          Seçili kartla POS’u aç
        </button>
        <button
          type="button"
          className="dugme"
          disabled={mesgul || bekliyor}
          onClick={() => void baslat(true)}
        >
          Yardımcı bağlantısını kontrol et
        </button>
        {bekliyor && (
          <button type="button" className="dugme" onClick={durdur}>
            Aktarımı durdur
          </button>
        )}
      </div>
      <FormHatasi id="pos-aktarim-hatasi" hata={hata} />
      {durum && <p role="status">{durum}</p>}
      <details open={Boolean(hata)}>
        <summary>POS yardımcısını bir kez kur</summary>
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
          açar. Son olarak “Paketlenmemiş öğe yükle” ile gösterilen klasörü seçin. Tarayıcıya ekleme onayını
          sizin vermeniz gerekir. Linux veya elle kurulum için aşağıdaki ZIP adımlarını kullanın.
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
            ve ZIP’i bir klasöre çıkarın.
          </li>
          <li>
            Edge’de <b>edge://extensions</b>, Chrome’da <b>chrome://extensions</b>, Brave’de{' '}
            <b>brave://extensions</b> açın; geliştirici modunu açıp “Paketlenmemiş öğe yükle” ile klasörü
            seçin.
          </li>
          <li>
            POS ödeme ekranında kart bilgisi girmeden, yardımcının panelinden boş numara/tarih alanlarını ve
            görünen vergi/TC numarasını bir kez tanıtın.
          </li>
          <li>
            Bu sayfayı yenileyip cari ve kartı seçin. Kurumunuz kurulum izni vermiyorsa bilgi işlemle görüşün.
          </li>
        </ol>
        <p className="ipucu">
          Görünen vergi/TC numarası gereklidir. Başka çerçevedeki veya tanıtılmamış alanlar doldurulmaz.
        </p>
      </details>
    </section>
  );
}
