/**
 * Kullanıcıya olduğu gibi gösterilebilecek hata: ne olduğunu ve ne yapılacağını anlatır.
 * Bunun dışındaki hatalar beklenmeyen hatadır; arayüz onları genel bir mesajla gösterir.
 */
export class KullaniciHatasi extends Error {
  override name = 'KullaniciHatasi';
}
