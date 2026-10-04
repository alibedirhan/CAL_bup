import { useIslem } from '../../bilesenler/useIslem';
import { IslemBildirimi } from '../../bilesenler/IslemBildirimi';
import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import { kartMaskesi, kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import { posBilgisiniKopyala } from '../../../platform/posGiris';
import { KartFormu } from './KartFormu';
import { PosKartAktarimi } from './PosKartAktarimi';

export function CariKartlari({
  cari,
  kartlar,
  mesgul,
  firmaOnay,
  gizlilikNo,
  aktarimNo,
  kaydet,
  sil,
  kartDegisti,
}: {
  cari: PosCari;
  kartlar: PosKart[];
  mesgul: boolean;
  firmaOnay: boolean;
  gizlilikNo: number;
  aktarimNo: number;
  kaydet: (k: PosKart) => Promise<IslemSonucu>;
  sil: (k: PosKart) => void;
  kartDegisti: () => void;
}) {
  const kopyalama = useIslem('kart-kopyalama');
  const blok = mesgul || kopyalama.mesgul;
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [form, setForm] = useState<{ kart: PosKart | null; no: number } | null>(null);
  const [gosterNo, setGosterNo] = useState<number | null>(null);
  const secili = kartlar.find((k) => k.id === seciliId && k.cariId === cari.id);
  const izinli = Boolean(secili && !kartSuresiGecti(secili) && firmaOnay && !blok);
  const acik = izinli && gosterNo === gizlilikNo;
  const kopyala = (tur: 'numara' | 'tarih' | 'sahibi') => {
    if (!izinli || !secili) return;
    const s = tur === 'tarih' ? `${secili.ay}/${secili.yil}` : secili[tur];
    void kopyalama.calistir(async (signal) => {
      await posBilgisiniKopyala(s);
      signal.throwIfAborted();
    }, 'Seçili kart bilgisi kopyalandı. POS’taki ilgili alana yapıştırın.');
  };
  return (
    <section className="kart" aria-labelledby="pos-kartlar-baslik">
      <div className="kart-ust">
        <h2 id="pos-kartlar-baslik">
          Kayıtlı kartlar <span className="rozet">{kartlar.length}</span>
        </h2>
        <button
          className="dugme"
          type="button"
          disabled={blok || kartlar.length >= 10}
          onClick={() => {
            setGosterNo(null);
            setSeciliId(null);
            kartDegisti();
            setForm({ kart: null, no: gizlilikNo });
          }}
        >
          Kart ekle
        </button>
      </div>
      <p className="ipucu">
        Bu kartlar yalnızca <b>{cari.ad}</b> profiline aittir. İşlemde kullanacağınız kartı seçin.
      </p>
      {kartlar.length === 0 ? (
        <div className="pos-kart-bos">
          <h3>Henüz kayıtlı kart yok</h3>
          <p>“Kart ekle” ile bilgileri elle yazabilir veya fotoğraftan okutabilirsiniz.</p>
        </div>
      ) : (
        <ul className="pos-kart-listesi">
          {kartlar.map((k) => {
            const eski = kartSuresiGecti(k);
            return (
              <li key={k.id}>
                <button
                  className="pos-odeme-karti"
                  type="button"
                  disabled={blok || eski}
                  aria-pressed={k.id === seciliId}
                  onClick={() => {
                    if (seciliId !== k.id) kartDegisti();
                    setSeciliId(k.id);
                    setGosterNo(null);
                  }}
                >
                  <b>{k.ad}</b>
                  <span className="rakam">{kartMaskesi(k)}</span>
                  <span>{k.sahibi || 'Kart sahibi eklenmedi'}</span>
                  <span>
                    {k.ay}/{k.yil}
                    {eski ? ' · Süresi geçmiş' : ''}
                  </span>
                </button>
                <div className="satir-dugmeleri">
                  <button
                    className="dugme kucuk"
                    type="button"
                    disabled={blok}
                    aria-label={`${k.ad} kartını düzenle`}
                    onClick={() => {
                      setGosterNo(null);
                      setSeciliId(null);
                      kartDegisti();
                      setForm({ kart: k, no: gizlilikNo });
                    }}
                  >
                    Düzenle
                  </button>
                  <button
                    className="dugme kucuk hayalet"
                    type="button"
                    disabled={blok}
                    aria-label={`${k.ad} kartını sil`}
                    onClick={() => sil(k)}
                  >
                    Sil
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {secili && (
        <div className="pos-secili-kart">
          <h3>Seçilen kart: {secili.ad}</h3>
          <PosKartAktarimi key={`${secili.id}-${aktarimNo}`} cari={cari} kart={secili} mesgul={blok} />
          <dl className="bilgi-satirlari">
            <div>
              <dt>Kart sahibi</dt>
              <dd>{secili.sahibi || 'Eklenmedi'}</dd>
            </div>
            <div>
              <dt>İletişim telefonu</dt>
              <dd className="rakam">{secili.telefon || 'Eklenmedi'}</dd>
            </div>
            <div>
              <dt>Son kullanma</dt>
              <dd className="rakam">
                {secili.ay}/{secili.yil}
              </dd>
            </div>
          </dl>
          <p className="ipucu">İletişim telefonu bankanın SMS hedefini değiştirmez.</p>
          {!firmaOnay && (
            <p className="ipucu">
              Kart numarasını göstermek/kopyalamak için aşağıdan POS’u açın ve açılan firma adı ile numarayı
              kontrol ettiğinizi işaretleyin.
            </p>
          )}
          <div className="satir-dugmeleri">
            <button
              className="dugme"
              type="button"
              disabled={!izinli}
              aria-expanded={acik}
              onClick={() => setGosterNo(acik ? null : gizlilikNo)}
            >
              {acik ? 'Kart numarasını gizle' : 'Kart numarasını göster'}
            </button>
            <button className="dugme" type="button" disabled={!izinli} onClick={() => kopyala('numara')}>
              Kart numarasını kopyala
            </button>
            <button className="dugme" type="button" disabled={!izinli} onClick={() => kopyala('tarih')}>
              Son kullanmayı kopyala
            </button>
            {secili.sahibi && (
              <button className="dugme" type="button" disabled={!izinli} onClick={() => kopyala('sahibi')}>
                Kart sahibini kopyala
              </button>
            )}
          </div>
          {acik && (
            <p className="rakam pos-acik-kart-numarasi">{secili.numara.replace(/(.{4})(?=.)/g, '$1 ')}</p>
          )}
          <p className="ipucu">
            Kart seçmek ödeme veya SMS başlatmaz. Tutarı, CVV’yi ve banka doğrulamasını POS/banka ekranında
            tamamlayın.
          </p>
        </div>
      )}
      <IslemBildirimi islem={kopyalama} />
      {form && form.no === gizlilikNo && (
        <KartFormu
          key={form.kart?.id ?? 'yeni'}
          cari={cari}
          kart={form.kart}
          mesgul={mesgul}
          kaydet={kaydet}
          vazgec={() => setForm(null)}
        />
      )}
    </section>
  );
}
