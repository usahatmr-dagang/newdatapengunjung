import time
import re
import json
import os
import sys
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

# Kredensial
A3_EMAIL, A3_PASS = "yaninfotmr@gmail.com", "Y4nInfo_TMR2024!"
IWM_USER, IWM_PASS = "admintmriwm", "tmriwm2015"

def clean_number(text: str) -> int:
    text = (text or "").strip()
    return int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else 0

# ==========================================
# 2. FUNGSI EKSTRAK DATA
# ==========================================
def tarik_data_3a(driver, wait, target_date_str, query_by='paid', mode='full'):
    print(f"\n🚀 [3A] Membuka web 3A (Query by: {query_by.upper()})...")
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
    val_order = f"{h_min_7} 00:00:00 to {h_plus_1} 23:59:59"
    
    if mode == "pendapatan_online_saja":
        channels = ["MERCHANT_PAGE"]
    else:
        channels = ["GATE", "TVM", "MERCHANT_PAGE", "MPOS"]
    hasil_channels = {}
    
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
        
        rows = driver.execute_script("""
            return Array.from(document.querySelectorAll('#summary-ticket-table tbody tr'))
                        .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
        """)
        
        now = target_visit.strftime("%Y-%m-%d %H:%M:%S")
        channel_data = []
        for r in rows:
            if len(r) >= 4 and r[0] and "Tidak ada data" not in r[0] and "TOTAL" not in r[0].upper():
                channel_data.append([now, r[0], r[1], clean_number(r[2]), clean_number(r[3])])
        hasil_channels[channel] = channel_data
        print(f"✅ [3A] Channel {channel}: Berhasil tarik {len(channel_data)} data.")
    
    # Agregasikan data dari seluruh channel
    aggregated = {}
    for ch, items in hasil_channels.items():
        for r in items:
            key = (r[1], r[2]) # (Item/Merchant, Kategori/TicketName)
            if key not in aggregated:
                aggregated[key] = {"qty": 0, "total": 0, "timestamp": r[0]}
            aggregated[key]["qty"] += r[3]
            aggregated[key]["total"] += r[4]
            
    header = ["Timestamp", "Item", "Kategori", "Qty", "Total"]
    data_3a_aggregated = [header]
    
    for (item_name, kategori), val in aggregated.items():
        data_3a_aggregated.append([val["timestamp"], item_name, kategori, val["qty"], val["total"]])
        
    print(f"✅ [3A] Agregasi Selesai. Total {len(data_3a_aggregated)-1} jenis tiket teragregasi.")
    return data_3a_aggregated, hasil_channels

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
            kategori = r[1].upper() + " " + r[2].upper()
            qty = r[3]
            
            # Accumulate PPS (Pusat Primata Schmutzer) tickets from 3A
            if "PUSAT PRIMATA" in kategori or "SCHMUTZER" in kategori:
                online_pps += qty
                continue
            
            # Accumulate TSA (Taman Satwa Anak) tickets from 3A
            if "TAMAN SATWA" in kategori or ("TSA" in kategori and "KENDARAAN" not in kategori):
                online_tsa += qty
                continue
                
            if "DEWASA" in kategori:
                online_dewasa += qty
            elif "ANAK" in kategori:
                online_anak += qty
            # Kendaraan 3A menggunakan format: "Kendaraan Gol I", "Gol II", "Gol III"
            # Gol I  = Bus besar, truk besar, mobil box besar
            # Gol II = Bus kecil, truk kecil, mobil box kecil, pick up besar
            # Gol III = Mobil sedan, mini bus/sejenis, pick up kecil
            elif "GOL I" in kategori and "GOL II" not in kategori and "GOL III" not in kategori:
                online_bus_gol_1 += qty
            elif "GOL II" in kategori and "GOL III" not in kategori:
                online_bus_gol_2 += qty
            elif "GOL III" in kategori or "MOBIL SEDAN" in kategori or "MINI BUS" in kategori:
                online_mobil += qty
            elif "SEPEDA MOTOR" in kategori or ("MOTOR" in kategori and "GOL" not in kategori):
                online_motor += qty
            elif "SEPEDA" in kategori and "MOTOR" not in kategori:
                online_sepeda += qty
            # Fallback for older/alternative formats
            elif "BUS BESAR" in kategori or "TRUK BESAR" in kategori:
                online_bus_gol_1 += qty
            elif "BUS KECIL" in kategori or "TRUK KECIL" in kategori or "PICK UP BESAR" in kategori:
                online_bus_gol_2 += qty
            elif "MOBIL" in kategori:
                online_mobil += qty
            elif "MOTOR" in kategori:
                online_motor += qty
            elif "SEPEDA" in kategori:
                online_sepeda += qty
                
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
# 4. PROGRAM UTAMA (MAIN)
# ==========================================
def main():
    # 1. PARSE ARGUMENTS
    shift = "siang"
    target_date_str = None
    mode = "pengunjung"
    
    # Check automatically based on local time if no shift specified
    current_dt = datetime.now()
    
    # Tentukan Shift berdasarkan hari dan jam
    # Hari: 0=Senin, 1=Selasa, ..., 4=Jumat, 5=Sabtu, 6=Minggu
    weekday = current_dt.weekday()
    hour = current_dt.hour
    minute = current_dt.minute
    
    shift = "siang"
    if weekday >= 5: # Sabtu & Minggu (Weekend)
        if hour > 17 or (hour == 17 and minute >= 30):
            shift = "malam"
    else: # Selasa - Jumat (Weekday)
        if hour > 16 or (hour == 16 and minute >= 45):
            shift = "malam"
        
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
        # 1. Query by visit date (Data Pengunjung)
        data_3a_visit, data_3a_channels_visit = tarik_data_3a(driver, wait, str_v, query_by='visit', mode=mode)
            
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

        # PREPARE FORMATTED LISTS FOR STORAGE
        tickets_3a_list_visit = []
        if data_3a_visit:
            for r in data_3a_visit:
                if len(r) >= 5:
                    tickets_3a_list_visit.append({
                        "item": r[1],
                        "kategori": r[2],
                        "qty": clean_number(str(r[3])),
                        "total": clean_number(str(r[4]))
                    })
        
        tickets_3a_by_channel_visit = {}
        if data_3a_channels_visit:
            for ch, rows in data_3a_channels_visit.items():
                ch_list = []
                for r in rows:
                    if len(r) >= 5:
                        ch_list.append({
                            "item": r[1],
                            "kategori": r[2],
                            "qty": clean_number(str(r[3])),
                            "total": clean_number(str(r[4]))
                        })
                tickets_3a_by_channel_visit[ch] = ch_list

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
        if shift == "malam":
            rekap_siang_data_visit = existing.get("siang", {}).get("rekap", {})
            rekap_visit = hitung_rekap_malam(data_3a_channels_visit, data_iwm, rekap_siang_data_visit, str_v)
        else:
            rekap_visit = hitung_rekap_siang(data_3a_channels_visit, data_iwm, str_v)

        # --- MONOTONIC FIX: Prevent data from dropping (e.g. portal resets at 18:00) ---
        old_rekap_visit = existing_shift_payload.get("rekap", {})
        if rekap_visit.get("total_pengunjung", 0) < old_rekap_visit.get("total_pengunjung", 0):
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
                    "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
                    "iwm": iwm_list
                }
                existing_history.append(snapshot)
                existing_history.sort(key=lambda x: x.get("jam", "00:00"))
                print(f"📸 [HISTORY] Snapshot pukul {snap_time} ditambahkan. Total snapshot hari ini: {len(existing_history)}")
            else:
                for h in existing_history:
                    if h.get("jam") == snap_time:
                        h.update({
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
                            "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
                            "iwm": iwm_list
                        })
                        break
                print(f"🔄 [HISTORY] Snapshot pukul {snap_time} diperbarui.")

        # Prepare payload merging existing data based on mode
        payload = {
            "last_run": datetime.now().isoformat(),
            "rekap": rekap_visit,
            "tickets_3a_visit": tickets_3a_list_visit,
            "tickets_3a_by_channel_visit": tickets_3a_by_channel_visit,
            "iwm": iwm_list,
            "history": existing_history
        }
        
        existing["date"] = str_v
        if shift == "malam":
            existing["malam"] = payload
        else:
            existing["siang"] = payload
            if "malam" in existing:
                del existing["malam"]
                
        print(f"✅ [LOKAL] Rekap Shift {shift.upper()} berhasil diproses. Pengunjung: {payload['rekap'].get('total_pengunjung', 0)}")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
            
        print(f"✅ [LOKAL] Data Shift {shift.upper()} berhasil disimpan di {file_path}!")
        
        # CEK APAKAH HARI INI TUTUP (TIDAK ADA PENGUNJUNG SAMPAI JAM 09:00)
        current_hour = datetime.now().hour
        if shift == "siang" and current_hour >= 9 and payload["rekap"].get("total_pengunjung", 0) == 0:
            existing["stop_for_today"] = True
            print("🛑 [AUTO-STOP] Ragunan tutup hari ini (Data 0 hingga pukul 09:00 WIB). Scraper dihentikan untuk hari ini!")

        # CEK APAKAH DATA STABIL 2 JAM (8 SNAPSHOT TERAKHIR SAMA)
        # Hanya aktifkan ini jika shift malam agar tidak mati otomatis di pagi hari saat belum ada pengunjung
        if shift == "malam" and len(existing_history) >= 8:
            last_8 = existing_history[-8:]
            totals = [h.get("total_pengunjung", 0) for h in last_8]
            # Jika 8 snapshot terakhir total pengunjungnya sama persis
            if all(t == totals[0] for t in totals):
                existing["stop_for_today"] = True
                print("🛑 [AUTO-STOP] Data stabil (tidak berubah) selama 2 jam terakhir. Scraper dihentikan untuk hari ini!")

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
