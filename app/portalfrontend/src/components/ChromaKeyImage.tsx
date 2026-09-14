import * as React from 'react';

/**
 * Renders an image with its flat solid-color background made transparent at runtime, so it can sit
 * on top of a CSS background (e.g. the site's navy panel gradients) instead of clashing with its
 * own background color (2026-09-11 user request: "Why borrow" section illustrations came with a
 * bright green background that doesn't fit the navy/lime palette - user chose "recolor background
 * to navy, keep the illustration's own colors untouched" over the alternatives).
 *
 * Deliberately a runtime chroma-key rather than pre-editing the source files: there's no pixel
 * editor available in this environment, and a CSS color filter (hue-rotate etc.) would shift every
 * color in the illustration uniformly - including the shield, cards, and clothing the user wants
 * preserved - not just the background. Sampling the image's own corner pixel as the "key color"
 * (rather than a hardcoded green) makes this robust to whatever exact shade each source file uses.
 */
export function ChromaKeyImage({
  src,
  alt = '',
  className,
  tolerance = 60,
}: {
  src: string;
  alt?: string;
  className?: string;
  tolerance?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Sample the key color from the four corners (averaged) rather than assuming a fixed green -
      // works regardless of the exact shade each source file happens to use.
      const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
      let kr = 0;
      let kg = 0;
      let kb = 0;
      for (const c of corners) {
        kr += data[c];
        kg += data[c + 1];
        kb += data[c + 2];
      }
      kr /= corners.length;
      kg /= corners.length;
      kb /= corners.length;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - kr;
        const dg = data[i + 1] - kg;
        const db = data[i + 2] - kb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tolerance) {
          // Feather the edge instead of a hard cutout, so the illustration doesn't get a jagged
          // halo where it originally anti-aliased into the green.
          data[i + 3] = Math.max(0, 255 * (dist / tolerance) ** 2);
        }
      }
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
      setReady(true);
    };
    return () => {
      cancelled = true;
    };
  }, [src, tolerance]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={alt}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 400ms ease' }}
    />
  );
}
