#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   ShopShield Label Printer — All-in-One Setup & Print  v3                  ║
║   Xprinter XP-T361U · 38×28mm · TSPL2 · Direct USB · Linux (any distro)    ║
║   Browsers supported: Firefox · Brave · Chromium · Chrome                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║   FIRST TIME:  python3 shopshield_print.py --setup                          ║
║   TEST PRINT:  python3 shopshield_print.py --test                           ║
║   PRINT HTML:  python3 shopshield_print.py <label.html>                     ║
║   DIAGNOSE:    python3 shopshield_print.py --check                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sys, os, subprocess, tempfile, shutil, time, traceback

# ── Printer USB IDs (lsusb: 1fc9:2016 NXP Semiconductors Printer-80) ─────────
VENDOR_ID  = 0x1fc9
PRODUCT_ID = 0x2016

# ── Label spec: 38×28mm @ 203 DPI ────────────────────────────────────────────
LABEL_W_MM  = 38
LABEL_H_MM  = 28
DPI         = 203
LABEL_W_PX  = round(LABEL_W_MM * DPI / 25.4)    # 304
LABEL_H_PX  = round(LABEL_H_MM * DPI / 25.4)    # 224
GAP_MM      = 2

# Browser viewport at 96 DPI, then scaled up to printer DPI
SCREEN_W_PX = 480    # matches PrintTags.tsx SCREEN_W=480
SCREEN_H_PX = 424    # matches PrintTags.tsx SCREEN_H=424
SCALE       = DPI / 96.0                          # 2.115

# ── udev rule for USB without sudo ───────────────────────────────────────────
UDEV_RULE = (
    'SUBSYSTEM=="usb", ATTR{idVendor}=="1fc9", '
    'ATTR{idProduct}=="2016", MODE="0666", GROUP="plugdev"'
)
UDEV_PATH = "/etc/udev/rules.d/99-xprinter.rules"


# ══════════════════════════════════════════════════════════════════════════════
#  ESC/POS RECEIPT — direct bytes, no browser, no PIL
# ══════════════════════════════════════════════════════════════════════════════

# Receipt: 80mm roll, 72mm printable (576px @ 203dpi)
RECEIPT_W_MM     = 72
RECEIPT_DPI      = 203
RECEIPT_W_PX     = round(RECEIPT_W_MM * RECEIPT_DPI / 25.4)  # 576
RECEIPT_SCREEN_W = RECEIPT_W_PX

