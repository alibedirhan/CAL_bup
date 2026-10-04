import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
export const APP = 'https://alibedirhan.github.io/CAL_bup/';
export const POS = 'https://denizpay.bupilic.com.tr';
export async function eklentiOrtami(v: { yanlis?: boolean; dolu?: boolean; ayri?: boolean } = {}) {
  const klasor = await mkdtemp(join(tmpdir(), 'cal-bup-eklenti-'));
  const yol = resolve('dist/pos-yardimcisi');
  const c = await chromium.launchPersistentContext(klasor, {
    channel: 'chromium',
    headless: true,
    // İkinci sınır: bir taklit yönlendirme route dışına çıksa bile canlı ağa ulaşamaz.
    args: [
      '--disable-extensions-except=' + yol,
      '--load-extension=' + yol,
      '--proxy-server=http://127.0.0.1:9',
      '--proxy-bypass-list=<-loopback>',
      '--disable-background-networking',
    ],
    viewport: { width: 1440, height: 1000 },
  });
  const sayac = { sms: 0, odeme: 0, giris: 0, dis: 0 };
  await c.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin === 'https://alibedirhan.github.io' && u.pathname.startsWith('/CAL_bup/')) {
      const rel = u.pathname.slice('/CAL_bup/'.length) || 'index.html';
      if (rel.includes('..')) return r.abort();
      const tur: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.woff2': 'font/woff2',
        '.wasm': 'application/wasm',
        '.gz': 'application/octet-stream',
        '.html': 'text/html',
      };
      return r.fulfill({
        body: await readFile(resolve('dist', rel)),
        contentType: tur[extname(rel)] ?? 'application/octet-stream',
      });
    }
    if (u.origin === POS) {
      if (u.pathname === '/login.aspx') {
        if (r.request().method() === 'POST') {
          const f = new URLSearchParams(r.request().postData() ?? '');
          expect(f.get('lvergino')).toBe('0123456789');
          expect(f.get('lkullaniciadi')).toBe('0123456789');
          expect(f.has('numara')).toBe(false);
          sayac.giris++;
          return r.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: '<script>location.replace("/yapay-odeme.aspx")</script>',
          });
        }
        return r.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: '<form id="form1" action="./login.aspx" method="post"><input id="lvergino" name="lvergino"><input id="lkullaniciadi" name="lkullaniciadi"><input id="lsifre" name="lsifre" type="password"><button name="btngiris">Giriş Yap</button></form>',
        });
      }
      if (u.pathname === '/yapay-odeme.aspx')
        return r.fulfill({ contentType: 'text/html; charset=utf-8', body: odemeHtml(v) });
      if (u.pathname === '/favicon.ico') return r.fulfill({ status: 204 });
      if (u.pathname === '/sms') sayac.sms++;
      else if (u.pathname === '/odeme') sayac.odeme++;
      else sayac.dis++;
      return r.fulfill({ status: 400, body: 'TEST: ödeme/SMS isteği yasak' });
    }
    if (u.pathname === '/favicon.ico') return r.fulfill({ status: 204 });
    sayac.dis++;
    await r.abort();
  });
  const p = await c.newPage();
  return {
    c,
    p,
    sayac,
    kapat: async () => {
      await c.close();
      await rm(klasor, { recursive: true, force: true });
    },
  };
}
function odemeHtml(v: { yanlis?: boolean; dolu?: boolean; ayri?: boolean }) {
  return `<!doctype html><html><body><h1>Yapay POS ödeme ekranı</h1><p>Yapay Firma</p><span id="firma">${v.yanlis ? '9876543210' : '0123456789'}</span>
    <form><label>Kredi Kartı Numarası <input id="kart" maxlength="23" value="${v.dolu ? '5555555555554444' : ''}"></label>
    ${v.ayri ? '<label>Son kullanma ayı <select id="ay"><option value=""></option>' + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('') + '</select></label><label>Son kullanma yılı <select id="yil"><option value=""></option><option value="35">2035</option></select></label>' : '<label>S.K.T <input id="tarih" maxlength="5"></label>'}
    <label>CVV <input id="cvv" maxlength="3" value=""></label><label>Tutar <input id="tutar" value="777"></label>
    <button type="button" onclick="fetch('/sms',{method:'POST'})">Şifre gönder</button><button type="submit">Ödeme al</button></form>
    <script>window.yapayOlay=0;document.querySelectorAll('input,select').forEach(e=>{for(const t of ['input','change'])e.addEventListener(t,()=>{window.yapayOlay++;fetch('/sms',{method:'POST'})})});document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();fetch('/odeme',{method:'POST'})});</script></body></html>`;
}
export async function alanlariTanit(p: Page, ayri = false) {
  await p.goto(POS + '/yapay-odeme.aspx');
  await p
    .getByRole('button', {
      name: ayri ? 'Numara, ayrı ay ve yılı tanıt' : 'Numara ve tek tarih alanını tanıt',
      exact: true,
    })
    .click();
  await p.locator('#firma').click();
  await p.locator('#kart').click();
  if (ayri) {
    await p.locator('#ay').click();
    await p.locator('#yil').click();
  } else await p.locator('#tarih').click();
  await expect(p.locator('#cal-bup-pos-yardimcisi')).toContainText('Alanlar tanıtıldı');
}
export async function yapayKartliCari(p: Page) {
  await p.goto(APP + '#/sanal-pos');
  await p.getByRole('button', { name: 'Yeni cari', exact: true }).click();
  await p.getByLabel('Cari adı', { exact: true }).fill('Yapay Eklenti Carisi');
  await p.getByLabel('Vergi/TC numarası', { exact: true }).fill('0123456789');
  await p.getByLabel('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.').check();
  await p.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
  await p.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await p.getByLabel('Karta vereceğiniz isim').fill('Yapay Eklenti Kartı');
  await p.getByLabel('Kart numarası', { exact: true }).fill('4242424242424242');
  await p.getByLabel('Son kullanma ayı', { exact: true }).selectOption('12');
  await p.getByLabel('Son kullanma yılı', { exact: true }).selectOption('2035');
  await p.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await p.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await p.locator('.pos-odeme-karti').click();
}
export async function kartliPosAc(p: Page, c: BrowserContext) {
  const yeni = c.waitForEvent('page');
  await p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
  const pos = await yeni;
  await pos.waitForURL(POS + '/yapay-odeme.aspx');
  return pos;
}
