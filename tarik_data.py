import time
import re
import json
import os
import sys
import base64
import smtplib
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore


# Force UTF-8 output to support emojis in console print statements
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==========================================
# 1. KONFIGURASI
# ==========================================
CHROME_PROFILE_PATH = r"C:\SeleniumChromeProfile"

# Inisialisasi Firebase
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("🔥 [FIREBASE] Berhasil terhubung ke Firestore!")
except Exception as e:
    print(f"⚠️ [FIREBASE] Gagal inisialisasi: {e}")
    db = None

# URL Portal
A3_LOGIN_URL = "https://3a-cms.ainosi.id/login"
A3_TRANS_URL = "https://3a-cms.ainosi.id/pwa-order-v2"
IWM_LOGIN_URL = "https://202.129.187.146:6997/ragunan_iwm/index.php"
IWM_DETAIL_POS_URL = "https://202.129.187.146:6997/ragunan_iwm/index.php?mod=laporan.detail.pos&sub=detailPos&act=view&typ=html"
IWM_NIGHT_CUTOFF = "16:45:00"

# Kredensial
A3_EMAIL, A3_PASS = "yaninfotmr@gmail.com", "Y4nInfo_TMR2024!"
IWM_USER, IWM_PASS = "admintmriwm", "tmriwm2015"

def clean_number(text: str) -> int:
    text = (text or "").strip()
    return int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else 0

# ==========================================
# DETEKSI KOLOM DINAMIS & PEMETAAN STSU (UPDATE V1.6)
# ==========================================
def cari_indeks_kolom_tiket(thead):
    """
    Mendeteksi posisi kolom 'Ticket', 'Total Ticket' (Qty), dan 'Total Nominal' secara dinamis.
    Semua kolom di sebelah kiri 'Ticket' dianggap sebagai kolom informasi/sumber (Merchant, Location, dll).
    """
    idx_ticket = None
    idx_qty = None
    idx_nominal = None

    for i, h in enumerate(thead):
        h_clean = h.strip().upper()
        if h_clean in ["TICKET", "TICKET NAME", "NAMA TIKET", "TIKET"]:
            idx_ticket = i
        elif ("TOTAL" in h_clean and "TICKET" in h_clean) or "QTY" in h_clean or "JUMLAH TIKET" in h_clean:
            idx_qty = i
        elif "NOMINAL" in h_clean or "AMOUNT" in h_clean or h_clean == "TOTAL":
            idx_nominal = i

    if idx_ticket is None or idx_qty is None or idx_nominal is None:
        print(f"⚠️ [PERINGATAN 3A] Ada perubahan nama header tabel: {thead}")
        if len(thead) >= 3:
            if idx_nominal is None: idx_nominal = len(thead) - 1
            if idx_qty is None: idx_qty = len(thead) - 2
            if idx_ticket is None: idx_ticket = len(thead) - 3
            print(f"   -> Menggunakan deteksi posisi otomatis: Kolom Ticket={idx_ticket}, Qty={idx_qty}, Nominal={idx_nominal}")
        else:
            return [], 0, 1, 2

    left_indices = [i for i in range(len(thead)) if i < idx_ticket and i not in (idx_qty, idx_nominal)]
    return left_indices, idx_ticket, idx_qty, idx_nominal


def petakan_ke_stsu(data_tiket, tanggal_rekon_str):
    stsu = {str(i): {"qty": 0, "nominal": 0} for i in range(1, 22)}
    try:
        tgl = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
        is_weekend = tgl.weekday() >= 5
    except:
        is_weekend = False

    for item in data_tiket:
        info_kiri = str(item.get('left_info', '')).upper()
        tiket = str(item.get('ticket_name', '')).upper()
        qty = int(item.get('qty', 0))
        nominal = int(item.get('nominal', 0))
        gabungan = info_kiri + " " + tiket

        # 1. KENDARAAN / PARKIR
        if "KENDARAAN" in gabungan or "PARKIR" in gabungan or "MOTOR" in tiket or "MOBIL" in tiket or "BUS" in tiket or "SEPEDA" in tiket:
            idx = 0
            if re.search(r'\bGOL(?:ONGAN)?\s*III\b', tiket):
                idx = 19
            elif re.search(r'\bGOL(?:ONGAN)?\s*II\b', tiket):
                idx = 18
            elif re.search(r'\bGOL(?:ONGAN)?\s*I\b', tiket):
                idx = 17
            elif "BUS BESAR" in tiket or "TRUK BESAR" in tiket or "TRUCK BESAR" in tiket:
                idx = 17
            elif "BUS KECIL" in tiket or "TRUK KECIL" in tiket or "TRUCK KECIL" in tiket or "PICK UP BESAR" in tiket:
                idx = 18
            elif "MOBIL" in tiket or "MINIBUS" in tiket or "MINI BUS" in tiket or "SEDAN" in tiket or "PICK UP KECIL" in tiket:
                idx = 19
            elif "MOTOR" in tiket or "RODA TIGA" in tiket:
                idx = 20
            elif "SEPEDA" in tiket and "MOTOR" not in tiket:
                idx = 21
            
            if idx > 0:
                stsu[str(idx)]["qty"] += qty
                stsu[str(idx)]["nominal"] += nominal
            continue 

        # 2. WAHANA (Kuda, Unta, Gajah, TSA)
        idx = 0
        if "KUDA" in gabungan: idx = 5
        elif "UNTA" in gabungan: idx = 6
        elif "GAJAH" in gabungan: idx = 7
        elif "TAMAN SATWA ANAK" in gabungan or "TSA" in gabungan: idx = 8
        
        if idx > 0:
            stsu[str(idx)]["qty"] += qty
            stsu[str(idx)]["nominal"] += nominal
            continue

        # 3. PUSAT PRIMATA SCHMUTZER
        if "PRIMATA" in gabungan or "SCHMUTZER" in gabungan:
            is_holiday = any(k in tiket for k in ["WEEKEND", "HOLIDAY", "LIBUR"])
            is_weekday = "WEEKDAY" in tiket

            if is_holiday:
                libur = True
            elif is_weekday:
                libur = False
            else:
                libur = is_weekend
                
            idx = 0
            if "ROMBONGAN" in tiket or "REDUKSI" in tiket:
                if "DEWASA" in tiket: 
                    idx = 16 if libur else 11
                elif "ANAK" in tiket: 
                    idx = 15 if libur else 12
            else:
                if "DEWASA" in tiket: 
                    idx = 13 if libur else 9
                elif "ANAK" in tiket: 
                    idx = 14 if libur else 10
            
            if idx > 0:
                stsu[str(idx)]["qty"] += qty
                stsu[str(idx)]["nominal"] += nominal
            continue

        # 4. TIKET MASUK TMR PENGUNJUNG REGULER
        idx = 0
        if "ROMBONGAN" in tiket or "REDUKSI" in tiket:
            if "DEWASA" in tiket: idx = 3
            elif "ANAK" in tiket: idx = 4
        else:
            if "DEWASA" in tiket: idx = 1
            elif "ANAK" in tiket: idx = 2
            
        if idx > 0:
            stsu[str(idx)]["qty"] += qty
            stsu[str(idx)]["nominal"] += nominal

    return stsu

# ==========================================
# 2. FUNGSI EKSTRAK DATA
# ==========================================
def gabungkan_data_3a_channels(channels_a, channels_b):
    """
    Menggabungkan dua dict hasil_channels 3A (misal Siang <= 16:44:59 + Malam >= 16:45:00)
    menjadi satu struktur kumulatif harian yang utuh.
    """
    merged_channels = {}
    all_ch_keys = list(dict.fromkeys(list(channels_a.keys()) + list(channels_b.keys())))
    for ch in all_ch_keys:
        by_key = {}
        for src in (channels_a.get(ch, []), channels_b.get(ch, [])):
            for r in src:
                if len(r) < 5:
                    continue
                k = (r[1], r[2])
                if k not in by_key:
                    by_key[k] = {
                        "timestamp": r[0],
                        "qty": 0,
                        "total": 0,
                        "lokasi": set()
                    }
                by_key[k]["qty"] += clean_number(str(r[3]))
                by_key[k]["total"] += clean_number(str(r[4]))
                if len(r) > 5 and r[5]:
                    for lp in str(r[5]).split(","):
                        lc = lp.strip()
                        if lc:
                            by_key[k]["lokasi"].add(lc)
        ch_rows = []
        for (m_str, t_str), v in by_key.items():
            loc_s = ", ".join(sorted(v["lokasi"]))
            ch_rows.append([v["timestamp"], m_str, t_str, v["qty"], v["total"], loc_s])
        merged_channels[ch] = ch_rows

    # Buat juga list agregasi seluruh channel
    aggregated = {}
    for ch, items in merged_channels.items():
        for r in items:
            key = (r[1], r[2])
            if key not in aggregated:
                aggregated[key] = {"qty": 0, "total": 0, "timestamp": r[0], "lokasi": set()}
            aggregated[key]["qty"] += r[3]
            aggregated[key]["total"] += r[4]
            if len(r) > 5 and r[5]:
                for loc_part in r[5].split(','):
                    loc_clean = loc_part.strip()
                    if loc_clean:
                        aggregated[key]["lokasi"].add(loc_clean)

    header = ["Timestamp", "Item", "Kategori", "Qty", "Total", "Lokasi"]
    data_3a_aggregated = [header]
    for (item_name, kategori), val in aggregated.items():
        lokasi_str = ", ".join(sorted(val["lokasi"]))
        data_3a_aggregated.append([val["timestamp"], item_name, kategori, val["qty"], val["total"], lokasi_str])

    return data_3a_aggregated, merged_channels


