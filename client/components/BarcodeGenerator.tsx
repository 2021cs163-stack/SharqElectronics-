import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeGeneratorProps {
  value: string;
  format?: "CODE128" | "CODE39" | "EAN13" | "UPC";
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export function BarcodeGenerator({ 
  value, 
  format = "CODE128", 
  width = 2, 
  height = 100,
  displayValue = true
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize: 16,
          margin: 10,
          background: "transparent",
          lineColor: "#000000",
        });
      } catch (error) {
        console.error("Barcode generation failed:", error);
      }
    }
  }, [value, format, width, height, displayValue]);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border">
      <svg ref={svgRef} className="max-w-full h-auto" />
    </div>
  );
}
