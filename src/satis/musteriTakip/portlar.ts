import type { MusteriCiktisi, MusteriListesi } from '../../cekirdek/musteriTakip/turler';

export interface MusteriDosyasi {
  readonly ad: string;
  readonly bayt: Uint8Array;
}

export interface MusteriMotoru {
  listeOku(dosya: MusteriDosyasi, signal: AbortSignal): Promise<MusteriListesi>;
  excelOlustur(cikti: MusteriCiktisi, signal: AbortSignal): Promise<Uint8Array>;
}

export interface MusteriBelgesi {
  readonly ad: string;
  readonly liste: MusteriListesi;
}
