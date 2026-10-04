type Duz = Record<string, unknown>;

export function ayarBirlestir<T>(varsayilan: T, kayitli: unknown): T {
  if (typeof varsayilan !== 'object' || varsayilan === null) {
    return typeof kayitli === typeof varsayilan && (typeof kayitli !== 'number' || Number.isFinite(kayitli))
      ? (kayitli as T)
      : varsayilan;
  }
  const sonuc: Duz = { ...(varsayilan as Duz) };
  const k = (typeof kayitli === 'object' && kayitli !== null ? kayitli : {}) as Duz;
  for (const anahtar of Object.keys(sonuc)) sonuc[anahtar] = ayarBirlestir(sonuc[anahtar], k[anahtar]);
  return sonuc as T;
}