def build_escpos_receipt(bill: dict) -> bytes:
    """Build raw ESC/POS bytes. No browser needed. Printer renders at native 203 DPI."""
    ESC = b'\x1b'; GS = b'\x1d'
    INIT     = ESC + b'@'
    ALIGN_L  = ESC + b'a\x00'
    ALIGN_C  = ESC + b'a\x01'
    BOLD_ON  = ESC + b'E\x01'
    BOLD_OFF = ESC + b'E\x00'
    DBL_WH   = GS  + b'!\x11'
    DBL_H    = GS  + b'!\x01'
    NORMAL   = GS  + b'!\x00'
    CUT      = GS  + b'V\x41\x03'
    W = 32
    sym = 'AF'  # currency symbol (Afghani)

    def lr(l, r, w=W):
        return l + ' ' * max(1, w - len(l) - len(r)) + r
    def div(ch='-', w=W): return ch * w + '\n'
    def enc(s): return str(s).encode('ascii', 'replace')

    o = bytearray()
    o += INIT + ALIGN_C + DBL_WH + BOLD_ON
    o += enc((bill.get('shopName') or 'Sharq Electronics')[:16].upper()) + b'\n'
    o += NORMAL + BOLD_OFF
    if bill.get('shopPhone'): o += enc(bill['shopPhone']) + b'\n'
    o += b'\n' + ALIGN_L
    o += enc(div('='))
    o += BOLD_ON
    o += enc(lr('INVOICE', str(bill.get('billNo') or ''))) + b'\n'
    o += BOLD_OFF
    o += enc(lr('Date',  str(bill.get('date') or ''))) + b'\n'
    o += enc(lr('Time',  str(bill.get('time') or ''))) + b'\n'
    o += enc(lr('Staff', str(bill.get('createdBy') or '')[:16])) + b'\n'
    cust = str(bill.get('customerName') or '')
    if cust and cust != 'Walk-in Customer':
        o += enc(lr('Customer', cust[:14])) + b'\n'
    o += enc(div('-'))
    o += BOLD_ON
    o += enc('Qty Item'.ljust(W - 8) + 'Amt'.rjust(8)) + b'\n'
    o += BOLD_OFF
    o += enc(div('-'))
    for it in bill.get('items') or []:
        qty  = str(it.get('qty', 1))
        name = str(it.get('name') or '')
        amt  = sym + str(round(it.get('total') or 0))
        nw   = W - 4 - len(amt)
        o += enc((qty + ' ').ljust(4) + name[:nw].ljust(nw) + amt) + b'\n'
        if len(name) > nw:
            o += enc('    ' + name[nw:nw*2]) + b'\n'
    o += enc(div('='))
    grand = bill.get('grandTotal') or 0
    disc  = bill.get('discount') or 0
    paid  = bill.get('amountPaid') if bill.get('amountPaid') is not None else grand
    bal   = bill.get('balance') or 0
    if disc > 0:
        o += enc(lr('Subtotal', sym + str(round(bill.get('subtotal') or 0)))) + b'\n'
        o += enc(lr('Discount', '-' + sym + str(round(disc)))) + b'\n'
        o += enc(div('-'))
    o += BOLD_ON + DBL_H
    o += enc(lr('TOTAL', sym + str(round(grand)))) + b'\n'
    o += NORMAL + BOLD_OFF
    if bill.get('status') == 'credit':
        o += enc(lr('PAID', sym + str(round(paid)))) + b'\n'
        o += BOLD_ON
        o += enc(lr('OWES', sym + str(round(bal)))) + b'\n'
        o += BOLD_OFF
    o += enc(div('=')) + ALIGN_C
    for line in str(bill.get('receiptFooter') or 'Thank you!').split('\n'):
        o += enc(line.strip()) + b'\n'
    o += b'\n\n' + CUT
    return bytes(o)


def print_bill_from_json(json_path: str):
    """Print receipt via ESC/POS (no browser needed)."""
    import json
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)
    bill = data.get('bill', {})
    if not bill:
        raise RuntimeError('No bill in JSON payload')
    bill_id   = bill.get('id', 'BILL')
    bill_data = bill.get('data')
    if not bill_data:
        raise RuntimeError('No structured bill data — cannot print')
    info(f'Printing bill {bill_id} via ESC/POS…')
    raw = build_escpos_receipt(bill_data)
    with open('/tmp/shopshield_last_bill.escpos', 'wb') as f:
        f.write(raw)
    info(f'ESC/POS: {len(raw)} bytes')
    send_to_printer(raw)
    ok(f'Bill {bill_id} printed ✓')

# ── Terminal colours ──────────────────────────────────────────────────────────
R="\033[91m"; G="\033[92m"; Y="\033[93m"; B="\033[94m"; BOLD="\033[1m"; X="\033[0m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def err(m):  print(f"  {R}✘{X}  {m}")
def warn(m): print(f"  {Y}⚠{X}  {m}")
def info(m): print(f"  {B}→{X}  {m}")
def head(m): print(f"\n{BOLD}{m}{X}")
def die(m):  err(m); sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def run_cmd(cmd, capture=True):
    r = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    stdout = (r.stdout or "").strip()
    stderr = (r.stderr or "").strip()
    return r.returncode, stdout, stderr

def is_root() -> bool:
    return os.geteuid() == 0

def sudo_prefix() -> str:
    return "" if is_root() else "sudo "

def sudo_run(cmd: str) -> tuple:
    return run_cmd(f"{sudo_prefix()}{cmd}")

def sudo_available() -> bool:
    if is_root():
        return True
    r = subprocess.run("sudo -v", shell=True, text=True)
    return r.returncode == 0

def pkg_installed(pkg: str) -> bool:
    rc, out, _ = run_cmd(f"dpkg -s {pkg} 2>/dev/null")
    return "Status: install ok" in out

