import { sayiMetni } from '../../../cekirdek/sayi';
import { gunAdi, tarihMetni } from '../../../cekirdek/tarih';
import type { Kontrol } from '../../../cekirdek/kontrol';
import type { DepoKontrolPlani } from '../../../raporlar/depoKontrol/hesapla';
import type { GunSecimi } from '../../../raporlar/depoKontrol/gunSecimi';
import { Mesaj } from '../../bilesenler/Mesaj';
import { Simge } from '../../bilesenler/Simge';

const DURUM_SINIFI = { Tamam: 'tamam', Uyarı: 'uyari', Hata: 'hata', Bilgi: 'bilgi' } as const;

const METRIKLER: { baslik: string; aciklama: string; kontrol: number }[] = [
  { baslik: 'LED stoğu (B)', aciklama: 'D01 dip toplamıyla', kontrol: 0 },
  { baslik: 'Depo sayımı (D)', aciklama: 'Sayım fişi + donuk ürünlerle', kontrol: 1 },
  { baslik: 'Gelen mal (G2)', aciklama: 'Şube alış dip toplamıyla', kontrol: 2 },
];

function Metrik({ baslik, aciklama, k }: { baslik: string; aciklama: string; k: Kontrol | undefined }) {
  if (!k) return null;
  const tamam = k.durum === 'Tamam';
  return (
    <div className={`metrik ${tamam ? '' : 'hatali'}`}>
      <span className="metrik-ad">{baslik}</span>
      <span className="metrik-deger">
        {sayiMetni(k.bulunan)}
        <small>kg</small>
      </span>
      <span className={`metrik-kontrol ${tamam ? 'tamam' : 'hata'}`}>
        <Simge ad={tamam ? 'tik' : 'dosya'} boyut={14} />
        {tamam
          ? `${aciklama} aynı`
          : `${aciklama} tutmuyor: beklenen ${sayiMetni(k.beklenen ?? 0)}, fark ${sayiMetni(k.fark ?? 0)}`}
      </span>
    </div>
  );
}

export function KontrolPaneli({ plan, secim }: { plan: DepoKontrolPlani; secim: GunSecimi }) {
  const bilgiler = plan.kontroller.filter((k) => k.durum === 'Bilgi');
  return (
    <section className="kart one-cikan kontrol" aria-labelledby="kontrol-baslik">
      <div className="kart-ust">
        <div>
          <h2 id="kontrol-baslik">
            {tarihMetni(secim.tarih)} · {gunAdi(secim.tarih)}
          </h2>
          <p>
            {secim.tur === 'yeni'
              ? `Yeni sayfa ${secim.onceki.ad} sayfasından oluşturulacak`
              : `${secim.ad} sayfası yeniden doldurulacak`}{' '}
            · {plan.satirlar.length} ürün satırı
          </p>
        </div>
        <span className={`rozet durum ${DURUM_SINIFI[plan.genelDurum]}`}>
          {plan.genelDurum}
          {plan.uyarilar.length > 0 && ` · ${plan.uyarilar.length} konu`}
        </span>
      </div>

      <div className="metrikler">
        {METRIKLER.map((m) => (
          <Metrik key={m.baslik} baslik={m.baslik} aciklama={m.aciklama} k={plan.kontroller[m.kontrol]} />
        ))}
      </div>

      <dl className="bilgi-satirlari">
        {bilgiler.map((k) => (
          <div key={k.ad}>
            <dt>{k.ad}</dt>
            <dd className="rakam">{sayiMetni(k.bulunan)}</dd>
          </div>
        ))}
      </dl>

      {(plan.uyarilar.length > 0 || plan.notlar.length > 0) && (
        <div className="mesajlar">
          {plan.uyarilar.map((u) => (
            <Mesaj key={u} ton="uyari">
              {u}
            </Mesaj>
          ))}
          {plan.notlar.map((n) => (
            <Mesaj key={n} ton="bilgi">
              {n}
            </Mesaj>
          ))}
        </div>
      )}
    </section>
  );
}