def tarik_data_3a(driver, wait, target_date_str, query_by='paid', mode='full', time_range_mode='all', skip_nav=False):
    print(f"\n🚀 [3A] Menarik data 3A (Query by: {query_by.upper()}, Rentang Waktu: {time_range_mode.upper()})...")
    if not skip_nav:
        driver.get(A3_LOGIN_URL)
        
        try:
            email_input = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.NAME, "email")))
            print("🔑 [3A] Form login ditemukan, mengisi kredensial...")
            email_input.send_keys(A3_EMAIL)
            driver.find_element(By.NAME, "password").send_keys(A3_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Welcome')]")))
        except:
            print("✅ [3A] Sesi sudah tersimpan (sudah login), lanjut!")
        
        print("🧭 [3A] Menuju halaman Transaction...")
        driver.get(A3_TRANS_URL)
        wait.until(EC.presence_of_element_located((By.ID, "filter-form")))
    
    target_visit = datetime.strptime(target_date_str, "%Y-%m-%d")
    str_visit = target_visit.strftime("%Y-%m-%d")
    h_min_7 = (target_visit - timedelta(days=7)).strftime("%Y-%m-%d")
    h_plus_1 = (target_visit + timedelta(days=1)).strftime("%Y-%m-%d")

    if time_range_mode == "siang":
        # Murni transaksi yang diorder/tap sampai pukul 16:44:59 WIB
        val_order = f"{h_min_7} 00:00:00 to {str_visit} 16:44:59"
    elif time_range_mode == "malam":
        # Murni transaksi yang diorder/tap mulai pukul 16:45:00 s/d 23:59:59 WIB
        val_order = f"{str_visit} 16:45:00 to {str_visit} 23:59:59"
    else:
        val_order = f"{h_min_7} 00:00:00 to {h_plus_1} 23:59:59"
    print(f"⏱️ [3A] Filter Tanggal Order: {val_order} | Tanggal Visit: {str_visit}")
    
    if mode == "pendapatan_online_saja":
        channels = ["MERCHANT_PAGE"]
    else:
        channels = ["GATE", "TVM", "MERCHANT_PAGE", "MPOS"]
    hasil_channels = {}
    hasil_stsu_channels = {}
    
    def datatable_done(_drv):
        try:
            el = _drv.find_elements(By.ID, "orders-table_processing")
            if not el: return True
            return "none" in el[0].value_of_css_property("display").lower()
        except: return False
        
    for channel in channels:
        print(f"🔄 [3A] Memproses Channel: {channel}...")
        
        if query_by == 'paid':
            js_query = f"""
                document.getElementById('tanggal_order').value = '{val_order}';
                document.getElementById('tanggal_paid').value = '{str_visit}';
                document.getElementById('tanggal_visit').value = '';
            """
        else: # query_by == 'visit'
            js_query = f"""
                document.getElementById('tanggal_order').value = '{val_order}';
                document.getElementById('tanggal_paid').value = '';
                document.getElementById('tanggal_visit').value = '{str_visit}';
            """
            
        driver.execute_script(js_query + f"""
            $('#status').val('paid').trigger('change');
            $('#channel_type').val('{channel}').trigger('change');
            $('#merchant').val('').trigger('change');
            $('#partner').val('').trigger('change');
            $('#filter-form').submit();
        """)
        
        WebDriverWait(driver, 60).until(datatable_done)
        time.sleep(2.5)
        
        driver.execute_script("let t = document.getElementById('toggleZero'); if(t && !t.checked) t.click();")
        time.sleep(1.5)
        
        raw_table_data = driver.execute_script("""
            let table = document.querySelector('#summary-ticket-table');
            if (!table) return { 'thead': [], 'tbody': [] };
            
            let thead = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            let tbody = Array.from(table.querySelectorAll('tbody tr'))
                .filter(tr => window.getComputedStyle(tr).display !== 'none')
                .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
            return { 'thead': thead, 'tbody': tbody };
        """)
        
        thead_list = raw_table_data.get('thead', [])
        tbody_list = raw_table_data.get('tbody', [])
        
        left_indices, idx_ticket, idx_qty, idx_nominal = cari_indeks_kolom_tiket(thead_list)
        min_cols_needed = max([idx_ticket, idx_qty, idx_nominal] + left_indices) + 1 if thead_list else 4
        
        now = target_visit.strftime("%Y-%m-%d %H:%M:%S")
        channel_data = []
        raw_items_for_stsu = []
        
        for cols in tbody_list:
            if len(cols) >= min_cols_needed:
                first_col_text = cols[0] if cols else ""
                if not first_col_text or "tidak ada data" in first_col_text.lower() or "total" in first_col_text.lower():
                    continue
                
                left_info_str = " | ".join([cols[i] for i in left_indices if i < len(cols)])
                merchant_str = cols[0] if len(cols) > 0 else ""
                # Jika ada kolom lokasi (index 1 di antara left_indices)
                location_str = cols[1] if len(left_indices) > 1 and len(cols) > 1 else ""
                ticket_name_str = cols[idx_ticket]
                qty_val = clean_number(cols[idx_qty])
                nominal_val = clean_number(cols[idx_nominal])
                
                if qty_val > 0 or nominal_val > 0:
                    channel_data.append([now, merchant_str, ticket_name_str, qty_val, nominal_val, location_str])
                    raw_items_for_stsu.append({
                        "left_info": left_info_str,
                        "ticket_name": ticket_name_str,
                        "qty": qty_val,
                        "nominal": nominal_val
                    })
                    
        hasil_channels[channel] = channel_data
        hasil_stsu_channels[channel] = petakan_ke_stsu(raw_items_for_stsu, target_date_str)
        print(f"✅ [3A] Channel {channel}: Berhasil tarik {len(channel_data)} data.")
    
    # Agregasikan data dari seluruh channel
    aggregated = {}
    for ch, items in hasil_channels.items():
        for r in items:
            key = (r[1], r[2]) # (Item/Merchant, Kategori/TicketName)
            if key not in aggregated:
                aggregated[key] = {"qty": 0, "total": 0, "timestamp": r[0], "lokasi": set()}
            aggregated[key]["qty"] += r[3]
            aggregated[key]["total"] += r[4]
            if len(r) > 5 and r[5]:
                for loc_part in r[5].split(','):
                    loc_clean = loc_part.strip()
                    if loc_clean:
                        aggregated[key]["lokasi"].add(loc_clean)
            
    header = ["Timestamp", "Item", "Kategori", "Qty", "Total", "Lokasi"]
    data_3a_aggregated = [header]
    
    for (item_name, kategori), val in aggregated.items():
        lokasi_str = ", ".join(sorted(val["lokasi"]))
        data_3a_aggregated.append([val["timestamp"], item_name, kategori, val["qty"], val["total"], lokasi_str])
        
    print(f"✅ [3A] Agregasi Selesai. Total {len(data_3a_aggregated)-1} jenis tiket teragregasi.")
    return data_3a_aggregated, hasil_channels, hasil_stsu_channels

def tarik_data_iwm_full(driver, wait, tanggal_target, mode='full'):
    print("\n🚀 [IWM] Membuka IWM...")
    driver.get(IWM_LOGIN_URL)
    
    try:
        user_input = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.NAME, "username")))
        print("🔑 [IWM] Form login ditemukan, mengisi kredensial...")
        user_input.clear()
        user_input.send_keys(IWM_USER)
        driver.find_element(By.ID, "regularInput").send_keys(IWM_PASS)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        time.sleep(3)
    except:
         print("✅ [IWM] Sesi sudah tersimpan (sudah login), lanjut!")
         
    # -------------------------------------------------------------------------
    # TAHAP 1: REKAP PENDAPATAN PERLOKASI (MODE JUMLAH/KUANTITAS)
    # -------------------------------------------------------------------------
    print("🧭 [IWM] Melompat langsung ke URL Laporan -> Rekap Pendapatan Perlokasi (Mode Kuantitas)...")
    driver.get("https://202.129.187.146:6997/ragunan_iwm/index.php?mod=laporan.rekap.perlokasi&sub=rekapPerlokasi&act=view&typ=html")
    time.sleep(3)
    
    print(f"📅 [IWM] Mengubah 'Tampilan' menjadi Jumlah and Mengisi Tanggal ke: {tanggal_target}")
    driver.execute_script(f"""
        let formSearch = document.getElementById('form_search');
        let container = formSearch ? formSearch : document;
        
        // 1. Ubah Dropdown 'Tampilan' menjadi 'Jumlah'
        let selects = container.querySelectorAll('select');
        for(let s of selects) {{
            for(let opt of s.options) {{
                if(opt.text.toLowerCase().includes('jumlah')) {{
                    s.value = opt.value;
                    s.dispatchEvent(new Event('change'));
                    break;
                }}
            }}
        }}
        
        // 2. Isi parameter tanggal pencarian
        let inputs = container.querySelectorAll('input[type="text"], input[type="date"]');
        for(let inp of inputs) {{
            let attr = (inp.name + ' ' + inp.id + ' ' + inp.className).toLowerCase();
            let isDate = attr.includes('tgl') || attr.includes('tanggal') || attr.includes('date') || /^\\d{{4}}-\\d{{2}}-\\d{{2}}$/.test(inp.value);
            if(isDate) {{
                inp.value = '{tanggal_target}';
            }}
        }}
        
        // 3. Submit data untuk merefresh tabel
        if(formSearch) formSearch.submit();
        else {{
           let cariBtn = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
              .find(el => el.value.toLowerCase().includes('cari') || el.innerText.toLowerCase().includes('cari'));
           if(cariBtn) cariBtn.click();
        }}
    """)
    
    print("⏳ [IWM] Menunggu data Perlokasi dimuat (Mode Kuantitas)...")
    # Wait until the target table is actually loaded
    matrix_qty = []
    for _ in range(30): # Wait up to 30 seconds
        time.sleep(1)
        matrix_qty = driver.execute_script("""
            const tables = document.querySelectorAll('table');
            let targetTable = null;
            for (let t of tables) {
                if (t.textContent.includes('Lokasi') && t.textContent.includes('Karcis Masuk')) {
                    targetTable = t;
                    break;
                }
            }
            if (!targetTable) return [];
            
            const rows = Array.from(targetTable.querySelectorAll('tbody tr, tfoot tr'));
            return rows.map(r => Array.from(r.querySelectorAll('td')).map(td => {
                const i = td.querySelector('input'); return (i ? i.value : td.textContent).trim();
            }));
        """)
        if len(matrix_qty) > 0:
            break
            
    if len(matrix_qty) == 0:
        print("⚠️ [IWM] Tabel Karcis Masuk tidak ditemukan setelah 30 detik!")
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = ["Timestamp", "Lokasi", "Karcis Anak", "Karcis Dewasa", "Parkir Gol I", "Parkir Gol II", "Parkir Gol III", "Parkir Motor", "Parkir Sepeda", "Total"]
    hasil_qty = [header]
    
    for raw_row in matrix_qty:
        cells = [c.strip() for c in raw_row]
        if not cells: continue
        if len(cells) >= 10 and re.fullmatch(r"\d+", cells[0]): cells = cells[1:]
        if len(cells) >= 2 and re.fullmatch(r"\d+", cells[0]) and not re.fullmatch(r"\d+", cells[1]): cells = cells[1:]
        if len(cells) > 9: cells = cells[:9]
        if len(cells) == 9 and cells[0].strip() != "":
            hasil_qty.append([now, cells[0]] + [clean_number(x) for x in cells[1:9]])
            
    print(f"✅ [IWM] Berhasil tarik {len(hasil_qty)-1} data kuantitas.")
    
    print(f"✅ [IWM] Berhasil tarik {len(hasil_qty)-1} data pengunjung dari IWM.")
    return {"qty": hasil_qty}


