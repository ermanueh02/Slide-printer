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

  let currentRenderTasks = [];
  const slideCache = new Map();

  /**
   * Clears cached slide canvases when a new document is loaded.
   */
  function resetCache() {
    slideCache.clear();
    currentRenderTasks.forEach(task => {
      try { task.cancel(); } catch (_) {}
    });
    currentRenderTasks = [];
  }

  /**
   * Helper to retrieve or render a slide to an offscreen canvas.
   */
  async function getSlideCanvas(pdfjsDoc, slideNum, targetWidth, dpr) {
    if (!pdfjsDoc || !slideNum || slideNum < 1 || slideNum > pdfjsDoc.numPages) {
      return null;
    }
    const roundedW = Math.round(targetWidth);
    const key = `${slideNum}_${roundedW}`;
    if (slideCache.has(key)) {
      return slideCache.get(key);
    }

    try {
      const page = await pdfjsDoc.getPage(slideNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = targetWidth / unscaledViewport.width;
      const scaledHeight = unscaledViewport.height * scale;

      const offscreen = document.createElement('canvas');
      const offscreenDpr = Math.max(dpr, 1.5);
      const viewport = page.getViewport({ scale: scale * offscreenDpr });

      offscreen.width = Math.round(viewport.width);
      offscreen.height = Math.round(viewport.height);

      const offCtx = offscreen.getContext('2d');
      const renderTask = page.render({
        canvasContext: offCtx,
        viewport: viewport,
      });

      currentRenderTasks.push(renderTask);
      await renderTask.promise;
      const idx = currentRenderTasks.indexOf(renderTask);
      if (idx !== -1) currentRenderTasks.splice(idx, 1);

      const result = {
        canvas: offscreen,
        scaledWidth: targetWidth,
        scaledHeight: scaledHeight,
      };

      if (slideCache.size > 24) {
        const oldest = slideCache.keys().next().value;
        slideCache.delete(oldest);
      }
      slideCache.set(key, result);
      return result;
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') {
        return null;
      }
      console.warn(`Could not render preview for slide ${slideNum}:`, err);
      return null;
    }
  }

  /**
   * Renders the handout preview onto the given HTML5 canvas.
   * 
   * @param {HTMLCanvasElement} canvas Target canvas element.
   * @param {Object} pdfjsDoc PDF.js document instance.
   * @param {number} pageNum 1-based sheet number.
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

    // High-resolution internal buffer representing the paper sheet (2x scale for sharpness)
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

    // 1. Handle Generated Editorial Cover on Sheet 1
    if (coverMode === 'generate' && pageNum === 1) {
      renderPreviewEditorialCover(ctx, paperWidth, paperHeight, options);
      ctx.restore();
      return;
    }

    // 2. Determine Slide Mapping
    const isCleanCover = (pageNum === 1 && coverMode === 'clean_first');
    let slot1SlideNum = 1;
    let slot2SlideNum = null;

    if (coverMode === 'generate') {
      // Sheet 1 was cover; Sheet 2 has slide 1, etc.
      if (layout === '2-up') {
        slot1SlideNum = (pageNum - 2) * 2 + 1;
        slot2SlideNum = (pageNum - 2) * 2 + 2;
      } else {
        slot1SlideNum = pageNum - 1;
      }
    } else {
      if (layout === '2-up') {
        slot1SlideNum = (pageNum - 1) * 2 + 1;
        slot2SlideNum = (pageNum - 1) * 2 + 2;
      } else {
        slot1SlideNum = pageNum;
      }
    }

    // 3. Study Header
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

    // 4. Render Slide(s) & Notes
    if (layout === '2-up') {
      const halfH = paperHeight / 2;
      const slot1Top = margin + (studyHeader ? 22 : 0);
      const slot1Bottom = halfH - 6;

      // Slot 1 Slide
      const slide1Data = await getSlideCanvas(pdfjsDoc, slot1SlideNum, availableWidth, dpr);
      const s1Height = slide1Data ? slide1Data.scaledHeight : (availableWidth * 9) / 16;
      const maxH1 = (slot1Bottom - slot1Top) * 0.58;
      const scale1 = Math.min(1, maxH1 / s1Height);
      const drawW1 = availableWidth * scale1;
      const drawH1 = s1Height * scale1;
      const x1 = xOffset + (availableWidth - drawW1) / 2;
      const y1 = slot1Top;

      if (slide1Data) {
        ctx.drawImage(slide1Data.canvas, x1, y1, drawW1, drawH1);
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

      // Slot 2
      const slot2Top = halfH + 10;
      const slot2Bottom = paperHeight - margin;

      if (slot2SlideNum && slot2SlideNum <= pdfjsDoc.numPages) {
        const slide2Data = await getSlideCanvas(pdfjsDoc, slot2SlideNum, availableWidth, dpr);
        const s2Height = slide2Data ? slide2Data.scaledHeight : (availableWidth * 9) / 16;
        const maxH2 = (slot2Bottom - slot2Top) * 0.58;
        const scale2 = Math.min(1, maxH2 / s2Height);
        const drawW2 = availableWidth * scale2;
        const drawH2 = s2Height * scale2;
        const x2 = xOffset + (availableWidth - drawW2) / 2;
        const y2 = slot2Top;

        if (slide2Data) {
          ctx.drawImage(slide2Data.canvas, x2, y2, drawW2, drawH2);
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x2, y2, drawW2, drawH2);

        // Slot 2 Notes
        const sepY2 = y2 + drawH2 + separation;
        drawPreviewPattern(ctx, xOffset, availableWidth, sepY2, slot2Bottom - 6, style, step);
      } else {
        // Empty slot 2: clean note space
        drawPreviewPattern(ctx, xOffset, availableWidth, slot2Top + 6, slot2Bottom - 6, style, step);
      }
    } else {
      // 1-Up layout
      const slideData = await getSlideCanvas(pdfjsDoc, slot1SlideNum, availableWidth, dpr);
      const sHeight = slideData ? slideData.scaledHeight : (availableWidth * 9) / 16;

      let slideTop = margin + (studyHeader && !isCleanCover ? headerHeight : 0);
      if (isCleanCover) {
        slideTop = (paperHeight - sHeight) / 2;
      }

      if (slideData) {
        ctx.drawImage(slideData.canvas, xOffset, slideTop, availableWidth, sHeight);
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(xOffset, slideTop, availableWidth, sHeight);

      if (!isCleanCover) {
        const ySep = slideTop + sHeight + separation;
        drawPreviewPattern(ctx, xOffset, availableWidth, ySep, paperHeight - margin, style, step);
      }
    }

    // 5. Centered page number at footer
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
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;
      const gridX2 = gridX1 + gridW;

      ctx.strokeStyle = 'rgba(100, 100, 100, 0.18)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      let yMax = yStart;
      for (let y = yStart; y <= bottomLimit; y += step) {
        ctx.moveTo(gridX1, y);
        ctx.lineTo(gridX2, y);
        yMax = y;
      }
      for (let col = 0; col <= numCols; col++) {
        const cx = gridX1 + col * step;
        ctx.moveTo(cx, yStart);
        ctx.lineTo(cx, yMax);
      }
      ctx.stroke();
    } else if (style === 'dots') {
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;

      ctx.fillStyle = 'rgba(60, 60, 60, 0.35)';
      const dotRadius = 0.7;
      for (let y = yStart; y <= bottomLimit; y += step) {
        for (let col = 0; col <= numCols; col++) {
          const cx = gridX1 + col * step;
          ctx.beginPath();
          ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawWrappedText(ctx, text, x, startY, maxWidth, lineHeight) {
    const words = (text || '').trim().split(/\s+/);
    let line = '';
    let curY = startY;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, x, curY);
        line = words[n];
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, curY);
    }
    return curY;
  }

  function renderPreviewEditorialCover(ctx, pw, ph, options) {
    const inset = 36;

    // Refined double hairline frame (Zara Home timeless notebook style)
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.22)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(inset, inset, pw - 2 * inset, ph - 2 * inset);

    ctx.strokeStyle = 'rgba(40, 40, 40, 0.10)';
    ctx.lineWidth = 0.35;
    ctx.strokeRect(inset + 6, inset + 6, pw - 2 * (inset + 6), ph - 2 * (inset + 6));

    // Top Header (understated notebook label, no software branding)
    ctx.font = '500 7.5px "Times New Roman", Times, Georgia, serif';
    ctx.fillStyle = 'rgba(80, 80, 80, 0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('C U A D E R N O   D E   N O T A S', pw / 2, inset + 45);

    ctx.strokeStyle = 'rgba(70, 70, 70, 0.20)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(pw / 2 - 24, inset + 53);
    ctx.lineTo(pw / 2 + 24, inset + 53);
    ctx.stroke();

    // Presentation Title (classic serif, centered, word-wrapping)
    const titleText = options.coverTitle || 'Presentación';
    ctx.font = '700 24px "Times New Roman", Times, Georgia, "Newsreader", serif';
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';

    const maxTextW = pw - 2 * inset - 60;
    const titleStartY = ph * 0.40;
    const endTitleY = drawWrappedText(ctx, titleText, pw / 2, titleStartY, maxTextW, 31);

    // Optional Subtitle / Subject (classic serif italic)
    if (options.studyTitle) {
      ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#57534e';
      ctx.fillText(options.studyTitle, pw / 2, endTitleY + 24);
    }

    // Delicate accent rule between title and metadata
    const dividerY = endTitleY + (options.studyTitle ? 44 : 28);
    ctx.strokeStyle = 'rgba(70, 70, 70, 0.18)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(pw / 2 - 32, dividerY);
    ctx.lineTo(pw / 2 + 32, dividerY);
    ctx.stroke();

    // Author & Date Block (warm, quiet typography)
    let metaY = ph * 0.72;
    if (options.coverAuthor) {
      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#292524';
      ctx.fillText(options.coverAuthor, pw / 2, metaY);
      metaY += 18;
    }

    ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
    ctx.fillStyle = '#78716c';
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), pw / 2, metaY);
  }

  return {
    renderPreview,
    resetCache,
  };
});