def apt_install(packages: list) -> bool:
    missing = [p for p in packages if not pkg_installed(p)]
    if not missing:
        return True
    info(f"Installing via apt: {' '.join(missing)}")
    rc, _, se = sudo_run(f"apt-get install -y {' '.join(missing)}")
    if rc != 0:
        err(f"apt-get failed:\n    {se[:300]}")
        return False
    return True

def python_ok(mod: str) -> bool:
    rc, _, _ = run_cmd(f"python3 -c 'import {mod}' 2>/dev/null")
    return rc == 0

def find_browser():
    for b in ["firefox", "firefox-esr"]:
        if shutil.which(b):
            return (b, "firefox")
    for b in ["brave-browser", "chromium-browser", "chromium",
              "google-chrome", "google-chrome-stable"]:
        if shutil.which(b):
            return (b, "chromium")
    return None

def current_user() -> str:
    return (os.environ.get("SUDO_USER")
            or os.environ.get("USER")
            or run_cmd("whoami")[1])

# ══════════════════════════════════════════════════════════════════════════════
#  SETUP
# ══════════════════════════════════════════════════════════════════════════════

def setup():
    head("╔══ ShopShield Printer Setup ══╗")
    print(f"  Label size : {LABEL_W_MM}×{LABEL_H_MM} mm")
    print(f"  Print size : {LABEL_W_PX}×{LABEL_H_PX} px @ {DPI} DPI")

    errors   = []
    warnings = []

    head("① Checking permissions")
    if is_root():
        ok("Running as root — all operations permitted")
    else:
        info("Some steps need sudo (apt-get, udev rules, group changes).")
        if not sudo_available():
            errors.append(
                "sudo authentication failed.\n"
                "    Re-run after entering your password, or run as root:\n"
                "      sudo python3 shopshield_print.py --setup"
            )
            _print_summary(errors, warnings)
            return False
        ok("sudo access confirmed")

    head("② System packages")
    needed = ["python3-pip", "python3-usb", "python3-pil", "imagemagick"]
    if apt_install(needed):
        ok(f"Packages ready: {', '.join(needed)}")
    else:
        errors.append(
            "System package install failed.\n"
            f"    Fix manually:  sudo apt-get install {' '.join(needed)}"
        )

    head("③ Browser for HTML rendering")
    result = find_browser()
    if result:
        ok(f"Found: {result[0]}  (engine: {result[1]})")
    else:
        info("No browser found — trying firefox then chromium-browser...")
        apt_install(["firefox"])
        result = find_browser()
        if not result:
            apt_install(["chromium-browser"])
            result = find_browser()
        if result:
            ok(f"Installed: {result[0]}")
        else:
            errors.append(
                "No browser found.\n"
                "    Option A:  sudo apt-get install firefox\n"
                "    Option B:  sudo apt-get install chromium-browser\n"
                "    Option C:  https://brave.com/linux/"
            )

    head("④ USB permissions (udev)")
    if os.path.exists(UDEV_PATH):
        content = open(UDEV_PATH).read()
        if "1fc9" in content:
            ok(f"udev rule already present: {UDEV_PATH}")
        else:
            sudo_run(f'sh -c \'echo "{UDEV_RULE}" >> {UDEV_PATH}\'')
            sudo_run("udevadm control --reload-rules && udevadm trigger")
            ok("Rule appended")
    else:
        rc, _, se = sudo_run(f'sh -c \'echo "{UDEV_RULE}" > {UDEV_PATH}\'')
        if rc == 0:
            sudo_run("udevadm control --reload-rules && udevadm trigger")
            ok(f"udev rule created: {UDEV_PATH}")
            warn("Unplug and replug the printer once for the rule to take effect")
        else:
            warnings.append(
                "Could not write udev rule — printing may require sudo.\n"
                f"    Fix manually:\n"
                f"      echo '{UDEV_RULE}' | sudo tee {UDEV_PATH}\n"
                f"      sudo udevadm control --reload-rules && sudo udevadm trigger"
            )

    head("⑤ User group (plugdev)")
    user = current_user()
    _, groups_out, _ = run_cmd(f"groups {user}")
    if "plugdev" in groups_out:
        ok(f"'{user}' already in plugdev")
    else:
        rc, _, se = sudo_run(f"usermod -a -G plugdev {user}")
        if rc == 0:
            ok(f"Added '{user}' to plugdev group")
            warn("Log out and back in (or reboot) for this to take effect")
        else:
            warnings.append(
                f"Could not add '{user}' to plugdev: {se[:150]}\n"
                f"    Fix manually:  sudo usermod -a -G plugdev {user}"
            )

    head("⑥ Printer USB detection")
    _detect_printer(verbose=True)

    _print_summary(errors, warnings)
    if not errors:
        info("All done!  Now run:  python3 shopshield_print.py --test")
    return len(errors) == 0


