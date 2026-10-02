// Tarayıcının kalıcı deposu (IndexedDB) için küçük anahtar/değer sarmalayıcı.
// Yedekler, geçmiş ve hatırlanan dosya burada durur; yalnızca bu tarayıcıda görünür.

// CAL bup adından önce kaydedilen geçmiş ve yedekleri korumak için ad değişmez.
const VT_ADI = 'bup-rapor';
const DEPO = 'kv';

let acilis: Promise<IDBDatabase> | null = null;

function vt(): Promise<IDBDatabase> {
  acilis ??= new Promise<IDBDatabase>((coz, reddet) => {
    const istek = indexedDB.open(VT_ADI, 1);
    istek.onupgradeneeded = () => istek.result.createObjectStore(DEPO);
    istek.onsuccess = () => {
      const db = istek.result;
      db.onversionchange = () => {
        db.close();
        acilis = null;
      };
      coz(db);
    };
    istek.onerror = () => {
      acilis = null;
      reddet(istek.error ?? new Error('Tarayıcı deposu açılamadı'));
    };
    istek.onblocked = () => {
      acilis = null;
      reddet(new Error('Tarayıcı deposu başka sekmede açık'));
    };
  }).catch((e: unknown) => {
    acilis = null;
    throw e;
  });
  return acilis;
}

function islem<T>(kip: IDBTransactionMode, is: (d: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return vt().then(
    (db) =>
      new Promise<T>((coz, reddet) => {
        const aktarim = db.transaction(DEPO, kip);
        const istek = is(aktarim.objectStore(DEPO));
        aktarim.oncomplete = () => coz(istek.result);
        aktarim.onabort = () => reddet(aktarim.error ?? new Error('Tarayıcı deposuna yazılamadı'));
        aktarim.onerror = () => reddet(aktarim.error ?? new Error('Tarayıcı deposu hatası'));
        istek.onerror = () => reddet(istek.error ?? new Error('Tarayıcı deposu hatası'));
      }),
  );
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
    await vt().then(
      (db) =>
        new Promise<void>((coz, reddet) => {
          const aktarim = db.transaction(DEPO, 'readwrite');
          const depo = aktarim.objectStore(DEPO);
          const istek = depo.get(anahtar);
          aktarim.oncomplete = () => coz();
          aktarim.onabort = () => reddet(aktarim.error ?? new Error('Tarayıcı kaydı tamamlanmadı'));
          aktarim.onerror = () => reddet(aktarim.error ?? new Error('Tarayıcı kaydı başarısız'));
          istek.onsuccess = () => {
            try {
              depo.put(degistir(istek.result, depo), anahtar);
            } catch {
              aktarim.abort();
            }
          };
        }),
    );
    return true;
  } catch {
    return false;
  }
}
