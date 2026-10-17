import re
import time
import os
import sys
import socket
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==============================================================================
# INSTRUKSI PENGGUNAAN & COMPILE:
# 1. Pastikan install: pip install pyinstaller flask flask-cors selenium
# 2. Perintah Build EXE: 
#    python -m PyInstaller --onefile --name "Server_Robot_3A_V1.6" --hidden-import="selenium.webdriver" --hidden-import="selenium.webdriver.chrome.webdriver" --hidden-import="flask" --hidden-import="flask_cors" api_rekon_3a.py
# ==============================================================================

app = Flask(__name__)
CORS(app) # Mengizinkan Tab Android (React) mengakses API ini

A3_LOGIN_URL = "https://3a-cms.ainosi.id/login"
A3_TRANS_URL = "https://3a-cms.ainosi.id/pwa-order-v2"
A3_EMAIL, A3_PASS = "yaninfotmr@gmail.com", "Y4nInfo_TMR2024!"

CHROME_PROFILE_PATH = r"C:\SeleniumChromeProfile"
if not os.path.exists(CHROME_PROFILE_PATH):
    try:
        os.makedirs(CHROME_PROFILE_PATH)
    except:
        if getattr(sys, 'frozen', False):
            app_path = os.path.dirname(sys.executable)
        else:
            app_path = os.path.dirname(os.path.abspath(__file__))
        CHROME_PROFILE_PATH = os.path.join(app_path, "ChromeProfile")
        os.makedirs(CHROME_PROFILE_PATH, exist_ok=True)

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
        print(f"⚠️ [PERINGATAN API] Ada perubahan nama header tabel: {thead}")
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
    # Menggunakan string untuk key (str(i)) agar valid menjadi format JSON di React
    stsu = {str(i): {"qty": 0, "nominal": 0} for i in range(1, 22)}
    tgl = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
    is_weekend = tgl.weekday() >= 5 

    for item in data_tiket:
        info_kiri = str(item['left_info']).upper()
        tiket = str(item['ticket_name']).upper()
        qty = int(item['qty'])
        nominal = int(item['nominal'])
        gabungan = info_kiri + " " + tiket

        # 1. KENDARAAN / PARKIR (PERBAIKAN: Pisahkan dengan tegas GOL I, GOL II, dan GOL III)
        if "KENDARAAN" in gabungan or "PARKIR" in gabungan or "MOTOR" in tiket or "MOBIL" in tiket or "BUS" in tiket or "SEPEDA" in tiket:
            idx = 0
            # Cek berdasarkan kode Golongan secara spesifik terlebih dahulu (Urutan III -> II -> I agar tidak tumpang tindih)
            if re.search(r'\bGOL(?:ONGAN)?\s*III\b', tiket):
                idx = 19
            elif re.search(r'\bGOL(?:ONGAN)?\s*II\b', tiket):
                idx = 18
            elif re.search(r'\bGOL(?:ONGAN)?\s*I\b', tiket):
                idx = 17
            # Jika tidak ada tulisan Golongan I/II/III, cek berdasarkan kata kunci jenis kendaraan
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

def proses_tarik_data(tanggal_rekon_str):
    options = Options()
    options.add_argument("--headless=new") # SEMBUNYIKAN BROWSER DI BACKGROUND
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_PATH}")
    options.add_argument("--ignore-certificate-errors")
    options.set_capability("acceptInsecureCerts", True)
    
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 30)
    
    try:
        driver.get(A3_LOGIN_URL)
        try:
            email_input = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.NAME, "email")))
            email_input.send_keys(A3_EMAIL)
            driver.find_element(By.NAME, "password").send_keys(A3_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Welcome')]")))
        except:
            pass
        
        driver.get(A3_TRANS_URL)
        wait.until(EC.presence_of_element_located((By.ID, "filter-form")))

        tgl_obj = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
        h_min_7 = (tgl_obj - timedelta(days=7)).strftime("%Y-%m-%d")
        h_plus_1 = (tgl_obj + timedelta(days=1)).strftime("%Y-%m-%d")
        val_order = f"{h_min_7} 00:00:00 to {h_plus_1} 23:59:59"
        
        channels = ["GATE", "TVM", "MERCHANT_PAGE", "MPOS"]
        all_channels_data = {}
        
        for channel in channels:
            print(f"🔄 [API] Memproses Channel: {channel} ...")
            driver.execute_script(f"""
                document.getElementById('tanggal_order').value = '{val_order}';
                document.getElementById('tanggal_paid').value = '{tanggal_rekon_str}';
                document.getElementById('tanggal_visit').value = '';
                $('#status').val('paid').trigger('change');
                $('#channel_type').val('{channel}').trigger('change');
                $('#merchant').val('').trigger('change');
                $('#partner').val('').trigger('change');
                $('#filter-form').submit();
            """)
            
            def SemuaTabelSelesai(_drv):
                try:
                    ids = ["orders-table_processing", "summary-ticket-table_processing"]
                    for proc_id in ids:
                        el = _drv.find_elements(By.ID, proc_id)
                        if el and "none" not in el[0].value_of_css_property("display").lower():
                            return False
                    return True
                except:
                    return False

            WebDriverWait(driver, 60).until(SemuaTabelSelesai)
            time.sleep(2) 
            
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
            
            data_channel = []
            for cols in tbody_list:
                if len(cols) >= min_cols_needed:
                    first_col_text = cols[0] if cols else ""
                    if not first_col_text or "tidak ada data" in first_col_text.lower() or "total" in first_col_text.lower():
                        continue
                    
                    left_info_str = " | ".join([cols[i] for i in left_indices if i < len(cols)])
                    ticket_name_str = cols[idx_ticket]
                    qty_val = clean_number(cols[idx_qty])
                    nominal_val = clean_number(cols[idx_nominal])
                    
                    if qty_val > 0 or nominal_val > 0:
                        data_channel.append({
                            "left_info": left_info_str,
                            "ticket_name": ticket_name_str,
                            "qty": qty_val,
                            "nominal": nominal_val
                        })
            
            all_channels_data[channel] = petakan_ke_stsu(data_channel, tanggal_rekon_str)

        return all_channels_data
    finally:
        driver.quit()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

# === ENDPOINT API YANG DIPANGGIL OLEH APLIKASI REACT ===
@app.route('/api/tarik_rekon_3a', methods=['GET'])
def api_tarik_3a():
    tanggal = request.args.get('tanggal')
    if not tanggal:
        return jsonify({"status": "error", "message": "Tanggal wajib diisi"}), 400
    
    try:
        print(f"\n📡 Request masuk dari Web React untuk tanggal: {tanggal}")
        data = proses_tarik_data(tanggal)
        print("✅ Data berhasil ditarik dan dikirim ke Web React!")
        return jsonify({
            "status": "success",
            "tanggal": tanggal,
            "rekon_data": data
        })
    except Exception as e:
        print(f"❌ Terjadi kesalahan: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("\n" + "="*60)
    print(" 🤖 SERVER API ROBOT 3A V1.6 TELAH MENYALA AKTIF!")
    print("="*60)
    print(f" 👉 Buka Aplikasi React di Tablet Anda.")
    print(f" 👉 Masukkan IP Address ini di Menu Master/Settings:")
    print(f"    {local_ip}")
    print("="*60)
    print(" (Biarkan layar hitam ini terbuka selama jam kerja)\n")
    
    app.run(host='0.0.0.0', port=5000)