def _print_summary(errors, warnings):
    head("╔══ Summary ══╗")
    if not errors and not warnings:
        ok("Setup completed with no issues!")
        return
    if warnings:
        print(f"\n  {Y}Warnings (non-critical):{X}")
        for w in warnings:
            for line in w.splitlines():
                print(f"    {Y}{line}{X}")
    if errors:
        print(f"\n  {R}Errors (must fix before printing):{X}")
        for e in errors:
            for line in e.splitlines():
                print(f"    {R}{line}{X}")

# ══════════════════════════════════════════════════════════════════════════════
#  DIAGNOSTICS
# ══════════════════════════════════════════════════════════════════════════════

def _detect_printer(verbose=False) -> bool:
    _, out, _ = run_cmd("lsusb 2>/dev/null")
    for line in out.splitlines():
        lo = line.lower()
        if "1fc9:2016" in lo or ("nxp" in lo and "printer" in lo):
            if verbose: ok(f"USB: {line.strip()}")
            return True
    if verbose: err("Printer not found — check USB cable and power")
    return False

def check():
    head("╔══ ShopShield Diagnostics ══╗")
    all_ok = True

    head("① Python modules")
    for mod, pkg in [("usb","python3-usb"), ("PIL","python3-pil")]:
        if python_ok(mod): ok(f"import {mod}")
        else:
            err(f"Missing '{mod}'  →  sudo apt-get install {pkg}")
            all_ok = False

    head("② Browser")
    result = find_browser()
    if result:
        ok(f"Browser: {result[0]}  (engine: {result[1]})")
    else:
        err("No browser  →  sudo apt-get install firefox")
        all_ok = False

    head("③ Printer on USB")
    if not _detect_printer(verbose=True):
        all_ok = False

    head("④ udev rule")
    if os.path.exists(UDEV_PATH) and "1fc9" in open(UDEV_PATH).read():
        ok(f"Rule present: {UDEV_PATH}")
    else:
        warn(f"udev rule missing — run --setup to fix")

    head("⑤ pyusb open test")
    try:
        import usb.core
        dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
        if dev:
            ok(f"Device opened  (Bus {dev.bus:03d}  Device {dev.address:03d})")
        else:
            err("pyusb cannot find device — is printer plugged in?")
            all_ok = False
    except ImportError:
        err("python3-usb not installed"); all_ok = False
    except Exception as e:
        err(f"USB open error: {e}"); all_ok = False

    head("⑥ User groups")
    user = current_user()
    _, out, _ = run_cmd(f"groups {user}")
    if "plugdev" in out: ok(f"'{user}' is in plugdev")
    else: warn(f"'{user}' not in plugdev — run --setup")

    head("╔══ Result ══╗")
    if all_ok: ok("All checks passed  →  run --test")
    else: err("Issues found  →  run --setup")
    return all_ok

# ══════════════════════════════════════════════════════════════════════════════
#  RENDER  HTML → PNG
# ══════════════════════════════════════════════════════════════════════════════

def html_to_png(html_path: str, out_png: str, browser: str, engine: str):
    if engine == "firefox":
        _html_to_png_firefox(html_path, out_png, browser)
    else:
        _html_to_png_chromium(html_path, out_png, browser)

    from PIL import Image
    img = Image.open(out_png)
    # Resize/scale from screen resolution to print resolution
    if img.size != (LABEL_W_PX, LABEL_H_PX):
        # Crop to the screen viewport first (in case browser added padding)
        sw, sh = min(img.width, SCREEN_W_PX), min(img.height, SCREEN_H_PX)
        img = img.crop((0, 0, sw, sh))
        # Scale up to full print resolution
        img = img.resize((LABEL_W_PX, LABEL_H_PX), Image.LANCZOS)
        img.save(out_png)
    ok(f"PNG: {img.width}×{img.height}px  ({os.path.getsize(out_png)//1024} KB)")