def tarik_data_iwm_detail_pos(driver, wait, tanggal_target, cutoff_time=IWM_NIGHT_CUTOFF):
    """
    Menarik data pembanding dari Laporan -> Detail Transaksi Pos (JakCard & New JakCard)
    saat Shift Malam untuk:
    1. Menghitung transaksi Malam Murni (Tanggal Transaksi >= 16:45:00)
    2. Mendeteksi transaksi Siang Susulan / Late Sync (Tanggal Transaksi < 16:45:00 tetapi Tanggal Masuk >= 16:45:00)
    """
    print(f"\n🔍 [IWM DETAIL POS] Membuka Detail Transaksi Pos (Cut-Off Malam: >= {cutoff_time})...")
    driver.get(IWM_DETAIL_POS_URL)
    time.sleep(2.5)

    # Pastikan modul Detail Transaksi Pos sudah termuat di #subcontent-element
    for _ in range(15):
        has_card_select = driver.execute_script("""
            let selects = document.querySelectorAll('select');
            for (let s of selects) {
                for (let opt of s.options) {
                    if (opt.text.trim().toLowerCase() === 'new jakcard') return true;
                }
            }
            return false;
        """)
        if has_card_select:
            break
        driver.execute_script("""
            let link = document.querySelector('a[href*="laporan.detail.pos"]');
            if (link) link.click();
            else if (window.jQuery) {
                window.jQuery('#subcontent-element').load('/ragunan_iwm/index.php?mod=laporan.detail.pos&sub=detailPos&act=view&typ=html&ascomponent=1');
            }
        """)
        time.sleep(1.5)

    def wait_iwm_busy_done(timeout_sec=25):
        for _ in range(int(timeout_sec * 2)):
            time.sleep(0.5)
            done = driver.execute_script("""
                let busy = document.querySelector('.busy-indicator');
                if (busy && window.getComputedStyle(busy).display !== 'none') return false;
                return true;
            """)
            if done:
                return True
        return False

    js_parse_detail_table = """
        const cutoffTime = arguments[0];
        const tables = document.querySelectorAll('table');
        let targetTable = null;
        for (let t of tables) {
            let txt = t.textContent || '';
            if (txt.includes('Tanggal Transaksi') && txt.includes('Trace Number')) {
                targetTable = t;
                break;
            }
        }
        if (!targetTable) return { found: false, rowsCount: 0, items: [] };

        let headers = Array.from(targetTable.querySelectorAll('thead th')).map(th => th.textContent.trim().toUpperCase());
        let idxTglTrx = 2, idxTglMasuk = 3, idxTrace = 7, idxAnak = 8, idxDewasa = 9, idxKend = 10, idxNomKend = 13, idxGate = 18, idxLokasi = 19;
        headers.forEach((h, i) => {
            if (h.includes('TANGGAL TRANSAKSI')) idxTglTrx = i;
            else if (h.includes('TANGGAL MASUK')) idxTglMasuk = i;
            else if (h.includes('TRACE NUMBER')) idxTrace = i;
            else if (h.includes('TRANSAKSI ANAK')) idxAnak = i;
            else if (h.includes('TRANSAKSI DEWASA')) idxDewasa = i;
            else if (h.includes('TRANSAKSI KENDARAAN')) idxKend = i;
            else if (h.includes('NOMINAL KENDARAAN')) idxNomKend = i;
            else if (h === 'GATE') idxGate = i;
            else if (h === 'LOKASI') idxLokasi = i;
        });

        const cleanNum = (s) => {
            let d = String(s || '').replace(/[^\\d]/g, '');
            return d ? parseInt(d, 10) : 0;
        };

        const rows = Array.from(targetTable.querySelectorAll('tbody tr'));
        const items = [];
        for (let r of rows) {
            const tds = Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim());
            if (tds.length < 15) continue;
            const mTrx = (tds[idxTglTrx] || '').match(/(\\d{2}:\\d{2}:\\d{2})/);
            if (!mTrx) continue;
            const mMasuk = (tds[idxTglMasuk] || '').match(/(\\d{2}:\\d{2}:\\d{2})/);
            const jamTrx = mTrx[1];
            const jamMasuk = mMasuk ? mMasuk[1] : jamTrx;
            const trace = tds[idxTrace] || `${jamTrx}_${tds[idxLokasi]}_${tds[0]}`;
            const anak = cleanNum(tds[idxAnak]);
            const dewasa = cleanNum(tds[idxDewasa]);
            const kend = cleanNum(tds[idxKend]);
            const nomKend = cleanNum(tds[idxNomKend]);
            const gate = tds[idxGate] || '';
            const lokasi = tds[idxLokasi] || 'Lainnya';

            // Hanya kirim baris yang merupakan transaksi Malam (>= cutoff) ATAU transaksi Siang yang baru masuk Malam (Late Sync)
            if (jamTrx >= cutoffTime || jamMasuk >= cutoffTime) {
                items.push({
                    trace,
                    jamTrx,
                    jamMasuk,
                    anak,
                    dewasa,
                    kend,
                    nomKend,
                    gate,
                    lokasi
                });
            }
        }
        return { found: true, rowsCount: rows.length, items };
    """

    target_cards = ["JakCard", "New JakCard"]
    collected_items = {}
    any_table_verified = False

    for card_name in target_cards:
        print(f"💳 [IWM DETAIL POS] Memproses Kartu: {card_name} (Tanggal: {tanggal_target})...")
        driver.execute_script("""
            const targetCard = arguments[0];
            const tanggalTarget = arguments[1];
            let formSearch = document.getElementById('form_search');
            let container = formSearch ? formSearch : document;

            // 1. Pilih jenis Kartu
            let selects = container.querySelectorAll('select');
            for (let s of selects) {
                let opts = Array.from(s.options);
                if (opts.some(o => o.text.trim().toLowerCase() === 'new jakcard')) {
                    let match = opts.find(o => o.text.trim().toLowerCase() === targetCard.toLowerCase());
                    if (match) {
                        if (window.jQuery) window.jQuery(s).val(match.value).trigger('change');
                        else {
                            s.value = match.value;
                            s.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    break;
                }
            }

            // 2. Isi kedua input Tanggal Transaksi (s/d)
            let inputs = container.querySelectorAll('input[type="text"], input[type="date"]');
            for (let inp of inputs) {
                let attr = (inp.name + ' ' + inp.id + ' ' + inp.className).toLowerCase();
                let isDate = attr.includes('tgl') || attr.includes('tanggal') || attr.includes('date') || /^\\d{4}-\\d{2}-\\d{2}$/.test(inp.value);
                if (isDate) {
                    inp.value = tanggalTarget;
                }
            }

            // 3. Klik tombol Cari
            let cariBtn = Array.from(container.querySelectorAll('button, input[type="button"], input[type="submit"]'))
                .find(el => ((el.value || '') + ' ' + (el.innerText || '')).toLowerCase().includes('cari'));
            if (cariBtn) cariBtn.click();
            else if (formSearch) formSearch.submit();
        """, card_name, tanggal_target)

        time.sleep(1.5)
        wait_iwm_busy_done(25)
        time.sleep(1.0)

        # Parse halaman 1 terlebih dahulu sebagai cadangan cepat (karena urutan terbaru ada di halaman 1)
        page1_res = driver.execute_script(js_parse_detail_table, cutoff_time) or {}
        if page1_res.get("found"):
            any_table_verified = True
            for it in page1_res.get("items", []):
                collected_items[it["trace"]] = it

        # Ubah dropdown jumlah data per halaman ke 'Semua' agar semua data (termasuk late sync jam siang) tertangkap sekaligus
        switched_all = driver.execute_script("""
            let selects = document.querySelectorAll('select');
            for (let s of selects) {
                let opts = Array.from(s.options);
                if (opts.some(o => o.text.toLowerCase().includes('data per halaman'))) {
                    let semuaOpt = opts.find(o => o.text.trim().toLowerCase() === 'semua') ||
                                   opts.find(o => o.text.toLowerCase().includes('200'));
                    if (semuaOpt && s.value !== semuaOpt.value) {
                        if (window.jQuery) window.jQuery(s).val(semuaOpt.value).trigger('change');
                        else {
                            s.value = semuaOpt.value;
                            s.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        if (typeof s.onchange === 'function') s.onchange();
                        return true;
                    }
                }
            }
            return false;
        """)

        if switched_all:
            time.sleep(1.5)
            wait_iwm_busy_done(25)
            time.sleep(1.0)
            full_res = driver.execute_script(js_parse_detail_table, cutoff_time) or {}
            if full_res.get("found"):
                any_table_verified = True
                for it in full_res.get("items", []):
                    collected_items[it["trace"]] = it
                print(f"   -> [{card_name}] Mode 'Semua' aktif: {full_res.get('rowsCount', 0)} baris diperiksa.")
        else:
            print(f"   -> [{card_name}] {page1_res.get('rowsCount', 0)} baris diperiksa.")

    # Klasifikasikan semua transaksi yang terkumpul
    def empty_bucket():
        return {
            "total_pengunjung": 0, "dewasa": 0, "anak": 0,
            "pps": 0, "tsa": 0,
            "motor": 0, "mobil": 0, "bus": 0,
            "bus_gol_1": 0, "bus_gol_2": 0, "sepeda": 0
        }

    def add_row_to_bucket(b, lok_str, anak, dewasa, g1, g2, g3, motor, sepeda):
        lok_l = lok_str.lower()
        if "primata" in lok_l or "schmutzer" in lok_l:
            b["pps"] += (anak + dewasa)
        elif "satwa anak" in lok_l or "children zoo" in lok_l:
            b["tsa"] += (anak + dewasa)
        else:
            b["anak"] += anak
            b["dewasa"] += dewasa
            b["total_pengunjung"] += (anak + dewasa)
        b["bus_gol_1"] += g1
        b["bus_gol_2"] += g2
        b["bus"] += (g1 + g2)
        b["mobil"] += g3
        b["motor"] += motor
        b["sepeda"] += sepeda

    malam_by_lokasi = {}
    late_sync_totals = empty_bucket()
    late_sync_by_hour = {}
    late_sync_by_lokasi = {}
    late_sync_by_slot_masuk = {}

    for trace, it in collected_items.items():
        lok = (it.get("lokasi") or "Lainnya").strip()
        gate = (it.get("gate") or "").upper()
        anak = int(it.get("anak", 0))
        dewasa = int(it.get("dewasa", 0))
        kend = int(it.get("kend", 0))
        nom_kend = int(it.get("nomKend", 0))
        jam_trx = it.get("jamTrx", "00:00:00")
        jam_masuk = it.get("jamMasuk", jam_trx)

        g1 = g2 = g3 = motor = sepeda = 0
        if kend > 0:
            tarif = nom_kend / kend if nom_kend > 0 else 0
            if 0 < tarif <= 1500:
                sepeda = kend
            elif 1500 < tarif <= 4500 or "MOTOR" in gate or "MOTOR" in lok.upper():
                motor = kend
            elif 4500 < tarif <= 9500:
                g3 = kend
            elif 9500 < tarif <= 13500:
                g2 = kend
            elif tarif > 13500:
                g1 = kend
            else:
                if "MOTOR" in (gate + " " + lok.upper()):
                    motor = kend
                else:
                    g3 = kend

        if jam_trx >= cutoff_time:
            # Transaksi Malam Murni (>= 16:45:00)
            if lok not in malam_by_lokasi:
                malam_by_lokasi[lok] = {
                    "lokasi": lok,
                    "karcis_anak": 0, "karcis_dewasa": 0,
                    "parkir_gol_1": 0, "parkir_gol_2": 0, "parkir_gol_3": 0,
                    "parkir_motor": 0, "parkir_sepeda": 0, "total": 0
                }
            ml = malam_by_lokasi[lok]
            ml["karcis_anak"] += anak
            ml["karcis_dewasa"] += dewasa
            ml["parkir_gol_1"] += g1
            ml["parkir_gol_2"] += g2
            ml["parkir_gol_3"] += g3
            ml["parkir_motor"] += motor
            ml["parkir_sepeda"] += sepeda
            ml["total"] += (anak + dewasa + g1 + g2 + g3 + motor + sepeda)
        elif jam_masuk >= cutoff_time:
            # Transaksi Siang (< 16:45:00) yang baru tersinkronisasi saat Shift Malam (>= 16:45:00)
            add_row_to_bucket(late_sync_totals, lok, anak, dewasa, g1, g2, g3, motor, sepeda)

            hour_key = jam_trx[:2] + ":00"
            if hour_key not in late_sync_by_hour:
                late_sync_by_hour[hour_key] = empty_bucket()
            add_row_to_bucket(late_sync_by_hour[hour_key], lok, anak, dewasa, g1, g2, g3, motor, sepeda)

            if lok not in late_sync_by_lokasi:
                late_sync_by_lokasi[lok] = empty_bucket()
            add_row_to_bucket(late_sync_by_lokasi[lok], lok, anak, dewasa, g1, g2, g3, motor, sepeda)

            # Hitung slot 15 menit dari jam_masuk (misal 18:04 -> 18:00)
            try:
                hh = int(jam_masuk[:2])
                mm = (int(jam_masuk[3:5]) // 15) * 15
                slot_key = f"{hh:02d}:{mm:02d}"
            except Exception:
                slot_key = jam_masuk[:5]
            if slot_key not in late_sync_by_slot_masuk:
                late_sync_by_slot_masuk[slot_key] = empty_bucket()
            add_row_to_bucket(late_sync_by_slot_masuk[slot_key], lok, anak, dewasa, g1, g2, g3, motor, sepeda)

    print(
        f"✅ [IWM DETAIL POS] Verifikasi selesai! "
        f"Lokasi Malam (>={cutoff_time}): {len(malam_by_lokasi)} lokasi | "
        f"Data Siang Susulan (Late Sync): {late_sync_totals['total_pengunjung']} pengunjung."
    )
    return {
        "verified": any_table_verified,
        "cutoff_time": cutoff_time,
        "malam_by_lokasi": malam_by_lokasi,
        "late_sync": {
            **late_sync_totals,
            "cutoff_time": cutoff_time,
            "by_hour": late_sync_by_hour,
            "by_lokasi": late_sync_by_lokasi,
            "by_slot_masuk": late_sync_by_slot_masuk
        }
    }

# ==========================================
# 3. LOGIKA REKAP OFFLINE
# ==========================================
def hitung_rekap_siang(data_3a_channels, data_iwm, target_date_str=None):
    online_dewasa = 0
    online_anak = 0
    online_motor = 0
    online_mobil = 0
    online_bus_gol_1 = 0
    online_bus_gol_2 = 0
    online_sepeda = 0
    
    # 3A PPS and TSA attraction ticket counts
    online_pps = 0
    online_tsa = 0
    
    for ch, items in data_3a_channels.items():
        for r in items:
            kategori = (str(r[1]) + " " + str(r[2]) + " " + (str(r[5]) if len(r) > 5 else "")).upper()
            tiket = str(r[2]).upper()
            qty = r[3]
            
            # Accumulate PPS (Pusat Primata Schmutzer) tickets from 3A
            if "PUSAT PRIMATA" in kategori or "SCHMUTZER" in kategori:
                online_pps += qty
                continue
            
            # Accumulate TSA (Taman Satwa Anak) tickets from 3A
            if "TAMAN SATWA" in kategori or ("TSA" in kategori and "KENDARAAN" not in kategori):
                online_tsa += qty
                continue
                
            # Kendaraan 3A (Cek III -> II -> I agar tidak tumpang tindih)
            if "KENDARAAN" in kategori or "PARKIR" in kategori or "MOTOR" in tiket or "MOBIL" in tiket or "BUS" in tiket or "SEPEDA" in tiket:
                if re.search(r'\bGOL(?:ONGAN)?\s*III\b', tiket):
                    online_mobil += qty
                elif re.search(r'\bGOL(?:ONGAN)?\s*II\b', tiket):
                    online_bus_gol_2 += qty
                elif re.search(r'\bGOL(?:ONGAN)?\s*I\b', tiket):
                    online_bus_gol_1 += qty
                elif "BUS BESAR" in tiket or "TRUK BESAR" in tiket or "TRUCK BESAR" in tiket:
                    online_bus_gol_1 += qty
                elif "BUS KECIL" in tiket or "TRUK KECIL" in tiket or "TRUCK KECIL" in tiket or "PICK UP BESAR" in tiket:
                    online_bus_gol_2 += qty
                elif "MOBIL" in tiket or "MINIBUS" in tiket or "MINI BUS" in tiket or "SEDAN" in tiket or "PICK UP KECIL" in tiket:
                    online_mobil += qty
                elif "MOTOR" in tiket or "RODA TIGA" in tiket:
                    online_motor += qty
                elif "SEPEDA" in tiket and "MOTOR" not in tiket:
                    online_sepeda += qty
                continue

            if "DEWASA" in kategori:
                online_dewasa += qty
            elif "ANAK" in kategori:
                online_anak += qty
                
    iwm_anak = 0
    iwm_dewasa = 0
    iwm_motor = 0
    iwm_mobil = 0
    iwm_bus_gol_1 = 0
    iwm_bus_gol_2 = 0
    iwm_sepeda = 0
    
    iwm_pps_anak = 0
    iwm_pps_dewasa = 0
    iwm_tsa_anak = 0
    iwm_tsa_dewasa = 0
    
    for r in data_iwm[1:]:
        lokasi = r[1]
        if lokasi.lower().strip() == "total":
            continue
        k_anak = r[2]
        k_dewasa = r[3]
        p_gol_1 = r[4]
        p_gol_2 = r[5]
        p_gol_3 = r[6]
        p_motor = r[7]
        p_sepeda = r[8]
        
        lokasi_lower = lokasi.lower()
        if "primata" in lokasi_lower or "schmutzer" in lokasi_lower:
            iwm_pps_anak += k_anak
            iwm_pps_dewasa += k_dewasa
        elif "satwa anak" in lokasi_lower or "children zoo" in lokasi_lower:
            iwm_tsa_anak += k_anak
            iwm_tsa_dewasa += k_dewasa
        else:
            iwm_anak += k_anak
            iwm_dewasa += k_dewasa
            
        iwm_motor += p_motor
        iwm_mobil += p_gol_3
        iwm_bus_gol_1 += p_gol_1
        iwm_bus_gol_2 += p_gol_2
        iwm_sepeda += p_sepeda
        
    net_anak = iwm_anak + online_anak
    net_dewasa = iwm_dewasa + online_dewasa
    total_visitors = net_anak + net_dewasa
    
    # PPS = IWM_PPS + 3A_PPS
    total_pps = iwm_pps_anak + iwm_pps_dewasa + online_pps
    # TSA = IWM_TSA + 3A_TSA
    total_tsa = iwm_tsa_anak + iwm_tsa_dewasa + online_tsa
    
    now = datetime.now()
    # Round down to the nearest 15-minute interval
    minute_rounded = (now.minute // 15) * 15
    now = now.replace(minute=minute_rounded, second=0, microsecond=0)
    
    try:
        tgl_obj = datetime.strptime(target_date_str, "%Y-%m-%d") if target_date_str else now
    except:
        tgl_obj = now
        
    hari_dict = {0: 'Senin', 1: 'Selasa', 2: 'Rabu', 3: 'Kamis', 4: 'Jumat', 5: 'Sabtu', 6: 'Minggu'}
    bulan_dict = {1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'}
    
    update_str = f"{hari_dict[now.weekday()]}, {now.strftime('%d')} {bulan_dict[now.month]} {now.strftime('%Y')} pukul {now.strftime('%H:%M')} WIB"
    tanggal_str = f"{hari_dict[tgl_obj.weekday()]}, {bulan_dict[tgl_obj.month]} {tgl_obj.strftime('%d')}, {tgl_obj.strftime('%Y')}"
    
    return {
        "total_pengunjung": total_visitors,
        "motor": iwm_motor + online_motor,
        "mobil": iwm_mobil + online_mobil,
        "bus": iwm_bus_gol_1 + iwm_bus_gol_2 + online_bus_gol_1 + online_bus_gol_2,
        "sepeda": iwm_sepeda + online_sepeda,
        "pps": total_pps,
        "tsa": total_tsa,
        "update_str": update_str,
        "tanggal_str": tanggal_str,
        "jam_str": now.strftime("%H:%M:%S"),
        "anak": net_anak,
        "dewasa": net_dewasa,
        "bus_gol_1": iwm_bus_gol_1 + online_bus_gol_1,
        "bus_gol_2": iwm_bus_gol_2 + online_bus_gol_2
    }

def hitung_rekap_malam(data_3a_channels, data_iwm, rekap_siang=None, target_date_str=None):
    # Hitung total kumulatif malam (total seharian)
    cum = hitung_rekap_siang(data_3a_channels, data_iwm, target_date_str)
    
    if not rekap_siang:
        print("⚠️ [REKAP] Data siang tidak ditemukan di JSON lokal. Menggunakan data kumulatif sebagai net malam.")
        rekap_siang = {}

    net_anak = max(0, cum["anak"] - rekap_siang.get("anak", 0))
    net_dewasa = max(0, cum["dewasa"] - rekap_siang.get("dewasa", 0))
    total_visitors = net_anak + net_dewasa
    
    now = datetime.now()
    # Round down to the nearest 15-minute interval
    minute_rounded = (now.minute // 15) * 15
    now = now.replace(minute=minute_rounded, second=0, microsecond=0)
    
    try:
        tgl_obj = datetime.strptime(target_date_str, "%Y-%m-%d") if target_date_str else now
    except:
        tgl_obj = now
        
    hari_dict = {0: 'Senin', 1: 'Selasa', 2: 'Rabu', 3: 'Kamis', 4: 'Jumat', 5: 'Sabtu', 6: 'Minggu'}
    bulan_dict = {1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'}
    
    update_str = f"{hari_dict[now.weekday()]}, {now.strftime('%d')} {bulan_dict[now.month]} {now.strftime('%Y')} pukul {now.strftime('%H:%M')} WIB"
    tanggal_str = f"{hari_dict[tgl_obj.weekday()]}, {bulan_dict[tgl_obj.month]} {tgl_obj.strftime('%d')}, {tgl_obj.strftime('%Y')}"
    
    return {
        "total_pengunjung": total_visitors,
        "motor": max(0, cum["motor"] - rekap_siang.get("motor", 0)),
        "mobil": max(0, cum["mobil"] - rekap_siang.get("mobil", 0)),
        "bus": max(0, cum["bus"] - rekap_siang.get("bus", 0)),
        "sepeda": max(0, cum["sepeda"] - rekap_siang.get("sepeda", 0)),
        "pps": max(0, cum["pps"] - rekap_siang.get("pps", 0)),
        "tsa": max(0, cum["tsa"] - rekap_siang.get("tsa", 0)),
        "update_str": update_str,
        "tanggal_str": tanggal_str,
        "jam_str": now.strftime("%H:%M:%S"),
        "anak": net_anak,
        "dewasa": net_dewasa,
        "bus_gol_1": max(0, cum.get("bus_gol_1", 0) - rekap_siang.get("bus_gol_1", 0)),
        "bus_gol_2": max(0, cum.get("bus_gol_2", 0) - rekap_siang.get("bus_gol_2", 0))
    }


# ==========================================
# 3B. GENERATE GAMBAR INFOGRAFIS & KIRIM EMAIL OTOMATIS (10:00, 12:00, 16:30 -> 17:00)
# ==========================================
DEFAULT_EMAIL_RECIPIENTS = ["alfaditmr@gmail.com", "lilopambudi1300@gmail.com"]


def file_to_data_url(rel_path: str, mime: str = "image/png") -> str:
    if not os.path.exists(rel_path):
        return ""
    try:
        with open(rel_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except Exception:
        return ""


def ambil_cuaca_ragunan():
    try:
        url = "https://api.open-meteo.com/v1/forecast?latitude=-6.3122&longitude=106.8206&current_weather=true"
        req = urllib.request.Request(url, headers={"User-Agent": "TMR-Scraper/2.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            d = json.loads(resp.read().decode("utf-8"))
        cw = d.get("current_weather", {})
        temp = round(float(cw.get("temperature", 29)))
        code = int(cw.get("weathercode", 2))
        desc = "Sunny / Cerah"
        icon = "☀️"
        if 1 <= code <= 3:
            desc, icon = "Cloudy / Berawan", "⛅"
        elif 45 <= code <= 48:
            desc, icon = "Fog / Kabut", "🌫️"
        elif 51 <= code <= 67:
            desc, icon = "Light Rain / Hujan Ringan", "🌦️"
        elif 80 <= code <= 82:
            desc, icon = "Heavy Rain / Hujan Deras", "🌧️"
        elif code >= 95:
            desc, icon = "Thunderstorm / Badai Petir", "⛈️"
        return {"temp": temp, "desc": desc, "icon": icon}
    except Exception:
        return {"temp": 29, "desc": "Cloudy / Berawan", "icon": "⛅"}


def render_dan_kirim_email_laporan(driver, db_client, target_date_str, snap_time, rekap_siang_data, existing, force_send=False):
    """
    Membuat gambar laporan infografis (format identik menu Laporan WA) dan mengirimkannya
    ke alfaditmr@gmail.com & lilopambudi1300@gmail.com pada jadwal:
    - Pukul 10:00 WIB (tertulis pukul 10:00 WIB)
    - Pukul 12:00 WIB (tertulis pukul 12:00 WIB)
    - Pukul 16:30 WIB (data penutupan 16:30, tertulis pukul 17:00 WIB di laporan)
    """
    sent_list = existing.get("email_reports_sent", [])
    if not isinstance(sent_list, list):
        sent_list = []

    slot_id = None
    display_jam = None

    if snap_time in ("10:00", "10:15") and "10:00" not in sent_list:
        slot_id = "10:00"
        display_jam = "10:00"
    elif snap_time in ("12:00", "12:15") and "12:00" not in sent_list:
        slot_id = "12:00"
        display_jam = "12:00"
    elif snap_time in ("16:30", "16:45") and "16:30" not in sent_list:
        slot_id = "16:30"
        display_jam = "17:00"  # Data 16:30 ditampilkan sebagai pukul 17:00 WIB sesuai permintaan
    elif force_send:
        slot_id = snap_time
        display_jam = "17:00" if snap_time >= "16:30" else snap_time

    if not slot_id or not display_jam:
        return False

    print(f"\n📧 [EMAIL REPORT] Menyiapkan laporan infografis untuk slot data {slot_id} (Tampil di laporan: pukul {display_jam} WIB)...")

    # 1. Ambil pengaturan foto satwa pilihan & penerima dari Firestore
    photo_data_url = ""
    recipients = list(DEFAULT_EMAIL_RECIPIENTS)
    if db_client:
        try:
            doc_snap = db_client.collection("report_settings").document("config").get()
            if doc_snap.exists:
                cfg = doc_snap.to_dict() or {}
                src = cfg.get("selected_photo_src", "")
                if src.startswith("data:image/"):
                    photo_data_url = src
                elif src.startswith("/"):
                    local_p = os.path.join("public", src.lstrip("/"))
                    mime = "image/png" if local_p.endswith(".png") else "image/jpeg"
                    photo_data_url = file_to_data_url(local_p, mime)
                extra_rec = cfg.get("email_recipients")
                if isinstance(extra_rec, list):
                    for r_email in extra_rec:
                        if r_email and "@" in str(r_email) and r_email not in recipients:
                            recipients.append(str(r_email).strip())
        except Exception as e_cfg:
            print(f"⚠️ [EMAIL REPORT] Gagal membaca report_settings dari Firestore: {e_cfg}")

    if not photo_data_url:
        photo_data_url = file_to_data_url(os.path.join("public", "chimpanzee_sidebar.png"), "image/png") or \
                         file_to_data_url(os.path.join("public", "harimau.jpg"), "image/jpeg")

    logo_dki_url = file_to_data_url(os.path.join("public", "logo-dki.png"), "image/png")
    logo_ragunan_url = file_to_data_url(os.path.join("public", "logo-ragunan.png"), "image/png")
    weather = ambil_cuaca_ragunan()

    # Format baris tanggal & jam laporan
    try:
        tgl_obj = datetime.strptime(target_date_str, "%Y-%m-%d")
    except Exception:
        tgl_obj = datetime.now()
    hari_dict = {0: 'Senin', 1: 'Selasa', 2: 'Rabu', 3: 'Kamis', 4: 'Jumat', 5: 'Sabtu', 6: 'Minggu'}
    bulan_dict = {1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'}
    title_line = f"{hari_dict[tgl_obj.weekday()]}, {tgl_obj.strftime('%d')} {bulan_dict[tgl_obj.month]} {tgl_obj.strftime('%Y')} pukul {display_jam} WIB"

    # 2. Render gambar PNG berukuran 1000x600 menggunakan Canvas di Headless Chrome
    driver.get("about:blank")
    render_payload = {
        "titleLine": title_line,
        "dewasa": int(rekap_siang_data.get("dewasa", 0)),
        "anak": int(rekap_siang_data.get("anak", 0)),
        "total": int(rekap_siang_data.get("total_pengunjung", 0)),
        "sepeda": int(rekap_siang_data.get("sepeda", 0)),
        "motor": int(rekap_siang_data.get("motor", 0)),
        "mobil": int(rekap_siang_data.get("mobil", 0)),
        "bus": int(rekap_siang_data.get("bus", 0)),
        "tsa": int(rekap_siang_data.get("tsa", 0)),
        "pps": int(rekap_siang_data.get("pps", 0)),
        "weatherText": f"{weather['temp']}° C - {weather['desc']}",
        "weatherIcon": weather["icon"],
        "photoSrc": photo_data_url,
        "logoDki": logo_dki_url,
        "logoRagunan": logo_ragunan_url
    }

    data_url_png = driver.execute_async_script("""
        const cfg = arguments[0];
        const done = arguments[1];

        const canvas = document.createElement('canvas');
        const W = 1000, H = 600;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        const fmt = (n) => new Intl.NumberFormat('en-US').format(n || 0);
        const loadImg = (src) => new Promise((res) => {
            if (!src) return res(null);
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => res(null);
            i.src = src;
        });

        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        const drawPill = (cx, y, w, h, color, text, fontSize = 28) => {
            const x = cx - w / 2;
            ctx.beginPath();
            ctx.moveTo(x + 14, y);
            ctx.lineTo(x + w - 14, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w - 14, y + h);
            ctx.lineTo(x + 14, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, y + h / 2 + 1);
        };

        const drawEmoji = (emoji, cx, cy, size) => {
            ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(emoji, cx, cy);
        };

        const drawLabel = (text, cx, y) => {
            ctx.font = '800 25px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#4a3a22';
            ctx.fillText(text, cx, y);
        };

        Promise.all([loadImg(cfg.photoSrc), loadImg(cfg.logoDki), loadImg(cfg.logoRagunan)]).then(([bgImg, dkiImg, ragImg]) => {
            ctx.fillStyle = '#e9e4d6';
            ctx.fillRect(0, 0, W, H);

            if (bgImg) {
                const scale = Math.max(W / bgImg.width, H / bgImg.height);
                const dw = bgImg.width * scale;
                const dh = bgImg.height * scale;
                ctx.drawImage(bgImg, W - dw, (H - dh) / 2, dw, dh);
            }

            const grad = ctx.createLinearGradient(0, 0, W, 0);
            grad.addColorStop(0, 'rgba(239,235,222,0.97)');
            grad.addColorStop(0.44, 'rgba(239,235,222,0.90)');
            grad.addColorStop(0.62, 'rgba(239,235,222,0.35)');
            grad.addColorStop(0.78, 'rgba(239,235,222,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Panji DKI
            ctx.fillStyle = '#f5b400';
            ctx.beginPath();
            ctx.moveTo(42, 0); ctx.lineTo(138, 0); ctx.lineTo(138, 110); ctx.lineTo(90, 132); ctx.lineTo(42, 110);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(47, 0); ctx.lineTo(133, 0); ctx.lineTo(133, 105); ctx.lineTo(90, 125); ctx.lineTo(47, 105);
            ctx.closePath(); ctx.fill();

            if (dkiImg) {
                const lh = 76;
                const lw = (dkiImg.width / dkiImg.height) * lh;
                ctx.drawImage(dkiImg, 90 - lw / 2, 18, lw, lh);
            }

            // Judul
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.font = '900 34px Arial, sans-serif';
            ctx.lineWidth = 7;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText('DATA PENGUNJUNG', 180, 58);
            ctx.fillStyle = '#3b8728';
            ctx.fillText('DATA PENGUNJUNG', 180, 58);

            // Badge tanggal
            roundRect(180, 74, 445, 42, 8);
            ctx.fillStyle = '#f7931e';
            ctx.fill();
            ctx.setLineDash([6, 5]);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#4a3520';
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 18px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cfg.titleLine, 402, 96);

            // Dewasa & Anak
            drawEmoji('🐅', 105, 184, 68);
            drawLabel('Dewasa', 105, 240);
            drawPill(105, 260, 122, 38, '#883997', fmt(cfg.dewasa), 26);

            drawEmoji('🐯', 246, 184, 68);
            drawLabel('Anak', 246, 240);
            drawPill(246, 260, 114, 38, '#883997', fmt(cfg.anak), 26);

            // TOTAL
            roundRect(362, 165, 138, 38, 2);
            ctx.fillStyle = '#754c24';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 28px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TOTAL', 431, 185);

            roundRect(326, 203, 210, 62, 2);
            ctx.fillStyle = '#7ab81d';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 48px Arial, sans-serif';
            ctx.fillText(fmt(cfg.total), 431, 236);

            // Kendaraan
            drawEmoji('🚲', 105, 336, 54);
            drawLabel('Sepeda', 105, 392);
            drawPill(105, 410, 106, 36, '#c9403e', fmt(cfg.sepeda), 25);

            drawEmoji('🏍️', 244, 336, 54);
            drawLabel('Motor', 244, 392);
            drawPill(244, 410, 114, 36, '#ec654f', fmt(cfg.motor), 25);

            drawEmoji('🚗', 376, 336, 54);
            drawLabel('Mobil', 376, 392);
            drawPill(376, 410, 114, 36, '#f2b622', fmt(cfg.mobil), 25);

            drawEmoji('🚌', 504, 336, 54);
            drawLabel('Bus', 504, 392);
            drawPill(504, 410, 106, 36, '#8cc63f', fmt(cfg.bus), 25);

            // Garis pemisah
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#8cc63f';
            ctx.beginPath();
            for (let x = 34; x <= 450; x += 4) {
                const y = 468 + Math.sin((x - 34) / 8) * 3;
                if (x === 34) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();

            // TSA & PPS
            roundRect(78, 484, 134, 34, 17);
            ctx.fillStyle = '#f5a028';
            ctx.fill();
            drawEmoji('🐊', 98, 501, 18);
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 20px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fmt(cfg.tsa), 146, 502);
            ctx.beginPath(); ctx.arc(194, 501, 13, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.fillStyle = '#4a3a22'; ctx.font = '900 10px Arial, sans-serif'; ctx.fillText('TSA', 194, 502);

            roundRect(272, 484, 134, 34, 17);
            ctx.fillStyle = '#f5a028';
            ctx.fill();
            ctx.beginPath(); ctx.arc(290, 501, 13, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.fillStyle = '#4a3a22'; ctx.font = '900 10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PPS', 290, 502);
            ctx.fillStyle = '#ffffff'; ctx.font = '800 20px Arial, sans-serif'; ctx.fillText(fmt(cfg.pps), 338, 502);
            drawEmoji('🦍', 388, 501, 18);

            // Cuaca
            roundRect(94, 535, 294, 50, 10);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#99c24d';
            ctx.stroke();
            drawEmoji(cfg.weatherIcon, 132, 560, 28);
            ctx.fillStyle = '#222222';
            ctx.font = '800 15px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(cfg.weatherText, 165, 561);

            // Lengkungan putih kanan bawah + Logo Ragunan
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(815, 600);
            ctx.quadraticCurveTo(845, 520, 1000, 490);
            ctx.lineTo(1000, 600);
            ctx.closePath();
            ctx.fill();

            if (ragImg) {
                const rh = 54;
                const rw = (ragImg.width / ragImg.height) * rh;
                ctx.drawImage(ragImg, 986 - rw, 590 - rh, rw, rh);
            }

            done(canvas.toDataURL('image/png'));
        });
    """, render_payload)

    if not data_url_png or not str(data_url_png).startswith("data:image/png;base64,"):
        print("⚠️ [EMAIL REPORT] Gagal merender gambar canvas.")
        return False

    png_bytes = base64.b64decode(str(data_url_png).split(",", 1)[1])

    # 3. Kirim Email melalui Gmail SMTP
    gmail_user = (os.environ.get("GMAIL_USER") or "usahatmr@gmail.com").strip()
    gmail_app_password = (os.environ.get("GMAIL_APP_PASSWORD") or "").strip()

    if not gmail_app_password:
        print("⚠️ [EMAIL REPORT] Secret GMAIL_APP_PASSWORD belum diatur di GitHub Secrets. Gambar berhasil dibuat namun pengiriman email dilewati.")
        return False

    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = f"Laporan Data Pengunjung TMR - {title_line}"
        msg["From"] = f"TMR Scraper Dashboard <{gmail_user}>"
        msg["To"] = ", ".join(recipients)

        html_body = f"""
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 720px;">
            <h2 style="color: #15803d; margin-bottom: 4px;">Laporan Data Pengunjung Taman Margasatwa Ragunan</h2>
            <p style="margin-top: 0; color: #4b5563;"><strong>{title_line}</strong></p>
            <div style="margin: 16px 0;">
                <img src="cid:laporan_infografis" alt="Laporan Pengunjung TMR" style="max-width: 100%; border-radius: 10px; border: 1px solid #d1d5db;" />
            </div>
            <table style="border-collapse: collapse; width: 100%; max-width: 480px; font-size: 14px;">
                <tr style="background: #15803d; color: #ffffff;">
                    <th style="padding: 8px 12px; text-align: left;">Kategori</th>
                    <th style="padding: 8px 12px; text-align: right;">Jumlah</th>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Dewasa</td><td style="padding: 6px 12px; text-align: right; font-weight: bold;">{render_payload['dewasa']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Anak</td><td style="padding: 6px 12px; text-align: right; font-weight: bold;">{render_payload['anak']:,}</td></tr>
                <tr style="border-bottom: 2px solid #15803d; background: #f0fdf4;"><td style="padding: 8px 12px; font-weight: bold;">TOTAL PENGUNJUNG</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #15803d;">{render_payload['total']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Sepeda</td><td style="padding: 6px 12px; text-align: right;">{render_payload['sepeda']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Motor</td><td style="padding: 6px 12px; text-align: right;">{render_payload['motor']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Mobil</td><td style="padding: 6px 12px; text-align: right;">{render_payload['mobil']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Bus</td><td style="padding: 6px 12px; text-align: right;">{render_payload['bus']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Taman Satwa Anak (TSA)</td><td style="padding: 6px 12px; text-align: right;">{render_payload['tsa']:,}</td></tr>
                <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px 12px;">Pusat Primata Schmutzer (PPS)</td><td style="padding: 6px 12px; text-align: right;">{render_payload['pps']:,}</td></tr>
            </table>
            <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
                Dikirim otomatis oleh sistem TMR Scraper Dashboard (<a href="https://tmr-scraper-db.web.app/">tmr-scraper-db.web.app</a>).
            </p>
        </div>
        """
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        filename = f"laporan-pengunjung-{target_date_str}-{display_jam.replace(':', '')}.png"
        img_inline = MIMEImage(png_bytes, _subtype="png")
        img_inline.add_header("Content-ID", "<laporan_infografis>")
        img_inline.add_header("Content-Disposition", "inline", filename=filename)
        msg.attach(img_inline)

        img_attach = MIMEImage(png_bytes, _subtype="png")
        img_attach.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(img_attach)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
            server.login(gmail_user, gmail_app_password)
            server.sendmail(gmail_user, recipients, msg.as_string())

        sent_list.append(slot_id)
        existing["email_reports_sent"] = sent_list
        print(f"✅ [EMAIL REPORT] Laporan pukul {display_jam} WIB berhasil dikirim ke: {', '.join(recipients)}!")
        return True
    except Exception as e_mail:
        print(f"❌ [EMAIL REPORT] Gagal mengirim email: {e_mail}")
        return False

# ==========================================
# 4. PROGRAM UTAMA (MAIN)
# ==========================================
def main():
    # 1. PARSE ARGUMENTS
    shift = "siang"
    target_date_str = None
    mode = "pengunjung"
    
    # Check automatically based on local time if no shift specified
    current_dt = datetime.now()
    
    # Tentukan Shift dan apakah sedang dalam jam aktif berdasarkan hari dan jam
    # Hari: 0=Senin, 1=Selasa, ..., 4=Jumat, 5=Sabtu, 6=Minggu
    weekday = current_dt.weekday()
    hour = current_dt.hour
    minute = current_dt.minute
    time_val = hour + (minute / 60.0)
    
    is_active = False
    shift = "siang"
    
    start_siang = 7.0 if weekday <= 4 else 6.5
    
    if start_siang <= time_val <= 16.5: # Siang Senin - Minggu sampai 16:30
        shift = "siang"
        is_active = True
    elif time_val > 16.5:
        shift = "malam"
        # Malam aktif jika Selasa(1) sampai Sabtu(5) dan dari pukul 16:45
        if 1 <= weekday <= 5:
            end_malam = 22.0 if weekday == 5 else 22.25
            if 16.75 <= time_val <= end_malam:
                is_active = True
            
    # Jika dijalankan otomatis (tanpa argumen tambahan) dan di luar jam operasional, berhentikan program
    if not is_active and len(sys.argv) == 1:
        print(f"🛑 [AUTO-STOP] Waktu saat ini ({current_dt.strftime('%H:%M WIB')}) berada di luar sesi operasional (Siang/Malam). Bot beristirahat.")
        sys.exit(0)
        
    for arg in sys.argv[1:]:
        val = arg.lower().strip()
        if val in ["siang", "malam"]:
            shift = val
        elif val in ["pengunjung", "pendapatan", "full"]:
            mode = val
        elif re.match(r"^\d{4}-\d{2}-\d{2}$", val):
            target_date_str = val
            
    if not target_date_str:
        target_date_str = datetime.now().strftime("%Y-%m-%d")
        
    print(f"🤖 MEMULAI AUTOMATION LAYANAN TERPADU TMR (Shift: {shift.upper()}, Mode: {mode.upper()}, Tanggal: {target_date_str})")
    
    # CEK EARLY EXIT (Apakah hari ini sudah dihentikan permanen?)
    os.makedirs("data", exist_ok=True)
    file_path = f"data/{target_date_str}.json"
    existing_early = {}
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                existing_early = json.load(f)
        except Exception:
            pass
            
    if existing_early.get("stop_for_today") == True:
        print(f"💤 [AUTO-STOP] Pengunjung tutup hari ini. Hanya menarik data pendapatan online (STSU)...")
        mode = "pendapatan_online_saja"
    
    options = Options()
    options.page_load_strategy = 'eager'
    options.add_argument("--headless=new") 
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_PATH}")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.set_capability("acceptInsecureCerts", True)
    
    # Blokir gambar agar IWM memuat lebih cepat di server 1GB RAM
    prefs = {"profile.managed_default_content_settings.images": 2}
    options.add_experimental_option("prefs", prefs)
    
    # Anti-detection options from malam script
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    
    wait = WebDriverWait(driver, 30)

    try:
        str_v = target_date_str

        # READ EXISTING DATA (Moved up for fallback logic)
        os.makedirs("data", exist_ok=True)
        file_path = f"data/{str_v}.json"
        existing = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                existing = {}

        existing_shift_payload = existing.get(shift, {})

        # EKSTRAKSI
        # 1. Query by visit date (Data Pengunjung 3A berbasis jam transaksi real)
        data_3a_malam_real = None
        data_3a_channels_malam_real = None
        stsu_channels_malam_real = None
        data_3a_siang_real = None
        data_3a_channels_siang_real = None
        stsu_channels_siang_real = None
        verified_3a_night_by_time = False

        if shift == "malam":
            # Tarik data 3A Siang Real (<= 16:44:59) dan Malam Real (>= 16:45:00) secara terpisah berdasarkan jam transaksi
            data_3a_siang_real, data_3a_channels_siang_real, stsu_channels_siang_real = tarik_data_3a(
                driver, wait, str_v, query_by='visit', mode=mode, time_range_mode='siang', skip_nav=False
            )
            data_3a_malam_real, data_3a_channels_malam_real, stsu_channels_malam_real = tarik_data_3a(
                driver, wait, str_v, query_by='visit', mode=mode, time_range_mode='malam', skip_nav=True
            )
            # Gabungkan Siang Real + Malam Real untuk kompatibilitas kumulatif
            data_3a_visit, data_3a_channels_visit = gabungkan_data_3a_channels(
                data_3a_channels_siang_real, data_3a_channels_malam_real
            )
            stsu_channels_visit = stsu_channels_malam_real
            verified_3a_night_by_time = True
        else:
            # Shift Siang: tarik murni rentang Siang (<= 16:44:59)
            data_3a_visit, data_3a_channels_visit, stsu_channels_visit = tarik_data_3a(
                driver, wait, str_v, query_by='visit', mode=mode, time_range_mode='siang', skip_nav=False
            )
            
        # 2. Pull IWM Quantity
        try:
            data_iwm_full = tarik_data_iwm_full(driver, wait, str_v, mode=mode)
            data_iwm = data_iwm_full["qty"]
            if not data_iwm or len(data_iwm) <= 1:
                raise Exception("Data IWM kosong dari website")
        except Exception as e:
            print(f"❌ [IWM] Gagal menarik data IWM dari website (Error: {e})")
            data_iwm = []
            
            # FALLBACK LOGIC
            fallback_iwm = existing_shift_payload.get("iwm")
            if fallback_iwm and len(fallback_iwm) > 0:
                print("⚠️ [FALLBACK] Mempertahankan data IWM terakhir dari JSON agar dashboard tidak kosong!")
                data_iwm = [["", "Lokasi", "Anak", "Dewasa", "Gol1", "Gol2", "Gol3", "Motor", "Sepeda", "Total"]]
                for item in fallback_iwm:
                    data_iwm.append([
                        "", 
                        item.get("lokasi", ""),
                        str(item.get("karcis_anak", 0)),
                        str(item.get("karcis_dewasa", 0)),
                        str(item.get("parkir_gol_1", 0)),
                        str(item.get("parkir_gol_2", 0)),
                        str(item.get("parkir_gol_3", 0)),
                        str(item.get("parkir_motor", 0)),
                        str(item.get("parkir_sepeda", 0)),
                        str(item.get("total", 0))
                    ])

        def format_3a_list(raw_agg):
            res = []
            if raw_agg:
                for r in raw_agg:
                    if len(r) >= 5 and str(r[0]).upper() != "TIMESTAMP" and str(r[1]).upper() != "ITEM":
                        res.append({
                            "item": r[1],
                            "kategori": r[2],
                            "qty": clean_number(str(r[3])),
                            "total": clean_number(str(r[4])),
                            "lokasi": r[5] if len(r) > 5 else ""
                        })
            return res

        def format_3a_by_channel(raw_ch):
            res = {}
            if raw_ch:
                for ch, rows in raw_ch.items():
                    ch_list = []
                    for r in rows:
                        if len(r) >= 5:
                            ch_list.append({
                                "item": r[1],
                                "kategori": r[2],
                                "qty": clean_number(str(r[3])),
                                "total": clean_number(str(r[4])),
                                "lokasi": r[5] if len(r) > 5 else ""
                            })
                    res[ch] = ch_list
            return res

        # PREPARE FORMATTED LISTS FOR STORAGE
        tickets_3a_list_visit = format_3a_list(data_3a_visit)
        tickets_3a_by_channel_visit = format_3a_by_channel(data_3a_channels_visit)
        tickets_3a_by_channel_malam_real = format_3a_by_channel(data_3a_channels_malam_real) if data_3a_channels_malam_real is not None else None

        iwm_list = []
        if data_iwm:
            for r in data_iwm[1:]:
                if len(r) >= 10:
                    iwm_list.append({
                        "lokasi": r[1],
                        "karcis_anak": clean_number(str(r[2])),
                        "karcis_dewasa": clean_number(str(r[3])),
                        "parkir_gol_1": clean_number(str(r[4])),
                        "parkir_gol_2": clean_number(str(r[5])),
                        "parkir_gol_3": clean_number(str(r[6])),
                        "parkir_motor": clean_number(str(r[7])),
                        "parkir_sepeda": clean_number(str(r[8])),
                        "total": clean_number(str(r[9]))
                    })

        # Calculate totals based on shift
        late_sync_iwm_payload = None
        late_sync_3a_payload = None
        iwm_malam_real_list = None
        iwm_malam_real_rows = [["Header"]]
        iwm_siang_corrected_rows = data_iwm if data_iwm else [["Header"]]
        verified_iwm_night = False

        now_ts_slot = datetime.now()
        now_ts_slot = now_ts_slot.replace(minute=(now_ts_slot.minute // 15) * 15, second=0, microsecond=0)
        current_slot_str = now_ts_slot.strftime("%H:%M")

        if shift == "malam":
            # ------------------------------------------------------------------
            # A. DETEKSI LATE-SYNC 3A & UPDATE SIANG 3A BERBASIS JAM (<= 16:44:59)
            # ------------------------------------------------------------------
            if verified_3a_night_by_time and data_3a_channels_siang_real is not None:
                new_siang_rekap_3a = hitung_rekap_siang(data_3a_channels_siang_real, [["Header"]], str_v)
                if "siang" not in existing or not isinstance(existing["siang"], dict):
                    existing["siang"] = {}

                # Rekonstruksi rekap_3a siang sebelumnya jika belum ada
                old_siang_rekap_3a = existing["siang"].get("rekap_3a")
                if not old_siang_rekap_3a:
                    prev_ch_dict = existing["siang"].get("tickets_3a_by_channel_visit") or {}
                    prev_ch_rows = {
                        ck: [["", it.get("item", ""), it.get("kategori", ""), it.get("qty", 0), it.get("total", 0), it.get("lokasi", "")] for it in citems]
                        for ck, citems in prev_ch_dict.items()
                    }
                    old_siang_rekap_3a = hitung_rekap_siang(prev_ch_rows, [["Header"]], str_v) if prev_ch_rows else new_siang_rekap_3a

                # Kunci baseline cutoff awal (pukul 16:30) agar total kumulatif late-sync 3A selalu terlacak
                if "rekap_3a_initial_cutoff" not in existing["siang"]:
                    existing["siang"]["rekap_3a_initial_cutoff"] = old_siang_rekap_3a
                if "channels_3a_initial_cutoff" not in existing["siang"]:
                    existing["siang"]["channels_3a_initial_cutoff"] = existing["siang"].get("tickets_3a_by_channel_visit") or format_3a_by_channel(data_3a_channels_siang_real)

                init_3a = existing["siang"]["rekap_3a_initial_cutoff"]
                init_ch_3a = existing["siang"]["channels_3a_initial_cutoff"]

                delta_3a_pengunjung = max(0, new_siang_rekap_3a.get("total_pengunjung", 0) - old_siang_rekap_3a.get("total_pengunjung", 0))
                cum_late_3a_pengunjung = max(0, new_siang_rekap_3a.get("total_pengunjung", 0) - init_3a.get("total_pengunjung", 0))

                # Hitung rincian late-sync 3A per channel dibanding baseline cutoff 16:30
                by_channel_late_3a = {}
                for ch_k, ch_rows_now in data_3a_channels_siang_real.items():
                    now_ch_rekap = hitung_rekap_siang({ch_k: ch_rows_now}, [["Header"]], str_v)
                    init_ch_items = init_ch_3a.get(ch_k, [])
                    init_ch_rows = [["", it.get("item", ""), it.get("kategori", ""), it.get("qty", 0), it.get("total", 0), it.get("lokasi", "")] for it in init_ch_items]
                    init_ch_rekap = hitung_rekap_siang({ch_k: init_ch_rows}, [["Header"]], str_v)
                    diff_p = max(0, now_ch_rekap.get("total_pengunjung", 0) - init_ch_rekap.get("total_pengunjung", 0))
                    if diff_p > 0:
                        by_channel_late_3a[ch_k] = {
                            "total_pengunjung": diff_p,
                            "dewasa": max(0, now_ch_rekap.get("dewasa", 0) - init_ch_rekap.get("dewasa", 0)),
                            "anak": max(0, now_ch_rekap.get("anak", 0) - init_ch_rekap.get("anak", 0)),
                            "pps": max(0, now_ch_rekap.get("pps", 0) - init_ch_rekap.get("pps", 0)),
                            "tsa": max(0, now_ch_rekap.get("tsa", 0) - init_ch_rekap.get("tsa", 0)),
                            "motor": max(0, now_ch_rekap.get("motor", 0) - init_ch_rekap.get("motor", 0)),
                            "mobil": max(0, now_ch_rekap.get("mobil", 0) - init_ch_rekap.get("mobil", 0)),
                            "bus": max(0, now_ch_rekap.get("bus", 0) - init_ch_rekap.get("bus", 0)),
                            "bus_gol_1": max(0, now_ch_rekap.get("bus_gol_1", 0) - init_ch_rekap.get("bus_gol_1", 0)),
                            "bus_gol_2": max(0, now_ch_rekap.get("bus_gol_2", 0) - init_ch_rekap.get("bus_gol_2", 0)),
                            "sepeda": max(0, now_ch_rekap.get("sepeda", 0) - init_ch_rekap.get("sepeda", 0))
                        }

                prev_late_3a = existing_shift_payload.get("late_sync_3a", {})
                by_slot_3a = dict(prev_late_3a.get("by_slot_masuk") or {})
                if delta_3a_pengunjung > 0:
                    prev_slot_b = by_slot_3a.get(current_slot_str, {})
                    by_slot_3a[current_slot_str] = {
                        "total_pengunjung": prev_slot_b.get("total_pengunjung", 0) + delta_3a_pengunjung,
                        "dewasa": prev_slot_b.get("dewasa", 0) + max(0, new_siang_rekap_3a.get("dewasa", 0) - old_siang_rekap_3a.get("dewasa", 0)),
                        "anak": prev_slot_b.get("anak", 0) + max(0, new_siang_rekap_3a.get("anak", 0) - old_siang_rekap_3a.get("anak", 0)),
                        "pps": prev_slot_b.get("pps", 0) + max(0, new_siang_rekap_3a.get("pps", 0) - old_siang_rekap_3a.get("pps", 0)),
                        "tsa": prev_slot_b.get("tsa", 0) + max(0, new_siang_rekap_3a.get("tsa", 0) - old_siang_rekap_3a.get("tsa", 0)),
                        "motor": prev_slot_b.get("motor", 0) + max(0, new_siang_rekap_3a.get("motor", 0) - old_siang_rekap_3a.get("motor", 0)),
                        "mobil": prev_slot_b.get("mobil", 0) + max(0, new_siang_rekap_3a.get("mobil", 0) - old_siang_rekap_3a.get("mobil", 0)),
                        "bus": prev_slot_b.get("bus", 0) + max(0, new_siang_rekap_3a.get("bus", 0) - old_siang_rekap_3a.get("bus", 0)),
                        "bus_gol_1": 0,
                        "bus_gol_2": 0,
                        "sepeda": prev_slot_b.get("sepeda", 0) + max(0, new_siang_rekap_3a.get("sepeda", 0) - old_siang_rekap_3a.get("sepeda", 0))
                    }
                    print(f"🔄 [LATE-SYNC 3A] Mengoreksi Rekap Siang 3A +{delta_3a_pengunjung} pengunjung dari transaksi siang (<= 16:44:59) yang baru sync.")

                late_sync_3a_payload = {
                    "total_pengunjung": cum_late_3a_pengunjung,
                    "dewasa": max(0, new_siang_rekap_3a.get("dewasa", 0) - init_3a.get("dewasa", 0)),
                    "anak": max(0, new_siang_rekap_3a.get("anak", 0) - init_3a.get("anak", 0)),
                    "pps": max(0, new_siang_rekap_3a.get("pps", 0) - init_3a.get("pps", 0)),
                    "tsa": max(0, new_siang_rekap_3a.get("tsa", 0) - init_3a.get("tsa", 0)),
                    "motor": max(0, new_siang_rekap_3a.get("motor", 0) - init_3a.get("motor", 0)),
                    "mobil": max(0, new_siang_rekap_3a.get("mobil", 0) - init_3a.get("mobil", 0)),
                    "bus": max(0, new_siang_rekap_3a.get("bus", 0) - init_3a.get("bus", 0)),
                    "bus_gol_1": max(0, new_siang_rekap_3a.get("bus_gol_1", 0) - init_3a.get("bus_gol_1", 0)),
                    "bus_gol_2": max(0, new_siang_rekap_3a.get("bus_gol_2", 0) - init_3a.get("bus_gol_2", 0)),
                    "sepeda": max(0, new_siang_rekap_3a.get("sepeda", 0) - init_3a.get("sepeda", 0)),
                    "delta_pengunjung": delta_3a_pengunjung,
                    "delta_dewasa": max(0, new_siang_rekap_3a.get("dewasa", 0) - old_siang_rekap_3a.get("dewasa", 0)),
                    "delta_anak": max(0, new_siang_rekap_3a.get("anak", 0) - old_siang_rekap_3a.get("anak", 0)),
                    "delta_pps": max(0, new_siang_rekap_3a.get("pps", 0) - old_siang_rekap_3a.get("pps", 0)),
                    "delta_tsa": max(0, new_siang_rekap_3a.get("tsa", 0) - old_siang_rekap_3a.get("tsa", 0)),
                    "delta_motor": max(0, new_siang_rekap_3a.get("motor", 0) - old_siang_rekap_3a.get("motor", 0)),
                    "delta_mobil": max(0, new_siang_rekap_3a.get("mobil", 0) - old_siang_rekap_3a.get("mobil", 0)),
                    "delta_bus": max(0, new_siang_rekap_3a.get("bus", 0) - old_siang_rekap_3a.get("bus", 0)),
                    "delta_sepeda": max(0, new_siang_rekap_3a.get("sepeda", 0) - old_siang_rekap_3a.get("sepeda", 0)),
                    "cutoff_time": IWM_NIGHT_CUTOFF,
                    "by_lokasi": by_channel_late_3a,
                    "by_slot_masuk": by_slot_3a
                }

                # Update data 3A pada shift siang dengan hasil query Siang Real (<= 16:44:59)
                if new_siang_rekap_3a.get("total_pengunjung", 0) >= old_siang_rekap_3a.get("total_pengunjung", 0):
                    existing["siang"]["rekap_3a"] = new_siang_rekap_3a
                    existing["siang"]["tickets_3a_visit"] = format_3a_list(data_3a_siang_real)
                    existing["siang"]["tickets_3a_by_channel_visit"] = format_3a_by_channel(data_3a_channels_siang_real)
                    if stsu_channels_siang_real:
                        existing["siang"]["stsu"] = stsu_channels_siang_real

            # ------------------------------------------------------------------
            # B. DETEKSI LATE-SYNC IWM & UPDATE SIANG IWM VIA DETAIL TRANSAKSI POS
            # ------------------------------------------------------------------
            try:
                if data_iwm and len(data_iwm) > 1:
                    detail_pos_res = tarik_data_iwm_detail_pos(driver, wait, str_v, cutoff_time=IWM_NIGHT_CUTOFF)
                    if detail_pos_res and detail_pos_res.get("verified"):
                        verified_iwm_night = True
                        malam_by_lok = detail_pos_res.get("malam_by_lokasi", {})
                        late_sync_iwm_payload = detail_pos_res.get("late_sync", {})

                        # Susun iwm_malam_real_list (murni transaksi >= 16:45:00) dan iwm_siang_corrected_rows (Total Perlokasi - Malam Real)
                        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        header_iwm = ["Timestamp", "Lokasi", "Karcis Anak", "Karcis Dewasa", "Parkir Gol I", "Parkir Gol II", "Parkir Gol III", "Parkir Motor", "Parkir Sepeda", "Total"]
                        iwm_siang_corrected_rows = [header_iwm]
                        iwm_malam_real_rows = [header_iwm]
                        iwm_malam_real_list = []
                        iwm_siang_corrected_list = []

                        for item in iwm_list:
                            lok_name = item.get("lokasi", "")
                            if lok_name.lower().strip() == "total":
                                continue
                            m_lok = malam_by_lok.get(lok_name, {})

                            m_anak = min(item.get("karcis_anak", 0), int(m_lok.get("karcis_anak", 0)))
                            m_dewasa = min(item.get("karcis_dewasa", 0), int(m_lok.get("karcis_dewasa", 0)))
                            m_g1 = min(item.get("parkir_gol_1", 0), int(m_lok.get("parkir_gol_1", 0)))
                            m_g2 = min(item.get("parkir_gol_2", 0), int(m_lok.get("parkir_gol_2", 0)))
                            m_g3 = min(item.get("parkir_gol_3", 0), int(m_lok.get("parkir_gol_3", 0)))
                            m_motor = min(item.get("parkir_motor", 0), int(m_lok.get("parkir_motor", 0)))
                            m_sepeda = min(item.get("parkir_sepeda", 0), int(m_lok.get("parkir_sepeda", 0)))
                            m_tot = m_anak + m_dewasa + m_g1 + m_g2 + m_g3 + m_motor + m_sepeda

                            s_anak = max(0, item.get("karcis_anak", 0) - m_anak)
                            s_dewasa = max(0, item.get("karcis_dewasa", 0) - m_dewasa)
                            s_g1 = max(0, item.get("parkir_gol_1", 0) - m_g1)
                            s_g2 = max(0, item.get("parkir_gol_2", 0) - m_g2)
                            s_g3 = max(0, item.get("parkir_gol_3", 0) - m_g3)
                            s_motor = max(0, item.get("parkir_motor", 0) - m_motor)
                            s_sepeda = max(0, item.get("parkir_sepeda", 0) - m_sepeda)
                            s_tot = s_anak + s_dewasa + s_g1 + s_g2 + s_g3 + s_motor + s_sepeda

                            iwm_malam_real_rows.append([now_str, lok_name, m_anak, m_dewasa, m_g1, m_g2, m_g3, m_motor, m_sepeda, m_tot])
                            iwm_siang_corrected_rows.append([now_str, lok_name, s_anak, s_dewasa, s_g1, s_g2, s_g3, s_motor, s_sepeda, s_tot])

                            iwm_malam_real_list.append({
                                "lokasi": lok_name,
                                "karcis_anak": m_anak, "karcis_dewasa": m_dewasa,
                                "parkir_gol_1": m_g1, "parkir_gol_2": m_g2, "parkir_gol_3": m_g3,
                                "parkir_motor": m_motor, "parkir_sepeda": m_sepeda, "total": m_tot
                            })
                            iwm_siang_corrected_list.append({
                                "lokasi": lok_name,
                                "karcis_anak": s_anak, "karcis_dewasa": s_dewasa,
                                "parkir_gol_1": s_g1, "parkir_gol_2": s_g2, "parkir_gol_3": s_g3,
                                "parkir_motor": s_motor, "parkir_sepeda": s_sepeda, "total": s_tot
                            })

                        # Koreksi otomatis data Shift Siang jika ada data IWM Siang yang baru tersinkronisasi (Late Sync)
                        if "siang" in existing and isinstance(existing["siang"], dict):
                            old_siang_rekap_iwm = existing["siang"].get("rekap_iwm") or {}
                            new_siang_rekap_iwm = hitung_rekap_siang({}, iwm_siang_corrected_rows, str_v)

                            prev_prev_siang_pengunjung = old_siang_rekap_iwm.get("total_pengunjung", 0)
                            delta_late_pengunjung = max(0, new_siang_rekap_iwm.get("total_pengunjung", 0) - prev_prev_siang_pengunjung)

                            if late_sync_iwm_payload is not None:
                                late_sync_iwm_payload["delta_pengunjung"] = delta_late_pengunjung
                                late_sync_iwm_payload["delta_dewasa"] = max(0, new_siang_rekap_iwm.get("dewasa", 0) - old_siang_rekap_iwm.get("dewasa", 0))
                                late_sync_iwm_payload["delta_anak"] = max(0, new_siang_rekap_iwm.get("anak", 0) - old_siang_rekap_iwm.get("anak", 0))
                                late_sync_iwm_payload["delta_pps"] = max(0, new_siang_rekap_iwm.get("pps", 0) - old_siang_rekap_iwm.get("pps", 0))
                                late_sync_iwm_payload["delta_tsa"] = max(0, new_siang_rekap_iwm.get("tsa", 0) - old_siang_rekap_iwm.get("tsa", 0))
                                late_sync_iwm_payload["delta_motor"] = max(0, new_siang_rekap_iwm.get("motor", 0) - old_siang_rekap_iwm.get("motor", 0))
                                late_sync_iwm_payload["delta_mobil"] = max(0, new_siang_rekap_iwm.get("mobil", 0) - old_siang_rekap_iwm.get("mobil", 0))
                                late_sync_iwm_payload["delta_bus"] = max(0, new_siang_rekap_iwm.get("bus", 0) - old_siang_rekap_iwm.get("bus", 0))
                                late_sync_iwm_payload["delta_sepeda"] = max(0, new_siang_rekap_iwm.get("sepeda", 0) - old_siang_rekap_iwm.get("sepeda", 0))

                            if new_siang_rekap_iwm.get("total_pengunjung", 0) >= prev_prev_siang_pengunjung:
                                existing["siang"]["iwm"] = iwm_siang_corrected_list
                                existing["siang"]["rekap_iwm"] = new_siang_rekap_iwm
                                if delta_late_pengunjung > 0:
                                    print(f"🔄 [LATE-SYNC IWM] Mengoreksi Rekap Siang IWM +{delta_late_pengunjung} pengunjung dari transaksi siang (< {IWM_NIGHT_CUTOFF}) yang baru sync.")
            except Exception as e_pos:
                print(f"⚠️ [IWM DETAIL POS] Gagal menarik pembanding Detail Transaksi Pos, menggunakan perhitungan standar: {e_pos}")

            # ------------------------------------------------------------------
            # C. REKALKULASI REKAP GABUNGAN SIANG & MALAM BERBASIS JAM TRANSAKSI REAL
            # ------------------------------------------------------------------
            if "siang" in existing and isinstance(existing["siang"], dict):
                siang_3a_for_rekap = data_3a_channels_siang_real
                if siang_3a_for_rekap is None:
                    siang_3a_ch = existing["siang"].get("tickets_3a_by_channel_visit") or {}
                    siang_3a_for_rekap = {
                        ch_k: [["", it.get("item", ""), it.get("kategori", ""), it.get("qty", 0), it.get("total", 0), it.get("lokasi", "")] for it in ch_items]
                        for ch_k, ch_items in siang_3a_ch.items()
                    }
                siang_iwm_for_rekap = iwm_siang_corrected_rows
                if not verified_iwm_night:
                    siang_iwm_items = existing["siang"].get("iwm") or []
                    siang_iwm_for_rekap = [["Header"]] + [
                        ["", it.get("lokasi", ""), it.get("karcis_anak", 0), it.get("karcis_dewasa", 0), it.get("parkir_gol_1", 0), it.get("parkir_gol_2", 0), it.get("parkir_gol_3", 0), it.get("parkir_motor", 0), it.get("parkir_sepeda", 0), it.get("total", 0)]
                        for it in siang_iwm_items
                    ]
                updated_siang_rekap = hitung_rekap_siang(siang_3a_for_rekap, siang_iwm_for_rekap, str_v)
                orig_siang_rekap = existing["siang"].get("rekap", {})
                if orig_siang_rekap.get("jam_str"):
                    updated_siang_rekap["jam_str"] = orig_siang_rekap["jam_str"]
                if orig_siang_rekap.get("update_str"):
                    updated_siang_rekap["update_str"] = orig_siang_rekap["update_str"]
                existing["siang"]["rekap"] = updated_siang_rekap

            # Hitung Rekap Malam 3A dan IWM secara langsung berdasarkan jam transaksi >= 16:45:00 (tanpa pengurangan buta)
            if verified_3a_night_by_time and data_3a_channels_malam_real is not None:
                rekap_3a_visit = hitung_rekap_siang(data_3a_channels_malam_real, [["Header"]], str_v)
            else:
                rekap_siang_3a = existing.get("siang", {}).get("rekap_3a", {})
                rekap_3a_visit = hitung_rekap_malam(data_3a_channels_visit, [["Header"]], rekap_siang_3a, str_v)

            if verified_iwm_night:
                rekap_iwm_visit = hitung_rekap_siang({}, iwm_malam_real_rows, str_v)
            else:
                rekap_siang_iwm = existing.get("siang", {}).get("rekap_iwm", {})
                rekap_iwm_visit = hitung_rekap_malam({}, data_iwm, rekap_siang_iwm, str_v)

            if verified_3a_night_by_time and verified_iwm_night:
                rekap_visit = hitung_rekap_siang(data_3a_channels_malam_real, iwm_malam_real_rows, str_v)
            else:
                rekap_siang_data_visit = existing.get("siang", {}).get("rekap", {})
                rekap_visit = hitung_rekap_malam(data_3a_channels_visit, data_iwm, rekap_siang_data_visit, str_v)
        else:
            rekap_visit = hitung_rekap_siang(data_3a_channels_visit, data_iwm, str_v)
            rekap_3a_visit = hitung_rekap_siang(data_3a_channels_visit, [["Header"]], str_v)
            rekap_iwm_visit = hitung_rekap_siang({}, data_iwm, str_v)

        # --- MONOTONIC FIX: Prevent data from dropping (e.g. portal resets at 18:00) ---
        old_rekap_visit = existing_shift_payload.get("rekap", {})
        if not (verified_iwm_night or verified_3a_night_by_time) and rekap_visit.get("total_pengunjung", 0) < old_rekap_visit.get("total_pengunjung", 0):
            print(f"⚠️ [MONOTONIC] Data pengunjung turun dari {old_rekap_visit.get('total_pengunjung')} menjadi {rekap_visit.get('total_pengunjung')}. Mempertahankan data lama.")
            jam_str = rekap_visit.get("jam_str")
            update_str = rekap_visit.get("update_str")
            rekap_visit = old_rekap_visit.copy()
            if jam_str: rekap_visit["jam_str"] = jam_str
            if update_str: rekap_visit["update_str"] = update_str
        # ---------------------------------------------------------------------------------
        
        # Build a history snapshot for this run
        new_rekap_for_history = rekap_visit
        existing_history = existing_shift_payload.get("history", [])
        
        if new_rekap_for_history:
            now_ts = datetime.now()
            minute_rounded = (now_ts.minute // 15) * 15
            now_ts = now_ts.replace(minute=minute_rounded, second=0, microsecond=0)
            snap_time = now_ts.strftime("%H:%M")
            snap_ts = now_ts.isoformat()
            
            # Cek apakah sudah ada snapshot untuk slot waktu ini (hindari duplikat)
            existing_slots = {h.get("jam") for h in existing_history}
            if snap_time not in existing_slots:
                snapshot = {
                    "timestamp": snap_ts,
                    "jam": snap_time,
                    "total_pengunjung": new_rekap_for_history.get("total_pengunjung", 0),
                    "anak": new_rekap_for_history.get("anak", 0),
                    "dewasa": new_rekap_for_history.get("dewasa", 0),
                    "pps": new_rekap_for_history.get("pps", 0),
                    "tsa": new_rekap_for_history.get("tsa", 0),
                    "motor": new_rekap_for_history.get("motor", 0),
                    "mobil": new_rekap_for_history.get("mobil", 0),
                    "bus": new_rekap_for_history.get("bus", 0),
                    "sepeda": new_rekap_for_history.get("sepeda", 0),
                    "rekap_3a": rekap_3a_visit,
                    "rekap_iwm": rekap_iwm_visit,
                    "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
                    "iwm": iwm_list
                }
                if tickets_3a_by_channel_malam_real is not None:
                    snapshot["tickets_3a_by_channel_malam_real"] = tickets_3a_by_channel_malam_real
                if late_sync_3a_payload is not None:
                    snapshot["late_sync_3a"] = late_sync_3a_payload
                if iwm_malam_real_list is not None:
                    snapshot["iwm_malam_real"] = iwm_malam_real_list
                if late_sync_iwm_payload is not None:
                    snapshot["late_sync_iwm"] = late_sync_iwm_payload
                existing_history.append(snapshot)
                existing_history.sort(key=lambda x: x.get("jam", "00:00"))
                print(f"📸 [HISTORY] Snapshot pukul {snap_time} ditambahkan. Total snapshot hari ini: {len(existing_history)}")
            else:
                for h in existing_history:
                    if h.get("jam") == snap_time:
                        update_dict = {
                            "timestamp": snap_ts,
                            "total_pengunjung": new_rekap_for_history.get("total_pengunjung", 0),
                            "anak": new_rekap_for_history.get("anak", 0),
                            "dewasa": new_rekap_for_history.get("dewasa", 0),
                            "pps": new_rekap_for_history.get("pps", 0),
                            "tsa": new_rekap_for_history.get("tsa", 0),
                            "motor": new_rekap_for_history.get("motor", 0),
                            "mobil": new_rekap_for_history.get("mobil", 0),
                            "bus": new_rekap_for_history.get("bus", 0),
                            "sepeda": new_rekap_for_history.get("sepeda", 0),
                            "rekap_3a": rekap_3a_visit,
                            "rekap_iwm": rekap_iwm_visit,
                            "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
                            "iwm": iwm_list
                        }
                        if tickets_3a_by_channel_malam_real is not None:
                            update_dict["tickets_3a_by_channel_malam_real"] = tickets_3a_by_channel_malam_real
                        if late_sync_3a_payload is not None:
                            update_dict["late_sync_3a"] = late_sync_3a_payload
                        if iwm_malam_real_list is not None:
                            update_dict["iwm_malam_real"] = iwm_malam_real_list
                        if late_sync_iwm_payload is not None:
                            update_dict["late_sync_iwm"] = late_sync_iwm_payload
                        h.update(update_dict)
                        break
                print(f"🔄 [HISTORY] Snapshot pukul {snap_time} diperbarui.")

        # Prepare payload merging existing data based on mode
        payload = {
            "last_run": datetime.now().isoformat(),
            "rekap": rekap_visit,
            "rekap_3a": rekap_3a_visit,
            "rekap_iwm": rekap_iwm_visit,
            "stsu": stsu_channels_visit,
            "tickets_3a_visit": tickets_3a_list_visit,
            "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
            "iwm": iwm_list,
            "history": existing_history
        }
        if tickets_3a_by_channel_malam_real is not None:
            payload["tickets_3a_by_channel_malam_real"] = tickets_3a_by_channel_malam_real
        if late_sync_3a_payload is not None:
            payload["late_sync_3a"] = late_sync_3a_payload
        if iwm_malam_real_list is not None:
            payload["iwm_malam_real"] = iwm_malam_real_list
        if late_sync_iwm_payload is not None:
            payload["late_sync_iwm"] = late_sync_iwm_payload
        
        existing["date"] = str_v
        if shift == "malam":
            existing["malam"] = payload
        else:
            existing["siang"] = payload
            if "malam" in existing:
                del existing["malam"]
                
        print(f"✅ [LOKAL] Rekap Shift {shift.upper()} berhasil diproses. Pengunjung: {payload['rekap'].get('total_pengunjung', 0)}")

        # KIRIM LAPORAN INFOGRAFIS KE EMAIL PADA JAM 10:00, 12:00, DAN 16:30 (DITULIS 17:00 WIB)
        try:
            force_email = any(a.lower().strip() in ("email", "test_email") for a in sys.argv[1:])
            rekap_siang_for_email = existing.get("siang", {}).get("rekap") or rekap_visit
            render_dan_kirim_email_laporan(
                driver, db, str_v, current_slot_str, rekap_siang_for_email, existing, force_send=force_email
            )
        except Exception as e_rep:
            print(f"⚠️ [EMAIL REPORT] Error saat memproses laporan email: {e_rep}")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
            
        print(f"✅ [LOKAL] Data Shift {shift.upper()} berhasil disimpan di {file_path}!")
        
        # CEK APAKAH DATA TETAP 0 SELAMA 2 JAM (8 SNAPSHOT TERAKHIR)
        if len(existing_history) >= 8:
            last_8 = existing_history[-8:]
            totals = [h.get("total_pengunjung", 0) for h in last_8]
            if all(t == 0 for t in totals):
                existing["stop_for_today"] = True
                print("🛑 [AUTO-STOP] Ragunan tutup (Data tetap 0 selama 2 jam). Scraper dihentikan untuk hari ini!")
            # Juga cek apakah data stabil (tidak berubah) di malam hari
            elif shift == "malam" and all(t == totals[0] for t in totals):
                existing["stop_for_today"] = True
                print("🛑 [AUTO-STOP] Data stabil (tidak berubah) selama 2 jam terakhir di malam hari. Scraper dihentikan untuk hari ini!")

        # PUSH TO FIREBASE
        if db:
            try:
                print("☁️ [FIREBASE] Mengunggah data ke Cloud Firestore...")
                # We save the entire 'existing' dict which contains both 'siang', 'malam' and 'date'
                db.collection("daily_records").document(str_v).set(existing)
                print(f"✅ [FIREBASE] Data tanggal {str_v} berhasil diunggah ke Cloud!")
            except Exception as e:
                print(f"❌ [FIREBASE] Gagal mengunggah data: {e}")

        print("\n🎉 SEMUA PROSES BERHASIL!")
        
    except Exception as e:
        print(f"\n❌ ERROR KRITIS: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
