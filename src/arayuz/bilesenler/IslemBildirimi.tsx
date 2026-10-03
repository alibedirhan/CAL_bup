import { useIslem } from './useIslem';
import { FormHatasi } from './FormHatasi';
import { Bildirim } from './Bildirim';
export function IslemBildirimi({ islem }: { islem: ReturnType<typeof useIslem> }) {
  const s = islem.sonuc;
  return (
    <>
      {islem.mesgul && (
        <div className="satir-dugmeleri">
          <p role="status">İşlem sürüyor…</p>
          <button className="dugme kucuk" type="button" onClick={islem.durdur}>
            İşlemi durdur
          </button>
        </div>
      )}
      {s && s.durum !== 'tamam' && <FormHatasi hata={s.mesaj} id={`islem-${s.kapsam}-hata`} />}
      {s?.durum === 'tamam' && s.mesaj && <Bildirim mesaj={s.mesaj} />}
    </>
  );
}
