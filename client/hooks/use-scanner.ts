import { useEffect, useRef, useCallback } from 'react';

/**
 * USB HID barcode/QR scanners behave as keyboards.
 * They type characters very fast (~2-10ms between keystrokes) then send Enter.
 * Humans type at >50ms per character.
 * We buffer chars and if they arrive fast enough + end with Enter, treat as a scan.
 */

const SCAN_SPEED_THRESHOLD_MS = 50;  // max ms between chars to count as scanner
const MIN_SCAN_LENGTH = 3;           // minimum chars to be a valid scan

interface UseScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
}

export function useScanner({ onScan, enabled = true }: UseScannerOptions) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is actively typing in an input/textarea/select
    const target = e.target as HTMLElement;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
      // Exception: if the input is the scanner search field (data-scanner-input), allow
      if (!target.getAttribute('data-scanner-input')) return;
    }

    const now = Date.now();
    const timeSinceLast = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // If gap too large, this is a new scan attempt — reset buffer
    if (timeSinceLast > SCAN_SPEED_THRESHOLD_MS * 3 && buffer.current.length > 0) {
      buffer.current = '';
    }

    if (e.key === 'Enter') {
      const scanned = buffer.current.trim();
      buffer.current = '';
      if (scanned.length >= MIN_SCAN_LENGTH) {
        e.preventDefault();
        e.stopPropagation();
        onScan(scanned);
      }
      return;
    }

    // Only accumulate printable single chars
    if (e.key.length === 1) {
      if (timeSinceLast < SCAN_SPEED_THRESHOLD_MS * 3 || buffer.current === '') {
        buffer.current += e.key;
      }
    }

    // Safety timeout — clear buffer if no input for 500ms
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      buffer.current = '';
    }, 500);
  }, [onScan, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleKeyDown]);
}
