import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

interface QrCodeProps {
  readonly value: string;
  readonly label: string;
  readonly className?: string | undefined;
}

/** A scannable QR code drawn as one SVG path, with its quiet zone. */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    const cells: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) {
          cells.push(`M${String(col + 4)} ${String(row + 4)}h1v1h-1z`);
        }
      }
    }
    return { size: count + 8, path: cells.join('') };
  }, [value]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fbf7ee" />
      <path d={path} fill="#14100d" />
    </svg>
  );
}
