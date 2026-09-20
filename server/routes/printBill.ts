import { RequestHandler } from "express";
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SCRIPT    = join(process.cwd(), "shopshield_print.py");
const VENDOR_ID = 0x1fc9;
const PROD_ID   = 0x2016;

// ── Python ESC/POS — PRIMARY path (proven, stable) ───────────────────────────
function sendViaPython(bill: Record<string, any>): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = join(tmpdir(), `sharq_bill_${Date.now()}.json`);
    try { writeFileSync(tmp, JSON.stringify({ bill }), "utf8"); }
    catch (e) { return reject(e); }
    const env = { ...process.env, DISPLAY: process.env.DISPLAY || ":0" };
    exec(
      `python3 "${SCRIPT}" --bill "${tmp}"`,
      { timeout: 45_000, env },
      (err, out, stderr) => {
        try { unlinkSync(tmp); } catch (_) {}
        if (err) reject(new Error(stderr?.trim() || out?.trim() || err.message));
        else resolve(out.trim());
      }
    );
  });
}

// ── Node.js ESC/POS — SECONDARY path (faster when available) ─────────────────
function buildEscPos(bill: Record<string, any>): Buffer {
  const ESC = 0x1b, GS = 0x1d;
  const b: number[] = [];
  const push = (...v: number[]) => b.push(...v);
  const txt = (s: string) => {
    for (const ch of String(s ?? "")) {
      const code = ch.charCodeAt(0);
      push(code > 0x7e ? 0x3f : code);
    }
  };
  const ln  = (s: string) => { txt(s); push(0x0a); };
  const W   = 32;
  const lr  = (l: string, r: string) =>
    l + " ".repeat(Math.max(1, W - (l?.length ?? 0) - (r?.length ?? 0))) + r;
  const div = (ch = "-") => ch.repeat(W);
  const sym = "AF";

  push(ESC, 0x40);
  push(ESC, 0x61, 0x01);
  push(GS,  0x21, 0x11, ESC, 0x45, 0x01);
  ln((bill.shopName || "Sharq Electronics").slice(0, 16).toUpperCase());
  push(GS, 0x21, 0x00, ESC, 0x45, 0x00);
  if (bill.shopPhone) ln(bill.shopPhone);
  push(0x0a);
  push(ESC, 0x61, 0x00);
  ln(div("="));
  push(ESC, 0x45, 0x01);
  ln(lr("INVOICE", String(bill.billNo || "")));
  push(ESC, 0x45, 0x00);
  ln(lr("Date",  String(bill.date  || "")));
  ln(lr("Time",  String(bill.time  || "")));
  ln(lr("Staff", String(bill.createdBy || "").slice(0, 16)));
  const cust = String(bill.customerName || "");
  if (cust && cust !== "Walk-in Customer") ln(lr("Customer", cust.slice(0, 14)));
  ln(div("-"));
  push(ESC, 0x45, 0x01);
  ln("Qty Item".padEnd(W - 8) + "Amt".padStart(8));
  push(ESC, 0x45, 0x00);
  ln(div("-"));
  for (const it of (bill.items || [])) {
    const qty  = String(it.qty ?? 1);
    const name = String(it.name || "");
    const amt  = sym + Math.round(it.total ?? 0);
    const nw   = W - 4 - amt.length;
    ln((qty + " ").padEnd(4) + name.slice(0, nw).padEnd(nw) + amt);
    if (name.length > nw) ln("    " + name.slice(nw, nw * 2));
  }
  ln(div("="));
  const grand = bill.grandTotal ?? 0;
  const disc  = bill.discount   ?? 0;
  const paid  = bill.amountPaid ?? grand;
  const bal   = bill.balance    ?? 0;
  if (disc > 0) {
    ln(lr("Subtotal", sym + Math.round(bill.subtotal ?? 0)));
    ln(lr("Discount", "-" + sym + Math.round(disc)));
    ln(div("-"));
  }
  push(ESC, 0x45, 0x01, GS, 0x21, 0x01);
  ln(lr("TOTAL", sym + Math.round(grand)));
  push(GS, 0x21, 0x00, ESC, 0x45, 0x00);
  if (bill.status === "credit") {
    ln(lr("PAID", sym + Math.round(paid)));
    push(ESC, 0x45, 0x01);
    ln(lr("OWES", sym + Math.round(bal)));
    push(ESC, 0x45, 0x00);
  }
  ln(div("="));
  push(ESC, 0x61, 0x01);
  for (const l of (bill.receiptFooter || "Thank you!").split("\n")) ln(l.trim());
  push(0x0a, 0x0a, 0x0a);
  push(GS, 0x56, 0x41, 0x03);
  return Buffer.from(b);
}

