import { useEffect, useRef, useState } from 'react';
import type { AtamaGirdisi } from '../../../../cekirdek/yaslandirma/turler';
import type { YaslandirmaEkrani } from './useYaslandirma';

const BOS: AtamaGirdisi = { arac_no: '', sorumlu: '', departman: '', email: '', telefon: '', notlar: '' };
const ALANLAR: [Exclude<keyof AtamaGirdisi, 'arac_no'>, string][] = [
  ['sorumlu', 'Sorumlu'],
  ['departman', 'Departman'],
  ['email', 'E-posta'],
  ['telefon', 'Telefon'],
  ['notlar', 'Notlar'],
];

/** Masaüstü “Atama”: araç–sorumlu kaydı, iş yükü, seçileni kaldırma ve son değişikliği geri alma.
 * Kayıt yalnız bu tarayıcıdadır; masaüstü atamaları aktarılmaz. */
export function AtamaPaneli({ m, araclar }: { m: YaslandirmaEkrani; araclar: string[] }) {
  const [form, setForm] = useState<AtamaGirdisi>(BOS);
  const [secili, setSecili] = useState<string | null>(null);
  const [ipucu, setIpucu] = useState('Araç no ve sorumlu zorunludur.');
  const yuklendi = useRef(false);
  const { atama, atamaIslemi, mesgul } = m;
  useEffect(() => {
    if (yuklendi.current || atama) return;
    yuklendi.current = true;
    void atamaIslemi('atama');
  }, [atama, atamaIslemi]);
  const liste = atama?.liste ?? [];
  const seciliVar = secili !== null && liste.some((a) => a.arac_no === secili);
  const isYuku = Object.entries(atama?.isYuku ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    <div className="musteri-izgara">
      <section className="kart" aria-labelledby="yas-atama-form">
        <h2 id="yas-atama-form">Araç ataması</h2>
        <p className="ipucu">
          Atamalar bu tarayıcıda saklanır; kişi bilgilerini yalnız bu bilgisayarı kullananlar görür.
        </p>
        <form
          className="pos-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (mesgul) return;
            if (!form.arac_no.trim() || !form.sorumlu.trim()) {
              setIpucu('Araç no ve sorumlu zorunludur.');
              return;
            }
            const arac = form.arac_no.trim();
            void atamaIslemi('ata', { atama: form }).then((tamam) => {
              if (!tamam) return;
              setForm(BOS);
              setIpucu(`Araç ${arac} atandı.`);
            });
          }}
        >
          <label htmlFor="yas-arac">Araç no</label>
          <input
            id="yas-arac"
            className="girdi"
            list="yas-arac-listesi"
            maxLength={200}
            autoComplete="off"
            value={form.arac_no}
            disabled={mesgul}
            onChange={(e) => setForm({ ...form, arac_no: e.target.value })}
          />
          <datalist id="yas-arac-listesi">
            {araclar.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          {ALANLAR.map(([k, ad]) => (
            <label key={k}>
              {ad}
              <input
                className="girdi"
                maxLength={200}
                autoComplete="off"
                type={k === 'email' ? 'email' : k === 'telefon' ? 'tel' : 'text'}
                value={form[k]}
                disabled={mesgul}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <p className="ipucu" role="status">
            {ipucu}
          </p>
          <div className="satir-dugmeleri">
            <button className="dugme birincil" type="submit" disabled={mesgul}>
              Ata / Güncelle
            </button>
          </div>
        </form>
      </section>
      <section className="kart" aria-labelledby="yas-atama-liste">
        <div className="kart-ust">
          <h2 id="yas-atama-liste">Atamalar</h2>
          <div className="satir-dugmeleri">
            <button
              className="dugme"
              disabled={mesgul || !atama?.geriAlinabilir}
              onClick={() => void atamaIslemi('geri-al').then(() => setSecili(null))}
            >
              Son Değişikliği Geri Al
            </button>
            <button
              className="dugme"
              disabled={mesgul || !seciliVar}
              title={
                seciliVar
                  ? 'Seçili araç atamasını kaldırır.'
                  : 'Kaldırmak için tablodan bir araç ataması seçin.'
              }
              onClick={() => {
                if (!secili || !window.confirm(`Araç ${secili} için atama kaldırılsın mı?`)) return;
                void atamaIslemi('kaldir', { aracNo: secili }).then((tamam) => {
                  if (tamam) setSecili(null);
                });
              }}
            >
              Seçiliyi Kaldır
            </button>
          </div>
        </div>
        {!atama ? (
          <div className="satir-dugmeleri">
            <p className="ipucu">Atamalar yüklenmedi.</p>
            <button className="dugme kucuk" disabled={mesgul} onClick={() => void atamaIslemi('atama')}>
              Atamaları yükle
            </button>
          </div>
        ) : (
          <>
            {isYuku.length > 0 && (
              <p className="ipucu">İş yükü — {isYuku.map(([ad, n]) => `${ad}: ${n} araç`).join(', ')}</p>
            )}
            {liste.length === 0 ? (
              <p className="ipucu">Henüz araç ataması yok. Araç ve sorumlu girerek ilk atamayı yapın.</p>
            ) : (
              <div className="tablo-kap" tabIndex={0} aria-label="Atama tablosu kaydırma alanı">
                <table className="tablo" aria-label="Araç atamaları">
                  <thead>
                    <tr>
                      <th scope="col">Seç</th>
                      <th scope="col">Araç</th>
                      <th scope="col">Sorumlu</th>
                      <th scope="col">Departman</th>
                      <th scope="col">İletişim</th>
                      <th scope="col">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((a) => (
                      <tr key={a.arac_no}>
                        <td>
                          <input
                            type="radio"
                            name="yas-atama-secim"
                            aria-label={`Araç ${a.arac_no} atamasını seç`}
                            checked={secili === a.arac_no}
                            onChange={() => setSecili(a.arac_no)}
                          />
                        </td>
                        <td>{a.arac_no}</td>
                        <td>{a.sorumlu}</td>
                        <td>{a.departman}</td>
                        <td>{[a.email, a.telefon].filter(Boolean).join(' · ')}</td>
                        <td>{a.atama_tarihi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
