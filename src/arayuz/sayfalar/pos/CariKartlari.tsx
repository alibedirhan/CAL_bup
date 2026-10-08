import type { IslemSonucu } from '../../../cekirdek/islemSonucu';
import { useState } from 'react';
import type { PosCari } from '../../../cekirdek/posCari';
import { kartMaskesi, kartSuresiGecti, type PosKart } from '../../../cekirdek/posKart';
import { KartFormu } from './KartFormu';
import { PosKartAktarimi } from './PosKartAktarimi';
import type { Yardimci } from './useYardimci';

/** Seçim ve aktarım, kartın bu sekmede görülen içeriğine bağlanır. */
function kartImzasi(k: PosKart): string {
  return JSON.stringify([k.id, k.cariId, k.numara, k.ay, k.yil, k.ad, k.sahibi, k.telefon, k.cvv ?? '']);
}

export function CariKartlari({
  cari,
  kartlar,
  mesgul,
  gizlilikNo,
  aktarimNo,
  kaydet,
  sil,
  cariyiDuzenle,
  yardimci,
}: {
  cari: PosCari;
  kartlar: PosKart[];
  mesgul: boolean;
  gizlilikNo: number;
  aktarimNo: number;
  kaydet: (k: PosKart, beklenen: PosKart | null) => Promise<IslemSonucu>;
  sil: (k: PosKart) => void;
  cariyiDuzenle: () => void;
  yardimci: Yardimci;
}) {
  const blok = mesgul;
  // Seçim kart içeriğine bağlıdır: başka sekmede düzenlenen/silinen kart seçili kalmaz.
  const [secim, setSecim] = useState<{ id: string; imza: string } | null>(null);
  const [form, setForm] = useState<{ kart: PosKart | null } | null>(null);
  const secili = kartlar.find(
    (k) => k.id === secim?.id && k.cariId === cari.id && kartImzasi(k) === secim.imza,
  );
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
            setSecim(null);
            setForm({ kart: null });
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
                  aria-pressed={k.id === secili?.id}
                  onClick={() => {
                    setSecim({ id: k.id, imza: kartImzasi(k) });
                  }}
                >
                  <b>{k.ad}</b>
                  <span className="rakam">{kartMaskesi(k)}</span>
                  <span>{k.sahibi || 'Kart sahibi eklenmedi'}</span>
                  <span>
                    {k.ay}/{k.yil}
                    {k.cvv ? ' · CVV •••' : ''}
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
                      setSecim(null);
                      setForm({ kart: k });
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
          <div className="pos-secili-ust">
            <h3>Seçilen kart: {secili.ad}</h3>
            <span className="rakam">
              {kartMaskesi(secili)} · {secili.ay}/{secili.yil}
            </span>
          </div>
          <PosKartAktarimi
            key={`${secili.id}-${aktarimNo}`}
            cari={cari}
            kart={secili}
            mesgul={blok}
            yardimci={yardimci}
            cariyiDuzenle={cariyiDuzenle}
          />
          {/* Kart numarası ve CVV ekranda açık gösterilmez, panoya kopyalanmaz; kart yalnız POS
              yardımcısıyla aktarılır (1.18.0). */}
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
              <dt>CVV</dt>
              <dd className="rakam">{secili.cvv ? '•••' : 'Kaydedilmedi'}</dd>
            </div>
          </dl>
          <p className="ipucu">
            Kart seçmek ödeme veya SMS başlatmaz. İletişim telefonu bankanın SMS hedefini değiştirmez.
          </p>
        </div>
      )}
      {form && (
        <KartFormu
          key={form.kart?.id ?? 'yeni'}
          cari={cari}
          kart={form.kart}
          mesgul={mesgul}
          gizlilikNo={gizlilikNo}
          kaydet={(k) => kaydet(k, form.kart)}
          vazgec={() => setForm(null)}
        />
      )}
    </section>
  );
}
