// Tarayıcının kalıcı deposu (IndexedDB) için küçük anahtar/değer sarmalayıcı.
// Yedekler, geçmiş ve hatırlanan dosya burada durur; yalnızca bu tarayıcıda görünür.

const VT_ADI = 'bup-rapor';
const DEPO = 'kv';

let acilis: Promise<IDBDatabase> | null = null;

function vt(): Promise<IDBDatabase> {
  acilis ??= new Promise((coz, reddet) => {
    const istek = indexedDB.open(VT_ADI, 1);
    istek.onupgradeneeded = () => istek.result.createObjectStore(DEPO);
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => reddet(istek.error ?? new Error('Tarayıcı deposu açılamadı'));
  });
  return acilis;
}

function islem<T>(kip: IDBTransactionMode, is: (d: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return vt().then(
    (db) =>
      new Promise<T>((coz, reddet) => {
        const istek = is(db.transaction(DEPO, kip).objectStore(DEPO));
        istek.onsuccess = () => coz(istek.result);
        istek.onerror = () => reddet(istek.error ?? new Error('Tarayıcı deposu hatası'));
      }),
  );
}

export async function oku<T>(anahtar: string): Promise<T | undefined> {
  try {
    return (await islem('readonly', (d) => d.get(anahtar))) as T | undefined;
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
