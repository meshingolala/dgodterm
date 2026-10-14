import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCanvasProps {
  text: string;
  size?: number;
  className?: string;
}

export const QrCanvas: React.FC<QrCanvasProps> = ({ text, size = 180, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    QRCode.toCanvas(
      canvas,
      text,
      {
        width: size,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      },
      (err) => {
        if (err) console.error('Error generating QR code:', err);
      }
    );
  }, [text, size]);

  return (
    <div className={`p-2.5 bg-white rounded-xl shadow-lg border border-slate-700 flex flex-col items-center inline-block ${className}`}>
      <canvas ref={canvasRef} width={size} height={size} className="block rounded" />
    </div>
  );
};
