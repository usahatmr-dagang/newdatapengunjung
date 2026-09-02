import re
import time
import os
import sys
import shutil
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from fpdf import FPDF

# Import untuk Date Picker
try:
    from tkcalendar import Calendar
except ImportError:
    print("Library 'tkcalendar' belum terinstall.")
    print("Silakan install dengan: pip install tkcalendar")
    sys.exit()

# ==============================================================================
# INSTRUKSI UNTUK MEMBUAT EXE (Gunakan di Terminal/CMD):
# 1. Install Library: pip install pyinstaller selenium fpdf tkcalendar
# 2. Perintah Build (Paling Aman): 
#    python -m PyInstaller --onefile --name "Bot_Rekon_3A_V1.4" --hidden-import="selenium.webdriver" --hidden-import="selenium.webdriver.chrome.webdriver" bot_rekon_3a_1.4.py
# ==============================================================================

# ==========================================
# 1. KONFIGURASI
# ==========================================
A3_LOGIN_URL = "https://3a-cms.ainosi.id/login"
A3_TRANS_URL = "https://3a-cms.ainosi.id/pwa-order-v2"
A3_EMAIL, A3_PASS = "yaninfotmr@gmail.com", "Y4nInfo_TMR2024!"

CHROME_PROFILE_PATH = r"C:\SeleniumChromeProfile"
if not os.path.exists(CHROME_PROFILE_PATH):
    try:
        os.makedirs(CHROME_PROFILE_PATH)
    except:
        CHROME_PROFILE_PATH = os.path.join(os.getcwd(), "ChromeProfile")
        os.makedirs(CHROME_PROFILE_PATH, exist_ok=True)

def clean_number(text: str) -> int:
    text = (text or "").strip()
    return int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else 0

# ==========================================
# 2. LOGIKA PEMETAAN STSU & FUNGSI TERBILANG
# ==========================================
def petakan_ke_stsu(data_tiket, tanggal_rekon_str):
    stsu = {i: {"qty": 0, "nominal": 0} for i in range(1, 22)}
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
                stsu[idx]["qty"] += qty
                stsu[idx]["nominal"] += nominal
            continue 

        # 2. WAHANA (Kuda, Unta, Gajah, TSA)
        idx = 0
        if "KUDA" in gabungan: idx = 5
        elif "UNTA" in gabungan: idx = 6
        elif "GAJAH" in gabungan: idx = 7
        elif "TAMAN SATWA ANAK" in gabungan or "TSA" in gabungan: idx = 8
        
        if idx > 0:
            stsu[idx]["qty"] += qty
            stsu[idx]["nominal"] += nominal
            continue

        # 3. PUSAT PRIMATA SCHMUTZER (DIPERBAIKI)
        if "PRIMATA" in merchant or "SCHMUTZER" in merchant or "SCHMUTZER" in tiket:
            # Perbaikan: Tambah kata 'HOLIDAY' agar tiket libur nasional tidak bocor ke Hari Biasa
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
                stsu[idx]["qty"] += qty
                stsu[idx]["nominal"] += nominal
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
            stsu[idx]["qty"] += qty
            stsu[idx]["nominal"] += nominal

    return stsu