async function sendViaNodeUsb(data: Buffer): Promise<string> {
  const usbMod = await import("usb");
  const usb    = (usbMod as any).default ?? usbMod;
  const device = usb.findByIds(VENDOR_ID, PROD_ID) as any;
  if (!device) throw new Error("Printer not found (1fc9:2016) — check USB cable");

  device.open();
  const iface = device.interface(0);

  // Detach usblp — Linux kernel grabs printer on connect
  try {
    if (iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
      console.log("[print] usblp detached ✓");
    }
  } catch (e: any) {
    console.warn("[print] kernel detach:", e.message, "(continuing)");
  }

  try {
    iface.claim();
  } catch (e: any) {
    try { device.close(); } catch (_) {}
    throw new Error(`USB claim failed: ${e.message}
Fix: sudo modprobe -r usblp  then replug printer`);
  }

  const ep = iface.endpoints.find((e: any) => e.direction === "out") as any;
  if (!ep) {
    try { iface.release(true, () => {}); } catch (_) {}
    try { device.close(); } catch (_) {}
    throw new Error("No USB OUT endpoint found");
  }

  // Write in 64-byte chunks (wMaxPacketSize from descriptor)
  const CHUNK = 64;
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += CHUNK) chunks.push(data.slice(i, i + CHUNK));

  const sendNext = (idx: number): Promise<void> => {
    if (idx >= chunks.length) return Promise.resolve();
    return new Promise<void>((res, rej) =>
      ep.transfer(chunks[idx], (err: Error | null) => err ? rej(err) : res())
    ).then(() => sendNext(idx + 1));
  };

  try {
    await sendNext(0);
  } finally {
    try { iface.release(true, () => {}); } catch (_) {}
    try { device.close(); } catch (_) {}
  }

  return `${data.length} bytes → Node.js ESC/POS (${chunks.length} chunks)`;
}

// ── Diagnostic ────────────────────────────────────────────────────────────────
export const handlePrintDiag: RequestHandler = async (_req, res) => {
  const lines: string[] = [];
  try {
    const usbMod = await import("usb");
    const usb    = (usbMod as any).default ?? usbMod;
    lines.push("✓ usb module loaded");
    const device = usb.findByIds(VENDOR_ID, PROD_ID);
    if (device) {
      lines.push("✓ XPrinter found (1fc9:2016)");
      try { device.open(); lines.push("✓ device.open() ok"); device.close(); }
      catch (e: any) { lines.push(`✗ device.open(): ${e.message}`); }
    } else {
      lines.push("✗ XPrinter NOT found — check USB cable + power");
      const all = (usb.getDeviceList?.() ?? []) as any[];
      lines.push(`  ${all.length} USB devices visible:`);
      all.slice(0, 10).forEach((d: any) => {
        const v = d.deviceDescriptor?.idVendor?.toString(16).padStart(4, "0");
        const p = d.deviceDescriptor?.idProduct?.toString(16).padStart(4, "0");
        lines.push(`    ${v}:${p}`);
      });
    }
  } catch (e: any) { lines.push(`✗ usb module error: ${e.message}`); }

  exec(`python3 -c "import usb.core; d=usb.core.find(idVendor=0x1fc9,idProduct=0x2016); print('pyusb ok — printer:', 'FOUND' if d else 'NOT FOUND')"`,
    { timeout: 5000 },
    (err, out) => {
      lines.push(err ? `✗ pyusb: ${err.message}` : `✓ ${out.trim()}`);
      lines.push(`  python3: ${process.env.PATH?.includes("python") ? "in PATH" : "check PATH"}`);
      lines.push(`  SCRIPT: ${SCRIPT}`);
      res.json({ ok: true, lines });
    }
  );
};

// ── Main handler — Python PRIMARY, Node.js secondary ─────────────────────────
export const handlePrintBill: RequestHandler = async (req, res) => {
  // Wrap everything — NetworkError must never happen again
  try {
    const { bill } = req.body as { bill?: { id: string; html?: string; data?: any } };
    if (!bill?.id || (!bill?.html && !bill?.data)) {
      res.status(400).json({ ok: false, message: "Missing bill.id and bill data" });
      return;
    }

    // ── Path 1: Python ESC/POS (PRIMARY — proven stable) ──────────────────
    try {
      const msg = await sendViaPython(bill);
      console.log("[print-bill] Python:", msg);
      res.json({ ok: true, message: msg });
      return;
    } catch (pyErr: any) {
      console.warn("[print-bill] Python failed:", pyErr.message, "→ trying Node.js USB");
    }

    // ── Path 2: Node.js ESC/POS (fallback) ────────────────────────────────
    if (bill.data) {
      try {
        const raw = buildEscPos(bill.data);
        const msg = await sendViaNodeUsb(raw);
        console.log("[print-bill] Node.js:", msg);
        res.json({ ok: true, message: msg });
        return;
      } catch (nodeErr: any) {
        console.warn("[print-bill] Node.js failed:", nodeErr.message);
        res.status(500).json({
          ok: false,
          message: `Print failed — check printer is on and connected.\n${nodeErr.message}`
        });
        return;
      }
    }

    res.status(500).json({ ok: false, message: "No print method available — check printer connection" });

  } catch (fatal: any) {
    // Catch-all: server NEVER crashes, always responds
    console.error("[print-bill] Fatal:", fatal.message);
    res.status(500).json({ ok: false, message: fatal.message });
  }
};
