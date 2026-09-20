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
    const binding = (options.binding || (options.gutter > 0 ? 'binder' : 'none')).toLowerCase();
    const holeGuides = Boolean(options.holeGuides);
    const gutterMargin = options.gutter !== undefined
      ? Number(options.gutter)
      : (binding === 'binder' ? 30.0 : (binding === 'spiral' ? 22.0 : 0.0));
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
      drawPreviewBindingGuides(ctx, paperWidth, paperHeight, binding, duplex, isOddSheet, holeGuides);
      ctx.restore();
      return;
    }

    // 2. Determine Slide Mapping
    const isCleanCover = (pageNum === 1 && coverMode === 'clean_first');
    const selectedIndices = Array.isArray(options.selectedIndices) && options.selectedIndices.length > 0
      ? options.selectedIndices
      : Array.from({ length: pdfjsDoc.numPages }, (_, i) => i);

    let slot1SlideNum = null;
    let slot2SlideNum = null;

    let slideIndex1 = 0;
    let slideIndex2 = null;

    if (coverMode === 'generate') {
      // Sheet 1 was cover; Sheet 2 has slide 1, etc.
      if (layout === '2-up') {
        slideIndex1 = (pageNum - 2) * 2;
        slideIndex2 = (pageNum - 2) * 2 + 1;
      } else {
        slideIndex1 = pageNum - 2;
      }
    } else {
      if (layout === '2-up') {
        slideIndex1 = (pageNum - 1) * 2;
        slideIndex2 = (pageNum - 1) * 2 + 1;
      } else {
        slideIndex1 = pageNum - 1;
      }
    }

    if (slideIndex1 >= 0 && slideIndex1 < selectedIndices.length) {
      slot1SlideNum = selectedIndices[slideIndex1] + 1;
    }
    if (slideIndex2 !== null && slideIndex2 >= 0 && slideIndex2 < selectedIndices.length) {
      slot2SlideNum = selectedIndices[slideIndex2] + 1;
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
      const label = studyTitle ? `SUBJECT / TOPIC: ${studyTitle}` : 'SUBJECT / TOPIC: _____________________________';
      ctx.fillText(label, xOffset, hY);

      ctx.font = '400 8px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('DATE: _____ / _____ / 20___', xOffset + availableWidth, hY);

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

    // 6. Binding & Hole Guides Overlay
    drawPreviewBindingGuides(ctx, paperWidth, paperHeight, binding, duplex, isOddSheet, holeGuides);

    ctx.restore();
  }

  function drawPreviewBindingGuides(ctx, pw, ph, binding, duplex, isOddSheet, holeGuides) {
    if (!binding || binding === 'none') return;

    ctx.save();
    const isVerso = duplex && !isOddSheet;

    if (binding === 'binder') {
      // 4 ISO 838 punch hole targets: 42mm, 122mm, 202mm, 282mm from bottom on A4 (or proportional)
      const holeX = isVerso ? (pw - 34.0) : 34.0;
      const mmToPt = 72.0 / 25.4;
      const hRatio = ph / 841.89;
      const holeYList = [
        42.0 * mmToPt * hRatio,
        122.0 * mmToPt * hRatio,
        202.0 * mmToPt * hRatio,
        282.0 * mmToPt * hRatio,
      ];

      for (const yFromBottom of holeYList) {
        const cy = ph - yFromBottom;
        // Punch hole target circle
        ctx.strokeStyle = holeGuides ? 'rgba(60, 60, 60, 0.70)' : 'rgba(160, 160, 160, 0.35)';
        ctx.fillStyle = holeGuides ? 'rgba(230, 230, 230, 0.50)' : 'rgba(245, 245, 245, 0.35)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.arc(holeX, cy, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Crosshairs
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = holeGuides ? 'rgba(50, 50, 50, 0.75)' : 'rgba(140, 140, 140, 0.30)';
        ctx.beginPath();
        ctx.moveTo(holeX - 11, cy);
        ctx.lineTo(holeX + 11, cy);
        ctx.moveTo(holeX, cy - 11);
        ctx.lineTo(holeX, cy + 11);
        ctx.stroke();
      }

      // Vertical guide line if holeGuides is active
      if (holeGuides) {
        ctx.strokeStyle = 'rgba(90, 90, 90, 0.35)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(holeX, 28);
        ctx.lineTo(holeX, ph - 28);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (binding === 'spiral') {
      const guideX = isVerso ? (pw - 22.0) : 22.0;
      const coilPitch = 14.17; // ~5mm pitch

      // Spiral clearance guide line
      ctx.strokeStyle = holeGuides ? 'rgba(80, 80, 80, 0.50)' : 'rgba(180, 180, 180, 0.25)';
      ctx.lineWidth = 0.6;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(guideX, 24);
      ctx.lineTo(guideX, ph - 24);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spiral wire loops or punch ticks along margin
      const holeCenter = isVerso ? (pw - 11.0) : 11.0;

      for (let y = 32; y <= ph - 32; y += coilPitch) {
        if (holeGuides) {
          // Cross ticks on clearance line
          ctx.strokeStyle = 'rgba(70, 70, 70, 0.6)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(guideX - 3, y);
          ctx.lineTo(guideX + 3, y);
          ctx.stroke();
        }

        // Realistic spiral coil wire loop in preview
        ctx.strokeStyle = 'rgba(110, 115, 125, 0.40)';
        ctx.fillStyle = 'rgba(235, 238, 242, 0.60)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(holeCenter, y, 4.0, 2.5, isVerso ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      }
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
    const tpl = (options.coverTemplate || 'atelier').toLowerCase();
    const titleText = options.coverTitle || 'Presentation';
    const dateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (tpl === 'george') {
      // 1. George 90s Editorial / JFK Jr Executive Style
      const m = 44;
      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(m, 58);
      ctx.lineTo(pw - m, 58);
      ctx.stroke();

      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(m, 63);
      ctx.lineTo(pw - m, 63);
      ctx.stroke();

      // Header Folio
      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#1e1e24';
      ctx.textAlign = 'left';
      ctx.fillText('STUDY DOSSIER', m, 50);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.fillText('EXECUTIVE BRIEF · 90S ARCHIVE', pw - m, 50);

      // Display Title (Authoritative, Left-aligned)
      ctx.font = '700 28px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#0f0f11';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, m, ph * 0.36, pw - 2 * m - 20, 36);

      // Subtitle / Subject
      let dividerY = endTitleY + 24;
      if (options.studyTitle) {
        ctx.font = 'italic 13.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, m, dividerY);
        dividerY += 28;
      }

      // Sleek short divider rule
      ctx.strokeStyle = 'rgba(30, 30, 36, 0.25)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(m, dividerY);
      ctx.lineTo(m + 80, dividerY);
      ctx.stroke();

      // Structured metadata grid at bottom
      const metaY = ph * 0.82;
      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(m, metaY - 32);
      ctx.lineTo(pw - m, metaY - 32);
      ctx.stroke();

      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'left';
      ctx.fillText('AUTHOR / STUDENT', m, metaY - 18);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(options.coverAuthor || 'General Notes', m, metaY);

      const col2X = m + (pw - 2 * m) * 0.52;
      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('DATE / COMPILATION', col2X, metaY - 18);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(dateFormatted, col2X, metaY);

    } else if (tpl === 'monograph') {
      // 2. Archival Monograph (Heritage Stationery Bookplate)
      const inset = 34;
      ctx.strokeStyle = 'rgba(50, 50, 50, 0.18)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(inset, inset, pw - 2 * inset, ph - 2 * inset);

      // Centered elegant cartouche
      const boxW = pw - 2 * inset - 70;
      const boxH = 190;
      const boxX = (pw - boxW) / 2;
      const boxY = ph * 0.36;

      ctx.strokeStyle = 'rgba(40, 40, 44, 0.35)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.strokeStyle = 'rgba(40, 40, 44, 0.14)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(boxX + 4.5, boxY + 4.5, boxW - 9, boxH - 9);

      // Cartouche Header
      ctx.font = '500 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(70, 70, 70, 0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('M O N O G R A P H   ·   N O T E S', pw / 2, boxY + 28);

      ctx.strokeStyle = 'rgba(80, 80, 80, 0.22)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 20, boxY + 35);
      ctx.lineTo(pw / 2 + 20, boxY + 35);
      ctx.stroke();

      // Title inside cartouche
      ctx.font = '700 22px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, boxY + 80, boxW - 36, 28);

      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, pw / 2, Math.max(endTitleY + 22, boxY + 140));
      }

      // Bottom metadata
      let metaY = ph * 0.78;
      if (options.coverAuthor) {
        ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#1f2937';
        ctx.fillText(options.coverAuthor, pw / 2, metaY);
        metaY += 18;
      }
      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`Date: ${dateFormatted}`, pw / 2, metaY);

    } else if (tpl === 'bauhaus') {
      // 3. Swiss Modernist Bauhaus Layout
      const m = 48;
      const vertX = m + 28;

      ctx.strokeStyle = 'rgba(30, 30, 36, 0.18)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(vertX, m);
      ctx.lineTo(vertX, ph - m);
      ctx.stroke();

      const hdrY = m + 32;
      ctx.beginPath();
      ctx.moveTo(m, hdrY);
      ctx.lineTo(pw - m, hdrY);
      ctx.stroke();

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'left';
      ctx.fillText('VOLUME I  ·  STUDY COMPENDIUM', vertX + 14, hdrY - 10);

      // Large modern title
      ctx.font = '700 26px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#0f0f11';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, vertX + 14, ph * 0.38, pw - vertX - m - 20, 34);

      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, vertX + 14, endTitleY + 24);
      }

      // Structured metadata lines
      const metaY = ph * 0.76;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('STUDENT:', vertX + 14, metaY);
      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(options.coverAuthor || 'General Study Notes', vertX + 76, metaY);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('DATE:', vertX + 14, metaY + 22);
      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(dateFormatted, vertX + 76, metaY + 22);

    } else if (tpl === 'fifties' || tpl === '50s') {
      // 4. Fifties: Mid-Century Pelican / Penguin Tri-Band
      const band1H = ph * 0.32;
      const band2H = ph * 0.38;
      const band3H = ph * 0.30;

      // Top color band
      ctx.fillStyle = '#d9653b';
      ctx.fillRect(0, 0, pw, band1H);

      ctx.font = '700 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('P E L I C A N   C O M P E N D I U M', pw / 2, band1H * 0.52);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText('SERIES IN STUDY & SCHOLARSHIP · NO. 52', pw / 2, band1H * 0.68);

      // Middle white band
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, band1H, pw, band2H);

      // Diamond emblem
      const emblemY = band1H + 34;
      ctx.strokeStyle = '#d9653b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pw / 2, emblemY - 10);
      ctx.lineTo(pw / 2 + 10, emblemY);
      ctx.lineTo(pw / 2, emblemY + 10);
      ctx.lineTo(pw / 2 - 10, emblemY);
      ctx.closePath();
      ctx.stroke();

      // Title
      ctx.font = '700 24px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, band1H + 78, pw - 80, 31);

      // Optional Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#57534e';
        ctx.fillText(options.studyTitle, pw / 2, endTitleY + 22);
      }

      // Bottom color band
      ctx.fillStyle = '#d9653b';
      ctx.fillRect(0, band1H + band2H, pw, band3H);

      ctx.font = '700 11px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const authorText = (options.coverAuthor || 'STUDENT COMPOSITION').toUpperCase();
      ctx.fillText(authorText, pw / 2, band1H + band2H + band3H * 0.38);

      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(`${dateFormatted} · MID-CENTURY EDITION`, pw / 2, band1H + band2H + band3H * 0.52);

    } else if (tpl === 'sixties' || tpl === '60s') {
      // 5. Sixties: Swiss International Typography (Müller-Brockmann Style)
      const m = 44;
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, pw, ph);

      // Heavy black bar across top
      ctx.fillStyle = '#000000';
      ctx.fillRect(m, m, pw - 2 * m, 8);

      // Grid folio
      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText('01 / TYPOGRAFISCHE MONOGRAFIE', m, m + 26);
      ctx.textAlign = 'right';
      ctx.fillText('SWISS INT. 1968 · ZÜRICH', pw - m, m + 26);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(m, m + 32);
      ctx.lineTo(pw - m, m + 32);
      ctx.stroke();

      // Bold Swiss title
      ctx.font = '700 30px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, m, ph * 0.36, pw - 2 * m, 38);

      // Subtitle
      let midRuleY = endTitleY + 24;
      if (options.studyTitle) {
        ctx.font = '500 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, m, midRuleY);
        midRuleY += 24;
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(m, midRuleY);
      ctx.lineTo(pw - m, midRuleY);
      ctx.stroke();

      // Bottom metadata
      const metaY = ph * 0.82;
      ctx.font = '700 7.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'left';
      ctx.fillText('AUTHOR / BEARBEITER', m, metaY);
      ctx.fillText('DATUM / DATE', m + (pw - 2 * m) * 0.52, metaY);

      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(options.coverAuthor || 'Allgemeine Notizen', m, metaY + 16);
      ctx.fillText(dateFormatted, m + (pw - 2 * m) * 0.52, metaY + 16);

    } else if (tpl === 'seventies' || tpl === '70s') {
      // 6. Seventies: Retro Warm Groove & Apollo Style
      ctx.fillStyle = '#fcf9f2';
      ctx.fillRect(0, 0, pw, ph);

      // Triple concentric rounded borders
      function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }

      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = 2.2;
      roundRect(32, 32, pw - 64, ph - 64, 14);
      ctx.stroke();

      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 2.0;
      roundRect(39, 39, pw - 78, ph - 78, 11);
      ctx.stroke();

      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1.8;
      roundRect(46, 46, pw - 92, ph - 92, 8);
      ctx.stroke();

      // Top banner
      ctx.font = '700 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#d35400';
      ctx.textAlign = 'center';
      ctx.fillText('✦   V I N T A G E   D O S S I E R   ·   1 9 7 4   ✦', pw / 2, 76);

      // Title in warm espresso
      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#3e2213';
      ctx.textAlign = 'center';
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, ph * 0.40, pw - 120, 34);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#b3541e';
        ctx.fillText(options.studyTitle, pw / 2, endTitleY + 24);
      }

      // Decorative triple groove lines
      const grooveY = endTitleY + (options.studyTitle ? 44 : 26);
      const gColors = ['#d35400', '#e67e22', '#5d4037'];
      for (let gi = 0; gi < 3; gi++) {
        ctx.strokeStyle = gColors[gi];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pw / 2 - 40, grooveY + gi * 4);
        ctx.lineTo(pw / 2 + 40, grooveY + gi * 4);
        ctx.stroke();
      }

      // Bottom metadata
      const metaY = ph * 0.80;
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#3e2213';
      ctx.textAlign = 'center';
      ctx.fillText(options.coverAuthor || 'Apollo Edition', pw / 2, metaY);

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#7a5230';
      ctx.fillText(dateFormatted, pw / 2, metaY + 16);

    } else if (tpl === 'eighties' || tpl === '80s') {
      // 7. Eighties: Memphis Design & 1984 Technical Manual
      const m = 44;

      // Diagonal hatch box
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(m, m, 46, 46);

      ctx.lineWidth = 1.0;
      ctx.strokeStyle = '#0ea5e9';
      for (let d = -46; d <= 46; d += 8) {
        ctx.beginPath();
        ctx.moveTo(Math.max(m, m + d), m + Math.max(0, -d));
        ctx.lineTo(Math.min(m + 46, m + 46 + d), m + Math.min(46, 46 - d));
        ctx.stroke();
      }

      // Header text
      ctx.font = '800 9px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText('PERSONAL STUDY SYSTEM // 1984', m + 58, m + 18);

      ctx.font = '500 7.5px monospace, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('REF. MODEL 84-MKII · MEMPHIS TECH EDITION', m + 58, m + 32);

      // Geometric rules
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(m, m + 58);
      ctx.lineTo(pw - m, m + 58);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(m, m + 62);
      ctx.lineTo(m + 96, m + 62);
      ctx.stroke();

      // Bold title
      ctx.font = '800 28px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, m, ph * 0.38, pw - 2 * m - 30, 36);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#0ea5e9';
        ctx.fillText(options.studyTitle, m, endTitleY + 24);
      }

      // Floating Memphis shapes
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pw - m - 20, ph * 0.36, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(pw - m - 30, ph * 0.39);
      ctx.lineTo(pw - m - 20, ph * 0.41);
      ctx.lineTo(pw - m - 40, ph * 0.41);
      ctx.closePath();
      ctx.fill();

      // Bottom operator card
      const bY = ph * 0.78;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(m, bY, pw - 2 * m, 54);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(m, bY, pw - 2 * m, 54);

      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText('OPERATOR / STUDENT:', m + 14, bY + 18);
      ctx.fillText('TIMESTAMP:', m + (pw - 2 * m) * 0.52, bY + 18);

      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(options.coverAuthor || 'SYSTEM USER 01', m + 14, bY + 36);

      ctx.font = '600 10px monospace, monospace';
      ctx.fillText(dateFormatted, m + (pw - 2 * m) * 0.52, bY + 36);

    } else if (tpl === 'nineties' || tpl === '90s') {
      // 8. Nineties: Minimalist Editorial Lookbook / Indie Zine
      const m = 54;

      // Crop / registration marks at corners
      const corners = [[30, 30], [pw - 30, 30], [30, ph - 30], [pw - 30, ph - 30]];
      ctx.strokeStyle = 'rgba(30, 30, 30, 0.40)';
      ctx.lineWidth = 0.5;
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy);
        ctx.lineTo(cx + 7, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // Top metadata
      ctx.font = '400 7.5px monospace, monospace';
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'left';
      ctx.fillText('[ ISSUE 09 // LOOKBOOK ARCHIVE ]', m, 52);
      ctx.textAlign = 'right';
      ctx.fillText('REF: 1994-AUTUMN-WINTER', pw - m, 52);

      // Title
      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, m, ph * 0.38, pw - 2 * m, 36);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#555555';
        ctx.fillText(options.studyTitle, m, endTitleY + 22);
      }

      // Subtle hairline divider
      const divY = endTitleY + (options.studyTitle ? 40 : 26);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(m, divY);
      ctx.lineTo(pw - m, divY);
      ctx.stroke();

      // Bottom metadata
      const metaY = ph * 0.82;
      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = '#777777';
      ctx.textAlign = 'left';
      ctx.fillText('DIRECTOR / STUDENT:', m, metaY);
      ctx.fillText('COMPILATION DATE:', m + (pw - 2 * m) * 0.52, metaY);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111111';
      ctx.fillText(options.coverAuthor || 'Studio Dossier', m, metaY + 16);
      ctx.fillText(dateFormatted, m + (pw - 2 * m) * 0.52, metaY + 16);

    } else if (tpl === 'natural' || tpl === 'forest' || tpl === 'verde' || tpl === 'bosque' || tpl === 'nature') {
      // 10. Natural Deep Forest Editorial (Luxury Architectural Notebook)
      ctx.fillStyle = '#f6f5f0';
      ctx.fillRect(0, 0, pw, ph);

      const m = 40;
      const forestDark = '#0f2e1c';
      const forestMid = '#1e472e';
      const forestLight = 'rgba(38, 70, 51, 0.35)';
      const brassGold = '#b8945c';

      ctx.strokeStyle = forestDark;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);

      ctx.strokeStyle = forestLight;
      ctx.lineWidth = 0.4;
      ctx.strokeRect(m + 4.5, m + 4.5, pw - 2 * (m + 4.5), ph - 2 * (m + 4.5));

      ctx.strokeStyle = brassGold;
      ctx.lineWidth = 0.6;
      for (const [cx, cy] of [[m, m], [pw - m, m], [m, ph - m], [pw - m, ph - m]]) {
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
        ctx.stroke();
      }

      ctx.fillStyle = forestDark;
      ctx.fillRect(m + 16, m + 14, pw - 2 * m - 32, 24);

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#f8f9fa';
      ctx.textAlign = 'left';
      ctx.fillText('NATURAL COMPENDIUM // EDITORIAL STUDY FOLIO', m + 26, m + 29);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = brassGold;
      ctx.textAlign = 'right';
      ctx.fillText('VOL. 01 · DEEP FOREST ARCHIVE', pw - m - 26, m + 29);

      ctx.fillStyle = brassGold;
      ctx.fillRect(m + 16, m + 38, pw - 2 * m - 32, 1.2);

      const titleX = m + 22;
      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = forestMid;
      ctx.textAlign = 'left';
      ctx.fillText('STUDY DOSSIER · NATURAL EDITION', titleX, ph * 0.35);

      ctx.font = '700 27px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestDark;
      const endTitleY = drawWrappedText(ctx, titleText, titleX, ph * 0.39, pw - 2 * m - 60, 35);

      let ruleY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = forestMid;
        ctx.fillText(options.studyTitle, titleX, ruleY);
        ruleY += 22;
      }

      ctx.strokeStyle = forestDark;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(titleX, ruleY);
      ctx.lineTo(titleX + 60, ruleY);
      ctx.stroke();

      ctx.fillStyle = brassGold;
      ctx.fillRect(titleX + 64, ruleY - 2, 4, 4);

      ctx.strokeStyle = forestLight;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(titleX + 72, ruleY);
      ctx.lineTo(pw - m - 22, ruleY);
      ctx.stroke();

      const gridY = ph * 0.80;
      const colW = (pw - 2 * m - 44) / 2;

      ctx.strokeStyle = forestDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(titleX, gridY);
      ctx.lineTo(pw - m - 22, gridY);
      ctx.stroke();

      ctx.strokeStyle = forestLight;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(titleX + colW, gridY);
      ctx.lineTo(titleX + colW, gridY + 45);
      ctx.stroke();

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = forestMid;
      ctx.fillText('STUDENT / AUTHOR', titleX, gridY + 12);
      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestDark;
      ctx.fillText(options.coverAuthor || 'Natural Dossier', titleX, gridY + 26);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestMid;
      const totalS = options.totalPages || 0;
      ctx.fillText(`${totalS} ${totalS === 1 ? 'slide sheet' : 'slide sheets'} compiled`, titleX, gridY + 39);

      const col2X = titleX + colW + 16;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = forestMid;
      ctx.fillText('DATE / COMPILATION', col2X, gridY + 12);
      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestDark;
      ctx.fillText(dateFormatted || 'Archival Record', col2X, gridY + 26);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestMid;
      ctx.fillText('Natural Forest Series // No. 01', col2X, gridY + 39);

    } else if (tpl === 'spring' || tpl === 'primavera' || tpl === 'vernal') {
      // 11. Spring / Vernal Editorial (Fresh Sage Green & Airy Geometry)
      ctx.fillStyle = '#fafcf8';
      ctx.fillRect(0, 0, pw, ph);

      const m = 42;
      const sageDeep = '#2a5a3a';
      const sageSoft = '#558265';
      const blossomTint = '#c78a7f';

      ctx.strokeStyle = sageSoft;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);

      ctx.strokeStyle = 'rgba(85, 130, 101, 0.18)';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(m + 4, m + 4, pw - 2 * (m + 4), ph - 2 * (m + 4));

      const lozY = ph * 0.32;
      ctx.strokeStyle = sageDeep;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(pw / 2, lozY, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = blossomTint;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 15, lozY); ctx.lineTo(pw / 2 + 15, lozY);
      ctx.moveTo(pw / 2, lozY - 15); ctx.lineTo(pw / 2, lozY + 15);
      ctx.stroke();

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = sageDeep;
      ctx.textAlign = 'center';
      ctx.fillText('V E R N A L   C O M P E N D I U M', pw / 2, m + 28);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText('SPRING SERIES · NEW CYCLE · VOL. I', pw / 2, m + 42);

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#1c3022';
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, lozY + 42, pw - 2 * m - 60, 33);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = sageSoft;
        ctx.fillText(options.studyTitle, pw / 2, subY);
        subY += 22;
      }

      ctx.strokeStyle = sageSoft;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 36, subY); ctx.lineTo(pw / 2 + 36, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText('CURATED STUDY FOLIO', pw / 2, metaY);

      ctx.font = '10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageDeep;
      ctx.fillText(options.coverAuthor || 'Spring Session Notes', pw / 2, metaY + 14);

      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText(dateFormatted || 'Springtime', pw / 2, metaY + 28);

    } else if (tpl === 'summer' || tpl === 'verano' || tpl === 'estio') {
      // 12. Summer / Solstice Editorial (Aegean Azure & Solar Warmth)
      ctx.fillStyle = '#fdfdfb';
      ctx.fillRect(0, 0, pw, ph);

      const m = 42;
      const azureDeep = '#0f3a63';
      const solarGold = '#d69633';

      const barH = 36;
      ctx.fillStyle = azureDeep;
      ctx.fillRect(0, 0, pw, barH);
      ctx.fillStyle = solarGold;
      ctx.fillRect(0, barH, pw, 2.5);

      ctx.font = '700 8.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('SOLSTICE COMPENDIUM · SUMMER FOLIO', m, 22);
      ctx.textAlign = 'right';
      ctx.fillText('MEDITERRANEAN ARCHIVE // 02', pw - m, 22);

      ctx.strokeStyle = 'rgba(15, 58, 99, 0.25)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(m, barH + 16, pw - 2 * m, ph - barH - m - 16);

      ctx.font = '700 27px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, m + 18, ph * 0.38, pw - 2 * m - 50, 35);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#3a668f';
        ctx.fillText(options.studyTitle, m + 18, subY);
        subY += 22;
      }

      ctx.strokeStyle = azureDeep;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(m + 18, subY); ctx.lineTo(m + 80, subY);
      ctx.stroke();
      ctx.strokeStyle = solarGold;
      ctx.beginPath();
      ctx.moveTo(m + 80, subY); ctx.lineTo(m + 120, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = solarGold;
      ctx.fillText('STUDY RESEARCHER', m + 18, metaY);
      ctx.font = '10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.fillText(options.coverAuthor || 'Summer Study Compendium', m + 18, metaY + 14);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = solarGold;
      ctx.fillText('CALENDAR REGISTRY', m + 18, metaY + 28);
      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.fillText(dateFormatted || 'Summer Solstice', m + 18, metaY + 40);

    } else if (tpl === 'autumn' || tpl === 'otono' || tpl === 'otonno' || tpl === 'fall') {
      // 13. Autumn / Equinox Editorial (Burnt Terracotta & Amber Warmth)
      ctx.fillStyle = '#f7f2ea';
      ctx.fillRect(0, 0, pw, ph);

      const m = 40;
      const terracotta = '#9e381f';
      const amber = '#c2812e';
      const espresso = '#2e1a14';

      ctx.strokeStyle = amber;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);

      ctx.strokeStyle = terracotta;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(m + 4, m + 4, pw - 2 * (m + 4), ph - 2 * (m + 4));

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = terracotta;
      ctx.textAlign = 'center';
      ctx.fillText('E Q U I N O X   D O S S I E R', pw / 2, m + 28);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = amber;
      ctx.fillText('AUTUMNAL COMPENDIUM · OCTOBER ARCHIVE', pw / 2, m + 42);

      const lozY = ph * 0.35;
      ctx.strokeStyle = terracotta;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(pw / 2, lozY - 11);
      ctx.lineTo(pw / 2 + 11, lozY);
      ctx.lineTo(pw / 2, lozY + 11);
      ctx.lineTo(pw / 2 - 11, lozY);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.arc(pw / 2, lozY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = espresso;
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, lozY + 40, pw - 2 * m - 60, 32);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = terracotta;
        ctx.fillText(options.studyTitle, pw / 2, subY);
        subY += 22;
      }

      ctx.strokeStyle = amber;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 45, subY); ctx.lineTo(pw / 2 + 45, subY);
      ctx.stroke();

      const boxY = ph * 0.80;
      const boxW = pw - 2 * m - 40;
      const boxH = 55;
      const bx = (pw - boxW) / 2;
      ctx.strokeStyle = 'rgba(158, 56, 31, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, boxY, boxW, boxH);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = terracotta;
      ctx.textAlign = 'left';
      ctx.fillText('RESEARCHER / STUDENT:', bx + 14, boxY + 16);
      ctx.font = '9.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = espresso;
      ctx.fillText(options.coverAuthor || 'Autumn Studies', bx + 140, boxY + 16);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = terracotta;
      ctx.fillText('SESSION DATE:', bx + 14, boxY + 32);
      ctx.font = '9.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = espresso;
      ctx.fillText(dateFormatted || 'Autumn Season', bx + 140, boxY + 32);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = terracotta;
      ctx.fillText('FOLIO ARCHIVE:', bx + 14, boxY + 47);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = amber;
      ctx.fillText(`${options.totalPages || 0} Slide Sheets Compiled`, bx + 140, boxY + 47);

    } else if (tpl === 'winter' || tpl === 'invierno' || tpl === 'hiemal') {
      // 14. Winter / Hiemal Editorial (Nordic Alpine Midnight & Crystalline Slate)
      ctx.fillStyle = '#f6f9fc';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const midnight = '#14243d';
      const slateBlue = '#527599';

      ctx.strokeStyle = slateBlue;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);
      ctx.strokeStyle = 'rgba(82, 117, 153, 0.25)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(m + 4, m + 4, pw - 2 * (m + 4), ph - 2 * (m + 4));
      ctx.strokeRect(m + 7, m + 7, pw - 2 * (m + 7), ph - 2 * (m + 7));

      const starY = ph * 0.32;
      ctx.strokeStyle = slateBlue;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(pw / 2, starY, 13, 0, Math.PI * 2);
      ctx.stroke();
      for (const deg of [0, 60, 120]) {
        const rad = (deg * Math.PI) / 180;
        const dx = 17 * Math.cos(rad);
        const dy = 17 * Math.sin(rad);
        ctx.beginPath();
        ctx.moveTo(pw / 2 - dx, starY - dy); ctx.lineTo(pw / 2 + dx, starY + dy);
        ctx.stroke();
      }

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = midnight;
      ctx.textAlign = 'center';
      ctx.fillText('HIEMAL COMPENDIUM · ARCTIC ARCHIVE', pw / 2, m + 28);
      ctx.font = '7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText('NORDIC ALPINE EDITION · NO. 04', pw / 2, m + 42);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = midnight;
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, starY + 44, pw - 2 * m - 60, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = slateBlue;
        ctx.fillText(options.studyTitle, pw / 2, subY);
        subY += 22;
      }

      ctx.strokeStyle = slateBlue;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 30, subY); ctx.lineTo(pw / 2 + 30, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText('OPERATOR / CURATOR', pw / 2, metaY);
      ctx.font = '9.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = midnight;
      ctx.fillText(options.coverAuthor || 'Winter Session', pw / 2, metaY + 14);
      ctx.font = '8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText(dateFormatted || 'Winter Season', pw / 2, metaY + 28);

    } else if (tpl === 'polo' || tpl === 'ralph' || tpl === 'ralphlauren' || tpl === 'ralph_lauren' || tpl === 'rl_polo' || tpl === 'preppy') {
      // 15. Ralph Lauren Polo (Collegiate Navy & Gold Shield Heritage)
      ctx.fillStyle = '#faf7f2';
      ctx.fillRect(0, 0, pw, ph);

      const m = 40;
      const rlNavy = '#0f1f40';
      const rlGreen = '#143824';
      const rlGold = '#c29952';

      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);
      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(m + 4.5, m + 4.5, pw - 2 * (m + 4.5), ph - 2 * (m + 4.5));
      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 0.4;
      ctx.strokeRect(m + 8.0, m + 8.0, pw - 2 * (m + 8.0), ph - 2 * (m + 8.0));

      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.textAlign = 'center';
      ctx.fillText('P O L O   S T U D Y   C O M P E N D I U M', pw / 2, m + 28);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGreen;
      ctx.fillText('HERITAGE COLLEGIATE ARCHIVE · EST. 1967', pw / 2, m + 42);

      const shieldY = ph * 0.34;
      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pw / 2, shieldY - 16);
      ctx.lineTo(pw / 2 + 16, shieldY);
      ctx.lineTo(pw / 2, shieldY + 16);
      ctx.lineTo(pw / 2 - 16, shieldY);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(pw / 2, shieldY, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 11, shieldY); ctx.lineTo(pw / 2 + 11, shieldY);
      ctx.moveTo(pw / 2, shieldY - 11); ctx.lineTo(pw / 2, shieldY + 11);
      ctx.stroke();

      ctx.font = '700 5.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.fillText('RL', pw / 2, shieldY + 2);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, shieldY + 44, pw - 2 * m - 60, 34);

      let subY = endTitleY + 20;
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = rlGreen;
        ctx.fillText(options.studyTitle, pw / 2, subY);
        subY += 20;
      }

      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 40, subY); ctx.lineTo(pw / 2 + 40, subY);
      ctx.stroke();
      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 25, subY + 3); ctx.lineTo(pw / 2 + 25, subY + 3);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGold;
      ctx.fillText('FELLOW / STUDENT RECORD', pw / 2, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.fillText(options.coverAuthor || 'Collegiate Member', pw / 2, metaY + 15);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGreen;
      ctx.fillText(dateFormatted || 'Academic Term', pw / 2, metaY + 28);

    } else if (tpl === 'equestrian' || tpl === 'ecuestre' || tpl === 'rl_equestrian' || tpl === 'saddlery') {
      // 16. Ralph Lauren Equestrian (British Country Estate & Hunter Green)
      ctx.fillStyle = '#f8f5ee';
      ctx.fillRect(0, 0, pw, ph);

      const m = 40;
      const hunterGreen = '#143321';
      const saddleTan = '#8c4d24';
      const brass = '#bd944d';

      ctx.strokeStyle = hunterGreen;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(m, m, pw - 2 * m, ph - 2 * m);
      ctx.strokeStyle = brass;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(m + 4, m + 4, pw - 2 * (m + 4), ph - 2 * (m + 4));

      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 0.4;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(m + 7.5, m + 7.5, pw - 2 * (m + 7.5), ph - 2 * (m + 7.5));
      ctx.setLineDash([]);

      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      ctx.textAlign = 'center';
      ctx.fillText('E Q U E S T R I A N   &   F I E L D', pw / 2, m + 28);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText('COUNTRY ESTATE ARCHIVE · SERIES IX', pw / 2, m + 42);

      const stirrupY = ph * 0.34;
      ctx.strokeStyle = brass;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 13, stirrupY - 12);
      ctx.lineTo(pw / 2 - 13, stirrupY + 8);
      ctx.lineTo(pw / 2 + 13, stirrupY + 8);
      ctx.lineTo(pw / 2 + 13, stirrupY - 12);
      ctx.stroke();
      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 16, stirrupY + 8); ctx.lineTo(pw / 2 + 16, stirrupY + 8);
      ctx.stroke();

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, stirrupY + 38, pw - 2 * m - 60, 33);

      let subY = endTitleY + 20;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = saddleTan;
        ctx.fillText(options.studyTitle, pw / 2, subY);
        subY += 20;
      }

      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 45, subY); ctx.lineTo(pw / 2 + 45, subY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = brass;
      ctx.beginPath();
      ctx.arc(pw / 2 - 50, subY, 2, 0, Math.PI * 2);
      ctx.arc(pw / 2 + 50, subY, 2, 0, Math.PI * 2);
      ctx.fill();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText('ESTATE REGISTER', pw / 2, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      ctx.fillText(options.coverAuthor || 'Estate Member', pw / 2, metaY + 15);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText(dateFormatted || 'Season Archive', pw / 2, metaY + 28);

    } else {
      // Default: Atelier Notebook (Zara Home Classic)
      const inset = 36;
      ctx.strokeStyle = 'rgba(40, 40, 40, 0.22)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(inset, inset, pw - 2 * inset, ph - 2 * inset);

      ctx.strokeStyle = 'rgba(40, 40, 40, 0.10)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(inset + 6, inset + 6, pw - 2 * (inset + 6), ph - 2 * (inset + 6));

      // Top Header
      ctx.font = '500 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(80, 80, 80, 0.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('N O T E B O O K', pw / 2, inset + 45);

      ctx.strokeStyle = 'rgba(70, 70, 70, 0.20)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 24, inset + 53);
      ctx.lineTo(pw / 2 + 24, inset + 53);
      ctx.stroke();

      // Presentation Title
      ctx.font = '700 24px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';

      const maxTextW = pw - 2 * inset - 60;
      const titleStartY = ph * 0.40;
      const endTitleY = drawWrappedText(ctx, titleText, pw / 2, titleStartY, maxTextW, 31);

      // Optional Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#57534e';
        ctx.fillText(options.studyTitle, pw / 2, endTitleY + 24);
      }

      // Delicate accent rule
      const dividerY = endTitleY + (options.studyTitle ? 44 : 28);
      ctx.strokeStyle = 'rgba(70, 70, 70, 0.18)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(pw / 2 - 32, dividerY);
      ctx.lineTo(pw / 2 + 32, dividerY);
      ctx.stroke();

      // Author & Date Block
      let metaY = ph * 0.72;
      if (options.coverAuthor) {
        ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#292524';
        ctx.fillText(options.coverAuthor, pw / 2, metaY);
        metaY += 18;
      }

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#78716c';
      ctx.fillText(dateFormatted, pw / 2, metaY);
    }
  }

  return {
    renderPreview,
    resetCache,
  };
});
