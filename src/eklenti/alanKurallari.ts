import type { KartRolu } from '../cekirdek/posKurulumu';

/** DOM'dan bağımsız alan kuralları. İpucu: alanın kimliği, adı, autocomplete, placeholder,
 * aria-label ve etiket metni; aksanları kaldırılmış, `ı` → `i`. */

// Hiçbir rolde yazılmayacak alanlar. `pin` yalnız ayrı sözcük veya PIN alanı kalıbıyla engellenir;
// `Pinar`, `Shopping` gibi adlar engellenmez, `txtPin`, `PinKod`, `PinNumber` engellenir. Yanında para
// birimi (TL, ₺, USD, EUR) yazan kutu tutar sayılır; başlığı olmasa da elle onaylanamaz.
export const ENGELLI_GENEL =
  /tutar|amount|bedel|miktar|taksit|sms|otp|sifre|parola|password|(?:^|[^a-z])pin|pin(?:[^a-z]|$)|pin(?:kod|code|no|num)|(?:^|[^a-z])(?:tl|try|usd|eur)(?:[^a-z]|$)|[₺€]/i;
// Güvenlik kodu kutusu: yalnız açıkça tanıtılmış CVV rolüne yazılır, başka hiçbir role.
export const CVV_IPUCU = /cvv|cvc|csc|cv2|security|guvenlik/i;
/** CVV dışındaki her rol için engelli alan (eski adıyla). */
export const ENGELLI_ALAN = new RegExp(`${ENGELLI_GENEL.source}|${CVV_IPUCU.source}`, 'i');

// ASP.NET'te yaygın önekler (ddl/txt/cmb…) birleşik adlarda sözcük sınırı bırakmaz.
export const ROL_IPUCU: Record<KartRolu, RegExp> = {
  numara:
    /(?:kart|card).*(?:num|no)|(?:num|no).*(?:kart|card)|kredi\s*kart|(?:^|[^a-z]|txt|tb)(?:cc|kk)[\s_.-]*(?:no|num)|(?:^|[^a-z]|txt|tb)pan(?:[^a-z]|$)|cc-number/i,
  tarih: /tarih|son\s*kullan|s[.\s_-]*k[.\s_-]*t|gecerlilik|expir|valid|cc-exp/i,
  ay: /(?:^|[^a-z])ay(?:[^a-z]|$)|(?:ddl|txt|cmb|drp|sel|skt|exp|son)ay(?:[^a-z]|$)|month|cc-exp-month/i,
  yil: /yil|year|cc-exp-year/i,
  ad: /ad[\s_.-]*soyad|adi[\s_.-]*soyadi|isim|kart\s*(?:uzerindeki|sahibi)|holder|cc-name|card-?name|full\s*name|(?:txt|tb)(?:ad|name)(?:[^a-z]|$)/i,
  cvv: CVV_IPUCU,
};

/** Bu rol için alan hiçbir durumda (elle onayla bile) kullanılamaz mı? */
export function alanEngelli(ipucu: string, rol: KartRolu | 'firma'): boolean {
  return rol === 'cvv' ? ENGELLI_GENEL.test(ipucu) : ENGELLI_ALAN.test(ipucu);
}

export function ipucuUygun(ipucu: string, rol: KartRolu): boolean {
  return !alanEngelli(ipucu, rol) && ROL_IPUCU[rol].test(ipucu);
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

/** Başlık karşılaştırması için tek biçim: aksansız, küçük harf, rakamsız, tek boşluk. Rakam
 * atılır; böylece başlıkta cari/bakiye gibi değişen sayılar kurulumu bozmaz ve kayda girmez. */
export function baslikBicimi(metin: string): string {
  return (
    metin
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .toLowerCase()
      .replace(/[\d•*]+/g, ' ')
      .replace(/[^\p{L}\s./]+/gu, ' ')
      // Nokta/bölü yalnız harfler arasında anlamlıdır (“s.k.t”, “ay/yil”); sayılardan kalanlar atılır.
      .replace(/(?<!\p{L})[./]|[./](?!\p{L})/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Ödeme sayfasında firma yazısı: “Firma İsmi : AD (numara)”. Tek 10–11 haneli numara aranır. */
export const FIRMA_NUMARASI = /(?<!\d)\d{10,11}(?!\d)/g;
export const FIRMA_IPUCU = /firma|unvan|musteri\s*(?:adi|unvani)|cari\s*(?:adi|unvani)/;
