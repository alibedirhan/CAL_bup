import { test, expect, type Page } from '@playwright/test';
import { eklentiOrtami, yapayKartliCari, kartliPosAc, POS } from './eklentiYardimci';

// Gerçek ödeme ekranına benzeyen YAPAY düzen: başlıklar kutuya bağlı <label> değil, ayrı yazı öğeleri.
// Kutu adları anlamsızdır (TextBoxN); tanıma yalnız yakındaki yazıyla veya açık onayla olabilir.
// ASP.NET gibi `name` içinde `$` taşır; bu işaret tutar/para birimi sayılmamalıdır.
function odeme(yakinYazi: boolean, yerTutucu = '') {
  return odemeGovdesi(yakinYazi, yerTutucu).replace(
    /<input id="(TextBox\d)"/g,
    '<input id="$1" name="ctl00$$Icerik$$$1"',
  );
}
function odemeGovdesi(yakinYazi: boolean, yerTutucu: string) {
  const baslik = (t: string) => (yakinYazi ? `<div class="baslik"><span>${t}</span></div>` : '');
  return `<!doctype html><body>
    <div class="ust">Firma İsmi : <span id="firma">YAPAY FİRMA (0123456789)</span></div>
    <div class="form">
      <div class="satir">${baslik('Ad Soyad')}<div><input id="TextBox1"></div></div>
      <div class="satir">${baslik('Kredi Kartı Numarası')}<div><input id="TextBox2"></div></div>
      ${yakinYazi ? '' : '<div class="etiketler"><span>S.K.T</span><span>CVV</span></div>'}
      <div class="ikili">
        <div class="sutun">${baslik('S.K.T')}<div><input id="TextBox3" placeholder="${yerTutucu}"></div></div>
        <div class="sutun">${baslik('CVV')}<div><input id="TextBox4"></div></div>
      </div>
      <div class="satir">${baslik('Tutar')}<div><input id="TextBox5"><span>TL</span></div></div>
      <button type="button">Ödeme İşlemine Devam Et</button>
    </div></body>`;
}
const panel = (p: Page) => p.locator('#cal-bup-pos-yardimcisi');
const durum = (p: Page) => panel(p).getByRole('status');

test('yakındaki “S.K.T” yazısı tanınır; CVV ve Tutar hiçbir adımda kabul edilmez; doldurma boşluklu tarih biçimine uyar', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({ contentType: 'text/html; charset=utf-8', body: odeme(true, 'MM / YY') }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Numara ve tek tarih alanını tanıt', exact: true }).click();
    await e.p.locator('#firma').click();
    await e.p.locator('#TextBox5').click();
    await expect(durum(e.p)).toContainText('CVV, tutar');
    await expect(panel(e.p).getByRole('button', { name: /^Evet/ })).toBeHidden();
    await e.p.locator('#TextBox2').click();
    await e.p.locator('#TextBox4').click();
    await expect(durum(e.p)).toContainText('CVV, tutar');
    await expect(panel(e.p).getByRole('button', { name: /^Evet/ })).toBeHidden();
    await e.p.locator('#TextBox3').click();
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(pos.locator('#TextBox2')).toHaveValue('4242424242424242');
    await expect(pos.locator('#TextBox3')).toHaveValue('12 / 35');
    for (const bos of ['#TextBox1', '#TextBox4', '#TextBox5']) await expect(pos.locator(bos)).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('yazısı tanınmayan kutu nedeni gösterilerek yalnız açık onayla tanıtılır ve doldurulur', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({ contentType: 'text/html; charset=utf-8', body: odeme(false) }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Numara ve tek tarih alanını tanıt', exact: true }).click();
    await e.p.locator('#firma').click();
    await e.p.locator('#TextBox2').click();
    await expect(durum(e.p)).toContainText('kart numarası olarak tanınmadı');
    await panel(e.p).getByRole('button', { name: 'Evet, bu kutu kart numarası kutusu', exact: true }).click();
    await e.p.locator('#TextBox3').click();
    await expect(durum(e.p)).toContainText('son kullanma (S.K.T) olarak tanınmadı');
    // “Hayır” onayı kaldırır; başka kutu seçilene kadar bir şey kaydedilmez.
    await panel(e.p).getByRole('button', { name: 'Hayır, başka kutu seçeceğim', exact: true }).click();
    await expect(panel(e.p).getByRole('button', { name: /^Evet/ })).toBeHidden();
    await e.p.locator('#TextBox3').click();
    await panel(e.p)
      .getByRole('button', { name: 'Evet, bu kutu son kullanma (S.K.T) kutusu', exact: true })
      .click();
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(pos.locator('#TextBox2')).toHaveValue('4242424242424242');
    await expect(pos.locator('#TextBox3')).toHaveValue('12/35');
    for (const bos of ['#TextBox1', '#TextBox4', '#TextBox5']) await expect(pos.locator(bos)).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('elle onaylanan kutu sonradan CVV/tutar yazısı alırsa yine yazılmaz', async () => {
  const e = await eklentiOrtami();
  try {
    let sonra = false;
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: sonra
          ? odeme(false).replace('<input id="TextBox3"', '<input id="TextBox3" aria-label="CVV"')
          : odeme(false),
      }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Numara ve tek tarih alanını tanıt', exact: true }).click();
    await e.p.locator('#firma').click();
    await e.p.locator('#TextBox2').click();
    await panel(e.p).getByRole('button', { name: /^Evet/ }).click();
    await e.p.locator('#TextBox3').click();
    await panel(e.p).getByRole('button', { name: /^Evet/ }).click();
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    sonra = true;
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).not.toBeEmpty();
    await expect(pos.locator('#TextBox2')).toHaveValue('');
    await expect(pos.locator('#TextBox3')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
