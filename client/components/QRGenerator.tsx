import QRCode from "react-qr-code";

interface QRGeneratorProps {
  value: string;
  size?: number;
}

export function QRGenerator({ value, size = 256 }: QRGeneratorProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl border shadow-sm">
      <div style={{ height: "auto", margin: "0 auto", maxWidth: size, width: "100%" }}>
        <QRCode
          size={256}
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          value={value}
          viewBox={`0 0 256 256`}
          fgColor="hsl(222.2 47.4% 11.2%)"
        />
      </div>
      <p className="mt-4 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{value}</p>
    </div>
  );
}
