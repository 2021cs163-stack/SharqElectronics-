import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
    ];

    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport,
        rememberLastUsedCamera: true,
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear();
      },
      (err) => {
        // We ignore scanning errors as they are frequent when no code is in frame
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Failed to clear scanner on unmount", error);
        });
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-bold">Scan Tool Barcode/QR</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          <div id="reader" className="overflow-hidden rounded-2xl border-2 border-dashed border-primary/20 bg-muted/50" />
          
          {error && (
            <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Position the barcode or QR code within the frame above to scan automatically.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-4 w-4" />
                Reset Camera
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
