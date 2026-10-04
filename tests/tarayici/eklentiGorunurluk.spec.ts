import { test, expect } from '@playwright/test';
import { eklentiOrtami, alanlariTanit, yapayKartliCari, kartliPosAc, POS } from './eklentiYardimci';

for (const durum of ['opak', 'inert', 'aria', 'fieldset', 'firma'] as const)
  test(`MV3 gizli veya etkisiz üst kapsayıcıdan kart aktarmaz: ${durum}`, async () => {
    const e = await eklentiOrtami();
    try {
      const kur = await e.c.newPage();
      await alanlariTanit(kur);
      await kur.close();
      await yapayKartliCari(e.p);
      const ozellik =
        durum === 'opak'
          ? 'style="opacity:0"'
          : durum === 'inert'
            ? 'inert'
            : durum === 'aria'
              ? 'aria-hidden="true"'
              : '';
      const alan =
        '<label>Kart numarası<input id="kart" maxlength="23"></label><label>Son kullanma<input id="tarih" maxlength="5"></label>';
      const firma = '<span id="firma">0123456789</span>';
      const body =
        durum === 'firma'
          ? `<div style="opacity:0">${firma}</div>${alan}`
          : `${firma}<${durum === 'fieldset' ? 'fieldset disabled' : 'div ' + ozellik}>${alan}</${durum === 'fieldset' ? 'fieldset' : 'div'}>`;
      await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
        r.fulfill({ contentType: 'text/html; charset=utf-8', body }),
      );
      const pos = await kartliPosAc(e.p, e.c);
      await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText(
        durum === 'firma' ? 'cari alanı okunamadı' : 'doldurulamadı',
      );
      await expect(pos.locator('#kart')).toHaveValue('');
      await expect(pos.locator('#tarih')).toHaveValue('');
      expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
    } finally {
      await e.kapat();
    }
  });
