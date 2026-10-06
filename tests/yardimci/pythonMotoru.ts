import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import paketler from '../../vendor/python/paketler.json';

const motorlar = new Map<string, Promise<PyodideInterface>>();
export function nodePythonMotoru(
  tur: 'musteri' | 'iskonto' | 'karlilik' | 'yaslandirma' = 'musteri',
): Promise<PyodideInterface> {
  const onceki = motorlar.get(tur);
  if (onceki) return onceki;
  const motor = (async () => {
    const p = await loadPyodide({
      indexURL: resolve('node_modules/pyodide'),
      packageCacheDir: resolve('node_modules/.cache/cal-python'),
      stdout: () => {},
      stderr: () => {},
    });
    if (tur === 'iskonto')
      await p.loadPackage(paketler.hazir, { messageCallback: () => {}, errorCallback: () => {} });
    for (const paket of paketler.paketler.filter((p) =>
      tur === 'iskonto'
        ? !p.url.includes('cdn.jsdelivr')
        : ['openpyxl', 'et-xmlfile', 'defusedxml'].includes(p.ad),
    ))
      p.unpackArchive(
        new Uint8Array(readFileSync(join('node_modules/.cache/cal-python', paket.dosya))),
        'zip',
        { extractDir: '/cal/site' },
      );
    function ekle(klasor: string) {
      for (const girdi of readdirSync(klasor, { withFileTypes: true })) {
        const yol = join(klasor, girdi.name);
        if (girdi.isDirectory()) ekle(yol);
        else if (girdi.name.endsWith('.py')) {
          const hedef = '/cal/site/' + relative('vendor/python/bup', yol);
          p.FS.mkdirTree(dirname(hedef));
          p.FS.writeFile(hedef, new Uint8Array(readFileSync(yol)));
        }
      }
    }
    ekle('vendor/python/bup');
    p.FS.writeFile('/cal/kopru.py', new Uint8Array(readFileSync('vendor/python/kopru.py')));
    p.FS.writeFile('/cal/karlilik_kopru.py', new Uint8Array(readFileSync('vendor/python/karlilik_kopru.py')));
    p.FS.writeFile(
      '/cal/yaslandirma_kopru.py',
      new Uint8Array(readFileSync('vendor/python/yaslandirma_kopru.py')),
    );
    p.FS.mkdirTree('/usr/share/fonts/truetype/dejavu');
    for (const [ad, hedef] of [
      ['font.ttf', 'DejaVuSans.ttf'],
      ['font-kalin.ttf', 'DejaVuSans-Bold.ttf'],
    ])
      p.FS.writeFile(
        '/usr/share/fonts/truetype/dejavu/' + hedef,
        new Uint8Array(readFileSync('vendor/python/' + ad)),
      );
    p.runPython(
      `import sys, types; sys.path.insert(0,'/cal/site'); ${tur === 'musteri' ? "sys.modules['pandas'] = types.SimpleNamespace(DataFrame=object);" : ''} from pathlib import Path; exec(Path('/cal/kopru.py').read_text())`,
    );
    return p;
  })();
  motorlar.set(tur, motor);
  return motor;
}