def _html_to_png_firefox(html_path: str, out_png: str, browser: str):
    info(f"Firefox render: {LABEL_W_PX}×{LABEL_H_PX}px")

    tmp_dir     = os.path.dirname(out_png)
    ff_out      = os.path.join(tmp_dir, "screenshot.png")
    tmp_profile = os.path.join(tmp_dir, "ff_profile")
    os.makedirs(tmp_profile, exist_ok=True)

    def _run_ff(extra_flags=""):
        cmd = (
            f"{browser} --headless "
            f"--profile {tmp_profile} "
            f"--no-remote "
            f"--window-size={SCREEN_W_PX},{SCREEN_H_PX} "
            f"--screenshot={ff_out} "
            f"{extra_flags} "
            f"file://{os.path.abspath(html_path)}"
        )
        return subprocess.run(cmd, shell=True, capture_output=True, timeout=30,
                              cwd=tmp_dir)

    def _screenshot_ok():
        if os.path.exists(ff_out) and ff_out != out_png:
            shutil.move(ff_out, out_png)
        return os.path.exists(out_png) and os.path.getsize(out_png) > 0

    try:
        r = _run_ff()
        if _screenshot_ok():
            return
        stderr1 = (r.stderr or b"").decode(errors="replace")
    except subprocess.TimeoutExpired:
        stderr1 = "timeout"

    rc, ff_pids, _ = run_cmd("pgrep -x firefox 2>/dev/null")
    firefox_was_running = rc == 0 and ff_pids.strip()

    if firefox_was_running:
        info("Suspending open Firefox temporarily for headless render...")
        run_cmd(f"kill -STOP $(pgrep -x firefox | tr '\\n' ' ') 2>/dev/null")
        time.sleep(0.5)

    try:
        r = _run_ff()
    except subprocess.TimeoutExpired:
        if firefox_was_running:
            run_cmd(f"kill -CONT $(pgrep -x firefox | tr '\\n' ' ') 2>/dev/null")
        raise RuntimeError(
            "Firefox timed out (25s).\n"
            "  • Run from a desktop session\n"
            "  • Or: DISPLAY=:0 python3 shopshield_print.py --test"
        )
    finally:
        if firefox_was_running:
            run_cmd(f"kill -CONT $(pgrep -x firefox | tr '\\n' ' ') 2>/dev/null")
            info("Firefox resumed")

    if _screenshot_ok():
        return

    stderr2 = (r.stderr or b"").decode(errors="replace")[-500:]
    raise RuntimeError(
        "Firefox screenshot failed after both attempts.\n"
        f"  Browser : {browser}\n"
        f"  Attempt1: {stderr1[-200:]}\n"
        f"  Attempt2: {stderr2}\n"
        "  Tips:\n"
        "    • sudo apt-get install firefox\n"
        "    • Run from a desktop session (not SSH)\n"
        "    • Try: DISPLAY=:0 python3 shopshield_print.py --test"
    )


def _html_to_png_chromium(html_path: str, out_png: str, browser: str):
    info(f"Chromium render: {SCREEN_W_PX}×{SCREEN_H_PX}px × {SCALE:.3f} → {LABEL_W_PX}×{LABEL_H_PX}px")

    cmd = (
        f"{browser} --headless=new --no-sandbox --disable-gpu "
        f"--disable-software-rasterizer "
        f"--window-size={SCREEN_W_PX},{SCREEN_H_PX} "
        f"--force-device-scale-factor={SCALE:.4f} "
        f"--screenshot={out_png} "
        f"file://{os.path.abspath(html_path)}"
    )

    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, timeout=20)
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            "Browser timed out (20s).\n"
            "  • Run from a desktop session\n"
            "  • Or prefix:  DISPLAY=:0 python3 shopshield_print.py ..."
        )

    if not os.path.exists(out_png) or os.path.getsize(out_png) == 0:
        stderr = r.stderr.decode(errors="replace")[-500:]
        raise RuntimeError(
            "Browser screenshot failed.\n"
            f"  Browser : {browser}\n"
            f"  stderr  : {stderr}\n"
            "  Tips:\n"
            "    • sudo apt-get install chromium-browser\n"
            "    • Must be run in a graphical (desktop) session"
        )

