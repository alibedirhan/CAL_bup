import type { AlanRolu } from '../cekirdek/posAktarimi';

/** DOM'dan bağımsız alan kuralları. İpucu: alanın kimliği, adı, autocomplete, placeholder,
 * aria-label ve etiket metni; aksanları kaldırılmış, `ı` → `i`. */

// Hiçbir rolde yazılmayacak alanlar. `pin` yalnız ayrı sözcük veya PIN alanı kalıbıyla engellenir;
// `Pinar`, `Shopping` gibi adlar engellenmez, `txtPin`, `PinKod`, `PinNumber` engellenir. Yanında para
// birimi (TL, ₺, USD, EUR) yazan kutu tutar sayılır; başlığı olmasa da elle onaylanamaz.
export const ENGELLI_ALAN =
  /cvv|cvc|csc|security|guvenlik|tutar|amount|bedel|miktar|taksit|sms|otp|sifre|parola|password|(?:^|[^a-z])pin|pin(?:[^a-z]|$)|pin(?:kod|code|no|num)|(?:^|[^a-z])(?:tl|try|usd|eur)(?:[^a-z]|$)|[₺€]/i;

// ASP.NET'te yaygın önekler (ddl/txt/cmb…) birleşik adlarda sözcük sınırı bırakmaz.
export const ROL_IPUCU: Record<Exclude<AlanRolu, 'firma'>, RegExp> = {
  numara:
    /(?:kart|card).*(?:num|no)|(?:num|no).*(?:kart|card)|kredi\s*kart|(?:^|[^a-z]|txt|tb)(?:cc|kk)[\s_.-]*(?:no|num)|(?:^|[^a-z]|txt|tb)pan(?:[^a-z]|$)|cc-number/i,
  tarih: /tarih|son\s*kullan|s[.\s_-]*k[.\s_-]*t|gecerlilik|expir|valid|cc-exp/i,
  ay: /(?:^|[^a-z])ay(?:[^a-z]|$)|(?:ddl|txt|cmb|drp|sel|skt|exp|son)ay(?:[^a-z]|$)|month|cc-exp-month/i,
  yil: /yil|year|cc-exp-year/i,
};

export function ipucuUygun(ipucu: string, rol: Exclude<AlanRolu, 'firma'>): boolean {
  return !ENGELLI_ALAN.test(ipucu) && ROL_IPUCU[rol].test(ipucu);
}

/** Tek tarih alanının biçimi: 4 karakter `AAYY`; yer tutucu `AA / YY` gibi boşluklu ayraç gösteriyorsa
 * boşluklu (kart görselli formlar); `YYYY` ipucu veya 7 karakterlik boşluksuz alan dört haneli yıl;
 * diğerleri `AA/YY`. Seçilen biçim alana sığmazsa `AA/YY` denenir, o da sığmazsa yazılmaz. */
export function tarihMetni(ay: string, yil: string, enFazla: number, yerTutucu: string): string {
  if (enFazla === 4) return ay + yil.slice(-2);
  const bosluklu = /\s\/\s/.test(yerTutucu);
  const dortHane = /y{4}/i.test(yerTutucu) || (!bosluklu && enFazla === 7);
  const metin = ay + (bosluklu ? ' / ' : '/') + (dortHane ? yil : yil.slice(-2));
  return enFazla !== -1 && metin.length > enFazla ? ay + '/' + yil.slice(-2) : metin;
}