def terbilang(angka):
    angka = int(angka)
    huruf = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"]
    if angka < 12: return huruf[angka]
    elif angka < 20: return terbilang(angka - 10) + " belas"
    elif angka < 100: return terbilang(angka // 10) + " puluh " + terbilang(angka % 10)
    elif angka < 200: return "seratus " + terbilang(angka - 100)
    elif angka < 1000: return terbilang(angka // 100) + " ratus " + terbilang(angka % 100)
    elif angka < 2000: return "seribu " + terbilang(angka - 1000)
    elif angka < 1000000: return terbilang(angka // 1000) + " ribu " + terbilang(angka % 1000)
    elif angka < 1000000000: return terbilang(angka // 1000000) + " juta " + terbilang(angka % 1000000)
    elif angka < 1000000000000: return terbilang(angka // 1000000000) + " miliar " + terbilang(angka % 1000000000)
    return ""

def generate_terbilang(nominal):
    if nominal == 0: return "Nol rupiah.-"
    text = terbilang(nominal).strip()
    text = text.capitalize() + " rupiah.-"
    return re.sub(' +', ' ', text)

# ==========================================
# 3. GENERATOR PDF (NATIVE TABLE - NO SCREENSHOT)
# ==========================================
def cetak_baris_stsu(pdf, no, uraian, nominal):
    pdf.set_font('Arial', '', 10)
    pdf.set_x(15)
    pdf.cell(15, 5, f"{no}.", ln=0, align='C')
    pdf.cell(120, 5, uraian, ln=0, align='L')
    pdf.cell(10, 5, 'Rp.', ln=0, align='L')
    val = '-' if nominal == 0 else f"{nominal:,.0f}".replace(",", ".")
    pdf.cell(35, 5, val, ln=1, align='R')

def buat_pdf_stsu(channel, tanggal_rekon_str, stsu_data, raw_table_data, folder_path):
    total_nominal = sum(item["nominal"] for item in stsu_data.values())
    tgl_obj = datetime.strptime(tanggal_rekon_str, "%Y-%m-%d")
    bulan_indo = {1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'}
    hari_dict = {0: 'SENIN', 1: 'SELASA', 2: 'RABU', 3: 'KAMIS', 4: 'JUMAT', 5: 'SABTU', 6: 'MINGGU'}
    
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    
    pdf.set_font("Arial", '', 11)
    
    if channel == "MERCHANT_PAGE": channel_display = "TIKET ONLINE"
    elif channel == "TVM": channel_display = "TICKET VENDING MACHINE"
    elif channel == "GATE": channel_display = "NEW GATE"
    else: channel_display = channel.upper()
    
    pdf.set_xy(15, 15)
    pdf.cell(90, 5, "BLUD TAMAN MARGASATWA", ln=0, align='L')
    pdf.cell(90, 5, "SURAT TANDA SETOR UANG", ln=1, align='R')
    pdf.set_xy(15, 20)
    pdf.cell(90, 5, "RAGUNAN PROV.DKI JAKARTA", ln=0, align='L')
    pdf.cell(90, 5, "DASAR HASIL RETRIBUSI", ln=1, align='R')
    pdf.set_xy(15, 25)
    pdf.cell(90, 5, "", ln=0, align='L')
    pdf.cell(90, 5, channel_display, ln=1, align='R')
    
    pdf.set_y(33)
    no_urut_stsu = f"      /{tgl_obj.strftime('%d')}/{tgl_obj.strftime('%m')}/SU/{tgl_obj.strftime('%Y')}"
    pdf.set_font("Arial", '', 11)
    pdf.set_x(15)
    pdf.cell(10, 5, "No", ln=0)
    pdf.cell(5, 5, ":", ln=0)
    pdf.cell(45, 5, no_urut_stsu, ln=1)
    
    pdf.ln(1) # Spasi yang lebih rapat
    pdf.set_font("Arial", '', 10)
    dashed_line = "-" * 163 
    
    # PERBAIKAN: Jarak garis HEADER didekatkan
    pdf.set_x(15)
    pdf.cell(180, 3, dashed_line, ln=1, align='C') 
    pdf.set_x(15)
    pdf.cell(15, 4, "NO", ln=0, align='C')         
    pdf.cell(120, 4, "URAIAN", ln=0, align='C')
    pdf.cell(45, 4, "JUMLAH", ln=1, align='C')
    pdf.set_x(15)
    pdf.cell(180, 3, dashed_line, ln=1, align='C') 
    pdf.ln(1) 
    
    pdf.set_font("Arial", 'B', 10)
    pdf.set_x(15)
    pdf.cell(180, 6, "4.1.02 Pendapatan Retribusi Daerah", ln=1)
    pdf.set_x(15)
    pdf.cell(180, 6, "4.1.02.02.009.00001 Retribusi Pelayanan Tempat Rekreasi, Pariwisata, dan Olahraga", ln=1)
    
    items_tmr = [
        "Dewasa", "Anak", "Rombongan Dewasa Reduksi 25%", "Rombongan Anak Reduksi 25%",
        "Kuda Tunggang", "Unta Tunggang", "Gajah Tunggang", "Taman Satwa Anak",
        "Hari Selasa-Jum'at Pst Primata-Dewasa", "Hari Selasa-Jum'at Pst Primata-Anak",
        "Hari Selasa-Jum'at Pst Primata-Romb Dws Reduksi 25%", "Hari Selasa-Jum'at Pst Primata-Romb Anak Reduksi 25%",
        "Hari Sabtu-Minggu/Besar Pst Primata-Dewasa", "Hari Sabtu-Minggu/Besar Pst Primata-Anak",
        "Hari Sabtu-Minggu/Besar Pst Primata-Romb Anak Reduksi 25%", "Hari Sabtu-Minggu/Besar Pst Primata-Romb Dws Reduksi 25%"
    ]
    for i in range(1, 17): cetak_baris_stsu(pdf, i, items_tmr[i-1], stsu_data[i]['nominal'])
        
    pdf.set_font("Arial", 'B', 10)
    pdf.set_x(15)
    pdf.cell(180, 6, "4.1.02.02.014.00001 Retribusi Penyediaan Tempat Khusus Parkir Di Luar Badan Jalan", ln=1)
    
    items_parkir = [
        "Golongan I (Bus Besar, Truk Besar, dan Mobil Box Besar)",
        "Golongan II (Bus Kecil, Truk Kecil, Mobil Box Kecil dan Pick Up Besar)",
        "Golongan III (Mobil, Sedan Minibus/Sejenis, Pick up Kecil)",
        "Sepeda Motor dan Kendaraan Roda Tiga",
        "Sepeda"
    ]
    for i in range(17, 22): cetak_baris_stsu(pdf, i, items_parkir[i-17], stsu_data[i]['nominal'])
        
    # PERBAIKAN: Jarak garis FOOTER didekatkan
    pdf.ln(1)
    pdf.set_font("Arial", '', 10)
    pdf.set_x(15)
    pdf.cell(180, 3, dashed_line, ln=1, align='C') 
    pdf.set_x(15)
    pdf.cell(15, 4, "", ln=0)
    pdf.cell(120, 4, "JUMLAH", ln=0, align='C')    
    pdf.cell(10, 4, "Rp.", ln=0, align='L')
    val_total = '-' if total_nominal == 0 else f"{total_nominal:,.0f}".replace(",", ".")
    pdf.cell(35, 4, val_total, ln=1, align='R')
    pdf.set_x(15)
    pdf.cell(180, 3, dashed_line, ln=1, align='C') 
    
    pdf.ln(4)
    terbilang_str = generate_terbilang(total_nominal)
    pdf.set_font("Arial", '', 10)
    pdf.set_x(15)
    pdf.cell(180, 6, f"Terbilang : {terbilang_str}", ln=1)
    
    pdf.ln(8)
    tgl_cetak = f"Jakarta, {tgl_obj.strftime('%d')} {bulan_indo[tgl_obj.month]} {tgl_obj.strftime('%Y')}"
    pdf.set_x(15)
    pdf.cell(80, 5, "", ln=0, align='C')
    pdf.cell(100, 5, tgl_cetak, ln=1, align='C')
    pdf.ln(3)
    pdf.set_x(15)
    pdf.cell(80, 5, "Kepala Seksi Pelayanan dan Informasi", ln=0, align='C')
    pdf.cell(100, 5, "Bendahara Penerimaan", ln=1, align='C')
    pdf.ln(25) 
    pdf.set_x(15)
    pdf.cell(80, 5, "Afriana Pulungan, S.Si., M.AP.", ln=0, align='C')
    pdf.cell(100, 5, "Evi Irmawati", ln=1, align='C')
    pdf.set_x(15)
    pdf.cell(80, 5, "NIP 197304212007012021", ln=0, align='C')
    pdf.cell(100, 5, "NIP 198101082009042006", ln=1, align='C')

    # ==============================================================
    # MENGGAMBAR TABEL LAMPIRAN SECARA NATIVE
    # ==============================================================
    if raw_table_data and len(raw_table_data.get('tbody', [])) > 0:
        pdf.add_page(orientation='L') # Halaman Landscape
        pdf.set_margins(15, 15, 15)
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Gambar Banner Judul
        pdf.set_font("Arial", 'B', 14)
        pdf.set_fill_color(103, 119, 239) 
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 10, "BUKTI REKONSILIASI DARI SISTEM 3A", border=0, ln=1, align='C', fill=True)
        
        pdf.set_font("Arial", 'B', 11)
        hari_str = hari_dict[tgl_obj.weekday()]
        tgl_str = f"{tgl_obj.day:02d} {bulan_indo[tgl_obj.month].upper()} {tgl_obj.year}"
        sub_title = f"HARI, TANGGAL: {hari_str}, {tgl_str}   |   CHANNEL: {channel_display}"
        pdf.cell(0, 8, sub_title, border=0, ln=1, align='C', fill=True)
        pdf.ln(5)
        
        pdf.set_text_color(0, 0, 0)
        
        col_w = [70, 115, 35, 47]
        
        # 1. Gambar Header Tabel
        pdf.set_font("Arial", 'B', 11)
        pdf.set_fill_color(230, 230, 230)
        thead = raw_table_data.get('thead', ["Merchant", "Ticket Name", "Qty", "Total"])
        if len(thead) >= 4:
            for i in range(4):
                pdf.cell(col_w[i], 10, thead[i].upper(), border=1, align='C', fill=True)
            pdf.ln()
            
        # 2. Gambar Isi Tabel (Body)
        pdf.set_font("Arial", '', 10)
        tbody = raw_table_data.get('tbody', [])
        for row in tbody:
            if not row or len(row) < 4: continue
            if "Tidak ada data" in row[0]: continue
            
            merchant_text = row[0][:38] + ".." if len(row[0]) > 40 else row[0]
            ticket_text = row[1][:65] + ".." if len(row[1]) > 67 else row[1]
            
            pdf.cell(col_w[0], 8, merchant_text, border=1)
            pdf.cell(col_w[1], 8, ticket_text, border=1)
            pdf.cell(col_w[2], 8, row[2], border=1, align='R')
            pdf.cell(col_w[3], 8, row[3], border=1, align='R')
            pdf.ln()
            
        # 3. Gambar Baris Total (Footer)
        pdf.set_font("Arial", 'B', 12)
        pdf.set_fill_color(200, 200, 200)
        tfoot = raw_table_data.get('tfoot', [])
        if len(tfoot) == 3: 
            pdf.cell(col_w[0] + col_w[1], 10, tfoot[0], border=1, align='C', fill=True)
            pdf.cell(col_w[2], 10, tfoot[1], border=1, align='R', fill=True)
            pdf.cell(col_w[3], 10, tfoot[2], border=1, align='R', fill=True)
            pdf.ln()
        elif len(tfoot) >= 4: 
            pdf.cell(col_w[0] + col_w[1], 10, "TOTAL", border=1, align='C', fill=True)
            pdf.cell(col_w[2], 10, tfoot[2], border=1, align='R', fill=True)
            pdf.cell(col_w[3], 10, tfoot[3], border=1, align='R', fill=True)
            pdf.ln()

        # 4. Tambahan Timestamp
        waktu_tarik = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
        pdf.ln(2) 
        pdf.set_font("Arial", 'I', 8) 
        pdf.set_text_color(100, 100, 100) 
        pdf.cell(0, 5, f"*Data diekstrak oleh sistem pada: {waktu_tarik} WIB", ln=1, align='L')
        pdf.set_text_color(0, 0, 0) 

    nama_file = f"STSU_{channel_display.replace(' ', '_')}_{tanggal_rekon_str}.pdf"
    full_path = os.path.join(folder_path, nama_file)
    
    try:
        pdf.output(full_path)
        print(f"📄 Berhasil mencetak/menimpa PDF: {full_path}")
    except PermissionError:
        print(f"❌ GAGAL MENYIMPAN PDF: {nama_file}")
        print(f"   ⚠️ File tersebut sepertinya sedang DIBUKA di PDF Reader Bapak.")
        print(f"   ⚠️ Tolong TUTUP dulu file PDF-nya, lalu coba tarik data lagi.")
    except Exception as e:
        print(f"❌ Terjadi kesalahan saat menyimpan PDF: {e}")

# ==========================================
# 4. ROBOT PENARIK DATA
# ==========================================
def tarik_rekon_3a_real(tanggal_rekon_str):
    print(f"\n🚀 Memulai Tarik Data Rekon 3A untuk Tanggal Paid: {tanggal_rekon_str}")
    
    base_folder = os.path.abspath(f"REKON_{tanggal_rekon_str}")
    
    if os.path.exists(base_folder):
        print(f"⚠️ Menemukan folder lama untuk tanggal {tanggal_rekon_str}. Sedang membersihkan data...")
        try:
            shutil.rmtree(base_folder) 
            time.sleep(0.5) 
        except Exception as e:
            print(f"❌ Gagal membersihkan folder lama. Error: {e}")
    
    os.makedirs(base_folder, exist_ok=True)
    
    options = Options()
    # options.add_argument("--headless=new") 
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
    
    channels = ["GATE", "TVM", "MERCHANT_PAGE"]
    
    for channel in channels:
        if channel == "MERCHANT_PAGE": disp = "TIKET ONLINE"
        elif channel == "TVM": disp = "TICKET VENDING MACHINE"
        elif channel == "GATE": disp = "NEW GATE"
        else: disp = channel.upper()

        print(f"🔄 Memproses Channel: {disp} ...")
        
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
        
        print(f"💾 [DATA] Mengekstrak isi tabel untuk {disp}...")
        raw_table_data = driver.execute_script("""
            let thead = Array.from(document.querySelectorAll('#summary-ticket-table thead th')).map(th => th.textContent.trim());
            let tbody = Array.from(document.querySelectorAll('#summary-ticket-table tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
            let tfoot = Array.from(document.querySelectorAll('#summary-ticket-table tfoot th, #summary-ticket-table tfoot td')).map(td => td.textContent.trim());
            return { 'thead': thead, 'tbody': tbody, 'tfoot': tfoot };
        """)
        
        data_channel = []
        for cols in raw_table_data.get('tbody', []):
            if len(cols) >= 4 and cols[0] and "Tidak ada data" not in cols[0] and "TOTAL" not in cols[0].upper():
                data_channel.append({
                    "merchant": cols[0], "ticket_name": cols[1],
                    "qty": clean_number(cols[2]), "nominal": clean_number(cols[3])
                })
        
        stsu_data = petakan_ke_stsu(data_channel, tanggal_rekon_str)
        buat_pdf_stsu(channel, tanggal_rekon_str, stsu_data, raw_table_data, base_folder)

    driver.quit()
    print(f"\n🎉 SELESAI! File PDF telah diperbarui di folder: {base_folder}")

# ==========================================
# 5. ANTARMUKA DATE PICKER (GUI)
# ==========================================
def jalankan_date_picker():
    dates_selected = []

    def on_submit():
        nonlocal dates_selected
        date_obj = cal.selection_get()
        dates_selected.append(date_obj.strftime("%Y-%m-%d"))
        
        if not multi_var.get():
            root.destroy()
        else:
            messagebox.showinfo("Berhasil", f"Tanggal {dates_selected[-1]} ditambahkan ke antrean.")

    def on_finish():
        root.destroy()

    root = tk.Tk()
    root.title("Bot Rekon 3A - Pilih Tanggal")
    root.geometry("350x450")
    
    style = ttk.Style(root)
    style.theme_use('clam')

    main_frame = ttk.Frame(root, padding="20")
    main_frame.pack(fill=tk.BOTH, expand=True)

    ttk.Label(main_frame, text="Pilih Tanggal Rekon:", font=("Arial", 12, "bold")).pack(pady=(0, 10))

    cal = Calendar(main_frame, selectmode='day', date_pattern='yyyy-mm-dd')
    cal.pack(fill=tk.BOTH, expand=True, pady=10)

    multi_var = tk.BooleanVar(value=False)
    ttk.Checkbutton(main_frame, text="Pilih lebih dari satu tanggal", variable=multi_var).pack(pady=5)

    btn_frame = ttk.Frame(main_frame)
    btn_frame.pack(pady=20)

    ttk.Button(btn_frame, text="Proses / Tambah", command=on_submit).pack(side=tk.LEFT, padx=5)
    ttk.Button(btn_frame, text="Selesai & Jalankan", command=on_finish).pack(side=tk.LEFT, padx=5)

    root.mainloop()
    return dates_selected

if __name__ == "__main__":
    list_tanggal = jalankan_date_picker()
    
    if list_tanggal:
        print(f"📅 Tanggal yang akan diproses: {', '.join(list_tanggal)}")
        for tgl in list_tanggal:
            try:
                datetime.strptime(tgl, "%Y-%m-%d")
                tarik_rekon_3a_real(tgl)
            except Exception as e:
                print(f"❌ Error pada {tgl}: {e}")
    else:
        print("⚠️ Tidak ada tanggal yang dipilih. Program keluar.")
    
    if len(sys.argv) > 1 or not sys.stdin.isatty():
        pass 
    else:
        print("\nSelesai. Tekan ENTER untuk menutup...")
        input()