import { afterEach, describe, expect, it, vi } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import {
  driveAyir,
  driveBaglan,
  driveBagli,
  driveToken,
  istemciGecerli,
  DRIVE_KAPSAMI,
} from '../../src/platform/driveKimlik';
import { driveIndir, driveListele, driveYukle, type DriveDosyasi } from '../../src/platform/drive';
import { gecmisBirlestir, oturumCoz, type DriveOturumu } from '../../src/platform/driveEsitleme';
import type { GecmisKaydi } from '../../src/platform/gecmis';

const KAYIT: GecmisKaydi = {
  zaman: '2026-10-02T07:00:00Z',
  rapor: 'Sentetik rapor',
  dosya: 'Sentetik.xlsx',
  sayfa: '02.10',
  durum: 'Tamam',
  ledStogu: 10,
  depoSayimi: 9,
  gelenMal: 2,
  uyariSayisi: 0,
  aciklama: '',
  kayit: 'indirildi',
};
const OTURUM: DriveOturumu = { surum: 1, zaman: KAYIT.zaman, ayarlar: AYAR, gecmis: [KAYIT] };
const KLASOR: DriveDosyasi = {
  id: 'klasor1',
  name: 'CAL bup',
  createdTime: KAYIT.zaman,
  mimeType: 'application/vnd.google-apps.folder',
  appProperties: { calbup: 'v1', tur: 'klasor' },
};
const DOSYA: DriveDosyasi = {
  id: 'dosya1',
  name: 'Sentetik.xlsx',
  createdTime: KAYIT.zaman,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  appProperties: { calbup: 'v1', tur: 'rapor' },
};
function googleKur(yanit: object) {
  const istek = vi.fn();
  vi.stubGlobal('localStorage', { getItem: () => 'deneme.apps.googleusercontent.com' });
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (a: { callback: (r: object) => void }) => ({
          requestAccessToken: (p: unknown) => {
            istek(p);
            a.callback(yanit);
          },
        }),
        revoke: vi.fn(),
      },
    },
  });
  return istek;
}
async function baglan() {
  googleKur({ access_token: 'sentetik-token', expires_in: 3600, scope: DRIVE_KAPSAMI });
  await driveBaglan();
}
const json = (veri: unknown, status = 200) =>
  new Response(JSON.stringify(veri), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => {
  driveAyir();
  vi.unstubAllGlobals();
});

describe('Drive kimlik ve izin sınırı', () => {
  it('yalnızca geçerli istemci kimliği kabul edilir', () => {
    expect(istemciGecerli('deneme.apps.googleusercontent.com')).toBe(true);
    expect(istemciGecerli('https://example.com')).toBe(false);
    expect(istemciGecerli('x.apps.googleusercontent.com/')).toBe(false);
  });
  it('bağlanma hesap seçimini açar, token yalnızca oturumda durur', async () => {
    const istek = googleKur({ access_token: 'sentetik-token', expires_in: 3600, scope: DRIVE_KAPSAMI });
    await driveBaglan();
    expect(istek).toHaveBeenCalledWith({ prompt: 'select_account' });
    expect(driveBagli()).toBe(true);
    expect(driveToken()).toBe('sentetik-token');
    driveAyir();
    expect(driveBagli()).toBe(false);
    expect(() => driveToken()).toThrow(/sona erdi/);
  });
  it('Drive kapsamı verilmediyse token kabul edilmez', async () => {
    googleKur({ access_token: 'sentetik-token', expires_in: 3600, scope: 'openid' });
    await expect(driveBaglan()).rejects.toThrow(/izni verilmedi/);
    expect(driveBagli()).toBe(false);
  });
  it('geç veya iptal edilmiş OAuth yanıtı yeniden bağlantı açmaz', async () => {
    let yanitla: (v: unknown) => void = () => {};
    vi.stubGlobal('localStorage', { getItem: () => 'deneme.apps.googleusercontent.com' });
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: (a: { callback: (v: unknown) => void }) => {
            yanitla = a.callback;
            return { requestAccessToken: () => {} };
          },
        },
      },
    });
    const istek = driveBaglan();
    driveAyir();
    yanitla({ access_token: 'gec-token', expires_in: 3600, scope: DRIVE_KAPSAMI });
    await expect(istek).rejects.toThrow(/iptal/);
    expect(driveBagli()).toBe(false);
  });
});

