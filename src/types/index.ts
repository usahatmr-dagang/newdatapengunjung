export interface Ticket3A {
  item: string;
  kategori: string;
  qty: number;
  total: number;
  lokasi?: string;
}

export interface IWMRecord {
  lokasi: string;
  karcis_anak?: number;
  karcis_dewasa?: number;
  parkir_gol_1?: number;
  parkir_gol_2?: number;
  parkir_gol_3?: number;
  parkir_motor?: number;
  parkir_sepeda?: number;
  total?: number;

  // Optional backward compatibility fields
  karcis_masuk?: number;
  harga_satuan?: number;
  potongan?: number;
  netto?: number;
  admin?: number;
  lain_lain?: number;
}

export interface RekapData {
  total_pengunjung: number;
  motor: number;
  mobil: number;
  bus: number;
  sepeda: number;
  pps: number;
  tsa: number;
  update_str: string;
  tanggal_str: string;
  jam_str: string;
  anak: number;
  dewasa: number;
  bus_gol_1?: number;
  bus_gol_2?: number;
  boogy_car?: number;
}

export interface STSUItem {
  qty: number;
  nominal: number;
}

export interface LateSyncIWMBucket {
  total_pengunjung: number;
  dewasa: number;
  anak: number;
  pps: number;
  tsa: number;
  motor: number;
  mobil: number;
  bus: number;
  bus_gol_1: number;
  bus_gol_2: number;
  sepeda: number;
}

export interface LateSyncIWMInfo extends LateSyncIWMBucket {
  delta_pengunjung?: number;
  delta_dewasa?: number;
  delta_anak?: number;
  delta_pps?: number;
  delta_tsa?: number;
  delta_motor?: number;
  delta_mobil?: number;
  delta_bus?: number;
  delta_sepeda?: number;
  cutoff_time?: string;
  by_hour?: Record<string, LateSyncIWMBucket>;
  by_lokasi?: Record<string, LateSyncIWMBucket>;
  by_slot_masuk?: Record<string, LateSyncIWMBucket>;
}

export interface ShiftData {
  last_run: string;
  rekap: RekapData;
  rekap_3a?: RekapData;
  rekap_iwm?: RekapData;
  rekap_pendapatan?: RekapData;
  late_sync_iwm?: LateSyncIWMInfo;
  late_sync_3a?: LateSyncIWMInfo;
  iwm_malam_real?: IWMRecord[];
  tickets_3a_by_channel_malam_real?: Record<string, Ticket3A[]>;
  stsu?: Record<string, Record<string, STSUItem>>;
  tickets_3a: Ticket3A[];
  tickets_3a_visit?: Ticket3A[];
  tickets_3a_by_channel?: Record<string, Ticket3A[]>;
  tickets_3a_by_channel_visit?: Record<string, Ticket3A[]>;
  iwm: IWMRecord[];
  history?: any[];
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  siang?: ShiftData;
  malam?: ShiftData;
  stop_for_today?: boolean;
}
