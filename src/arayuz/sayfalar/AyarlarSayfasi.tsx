import type { ReactNode } from 'react';
import { VARSAYILAN_AYARLAR, sutunNo, type Ayarlar, type TabloDuzeni } from '../../cekirdek/ayarlar';
import { SURUM } from '../../surum';
import { SayfaBasligi } from '../bilesenler/SayfaBasligi';
import { TemaSecici } from '../bilesenler/TemaSecici';
import type { TemaTercihi } from '../tema';

interface Ozellikler {
  tema: TemaTercihi;
  temaDegisti: (t: TemaTercihi) => void;
  ayarlar: Ayarlar;
  ayarDegisti: (a: Ayarlar) => void;
}

function Anahtar({ id, deger, degisti }: { id: string; deger: boolean; degisti: (d: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={deger}
      className="anahtar"
      onClick={() => degisti(!deger)}
    >
      <span />
    </button>
  );
}

function Alan({
  id,
  etiket,
  aciklama,
  children,
}: {
  id: string;
  etiket: string;
  aciklama: string;
  children: ReactNode;
}) {
  return (
    <div className="ayar">
      <div>
        <label htmlFor={id}>{etiket}</label>
        <p>{aciklama}</p>
      </div>
      {children}
    </div>
  );
}

function SayiGirdisi({
  id,
  deger,
  degisti,
  en = 0,
}: {
  id: string;
  deger: number;
  degisti: (n: number) => void;
  en?: number;
}) {
  return (
    <input
      id={id}
      className="girdi rakam kisa"
      inputMode="decimal"
      defaultValue={String(deger).replace('.', ',')}
      key={deger}
      onBlur={(e) => {
        const n = Number(e.target.value.replace(',', '.'));
        if (Number.isFinite(n) && n >= en) degisti(n);
        else e.target.value = String(deger).replace('.', ',');
      }}
    />
  );
}

function MetinGirdisi({
  id,
  deger,
  degisti,
  kisa = false,
}: {
  id: string;
  deger: string;
  degisti: (s: string) => void;
  kisa?: boolean;
}) {
  return (
    <input
      id={id}
      className={kisa ? 'girdi kisa' : 'girdi'}
      defaultValue={deger}
      key={deger}
      onBlur={(e) => {
        const s = e.target.value.trim();
        if (s) degisti(s);
        else e.target.value = deger;
      }}
    />
  );
}

const SUTUN_ALANLARI: { anahtar: keyof TabloDuzeni; ad: string }[] = [
  { anahtar: 'ilkVeriSatiri', ad: 'İlk satır' },
  { anahtar: 'kodSutunu', ad: 'Kod' },
  { anahtar: 'isimSutunu', ad: 'Ad' },
  { anahtar: 'miktarSutunu', ad: 'Miktar' },
];

function DuzenSatiri({
  ad,
  duzen,
  degisti,
}: {
  ad: string;
  duzen: TabloDuzeni;
  degisti: (d: TabloDuzeni) => void;
}) {
  return (
    <tr>
      <th scope="row">{ad}</th>
      {SUTUN_ALANLARI.map(({ anahtar }) => (
        <td key={anahtar}>
          <input
            className="girdi rakam mini"
            aria-label={`${ad} ${anahtar}`}
            defaultValue={String(duzen[anahtar])}
            key={String(duzen[anahtar])}
            onBlur={(e) => {
              const v = e.target.value.trim().toUpperCase();
              try {
                if (anahtar === 'ilkVeriSatiri') {
                  const n = Number(v);
                  if (!Number.isInteger(n) || n < 1) throw new Error();
                  degisti({ ...duzen, ilkVeriSatiri: n });
                } else {
                  sutunNo(v);
                  degisti({ ...duzen, [anahtar]: v });
                }
              } catch {
                e.target.value = String(duzen[anahtar]);
              }
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function AyarlarSayfasi({ tema, temaDegisti, ayarlar: a, ayarDegisti }: Ozellikler) {
  const degis = (p: Partial<Ayarlar>) => ayarDegisti({ ...a, ...p });

  return (
    <>
      <SayfaBasligi ust="Kayıtlar" baslik="Ayarlar">
        Değişiklikler hemen geçerli olur ve bu bilgisayardaki tarayıcıda saklanır.
      </SayfaBasligi>

      <section className="kart" aria-labelledby="gorunum-baslik">
        <div className="kart-ust">
          <div>
            <h2 id="gorunum-baslik">Görünüm</h2>
            <p>Sistem seçiliyse bilgisayarınızın açık/koyu ayarı izlenir.</p>
          </div>
          <TemaSecici tercih={tema} degisti={temaDegisti} genis />
        </div>
      </section>

      <section className="kart" aria-labelledby="dk-ayar-baslik">
        <h2 id="dk-ayar-baslik">Günlük depo kontrol</h2>
        <div className="ayarlar">
          <Alan id="pazar" etiket="Pazar gününü atla" aciklama="Önerilen tarihte pazar günü atlanır.">
            <Anahtar id="pazar" deger={a.pazarAtla} degisti={(d) => degis({ pazarAtla: d })} />
          </Alan>
          <Alan
            id="tolerans"
            etiket="Kontrol toleransı (kg)"
            aciklama="Toplamlar arasında kabul edilen en büyük fark."
          >
            <SayiGirdisi id="tolerans" deger={a.tolerans} degisti={(n) => degis({ tolerans: n })} />
          </Alan>
          <Alan
            id="donuk"
            etiket="Donuk ürün öneki"
            aciklama="Bu önekle başlayan ürün sayım fişinde yoksa sayım = LED stoğu."
          >
            <MetinGirdisi id="donuk" deger={a.donukOnek} degisti={(s) => degis({ donukOnek: s })} kisa />
          </Alan>
          <Alan
            id="sifir"
            etiket="Miktarı sıfır eksikleri de ekle"
            aciklama="Listede olmayan ama miktarı sıfır olan ürünler de listeye eklenir."
          >
            <Anahtar
              id="sifir"
              deger={a.sifirEksikleriEkle}
              degisti={(d) => degis({ sifirEksikleriEkle: d })}
            />
          </Alan>
        </div>
      </section>

      <details className="kart gelismis">
        <summary>
          <h2>Gelişmiş: dosya düzenleri</h2>
          <p>LED raporlarının biçimi değişirse buradan uyarlanır.</p>
        </summary>
        <div className="ayarlar">
          <Alan
            id="ilk-satir"
            etiket="Gün sayfasında ilk ürün satırı"
            aciklama="Depo kontrol dosyasında listenin başladığı satır."
          >
            <SayiGirdisi
              id="ilk-satir"
              deger={a.hedefIlkSatir}
              en={1}
              degisti={(n) => degis({ hedefIlkSatir: Math.round(n) })}
            />
          </Alan>
          <Alan
            id="g1"
            etiket="G1 başlığı"
            aciklama="Depo kontrol dosyasını tanımak için G1 hücresinde aranır."
          >
            <MetinGirdisi
              id="g1"
              deger={a.hedefKontrolBaslik}
              degisti={(s) => degis({ hedefKontrolBaslik: s })}
            />
          </Alan>
          <Alan id="d01-tanim" etiket="D01 tanımı" aciklama="D01 dosyasının A1 hücresinde aranır.">
            <MetinGirdisi
              id="d01-tanim"
              deger={a.d01.tanim}
              degisti={(s) => degis({ d01: { ...a.d01, tanim: s } })}
            />
          </Alan>
          <Alan
            id="sube-tanim"
            etiket="Şube alış tanımı"
            aciklama="Şube alış raporunun A1 hücresinde aranır."
          >
            <MetinGirdisi
              id="sube-tanim"
              deger={a.subeAlis.tanim}
              degisti={(s) => degis({ subeAlis: { ...a.subeAlis, tanim: s } })}
            />
          </Alan>
          <Alan
            id="sayim-sayfa"
            etiket="Sayım fişi sayfa adı"
            aciklama="Sayım fişi dosyasında bu adda sayfa aranır."
          >
            <MetinGirdisi
              id="sayim-sayfa"
              deger={a.sayim.sayfaAdi}
              degisti={(s) => degis({ sayim: { ...a.sayim, sayfaAdi: s } })}
            />
          </Alan>
        </div>
        <div className="tablo-kap">
          <table className="tablo duzen-tablosu">
            <thead>
              <tr>
                <th>Rapor</th>
                {SUTUN_ALANLARI.map((s) => (
                  <th key={s.anahtar}>{s.ad}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <DuzenSatiri ad="D01" duzen={a.d01} degisti={(d) => degis({ d01: { ...a.d01, ...d } })} />
              <DuzenSatiri
                ad="Sayım fişi"
                duzen={a.sayim}
                degisti={(d) => degis({ sayim: { ...a.sayim, ...d } })}
              />
              <DuzenSatiri
                ad="Şube alış"
                duzen={a.subeAlis}
                degisti={(d) => degis({ subeAlis: { ...a.subeAlis, ...d } })}
              />
            </tbody>
          </table>
        </div>
        <div className="satir-dugmeleri">
          <button type="button" className="dugme" onClick={() => ayarDegisti(VARSAYILAN_AYARLAR)}>
            Bütün ayarları varsayılana döndür
          </button>
        </div>
      </details>

      <section className="kart" aria-labelledby="hakkinda-baslik">
        <h2 id="hakkinda-baslik">Hakkında</h2>
        <dl className="bilgi-satirlari">
          <div>
            <dt>Sürüm</dt>
            <dd className="rakam">{SURUM}</dd>
          </div>
          <div>
            <dt>Dosyalarınız</dt>
            <dd>Yalnızca bu bilgisayarda işlenir</dd>
          </div>
          <div>
            <dt>Kaynak kod</dt>
            <dd>
              <a href="https://github.com/alibedirhan/CAL_bup" target="_blank" rel="noreferrer">
                github.com/alibedirhan/CAL_bup
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
