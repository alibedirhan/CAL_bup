/** İş hesabı özgün Python DTO'larıyla taşınır; burada yalnız sözleşme bulunur. */
export interface KarlilikSatiri {
  stock_name: string;
  sales_quantity: number;
  average_sales_price: number;
  sales_amount: number;
  unit_cost: number;
  unit_profit: number;
  net_profit: number;
}
export interface KarlilikOzeti {
  rows: KarlilikSatiri[];
  matched_count: number;
  total_count: number;
  unmatched: string[];
  fill_rate: number;
  average_unit_cost: number;
  average_unit_profit: number;
  total_net_profit: number;
}
export interface SenaryoOranlari {
  cost_change_pct: number;
  price_change_pct: number;
  quantity_change_pct: number;
}
export const SIFIR_SENARYO: SenaryoOranlari = {
  cost_change_pct: 0,
  price_change_pct: 0,
  quantity_change_pct: 0,
};
export interface SenaryoSatiri {
  stock_name: string;
  cost_matched: boolean;
  current_quantity: number;
  scenario_quantity: number;
  current_price: number;
  scenario_price: number;
  current_cost: number;
  scenario_cost: number;
  current_net_profit: number;
  scenario_net_profit: number;
  net_profit_delta: number;
  current_margin_pct: number;
  scenario_margin_pct: number;
  break_even_price: number;
  contribution_pct: number | null;
  cumulative_contribution_pct: number | null;
  pareto_class: string;
}
export interface KarlilikSenaryosu {
  assumptions: SenaryoOranlari;
  rows: SenaryoSatiri[];
  baseline_net_profit: number;
  scenario_net_profit: number;
  net_profit_delta: number;
  baseline_matched_margin_pct: number;
  scenario_matched_margin_pct: number;
  matched_count: number;
  unmatched_count: number;
  positive_matched_profit: number;
}
export interface UrunKari {
  stock_name: string;
  net_profit: number;
}
export type KarKategorisi = 'all' | 'cok_karli' | 'orta_karli' | 'dusuk_karli' | 'zararda';
export const KAR_KATEGORILERI: Record<KarKategorisi, string> = {
  all: 'Tümü',
  cok_karli: 'Çok kârlı',
  orta_karli: 'Orta kârlı',
  dusuk_karli: 'Düşük kârlı',
  zararda: 'Zararda',
};
export interface GenelBakis {
  istatistik: {
    product_count: number;
    profitable_count: number;
    loss_count: number;
    total_net_profit: number;
    average_net_profit: number;
    max_net_profit: number;
    min_net_profit: number;
  };
  dagilim: Record<Exclude<KarKategorisi, 'all'>, number>;
  ilkUrunler: UrunKari[];
  kategoriler: Record<KarKategorisi, UrunKari[]>;
}
export interface StokEslesmesi {
  alias: string;
  target: string;
  status: 'pending' | 'approved';
  source: 'manual';
  created_at: string;
  updated_at: string;
  revision: number;
}
export interface EslesmeOzeti {
  revision: number;
  aliases: StokEslesmesi[];
  history: {
    revision: number;
    action: 'proposed' | 'approved' | 'removed';
    alias: string;
    target: string;
    source: 'manual';
    occurred_at: string;
  }[];
  unmatched: string[];
  price_targets: string[];
  applied_aliases: [string, string][];
  can_restore: boolean;
}
export interface KarlilikSonucu {
  ozet: KarlilikOzeti;
  genelBakis: GenelBakis;
  senaryo: KarlilikSenaryosu;
  eslesme: EslesmeOzeti;
}
export interface DonemKaydi {
  id: string;
  name: string;
  saved_at: string;
  total_count: number;
  matched_count: number;
  fill_rate: number;
  total_net_profit: number;
  average_unit_profit: number;
  product_profits: [string, number][];
}
export interface DonemKarsilastirmasi {
  first: DonemKaydi;
  second: DonemKaydi;
  metrics: {
    key: string;
    label: string;
    first: number;
    second: number;
    is_money: boolean;
    delta: number;
    pct_change: number | null;
  }[];
  top_gainers: { stock_name: string; first: number; second: number; delta: number }[];
  top_losers: { stock_name: string; first: number; second: number; delta: number }[];
}
export interface KarlilikKaydi {
  surum: 1;
  nesil: number;
  eslesmeler: { guncel: string | null; yedek: string | null };
  donemler: { guncel: string | null; yedek: string | null };
}
export function bosKarlilikKaydi(): KarlilikKaydi {
  return {
    surum: 1,
    nesil: 0,
    eslesmeler: { guncel: null, yedek: null },
    donemler: { guncel: null, yedek: null },
  };
}
export type KarlilikEylemi =
  | 'kayit'
  | 'analiz'
  | 'senaryo'
  | 'excel'
  | 'gorunen'
  | 'senaryo-excel'
  | 'oner'
  | 'onayla'
  | 'kaldir'
  | 'eslesme-geri'
  | 'donem-kaydet'
  | 'donem-sil'
  | 'donem-geri'
  | 'karsilastir';
export interface KarlilikDosyasi {
  ad: string;
  bayt: Uint8Array;
}
export interface KarlilikIstegi {
  tur: 'karlilik';
  eylem: KarlilikEylemi;
  kayit: KarlilikKaydi;
  tarih: string;
  satis?: KarlilikDosyasi;
  fiyat?: KarlilikDosyasi;
  oranlar?: SenaryoOranlari;
  beklenenEslesmeler?: string | null;
  satirlar?: number[];
  alias?: string;
  target?: string;
  ad?: string;
  id?: string;
  ilk?: string;
  ikinci?: string;
}
export interface KarlilikCevabi {
  tur: 'kayit' | 'analiz' | 'karsilastirma' | 'dosya';
  kayit?: KarlilikKaydi;
  sonuc?: KarlilikSonucu;
  donemler?: DonemKaydi[];
  karsilastirma?: DonemKarsilastirmasi;
  ad?: string;
  bayt?: Uint8Array;
}
