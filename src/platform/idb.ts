// Tarayıcının kalıcı deposu (IndexedDB) için küçük anahtar/değer sarmalayıcı.
// Yedekler, geçmiş ve hatırlanan dosya burada durur; yalnızca bu tarayıcıda görünür.

// CAL bup adından önce kaydedilen geçmiş ve yedekleri korumak için ad değişmez.
const VT_ADI = 'bup-rapor';
const DEPO = 'kv';
export const DEPO_ACILIS_SURESI = 10_000;
export const DEPO_ISLEM_SURESI = 30_000;
export const KAYDI_SIL = Symbol('kaydi-sil');

let acilis: Promise<IDBDatabase> | null = null;

function vt(): Promise<IDBDatabase> {
  if (acilis) return acilis;
  const bekleyen = new Promise<IDBDatabase>((coz, reddet) => {
    let bitti = false;
    const sure = setTimeout(() => hata(new Error('Tarayıcı deposu zamanında açılamadı')), DEPO_ACILIS_SURESI);
    const hata = (e: unknown) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(sure);
      reddet(e);
    };
    let istek: IDBOpenDBRequest;
    try {
      istek = indexedDB.open(VT_ADI, 1);
    } catch (e) {
      hata(e);
      return;
    }
    istek.onupgradeneeded = () => {
      if (bitti) {
        istek.transaction?.abort();
        return;
      }
      try {
        istek.result.createObjectStore(DEPO);
      } catch (e) {
        istek.transaction?.abort();
        hata(e);
      }
    };
    istek.onsuccess = () => {
      const db = istek.result;
      if (bitti) {
        db.close();
        return;
      }
      bitti = true;
      clearTimeout(sure);
      db.onversionchange = () => {
        db.close();
        if (acilis === bekleyen) acilis = null;
      };
      coz(db);
    };
    istek.onerror = () => hata(istek.error ?? new Error('Tarayıcı deposu açılamadı'));
    istek.onblocked = () =>
      hata(new Error('Tarayıcı deposu başka sekmede açık; diğer CAL bup sekmelerini kapatın'));
  });
  acilis = bekleyen;
  void bekleyen.catch(() => {
    if (acilis === bekleyen) acilis = null;
  });
  return bekleyen;
}

/** Aktarım hiç sonuçlanmazsa iptal edilir; geç gelen başarı kabul edilmez. */
function aktar<T>(
  kip: IDBTransactionMode,
  is: (d: IDBObjectStore, a: IDBTransaction, devam: () => boolean) => () => T,
): Promise<T> {
  return vt().then(
    (db) =>
      new Promise<T>((coz, reddet) => {
        let aktarim: IDBTransaction;
        try {
          aktarim = db.transaction(DEPO, kip);
        } catch (e) {
          db.close();
          acilis = null;
          reddet(e);
          return;
        }
        let bitti = false;
        const sure = setTimeout(
          () => iptal(new Error('Tarayıcı depo işlemi zamanında tamamlanmadı')),
          DEPO_ISLEM_SURESI,
        );
        const hata = (e: unknown) => {
          if (bitti) return;
          bitti = true;
          clearTimeout(sure);
          reddet(e);
        };
        const iptal = (e: unknown) => {
          try {
            aktarim.abort();
          } catch {
            /* aktarım zaten kapanmış olabilir */
          }
          hata(e);
        };
        try {
          const sonuc = is(aktarim.objectStore(DEPO), aktarim, () => !bitti);
          aktarim.oncomplete = () => {
            if (bitti) return;
            try {
              const deger = sonuc();
              bitti = true;
              clearTimeout(sure);
              coz(deger);
            } catch (e) {
              hata(e);
            }
          };
          aktarim.onabort = () => hata(aktarim.error ?? new Error('Tarayıcı depo işlemi iptal edildi'));
          aktarim.onerror = () => hata(aktarim.error ?? new Error('Tarayıcı deposu hatası'));
        } catch (e) {
          iptal(e);
        }
      }),
  );
}

function islem<T>(kip: IDBTransactionMode, is: (d: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return aktar(kip, (depo) => {
    const istek = is(depo);
    return () => istek.result;
  });
}

/** Hassas kayıtlarda depo hatası "kayıt yok" sayılmamalı. */
export async function okuKesin<T>(anahtar: string): Promise<T | undefined> {
  return (await islem('readonly', (d) => d.get(anahtar))) as T | undefined;
}

export async function oku<T>(anahtar: string): Promise<T | undefined> {
  try {
    return await okuKesin<T>(anahtar);
  } catch {
    return undefined; // gizli pencere ya da engellenmiş depo: uygulama yine çalışır
  }
}

export async function yaz(anahtar: string, deger: unknown): Promise<boolean> {
  try {
    await islem('readwrite', (d) => d.put(deger, anahtar));
    return true;
  } catch {
    return false;
  }
}

export async function sil(anahtar: string): Promise<void> {
  try {
    await islem('readwrite', (d) => d.delete(anahtar));
  } catch {
    // yok sayılır
  }
}

/** Oku-değiştir-yaz tek aktarımda; iki sekmedeki geçmiş ve yedekler birbirini ezmez. */
export async function guncelle(
  anahtar: string,
  degistir: (onceki: unknown, depo: IDBObjectStore) => unknown,
): Promise<boolean> {
  try {
    await aktar('readwrite', (depo, aktarim, devam) => {
      const istek = depo.get(anahtar);
      istek.onsuccess = () => {
        if (!devam()) return;
        try {
          const deger = degistir(istek.result, depo);
          if (deger === KAYDI_SIL) depo.delete(anahtar);
          else depo.put(deger, anahtar);
        } catch {
          aktarim.abort();
        }
      };
      return () => undefined;
    });
    return true;
  } catch {
    return false;
  }
}
