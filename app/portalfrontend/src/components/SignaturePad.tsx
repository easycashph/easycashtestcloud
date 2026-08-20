import * as React from 'react';

/**
 * 2026-08-20 (Portal e-signature) - copied verbatim from app/lmsfrontend/src/components/
 * SignaturePad.tsx (no shared package between the two frontends yet, same duplication precedent
 * as other portal-side components that mirror an lmsfrontend counterpart). Keep the two in sync by
 * hand if either changes.
 *
 * Plain canvas signature capture - no external drawing library, just pointer events. Exposes the
 * drawn image as a PNG data URL via `onChange` on every stroke end, and a `clear()` the parent can
 * call (via `ref`) before re-showing the pad for the next document.
 */
export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, { onChange: (dataUrl: string | null) => void }>(
  function SignaturePad({ onChange }, ref) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const drawingRef = React.useRef(false);
    const hasStrokeRef = React.useRef(false);
    const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx?.scale(dpr, dpr);
    }, []);

    const getContext = () => canvasRef.current?.getContext('2d') ?? null;

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = true;
      lastPointRef.current = getPoint(e);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = getContext();
      const last = lastPointRef.current;
      if (!ctx || !last) return;
      const point = getPoint(e);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      hasStrokeRef.current = true;
    };

    const emitChange = () => {
      const canvas = canvasRef.current;
      onChange(canvas && hasStrokeRef.current ? canvas.toDataURL('image/png') : null);
    };

    const handlePointerUp = () => {
      drawingRef.current = false;
      lastPointRef.current = null;
      emitChange();
    };

    React.useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokeRef.current = false;
        onChange(null);
      },
      isEmpty: () => !hasStrokeRef.current,
    }));

    return (
      <canvas
        ref={canvasRef}
        className="h-36 w-full touch-none rounded-md border border-dashed border-border"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    );
  },
);
