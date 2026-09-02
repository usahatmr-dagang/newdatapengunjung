import re
import time
import os
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
# 1. Pastikan install: pip install flask flask-cors selenium
# 2. Perintah Build EXE: 
#    python -m PyInstaller --onefile --name "Server_Robot_3A_V1.5" --hidden-import="flask" --hidden-import="flask_cors" --collect-all selenium api_rekon_3a.py
# ==============================================================================

app = Flask(__name__)
CORS(app) # Mengizinkan Tab Android (React) mengakses API ini

A3_LOGIN_URL = "https://3a-cms.ainosi.id/login"
A3_TRANS_URL = "https://3a-cms.ainosi.id/pwa-order-v2"
A3_EMAIL, A3_PASS = "yaninfotmr@gmail.com", "Y4nInfo_TMR2024!"

CHROME_PROFILE_PATH = r"C:\SeleniumChromeProfile"
if not os.path.exists(CHROME_PROFILE_PATH):
    try: os.makedirs(CHROME_PROFILE_PATH)
    except: pass

def clean_number(text: str) -> int:
    text = (text or "").strip()
    return int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else 0

# ==========================================
# LOGIKA PEMETAAN STSU (UPDATE V1.5)
# ==========================================
def petakan_ke_stsu(data_tiket, tanggal_rekon_str):
    # Menggunakan string untuk key (str(i)) agar valid menjadi format JSON di React
    stsu = {str(i): {"qty": 0, "nominal": 0} for i in range(1, 22)}
    tgl = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
    is_weekend = tgl.weekday() >= 5 

    for item in data_tiket:
        merchant = str(item['merchant']).upper()
        tiket = str(item['ticket_name']).upper()
        qty = int(item['qty'])
        nominal = int(item['nominal'])
        gabungan = merchant + " " + tiket

        # 1. KENDARAAN / PARKIR
        if "KENDARAAN" in merchant or "PARKIR" in merchant or "MOTOR" in tiket or "MOBIL" in tiket or "BUS" in tiket or "SEPEDA" in tiket:
            idx = 0
            if "BUS BESAR" in tiket or "TRUK BESAR" in tiket: idx = 17
            elif "BUS KECIL" in tiket or "TRUK KECIL" in tiket or "PICK UP BESAR" in tiket: idx = 18
            elif "MOBIL" in tiket or "MINIBUS" in tiket or "SEDAN" in tiket or "PICK UP KECIL" in tiket: idx = 19
            elif "MOTOR" in tiket or "RODA TIGA" in tiket: idx = 20
            elif "SEPEDA" in tiket and "MOTOR" not in tiket: idx = 21
            
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

        # 3. PUSAT PRIMATA SCHMUTZER (DIPERBAIKI SEPERTI V1.4)
        if "PRIMATA" in merchant or "SCHMUTZER" in merchant or "SCHMUTZER" in tiket:
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
    options.add_argument("--headless=new") # KITA SEMBUNYIKAN BROWSERNYA AGAR RAPI DI BACKGROUND
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_PATH}")
    options.add_argument("--ignore-certificate-errors")
    options.set_capability("acceptInsecureCerts", True)
    
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 30)
    
    driver.get(A3_LOGIN_URL)
    try:
        email_input = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.NAME, "email")))
        email_input.send_keys(A3_EMAIL)
        driver.find_element(By.NAME, "password").send_keys(A3_PASS)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Welcome')]")))
    except: pass
    
    driver.get(A3_TRANS_URL)
    wait.until(EC.presence_of_element_located((By.ID, "filter-form")))

    tgl_obj = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
    h_min_7 = (tgl_obj - timedelta(days=7)).strftime("%Y-%m-%d")
    h_plus_1 = (tgl_obj + timedelta(days=1)).strftime("%Y-%m-%d")
    val_order = f"{h_min_7} 00:00:00 to {h_plus_1} 23:59:59"
    
    # PERUBAHAN: Menambahkan "MPOS" ke dalam daftar saluran
    channels = ["GATE", "TVM", "MERCHANT_PAGE", "MPOS"]
    all_channels_data = {}
    
    for channel in channels:
        driver.execute_script(f"""
            document.getElementById('tanggal_order').value = '{val_order}';
            document.getElementById('tanggal_paid').value = '';
            document.getElementById('tanggal_visit').value = '{tanggal_rekon_str}';
            $('#status').val('paid').trigger('change');
            $('#channel_type').val('{channel}').trigger('change');
            $('#merchant').val('').trigger('change');
            $('#partner').val('').trigger('change');
            $('#filter-form').submit();
        """)
        
        def datatable_done(_drv):
            try:
                el = _drv.find_elements(By.ID, "orders-table_processing")
                if not el: return True
                return "none" in el[0].value_of_css_property("display").lower()
            except: return False

        WebDriverWait(driver, 60).until(datatable_done)
        time.sleep(2) 
        driver.execute_script("let t = document.getElementById('toggleZero'); if(t && !t.checked) t.click();")
        time.sleep(1.5)
        
        raw_table_data = driver.execute_script("""
            let tbody = Array.from(document.querySelectorAll('#summary-ticket-table tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
            return tbody;
        """)
        
        data_channel = []
        for cols in raw_table_data:
            if len(cols) >= 4 and cols[0] and "Tidak ada data" not in cols[0] and "TOTAL" not in cols[0].upper():
                data_channel.append({
                    "merchant": cols[0], "ticket_name": cols[1],
                    "qty": clean_number(cols[2]), "nominal": clean_number(cols[3])
                })
        
        all_channels_data[channel] = petakan_ke_stsu(data_channel, tanggal_rekon_str)

    driver.quit()
    return all_channels_data

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
    print(" 🤖 SERVER API ROBOT 3A TELAH MENYALA AKTIF!")
    print("="*60)
    print(f" 👉 Buka Aplikasi React di Tablet Anda.")
    print(f" 👉 Masukkan IP Address ini di Menu Master/Settings:")
    print(f"    {local_ip}")
    print("="*60)
    print(" (Biarkan layar hitam ini terbuka selama jam kerja)\n")
    
    # Server berjalan di semua antarmuka (0.0.0.0) agar bisa diakses dari Tab Android
    app.run(host='0.0.0.0', port=5000)