describe('Drive REST ve dosyalar', () => {
  it('CAL bup klasöründeki uygulama dosyalarını sayfalar boyunca listeler', async () => {
    await baglan();
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [KLASOR] }))
      .mockResolvedValueOnce(json({ files: [DOSYA], nextPageToken: 'ikinci' }))
      .mockResolvedValueOnce(json({ files: [{ ...DOSYA, id: 'dosya2' }] }));
    vi.stubGlobal('fetch', f);
    expect(await driveListele('rapor')).toHaveLength(2);
    expect(String(f.mock.calls[1]?.[0])).toContain('calbup');
    expect(String(f.mock.calls[2]?.[0])).toContain('pageToken=ikinci');
    expect(f.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer sentetik-token' },
      redirect: 'error',
    });
  });
  it.each(['ikinci-hesap', 'sentetik-token'])(
    'bağlantı yenilenince eski işlemler sürmez: %s',
    async (yeniToken) => {
      await baglan();
      let yanitla: (r: Response) => void = () => {};
      const f = vi.fn(
        () =>
          new Promise<Response>((coz) => {
            yanitla = coz;
          }),
      );
      vi.stubGlobal('fetch', f);
      const ilk = driveListele('rapor');
      const ikinci = driveYukle('Sentetik.xlsx', new Uint8Array([1]), 'rapor');
      const bitis = Promise.allSettled([ilk, ikinci]);
      await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      driveAyir();
      googleKur({ access_token: yeniToken, expires_in: 3600, scope: DRIVE_KAPSAMI });
      await driveBaglan();
      yanitla(json({ files: [KLASOR] }));
      expect((await bitis).every((r) => r.status === 'rejected')).toBe(true);
      expect(f).toHaveBeenCalledTimes(1);
    },
  );

  it('aynı içerik yeniden gönderilirse dosyayı çoğaltmaz', async () => {
    await baglan();
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [KLASOR] }))
      .mockResolvedValueOnce(json({ files: [DOSYA] }));
    vi.stubGlobal('fetch', f);
    expect(await driveYukle('Sentetik.xlsx', new Uint8Array([1, 2, 3]), 'rapor')).toEqual(DOSYA);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('yüklemeyi Google adresiyle tamamlar ve yeni kopya oluşturur', async () => {
    await baglan();
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [KLASOR] }))
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(
        new Response('', {
          headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=sentetik' },
        }),
      )
      .mockResolvedValueOnce(json(DOSYA));
    vi.stubGlobal('fetch', f);
    expect(await driveYukle('Sentetik.xlsx', new Uint8Array([1, 2, 3]), 'rapor')).toEqual(DOSYA);
    expect(f.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
    expect(f.mock.calls[3]?.[1]).toMatchObject({ method: 'PUT' });
    expect(f.mock.calls.some((c) => (c[1] as RequestInit)?.method === 'PATCH')).toBe(false);
  });
  it('yükleme adresi Google dışındaysa tokenı göndermez', async () => {
    await baglan();
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ files: [KLASOR] }))
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(new Response('', { headers: { Location: 'https://example.com/upload' } }));
    vi.stubGlobal('fetch', f);
    await expect(driveYukle('Sentetik.xlsx', new Uint8Array([1]), 'rapor')).rejects.toThrow(
      /adresi geçersiz/,
    );
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('401 oturumu kapatır ve anlaşılır hata gösterir', async () => {
    await baglan();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401)));
    await expect(driveListele('rapor')).rejects.toThrow(/sona erdi/);
    expect(driveBagli()).toBe(false);
  });
  it('akışlı indirmede boyut sınırı uygulanır', async () => {
    await baglan();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(10))));
    await expect(driveIndir(DOSYA, 5)).rejects.toThrow(/çok büyük/);
  });
  it('Drive dışında değiştirilmiş dosyayı eski rapor sanarak açmaz', async () => {
    await baglan();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]))));
    await expect(
      driveIndir({ ...DOSYA, appProperties: { ...DOSYA.appProperties, ozet: '0'.repeat(64) } }),
    ).rejects.toThrow(/değiştirilmiş/);
  });
  it('hatalı dosya kimliğiyle ağ isteği yapılmaz', async () => {
    await baglan();
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(driveIndir({ ...DOSYA, id: '../../example' })).rejects.toThrow(/kimliği geçersiz/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('Drive ayar ve geçmiş doğrulaması', () => {
  it('geçerli kayıt okunur, yerel yedek kimliği diğer cihaza taşınmaz', () => {
    const o = oturumCoz(JSON.stringify({ ...OTURUM, gecmis: [{ ...KAYIT, yedekId: 'yerel' }] }));
    expect(o.ayarlar).toEqual(AYAR);
    expect(o.gecmis[0]).not.toHaveProperty('yedekId');
  });
  it.each([
    '{}',
    'null',
    'bozuk',
    JSON.stringify({ ...OTURUM, surum: 2 }),
    JSON.stringify({ ...OTURUM, ayarlar: { ...AYAR, tolerans: -1 } }),
    JSON.stringify({ ...OTURUM, gecmis: [{ ...KAYIT, ledStogu: '10' }] }),
  ])('bozuk kaydı reddeder: %s', (s) => {
    expect(() => oturumCoz(s)).toThrow(/bozuk/);
  });
  it('geçmişleri birleştirir, yerel yedek bağlantısını korur ve aynı kaydı çoğaltmaz', () => {
    const ikinci = { ...KAYIT, zaman: '2026-10-02T08:00:00Z' };
    const sonuc = gecmisBirlestir([{ ...KAYIT, yedekId: 'yerel' }], [KAYIT, ikinci]);
    expect(sonuc).toHaveLength(2);
    expect(sonuc[0]?.zaman).toBe(ikinci.zaman);
    expect(sonuc[1]?.yedekId).toBe('yerel');
  });
});

it('ayrılan OAuth isteği yeni bağlantıyı bir dakika engellemez', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'deneme.apps.googleusercontent.com' });
  vi.stubGlobal('google', {
    accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } },
  });
  const ilk = driveBaglan().catch((e: unknown) => e);
  driveAyir();
  googleKur({ access_token: 'yeni', expires_in: 3600, scope: DRIVE_KAPSAMI });
  try {
    await expect(driveBaglan()).resolves.toBeUndefined();
  } finally {
    driveAyir();
    await ilk;
  }
});
it('Drive aynı sayfa anahtarını tekrarlarsa listeleme durur', async () => {
  await baglan();
  let n = 0;
  const f = vi.fn(async () => {
    n++;
    if (n === 1) return json({ files: [KLASOR] });
    if (n > 4) throw new Error('Yapay sonsuz döngü kesildi');
    return json({ files: [], nextPageToken: 'tekrar' });
  });
  vi.stubGlobal('fetch', f);
  await expect(driveListele('rapor')).rejects.toThrow(/sayfa|listesi/);
  expect(f.mock.calls.length).toBeLessThanOrEqual(3);
});

it.each([{ size: '-1' }, { size: 'bozuk' }, { appProperties: { ...DOSYA.appProperties, ozet: 'kısa' } }])(
  'bozuk Drive metaverisinde dosya okunmaz: %j',
  async (degisiklik) => {
    await baglan();
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(driveIndir({ ...DOSYA, ...degisiklik })).rejects.toThrow(/dosya bilgisi/);
    expect(f).not.toHaveBeenCalled();
  },
);