# ══════════════════════════════════════════════════════════════════════════════
#  CONVERT  PNG → 1-bit TSPL2 bitmap
# ══════════════════════════════════════════════════════════════════════════════

def png_to_bitmap(png_path: str) -> bytes:
    """
    Convert a PNG to TSPL2 BITMAP byte data.
    Uses NEAREST-NEIGHBOR scaling (no blur) and Otsu-style threshold.
    Returns raw bitmap bytes (not a tuple — width/height are always LABEL_W_PX×LABEL_H_PX).
    """
    from PIL import Image
    img = Image.open(png_path).convert("L")

    # Scale to exact print resolution using NEAREST (no blur on barcode bars)
    if img.size != (LABEL_W_PX, LABEL_H_PX):
        img = img.resize((LABEL_W_PX, LABEL_H_PX), Image.NEAREST)

    # Convert to pure 1-bit with threshold 200 (keep bars crisp and dark)
    # Pixels darker than 200 → print dot (bit=0), lighter → no dot (bit=1)
    rows = []
    for y in range(img.height):
        byte_val, bit_pos, row_bytes = 0, 7, []
        for x in range(img.width):
            # bit=1 → no dot (white), bit=0 → print dot (black)
            if img.getpixel((x, y)) > 200:   # light pixel → 1 (no dot)
                byte_val |= (1 << bit_pos)
            bit_pos -= 1
            if bit_pos < 0:
                row_bytes.append(byte_val)
                byte_val, bit_pos = 0, 7
        if bit_pos < 7:
            row_bytes.append(byte_val)
        rows.extend(row_bytes)

    ok(f"Bitmap: {LABEL_W_PX}×{LABEL_H_PX}px  ({len(rows)} bytes)")
    return bytes(rows)

def build_tspl_single(bitmap: bytes) -> bytes:
    """Build a TSPL2 packet for one label."""
    bpr = (LABEL_W_PX + 7) // 8
    return b"".join([
        f"SIZE {LABEL_W_MM} mm, {LABEL_H_MM} mm\r\n".encode(),
        f"GAP {GAP_MM} mm, 0 mm\r\n".encode(),
        b"DIRECTION 0\r\n",
        b"REFERENCE 0,0\r\n",
        b"DENSITY 8\r\n",
        b"CLS\r\n",
        f"BITMAP 0,0,{bpr},{LABEL_H_PX},0,".encode(),
        bitmap,
        b"\r\n",
        b"PRINT 1,1\r\n",
    ])

def build_tspl(bitmap: bytes, width_px: int, height_px: int) -> bytes:
    """Legacy wrapper — kept for --png mode."""
    return build_tspl_single(bitmap)

# ══════════════════════════════════════════════════════════════════════════════
#  USB SEND
# ══════════════════════════════════════════════════════════════════════════════

