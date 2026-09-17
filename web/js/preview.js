/**
 * Slide-Printer Live Preview Renderer
 * 
 * Renders an instant, high-fidelity visual representation of the handout
 * on an HTML5 canvas using PDF.js and 2D canvas drawing.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SlidePrinterPreview = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let currentRenderTask = null;
  let cachedSlideCanvas = null;
  let lastCachedPageIndex = -1;

  /**
   * Clears any cached slide canvas when a new document is loaded.
   */
  function resetCache() {
    cachedSlideCanvas = null;
    lastCachedPageIndex = -1;
    if (currentRenderTask) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }
  }

  /**
   * Renders the handout preview onto the given HTML5 canvas.
   * 
   * @param {HTMLCanvasElement} canvas Target canvas element.
   * @param {Object} pdfjsDoc PDF.js document instance.
   * @param {number} pageNum 1-based slide page number.
   * @param {Object} options Handout layout options (paperSize, style, margin, step, separation).
   */
  async function renderPreview(canvas, pdfjsDoc, pageNum, options) {
    if (!canvas || !pdfjsDoc) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const paperKey = (options.paperSize || 'a4').toLowerCase();
    const paperDimensions = options.paperDimensions || [595.28, 841.89];
    const [paperWidth, paperHeight] = paperDimensions;

    const margin = options.margin !== undefined ? Number(options.margin) : 40.0;
    const step = options.step !== undefined ? Number(options.step) : 14.0;
    const separation = options.separation !== undefined ? Number(options.separation) : 10.0;
    const style = (options.style || 'lines').toLowerCase();

    // Determine canvas logical display width
    const container = canvas.parentElement;
    const maxDisplayWidth = container ? Math.min(container.clientWidth - 32, 680) : 560;
    const displayWidth = Math.max(maxDisplayWidth, 320);
    const displayHeight = displayWidth * (paperHeight / paperWidth);

    // Set high-DPI buffer size
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.save();
    ctx.scale(canvas.width / paperWidth, canvas.height / paperHeight);

    // Draw sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paperWidth, paperHeight);

    // Fetch and render slide via offscreen canvas if not already cached for this page
    if (lastCachedPageIndex !== pageNum || !cachedSlideCanvas) {
      try {
        if (currentRenderTask) {
          currentRenderTask.cancel();
          currentRenderTask = null;
        }

        const page = await pdfjsDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calculate scale to fit available width
        const availableWidth = paperWidth - 2 * margin;
        const scale = availableWidth / unscaledViewport.width;
        const scaledHeight = unscaledViewport.height * scale;

        // Render slide into offscreen canvas at high resolution
        const offscreen = document.createElement('canvas');
        const offscreenDpr = dpr * 1.5;
        const viewport = page.getViewport({ scale: scale * offscreenDpr });

        offscreen.width = viewport.width;
        offscreen.height = viewport.height;

        const offCtx = offscreen.getContext('2d');
        currentRenderTask = page.render({
          canvasContext: offCtx,
          viewport: viewport,
        });

        await currentRenderTask.promise;
        currentRenderTask = null;

        cachedSlideCanvas = {
          canvas: offscreen,
          scaledWidth: availableWidth,
          scaledHeight: scaledHeight,
        };
        lastCachedPageIndex = pageNum;
      } catch (err) {
        if (err && err.name === 'RenderingCancelledException') {
          ctx.restore();
          return;
        }
        console.error('Error rendering slide for preview:', err);
      }
    }

    const availableWidth = paperWidth - 2 * margin;
    let scaledHeight = (availableWidth * 9) / 16; // default fallback 16:9

    if (cachedSlideCanvas) {
      scaledHeight = cachedSlideCanvas.scaledHeight;
      // Draw slide content at top margin
      ctx.drawImage(
        cachedSlideCanvas.canvas,
        margin,
        margin,
        availableWidth,
        scaledHeight
      );
    }

    // Draw subtle slide boundary line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(margin, margin, availableWidth, scaledHeight);

    // Separator line
    const ySep = margin + scaledHeight + separation;
    const x1 = margin;
    const x2 = margin + availableWidth;

    ctx.strokeStyle = 'rgba(50, 50, 50, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, ySep);
    ctx.lineTo(x2, ySep);
    ctx.stroke();

    // Subtle end tick markers
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, ySep - 3);
    ctx.lineTo(x1, ySep + 3);
    ctx.moveTo(x2, ySep - 3);
    ctx.lineTo(x2, ySep + 3);
    ctx.stroke();

    // Notes area pattern
    const yStart = ySep + 10;
    const bottomLimit = paperHeight - margin;

    if (style === 'lines') {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.22)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let y = yStart + step; y <= bottomLimit; y += step) {
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
      }
      ctx.stroke();
    } else if (style === 'grid') {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.18)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();

      // Horizontal lines
      let yMax = yStart;
      for (let y = yStart; y <= bottomLimit; y += step) {
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        yMax = y;
      }

      // Vertical lines
      for (let x = x1; x <= x2; x += step) {
        ctx.moveTo(x, yStart);
        ctx.lineTo(x, yMax);
      }
      ctx.stroke();
    } else if (style === 'dots') {
      ctx.fillStyle = 'rgba(60, 60, 60, 0.35)';
      const dotRadius = 0.7;
      for (let y = yStart; y <= bottomLimit; y += step) {
        for (let x = x1; x <= x2; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 'blank' style only draws the separator line

    ctx.restore();
  }

  return {
    renderPreview,
    resetCache,
  };
});
