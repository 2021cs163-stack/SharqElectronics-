import { RequestHandler } from "express";
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SCRIPT = join(process.cwd(), "shopshield_print.py");

/**
 * POST /api/print
 * Body: { tags: Array<{ id: string; html: string }> }
 * Renders each tag HTML via headless browser → TSPL2 bitmap → USB printer
 * Requires: Firefox/Chromium installed + python3 + pyusb
 */
export const handlePrint: RequestHandler = (req, res) => {
  const { tags } = req.body as { tags?: Array<{ id: string; html: string }> };

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    res.status(400).json({ ok: false, message: 'Missing tags array' });
    return;
  }

  const tmp = join(tmpdir(), `shopshield_labels_${Date.now()}.json`);
  try { writeFileSync(tmp, JSON.stringify({ tags }), 'utf8'); }
  catch (e) {
    res.status(500).json({ ok: false, message: `Temp file error: ${e}` });
    return;
  }

  const env = { ...process.env, DISPLAY: process.env.DISPLAY || ':0' };
  exec(
    `python3 "${SCRIPT}" "${tmp}"`,
    { timeout: 90_000, env },
    (error, stdout, stderr) => {
      try { unlinkSync(tmp); } catch (_) {}
      if (error) {
        const msg = stderr?.trim() || stdout?.trim() || error.message;
        console.error('[print-labels]', msg);
        res.status(500).json({ ok: false, message: msg });
        return;
      }
      console.log('[print-labels]', stdout.trim());
      res.json({ ok: true, message: stdout.trim() });
    }
  );
};