def send_to_printer(data: bytes):
    try:
        import usb.core, usb.util
    except ImportError:
        raise RuntimeError(
            "python3-usb missing.\n"
            "  Fix:  sudo apt-get install python3-usb"
        )

    dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
    if dev is None:
        raise RuntimeError(
            "Printer not found (1fc9:2016).\n"
            "  • Plug in and power on the printer\n"
            "  • Run:  lsusb | grep 1fc9\n"
            "  • If missing udev rule, try:  sudo python3 shopshield_print.py --test"
        )

    try:
        for intf in dev.get_active_configuration():
            if dev.is_kernel_driver_active(intf.bInterfaceNumber):
                dev.detach_kernel_driver(intf.bInterfaceNumber)
    except Exception as e:
        warn(f"Kernel driver detach: {e} — continuing")

    try:
        dev.set_configuration()
    except Exception as e:
        raise RuntimeError(
            f"USB set_configuration failed: {e}\n"
            "  • Unplug / replug the printer then retry\n"
            "  • Or:  sudo python3 shopshield_print.py --test"
        )

    intf  = dev.get_active_configuration()[(0, 0)]
    import usb.util as uu
    ep_out = uu.find_descriptor(
        intf,
        custom_match=lambda e:
            uu.endpoint_direction(e.bEndpointAddress) == uu.ENDPOINT_OUT
    )
    if ep_out is None:
        raise RuntimeError(
            "No USB OUT endpoint found.\n"
            "  • Try a different USB cable or port"
        )

    info(f"Sending {len(data)} bytes to printer…")
    sent = 0
    try:
        for i in range(0, len(data), 4096):
            ep_out.write(data[i:i+4096], timeout=5000)
            sent += min(4096, len(data) - i)
    except Exception as e:
        raise RuntimeError(
            f"USB write failed after {sent}/{len(data)} bytes: {e}\n"
            "  • Check USB cable\n"
            "  • Check labels are loaded in the printer"
        )

    uu.dispose_resources(dev)
    ok(f"Sent {sent} bytes ✓")

# ══════════════════════════════════════════════════════════════════════════════
#  TEST LABEL
# ══════════════════════════════════════════════════════════════════════════════

TEST_HTML = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{SCREEN_W_PX}px;height:{SCREEN_H_PX}px;background:#fff;
  font-family:'Courier New',monospace;overflow:hidden}}
.tag{{width:{SCREEN_W_PX}px;height:{SCREEN_H_PX}px;padding:3px 4px;
  display:flex;flex-direction:column}}
.hdr{{display:flex;justify-content:space-between;align-items:center;
  font-size:5px;font-weight:bold;text-transform:uppercase;margin-bottom:2px}}
