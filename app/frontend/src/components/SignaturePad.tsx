import * as React from 'react';

/** Plain canvas signature capture - no external drawing library, just pointer events. Exposes the
 * drawn image as a PNG data URL via `onChange` on every stroke end, and a `clear()` the parent can
 * call (via `ref`) before re-showing the pad for the next document. */
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

    // 2026-07-22: the canvas backing store was a fixed 320x140px stretched to fill the container
    // via `w-full` - on any screen wider than 320 CSS px (basically all of them) that upscales an
    // already-modest bitmap, and on a high-DPI phone screen (devicePixelRatio 2-3x) it's coarse to
    // begin with, so the captured signature (and the PDF it gets stamped into) looked blurry/jagged.
    // Size the backing store to the canvas's actual on-screen CSS size times devicePixelRatio, then
    // scale the drawing context so all the pointer-event math below can stay in CSS-pixel space.
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Floor of 2x even on a plain 1x desktop monitor - the stamped signature ends up quite small
      // on the page (a template's signature line rarely has more than ~22pt of blank height to
      // work with), so a higher-resolution source always helps sharpness there, not just on
      // high-DPI phone screens.
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
        className="h-36 w-full touch-none rounded-md border border-dashed"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    );
  },
);
