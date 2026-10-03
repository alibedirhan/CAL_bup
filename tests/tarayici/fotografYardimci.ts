import type { Page } from '@playwright/test';
export interface FotoVaka {
  ad: string;
  donus?: number;
  egim?: number;
  mime?: string;
  bol?: boolean;
  ikiTarih?: boolean;
  uzak?: boolean;
  font?: number;
  fg?: string;
  bg?: string;
  blur?: number;
  dekor?: boolean;
  ayniSatir?: boolean;
  numara?: string;
  tarihsiz?: boolean;
  bitisikTarih?: boolean;
}
export async function fotoUret(page: Page, v: FotoVaka): Promise<Buffer> {
  return Buffer.from(
    await page.evaluate(async (v) => {
      const c = document.createElement('canvas');
      c.width = 1800;
      c.height = 1200;
      const x = c.getContext('2d');
      if (!x) throw new Error('Canvas yok');
      x.fillStyle = v.bg ?? '#fff';
      x.fillRect(0, 0, c.width, c.height);
      x.save();
      x.translate(c.width / 2, c.height / 2);
      x.rotate(((v.egim ?? 0) * Math.PI) / 180);
      if (v.uzak) x.scale(0.28, 0.28);
      x.fillStyle = v.fg ?? '#000';
      x.font = `${v.font ?? 64}px monospace`;
      x.filter = v.blur ? `blur(${v.blur}px)` : 'none';
      if (v.bol) {
        x.fillText('4242 4242', -650, -160);
        x.fillText('4242 4242', -650, -70);
      } else x.fillText((v.numara ?? '4242 4242 4242 4242') + (v.ayniSatir ? ' 12/35' : ''), -650, -120);
      if (!v.tarihsiz && !v.ayniSatir)
        x.fillText(v.ikiTarih ? '09/24     12/35' : v.bitisikTarih ? 'VALID THRU 1235' : '12/35', -650, 120);
      if (v.dekor) {
        x.font = '44px sans-serif';
        x.fillText('2026 123 05000000000', -650, 350);
        x.fillText('12345678', -650, -350);
      }
      x.restore();
      // Döndürürken tuval boyutu da değiştirilir; rakamlar testte kadrajdan kesilmez.
      const hedef = document.createElement('canvas');
      const a = ((v.donus ?? 0) * Math.PI) / 180;
      hedef.width = v.donus && v.donus % 180 ? c.height : c.width;
      hedef.height = v.donus && v.donus % 180 ? c.width : c.height;
      const h = hedef.getContext('2d');
      if (!h) throw new Error('Canvas yok');
      h.translate(hedef.width / 2, hedef.height / 2);
      h.rotate(a);
      h.drawImage(c, -c.width / 2, -c.height / 2);
      return hedef.toDataURL(v.mime ?? 'image/png', 0.9).split(',')[1] ?? '';
    }, v),
    'base64',
  );
}