.dot{{width:4px;height:4px;border-radius:50%;background:#2e7d32}}
.mid{{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px}}
.bars{{font-size:18px;letter-spacing:2px;line-height:1}}
.code{{font-size:6px;font-weight:bold;letter-spacing:1px}}
.name{{font-size:5.5px;text-align:center;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;margin-top:1px}}
.foot{{display:flex;justify-content:space-between;font-size:5px;color:#444;
  border-top:0.5px dashed #bbb;padding-top:1px;margin-top:1px}}
</style></head><body>
<div class="tag">
  <div class="hdr"><span>ShopShield V1</span><span class="dot"></span></div>
  <div class="mid">
    <div class="bars">||| ||| ||| |||</div>
    <div class="code">TEST-001</div>
  </div>
  <div class="name">Test Label — USB OK</div>
  <div class="foot"><span>38×28mm</span><span>XP-T361U</span></div>
</div>
</body></html>
"""

# ══════════════════════════════════════════════════════════════════════════════
#  PRINT FLOW
# ══════════════════════════════════════════════════════════════════════════════

def render_tag_html(tag_id: str, tag_html: str, browser: str, engine: str, tmp: str) -> bytes:
    """
    Render one tag's HTML to a PNG and convert to TSPL2 bitmap bytes.
    tag_html is a complete HTML document for a single 144×106px label.
    """
    html_path = os.path.join(tmp, f"tag_{tag_id}.html")
    png_path  = os.path.join(tmp, f"tag_{tag_id}.png")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(tag_html)
    html_to_png(html_path, png_path, browser, engine)
    return png_to_bitmap(png_path)


def print_labels_from_json(json_path: str):
    """
    Reads a JSON file containing { "tags": [ { "id": "T001", "html": "..." }, ... ] }
    Renders each tag individually, builds one TSPL2 job, sends to printer.
    """
    import json
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    tags = data.get("tags", [])
    if not tags:
        raise RuntimeError("No tags in JSON payload")

    result = find_browser()
    if not result:
        raise RuntimeError(
            "No browser found.\n"
            "  Install Firefox:  sudo apt-get install firefox\n"
            "  OR Chromium:      sudo apt-get install chromium-browser"
        )
    browser, engine = result
    info(f"Browser: {browser} ({engine})  |  {len(tags)} label(s) to print")

    all_tspl = b""
    with tempfile.TemporaryDirectory() as tmp:
        for i, tag in enumerate(tags):
            tag_id   = tag.get("id", f"tag{i}")
            tag_html = tag.get("html", "")
            info(f"  [{i+1}/{len(tags)}] Rendering {tag_id}…")
            bitmap = render_tag_html(tag_id, tag_html, browser, engine, tmp)
            all_tspl += build_tspl_single(bitmap)
            # Save first label as debug PNG
            if i == 0:
                shutil.copy(
                    os.path.join(tmp, f"tag_{tag_id}.png"),
                    "/tmp/shopshield_last_label.png"
                )

    with open("/tmp/shopshield_last_label.tspl", "wb") as f:
        f.write(all_tspl)
    info(f"TSPL packet: {len(all_tspl)} bytes")

    send_to_printer(all_tspl)
    ok(f"{len(tags)} label(s) printed!")


def print_label(html_path: str):
    """Legacy: render a single HTML file and print it."""
    result = find_browser()
    if not result:
        raise RuntimeError(
            "No browser found.\n"
            "  Install Firefox:  sudo apt-get install firefox\n"
            "  OR Chromium:      sudo apt-get install chromium-browser\n"
            "  OR Brave:         https://brave.com/linux/"
        )
    browser, engine = result
    info(f"Using browser: {browser}  ({engine})")

    with tempfile.TemporaryDirectory() as tmp:
        png_path = os.path.join(tmp, "label.png")
        html_to_png(html_path, png_path, browser, engine)
        shutil.copy(png_path, "/tmp/shopshield_last_label.png")
        info("Debug PNG → /tmp/shopshield_last_label.png")
        bitmap = png_to_bitmap(png_path)
        tspl = build_tspl_single(bitmap)
        with open("/tmp/shopshield_last_label.tspl", "wb") as f:
            f.write(tspl)
        info("Debug TSPL → /tmp/shopshield_last_label.tspl")
        send_to_printer(tspl)
        ok("Label printed!")

# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)

    cmd = sys.argv[1]
    try:
        if cmd == "--setup":
            sys.exit(0 if setup() else 1)

        elif cmd == "--check":
            sys.exit(0 if check() else 1)

        elif cmd == "--test":
            head("╔══ Test Print ══╗")
            with tempfile.NamedTemporaryFile(
                suffix=".html", delete=False, mode="w"
            ) as f:
                f.write(TEST_HTML); tmp_html = f.name
            try:
                print_label(tmp_html)
            finally:
                os.unlink(tmp_html)

        elif cmd == "--png":
            if len(sys.argv) < 3:
                die("Usage: shopshield_print.py --png <image.png>")
            p = sys.argv[2]
            if not os.path.exists(p):
                raise FileNotFoundError(f"Not found: {p}")
            head(f"╔══ Printing PNG ══╗")
            bitmap, w, h = png_to_bitmap(p)
            send_to_printer(build_tspl(bitmap, w, h))
            ok("Done!")

        elif cmd == "--bill":
            if len(sys.argv) < 3:
                die("Usage: shopshield_print.py --bill <bill.json>")
            p = sys.argv[2]
            if not os.path.exists(p):
                raise FileNotFoundError(f"Not found: {p}")
            head("╔══ Printing Bill ══╗")
            print_bill_from_json(p)

        else:
            if not os.path.exists(cmd):
                raise FileNotFoundError(
                    f"File not found: {cmd}\n"
                    "  Usage:  python3 shopshield_print.py <label.json>  (or .html)"
                )
            head(f"╔══ Printing: {os.path.basename(cmd)} ══╗")
            if cmd.endswith(".json"):
                print_labels_from_json(cmd)
            else:
                print_label(cmd)

    except FileNotFoundError as e:
        err(f"File error: {e}"); sys.exit(1)
    except RuntimeError as e:
        print(f"\n  {R}✘  Error:{X}")
        for line in str(e).splitlines():
            print(f"     {line}")
        sys.exit(1)
    except KeyboardInterrupt:
        warn("Cancelled."); sys.exit(1)
    except Exception as e:
        err(f"Unexpected: {type(e).__name__}: {e}")
        traceback.print_exc(); sys.exit(1)

if __name__ == "__main__":
    main()
