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
   * @param {Object} options Handout layout options.
   */
  async function renderPreview(canvas, pdfjsDoc, pageNum, options = {}) {
    if (!canvas || !pdfjsDoc) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const paperDimensions = options.paperDimensions || [595.28, 841.89];
    const [paperWidth, paperHeight] = paperDimensions;

    const margin = options.margin !== undefined ? Number(options.margin) : 40.0;
    const step = options.step !== undefined ? Number(options.step) : 14.0;
    const separation = options.separation !== undefined ? Number(options.separation) : 10.0;
    const style = (options.style || 'lines').toLowerCase();
    const pageNumbers = options.pageNumbers !== undefined ? Boolean(options.pageNumbers) : true;
    const pageNumberFormat = options.pageNumberFormat || 'total';
    const totalPages = options.totalPages || pdfjsDoc.numPages || 1;
    const layout = (options.layout || '1-up').toLowerCase();
    const gutterMargin = options.gutter !== undefined ? Number(options.gutter) : 0.0;
    const duplex = Boolean(options.duplex);
    const coverMode = (options.coverMode || 'none').toLowerCase();
    const studyHeader = Boolean(options.studyHeader);
    const studyTitle = options.studyTitle || '';
    const ecoPrint = Boolean(options.ecoPrint);

    // High-resolution internal buffer representing the paper sheet (2x scale for Retina sharpness)
    const scaleFactor = Math.max(dpr, 2);
    canvas.width = Math.round(paperWidth * scaleFactor);
    canvas.height = Math.round(paperHeight * scaleFactor);

    canvas.style.width = '100%';
    canvas.style.maxWidth = '580px';
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = `${paperWidth} / ${paperHeight}`;

    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);

    if (ecoPrint) {
      ctx.filter = 'grayscale(100%) contrast(105%)';
    }

    // Draw sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paperWidth, paperHeight);

    // Duplex gutter offset: odd sheets (recto) have gutter on left; even sheets (verso) on right
    const isOddSheet = (pageNum % 2 === 1);
    const leftGutter = duplex ? (isOddSheet ? gutterMargin : 0) : gutterMargin;
    const xOffset = margin + leftGutter;
    const availableWidth = paperWidth - 2 * margin - gutterMargin;

    // Handle Clean First Slide Cover
    const isCleanCover = (pageNum === 1 && coverMode === 'clean_first');

    // Handle Generated Cover Preview
    if (coverMode === 'generate' && pageNum === 1 && options.isCoverView) {
      renderPreviewEditorialCover(ctx, paperWidth, paperHeight, options);
      ctx.restore();
      return;
    }

    // Fetch and render slide via offscreen canvas if not already cached
    const cacheKey = `${pageNum}_${availableWidth}_${layout}`;
    if (lastCachedPageIndex !== cacheKey || !cachedSlideCanvas) {
      try {
        if (currentRenderTask) {
          currentRenderTask.cancel();
          currentRenderTask = null;
        }

        const page = await pdfjsDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        const scale = availableWidth / unscaledViewport.width;
        const scaledHeight = unscaledViewport.height * scale;

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
        lastCachedPageIndex = cacheKey;
      } catch (err) {
        if (err && err.name === 'RenderingCancelledException') {
          ctx.restore();
          return;
        }
        console.error('Error rendering slide for preview:', err);
      }
    }

    let scaledHeight = (availableWidth * 9) / 16;
    if (cachedSlideCanvas) {
      scaledHeight = cachedSlideCanvas.scaledHeight;
    }

    // 1. Study Header
    let headerHeight = 0;
    if (studyHeader && !isCleanCover) {
      headerHeight = 24;
      const hY = margin + 14;
      ctx.font = '600 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(50, 50, 50, 0.85)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const label = studyTitle ? `TEMA / ASIGNATURA: ${studyTitle}` : 'TEMA / ASIGNATURA: _____________________________';
      ctx.fillText(label, xOffset, hY);

      ctx.font = '400 8px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('FECHA: _____ / _____ / 20___', xOffset + availableWidth, hY);

      ctx.strokeStyle = 'rgba(50, 50, 50, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(xOffset, hY + 4);
      ctx.lineTo(xOffset + availableWidth, hY + 4);
      ctx.stroke();
    }

    // 2. Render Slide(s) & Notes
    if (layout === '2-up') {
      const halfH = paperHeight / 2;
      const slot1Top = margin + (studyHeader ? 22 : 0);
      const slot1Bottom = halfH - 6;

      // Slot 1 Slide (scaled to fit slot 1)
      const maxH1 = (slot1Bottom - slot1Top) * 0.58;
      const scale1 = Math.min(1, maxH1 / scaledHeight);
      const drawW1 = availableWidth * scale1;
      const drawH1 = scaledHeight * scale1;
      const x1 = xOffset + (availableWidth - drawW1) / 2;
      const y1 = slot1Top;

      if (cachedSlideCanvas) {
        ctx.drawImage(cachedSlideCanvas.canvas, x1, y1, drawW1, drawH1);
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x1, y1, drawW1, drawH1);

      // Slot 1 Notes
      const sepY1 = y1 + drawH1 + separation;
      drawPreviewPattern(ctx, xOffset, availableWidth, sepY1, slot1Bottom - 6, style, step);

      // Mid-page dashed divider
      ctx.strokeStyle = 'rgba(80, 80, 80, 0.22)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(xOffset, halfH);
      ctx.lineTo(xOffset + availableWidth, halfH);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Slot 2 (Second slide placeholder or image)
      const slot2Top = halfH + 10;
      const slot2Bottom = paperHeight - margin;
      const drawW2 = drawW1;
      const drawH2 = drawH1;
      const x2 = xOffset + (availableWidth - drawW2) / 2;
      const y2 = slot2Top;

      if (cachedSlideCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.drawImage(cachedSlideCanvas.canvas, x2, y2, drawW2, drawH2);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x2, y2, drawW2, drawH2);

      // Slot 2 Notes
      const sepY2 = y2 + drawH2 + separation;
      drawPreviewPattern(ctx, xOffset, availableWidth, sepY2, slot2Bottom - 6, style, step);
    } else {
      // 1-Up layout
      let slideTop = margin + (studyHeader && !isCleanCover ? headerHeight : 0);
      if (isCleanCover) {
        slideTop = (paperHeight - scaledHeight) / 2;
      }

      if (cachedSlideCanvas) {
        ctx.drawImage(
          cachedSlideCanvas.canvas,
          xOffset,
          slideTop,
          availableWidth,
          scaledHeight
        );
      }

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(xOffset, slideTop, availableWidth, scaledHeight);

      if (!isCleanCover) {
        // Separator line
        const ySep = slideTop + scaledHeight + separation;
        drawPreviewPattern(ctx, xOffset, availableWidth, ySep, paperHeight - margin, style, step);
      }
    }

    // 3. Centered page number at footer
    if (pageNumbers && !isCleanCover) {
      ctx.save();
      ctx.font = '500 9px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(70, 70, 70, 0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const footerY = paperHeight - Math.max(margin / 2 - 3, 12);
      const numStr = pageNumberFormat === 'total' ? `${pageNum} / ${totalPages}` : String(pageNum);
      ctx.fillText(numStr, paperWidth / 2, footerY);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPreviewPattern(ctx, x1, width, ySep, bottomLimit, style, step) {
    const x2 = x1 + width;
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, ySep);
    ctx.lineTo(x2, ySep);
    ctx.stroke();

    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, ySep - 3);
    ctx.lineTo(x1, ySep + 3);
    ctx.moveTo(x2, ySep - 3);
    ctx.lineTo(x2, ySep + 3);
    ctx.stroke();

    const yStart = ySep + 10;
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
      let yMax = yStart;
      for (let y = yStart; y <= bottomLimit; y += step) {
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        yMax = y;
      }
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
  }

  function renderPreviewEditorialCover(ctx, pw, ph, options) {
    const inset = 36;
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.25)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect(inset, inset, pw - 2 * inset, ph - 2 * inset);

    ctx.strokeStyle = 'rgba(50, 50, 50, 0.12)';
    ctx.lineWidth = 0.4;
    ctx.strokeRect(inset + 4, inset + 4, pw - 2 * (inset + 4), ph - 2 * (inset + 4));

    ctx.font = '700 8px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(80, 80, 80, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('SLIDE—PRINTER · CUADERNO DE APUNTES', pw / 2, 90);

    ctx.strokeStyle = 'rgba(80, 80, 80, 0.3)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(pw / 2 - 40, 100);
    ctx.lineTo(pw / 2 + 40, 100);
    ctx.stroke();

    ctx.font = '700 22px system-ui, Georgia, serif';
    ctx.fillStyle = '#1a2332';
    ctx.fillText(options.coverTitle || 'Presentación', pw / 2, ph * 0.45);

    if (options.studyTitle) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = '#555555';
      ctx.fillText(options.studyTitle, pw / 2, ph * 0.51);
    }

    let metaY = ph * 0.72;
    if (options.coverAuthor) {
      ctx.font = '400 10px system-ui, sans-serif';
      ctx.fillStyle = '#444444';
      ctx.fillText(`Autor / Estudiante: ${options.coverAuthor}`, pw / 2, metaY);
      metaY += 18;
    }

    ctx.font = '400 9px system-ui, sans-serif';
    ctx.fillStyle = '#777777';
    ctx.fillText(new Date().toLocaleDateString(), pw / 2, metaY);

    ctx.fillText('Slide—Printer · Handout Edition', pw / 2, ph - inset - 14);
  }

  return {
    renderPreview,
    resetCache,
  };
});
