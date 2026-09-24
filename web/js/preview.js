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

  const coverImageCache = {};
  function getCoverImage(name) {
    const src = 'covers/' + name + '.jpg';
    if (!coverImageCache[name]) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        window.dispatchEvent(new CustomEvent('slideprinter-cover-loaded'));
      };
      coverImageCache[name] = img;
    }
    return coverImageCache[name];
  }

  function renderPreviewEditorialCover(ctx, pw, ph, options) {
    const tpl = (options.coverTemplate || 'atelier').toLowerCase();
    const titleText = options.coverTitle || 'Presentation';
    const dateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const gutterMap = { binder: 30.0, ring: 30.0, rings: 30.0, spiral: 22.0, espiral: 22.0, coil: 22.0, none: 0.0 };
    const binding = (options.binding || 'none').toLowerCase();
    const gutterMargin = typeof options.gutterMargin === 'number'
      ? options.gutterMargin
      : (options.gutter !== undefined ? Number(options.gutter) : (gutterMap[binding] || 0.0));
    const pageNum = options.pageNum || 1;
    const isOddSheet = (pageNum % 2 !== 0);
    const isVerso = options.duplex ? !isOddSheet : false;
    const leftGutter = isVerso ? 0 : gutterMargin;
    const rightGutter = isVerso ? gutterMargin : 0;

    const userMargin = options.margin !== undefined ? Number(options.margin) : 40.0;
    const m = Math.max(userMargin, 20.0);
    const x1 = leftGutter + m;
    const x2 = pw - rightGutter - m;
    const w = x2 - x1;
    const centerX = x1 + w / 2;

    if (tpl === 'george') {
      // 1. George 90s Editorial / JFK Jr Executive Style
      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;

      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x1, 58);
      ctx.lineTo(x2, 58);
      ctx.stroke();

      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, 63);
      ctx.lineTo(x2, 63);
      ctx.stroke();

      // Header Folio
      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#1e1e24';
      ctx.textAlign = 'left';
      ctx.fillText('STUDY DOSSIER', x1, 50);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.fillText('EXECUTIVE BRIEF · 90S ARCHIVE', x2, 50);

      // Display Title (Authoritative, Left-aligned)
      ctx.font = '700 28px "Playfair Display", "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#0f0f11';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.36, w - 20, 36);

      // Subtitle / Subject
      let dividerY = endTitleY + 24;
      if (options.studyTitle) {
        ctx.font = 'italic 13.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, x1, dividerY);
        dividerY += 28;
      }

      // Sleek short divider rule
      ctx.strokeStyle = 'rgba(30, 30, 36, 0.25)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1, dividerY);
      ctx.lineTo(x1 + 80, dividerY);
      ctx.stroke();

      // Structured metadata grid at bottom
      const metaY = ph * 0.82;
      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x1, metaY - 32);
      ctx.lineTo(x2, metaY - 32);
      ctx.stroke();

      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'left';
      ctx.fillText('AUTHOR / STUDENT', x1, metaY - 18);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(options.coverAuthor || 'General Notes', x1, metaY);

      const col2X = x1 + w * 0.52;
      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('DATE / COMPILATION', col2X, metaY - 18);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(dateFormatted, col2X, metaY);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.fillText('Archival Executive Copy', x2, metaY + 16);

    } else if (tpl === 'monograph') {
      // 2. Archival Monograph (Heritage Stationery Bookplate)
      const inset = 34;
      const x1 = leftGutter + inset;
      const x2 = pw - rightGutter - inset;
      const w = x2 - x1;

      ctx.strokeStyle = 'rgba(75, 85, 99, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x1, inset, w, ph - 2 * inset);

      const boxW = Math.min(w - 70, 420);
      const boxH = 190;
      const boxX = centerX - boxW / 2;
      const boxY = ph * 0.38;

      ctx.strokeStyle = 'rgba(30, 30, 36, 0.4)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = 'rgba(30, 30, 36, 0.15)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(boxX + 4.5, boxY + 4.5, boxW - 9, boxH - 9);

      ctx.font = '400 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.fillText('M O N O G R A P H   ·   N O T E S', centerX, boxY + 26);

      ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(centerX - 20, boxY + 33);
      ctx.lineTo(centerX + 20, boxY + 33);
      ctx.stroke();

      ctx.font = '700 20px "Playfair Display", "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111827';
      const titleY = boxY + boxH * 0.45;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, titleY, boxW - 36, 26, 'center');

      if (options.studyTitle) {
        ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, centerX, endTitleY + 20);
      }

      let metaY = ph * 0.70;
      if (options.coverAuthor) {
        ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#1f2937';
        ctx.fillText(options.coverAuthor, centerX, metaY);
        metaY += 18;
      }

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`Date: ${dateFormatted}`, centerX, metaY);

    } else if (tpl === 'bauhaus') {
      // 3. Swiss Modernist Bauhaus Layout
      const m = 48;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const vertX = x1 + 28;

      ctx.strokeStyle = 'rgba(30, 30, 36, 0.18)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(vertX, m);
      ctx.lineTo(vertX, ph - m);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, m + 20);
      ctx.lineTo(x2, m + 20);
      ctx.stroke();

      ctx.font = '700 8px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'left';
      ctx.fillText('VOLUME I  ·  STUDY COMPENDIUM', vertX + 14, m + 14);

      ctx.font = '700 24px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#111827';
      const endTitleY = drawWrappedText(ctx, titleText, vertX + 14, ph * 0.36, x2 - (vertX + 14), 30);

      if (options.studyTitle) {
        ctx.font = 'italic 400 12.5px "Inter", "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, vertX + 14, endTitleY + 22);
      }

      const metaY = ph * 0.70;
      ctx.font = '700 7px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('STUDENT:', vertX + 14, metaY);

      ctx.font = '500 10.5px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(options.coverAuthor || 'General Notes', vertX + 14, metaY + 16);

      ctx.font = '700 7px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('DATE:', vertX + 14, metaY + 36);

      ctx.font = '500 10.5px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(dateFormatted, vertX + 14, metaY + 52);

    } else if (tpl === 'nineteen00s' || tpl === '1900s' || tpl === '1900' || tpl === '00s') {
      // 1900s Art Nouveau & Belle Époque
      const m = 40;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;
      const bordeaux = '#4a1525';
      const gold = '#c5a059';

      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = bordeaux;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = bordeaux;
      ctx.textAlign = 'center';
      ctx.fillText('ART NOUVEAU ARCHIVE · TURN OF THE CENTURY', centerX, m + 42);

      const lozY = ph * 0.35;
      ctx.strokeStyle = bordeaux;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(centerX, lozY, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(centerX, lozY, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#241a1c';
      const endTitleY = drawWrappedText(ctx, titleText, centerX, lozY + 40, w - 60, 33);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = bordeaux;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 22;
      }

      ctx.strokeStyle = gold;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(centerX - 45, subY); ctx.lineTo(centerX + 45, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = gold;
      ctx.fillText('STUDENT / AUTHOR', centerX, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = bordeaux;
      ctx.fillText(options.coverAuthor || 'Belle Époque Edition', centerX, metaY + 14);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = gold;
      ctx.fillText(dateFormatted || 'Turn of the Century', centerX, metaY + 28);

    } else if (tpl === 'nineteen10s' || tpl === '1910s' || tpl === '1910' || tpl === '10s') {
      // 1910s Edwardian & Aviation Monograph
      const m = 42;
      const navy = '#1a2947';
      const goldMuted = '#b2945c';

      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = navy;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = goldMuted;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));

      ctx.strokeStyle = navy;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x2 - 110, m + 14, 96, 26);
      ctx.font = '700 6.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = navy;
      ctx.textAlign = 'center';
      ctx.fillText('REGISTRY NO. 1914-SP', x2 - 62, m + 27);
      ctx.font = '5.5px system-ui, -apple-system, sans-serif';
      ctx.fillText('TELEGRAPH DOSSIER', x2 - 62, m + 35);

      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = navy;
      ctx.textAlign = 'left';
      ctx.fillText('E D W A R D I A N   D O S S I E R   ·   1 9 1 0 s', x1 + 16, m + 26);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = goldMuted;
      ctx.fillText('EARLY MODERNIST MONOGRAPH · AVIATION ERA', x1 + 16, m + 38);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = navy;
      const endTitleY = drawWrappedText(ctx, titleText, x1 + 16, ph * 0.38, w - 50, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = goldMuted;
        ctx.fillText(options.studyTitle, x1 + 16, subY);
        subY += 22;
      }

      ctx.strokeStyle = navy;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1 + 16, subY); ctx.lineTo(x1 + 90, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = goldMuted;
      ctx.fillText('AUTHOR / CORRESPONDENT', x1 + 16, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = navy;
      ctx.fillText(options.coverAuthor || 'Edwardian Edition', x1 + 16, metaY + 14);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = goldMuted;
      ctx.fillText(dateFormatted || 'Archival Record 1910', x1 + 16, metaY + 28);

    } else if (tpl === 'twenties' || tpl === '20s' || tpl === '1920s' || tpl === '1920' || tpl === 'artdeco' || tpl === 'gatsby') {
      // 1920s Art Deco & Roaring Twenties
      const m = 40;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;
      const decoBlack = '#1a1a1e';
      const decoGold = '#d1a647';

      ctx.fillStyle = '#faf8f2';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = decoBlack;
      ctx.lineWidth = 2.0;
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = decoGold;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x1 + 4.5, m + 4.5, w - 9, ph - 2 * (m + 4.5));
      ctx.lineWidth = 0.4;
      ctx.strokeRect(x1 + 8, m + 8, w - 16, ph - 2 * (m + 8.0));

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = decoGold;
      ctx.textAlign = 'center';
      ctx.fillText('★   A R T   D E C O   C O M P E N D I U M   ·   1 9 2 0 s   ★', centerX, m + 28);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = decoBlack;
      ctx.fillText('ROARING TWENTIES EDITORIAL · GATSBY ARCHIVE', centerX, m + 42);

      const lozY = ph * 0.35;
      ctx.strokeStyle = decoBlack;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX, lozY - 15);
      ctx.lineTo(centerX + 15, lozY);
      ctx.lineTo(centerX, lozY + 15);
      ctx.lineTo(centerX - 15, lozY);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = decoGold;
      ctx.beginPath();
      ctx.arc(centerX, lozY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = decoBlack;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, lozY + 42, w - 60, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = decoGold;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 22;
      }

      ctx.strokeStyle = decoGold;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX - 45, subY); ctx.lineTo(centerX + 45, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = decoGold;
      ctx.fillText('CURATOR / STUDENT', centerX, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = decoBlack;
      ctx.fillText(options.coverAuthor || 'Gatsby Edition', centerX, metaY + 14);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = decoGold;
      ctx.fillText(dateFormatted || '1920s Archive', centerX, metaY + 28);

    } else if (tpl === 'thirties' || tpl === '30s' || tpl === '1930s' || tpl === '1930' || tpl === 'streamline') {
      // 1930s Streamline Moderne & Constructivism
      const m = 42;
      const copper = '#994729';
      const slate = '#384252';

      ctx.fillStyle = '#f8f8f6';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = slate;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.strokeStyle = copper;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, m + 45); ctx.lineTo(x2, m + 45);
      ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, m + 49); ctx.lineTo(x2, m + 49);
      ctx.stroke();

      ctx.font = '700 8.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slate;
      ctx.textAlign = 'left';
      ctx.fillText('STREAMLINE MODERNE  ·  DOSSIER 1935', x1 + 14, m + 32);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = copper;
      ctx.textAlign = 'right';
      ctx.fillText('INDUSTRIAL DESIGN ARCHIVE', x2 - 14, m + 32);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = slate;
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1 + 14, ph * 0.38, w - 50, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = copper;
        ctx.fillText(options.studyTitle, x1 + 14, subY);
        subY += 22;
      }

      ctx.strokeStyle = copper;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, subY); ctx.lineTo(x1 + 100, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = copper;
      ctx.fillText('DESIGNER / AUTHOR', x1 + 14, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = slate;
      ctx.fillText(options.coverAuthor || 'Streamline Monograph', x1 + 14, metaY + 14);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = copper;
      ctx.fillText(dateFormatted || '1930s Edition', x1 + 14, metaY + 28);

    } else if (tpl === 'forties' || tpl === '40s' || tpl === '1940s' || tpl === '1940' || tpl === 'typewriter' || tpl === 'postwar') {
      // 1940s Typewriter Dossier & Post-War Press Release
      const m = 40;
      const inkBlack = '#1e1e24';
      const stampRed = '#b22626';

      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = inkBlack;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.strokeStyle = stampRed;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x2 - 130, m + 14, 116, 24);
      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = stampRed;
      ctx.textAlign = 'center';
      ctx.fillText('CONFIDENTIAL STUDY FILE', x2 - 72, m + 26);
      ctx.font = '5.5px monospace, monospace';
      ctx.fillText('PRESS & RESEARCH DOSSIER', x2 - 72, m + 34);

      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkBlack;
      ctx.textAlign = 'left';
      ctx.fillText('[ DOSSIER 1944 ] :: OFFICIAL BRIEF', x1 + 16, m + 28);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkBlack;
      const endTitleY = drawWrappedText(ctx, titleText, x1 + 16, ph * 0.38, w - 50, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#555555';
        ctx.fillText(options.studyTitle, x1 + 16, subY);
        subY += 22;
      }

      ctx.strokeStyle = inkBlack;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1 + 16, subY); ctx.lineTo(x1 + 110, subY);
      ctx.stroke();

      const metaY = ph * 0.78;
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkBlack;
      ctx.fillText(`[ OPERATOR ] : ${options.coverAuthor || 'Anonymous.44'}`, x1 + 16, metaY);
      ctx.fillText(`[ TIMESTAMP] : ${dateFormatted}`, x1 + 16, metaY + 16);
      ctx.fillText(`[ DATASETS ] : ${options.totalPages || 0} Slides Compiled // Monograph`, x1 + 16, metaY + 32);

    } else if (tpl === 'fifties' || tpl === '50s') {
      // 4. Fifties: Mid-Century Pelican / Penguin Tri-Band
      const m = 40;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;
      const band1H = ph * 0.32;
      const band2H = ph * 0.38;
      const band3H = ph * 0.30;

      // Top color band
      ctx.fillStyle = '#d9653b';
      ctx.fillRect(0, 0, pw, band1H);

      ctx.font = '700 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('P E L I C A N   C O M P E N D I U M', centerX, band1H * 0.52);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText('SERIES IN STUDY & SCHOLARSHIP · NO. 52', centerX, band1H * 0.68);

      // Middle white band
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, band1H, pw, band2H);

      // Diamond emblem
      const emblemY = band1H + 34;
      ctx.strokeStyle = '#d9653b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX, emblemY - 10);
      ctx.lineTo(centerX + 10, emblemY);
      ctx.lineTo(centerX, emblemY + 10);
      ctx.lineTo(centerX - 10, emblemY);
      ctx.closePath();
      ctx.stroke();

      // Title
      ctx.font = '700 24px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';
      const endTitleY = drawWrappedText(ctx, titleText, centerX, band1H + 78, w - 40, 31);

      // Optional Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#57534e';
        ctx.fillText(options.studyTitle, centerX, endTitleY + 22);
      }

      // Bottom color band
      ctx.fillStyle = '#d9653b';
      ctx.fillRect(0, band1H + band2H, pw, band3H);

      ctx.font = '700 11px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const authorText = (options.coverAuthor || 'STUDENT COMPOSITION').toUpperCase();
      ctx.fillText(authorText, centerX, band1H + band2H + band3H * 0.38);

      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(`${dateFormatted} · MID-CENTURY EDITION`, centerX, band1H + band2H + band3H * 0.52);

    } else if (tpl === 'sixties' || tpl === '60s') {
      // 5. Sixties: Swiss International Typography (Müller-Brockmann Style)
      const m = 44;
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, pw, ph);

      // Heavy black bar across top
      ctx.fillStyle = '#000000';
      ctx.fillRect(x1, m, w, 8);

      // Grid folio
      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText('01 / TYPOGRAFISCHE MONOGRAFIE', x1, m + 26);
      ctx.textAlign = 'right';
      ctx.fillText('SWISS INT. 1968 · ZÜRICH', x2, m + 26);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, m + 32);
      ctx.lineTo(x2, m + 32);
      ctx.stroke();

      // Bold Swiss title
      ctx.font = '700 30px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.36, w, 38);

      // Subtitle
      let midRuleY = endTitleY + 24;
      if (options.studyTitle) {
        ctx.font = '500 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(options.studyTitle, x1, midRuleY);
        midRuleY += 24;
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1, midRuleY);
      ctx.lineTo(x2, midRuleY);
      ctx.stroke();

      // Bottom metadata
      const metaY = ph * 0.82;
      ctx.font = '700 7.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'left';
      ctx.fillText('AUTHOR / BEARBEITER', x1, metaY);
      ctx.fillText('DATUM / DATE', x1 + w * 0.52, metaY);

      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(options.coverAuthor || 'Allgemeine Notizen', x1, metaY + 16);
      ctx.fillText(dateFormatted, x1 + w * 0.52, metaY + 16);

    } else if (tpl === 'seventies' || tpl === '70s') {
      // 6. Seventies: Retro Warm Groove & Apollo Style
      ctx.fillStyle = '#fcf9f2';
      ctx.fillRect(0, 0, pw, ph);

      const m = 40;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

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
      roundRect(leftGutter + 32, 32, pw - leftGutter - rightGutter - 64, ph - 64, 14);
      ctx.stroke();

      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 2.0;
      roundRect(leftGutter + 39, 39, pw - leftGutter - rightGutter - 78, ph - 78, 11);
      ctx.stroke();

      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1.8;
      roundRect(leftGutter + 46, 46, pw - leftGutter - rightGutter - 92, ph - 92, 8);
      ctx.stroke();

      // Top banner
      ctx.font = '700 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#d35400';
      ctx.textAlign = 'center';
      ctx.fillText('✦   V I N T A G E   D O S S I E R   ·   1 9 7 4   ✦', centerX, 76);

      // Title in warm espresso
      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#3e2213';
      ctx.textAlign = 'center';
      const endTitleY = drawWrappedText(ctx, titleText, centerX, ph * 0.40, w - 40, 34);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#b3541e';
        ctx.fillText(options.studyTitle, centerX, endTitleY + 24);
      }

      // Decorative triple groove lines
      const grooveY = endTitleY + (options.studyTitle ? 44 : 26);
      const gColors = ['#d35400', '#e67e22', '#5d4037'];
      for (let gi = 0; gi < 3; gi++) {
        ctx.strokeStyle = gColors[gi];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(centerX - 40, grooveY + gi * 4);
        ctx.lineTo(centerX + 40, grooveY + gi * 4);
        ctx.stroke();
      }

      // Bottom metadata
      const metaY = ph * 0.80;
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#3e2213';
      ctx.textAlign = 'center';
      ctx.fillText(options.coverAuthor || 'Apollo Edition', centerX, metaY);

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#7a5230';
      ctx.fillText(dateFormatted, centerX, metaY + 16);

    } else if (tpl === 'eighties' || tpl === '80s') {
      // 7. Eighties: Memphis Design & 1984 Technical Manual
      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      // Diagonal hatch box
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, m, 46, 46);

      ctx.lineWidth = 1.0;
      ctx.strokeStyle = '#0ea5e9';
      for (let d = -46; d <= 46; d += 8) {
        ctx.beginPath();
        ctx.moveTo(Math.max(x1, x1 + d), m + Math.max(0, -d));
        ctx.lineTo(Math.min(x1 + 46, x1 + 46 + d), m + Math.min(46, 46 - d));
        ctx.stroke();
      }

      // Header text
      ctx.font = '800 9px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText('PERSONAL STUDY SYSTEM // 1984', x1 + 58, m + 18);

      ctx.font = '500 7.5px monospace, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('REF. MODEL 84-MKII · MEMPHIS TECH EDITION', x1 + 58, m + 32);

      // Geometric rules
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x1, m + 58);
      ctx.lineTo(x2, m + 58);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x1, m + 62);
      ctx.lineTo(x1 + 96, m + 62);
      ctx.stroke();

      // Bold title
      ctx.font = '800 28px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.38, w - 30, 36);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#0ea5e9';
        ctx.fillText(options.studyTitle, x1, endTitleY + 24);
      }

      // Floating Memphis shapes
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x2 - 20, ph * 0.36, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(x2 - 30, ph * 0.39);
      ctx.lineTo(x2 - 20, ph * 0.41);
      ctx.lineTo(x2 - 40, ph * 0.41);
      ctx.closePath();
      ctx.fill();

      // Bottom operator card
      const bY = ph * 0.78;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x1, bY, w, 54);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(x1, bY, w, 54);

      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText('OPERATOR / STUDENT:', x1 + 14, bY + 18);
      ctx.fillText('TIMESTAMP:', x1 + w * 0.52, bY + 18);

      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(options.coverAuthor || 'SYSTEM USER 01', x1 + 14, bY + 36);

      ctx.font = '600 10px monospace, monospace';
      ctx.fillText(dateFormatted, x1 + w * 0.52, bY + 36);

    } else if (tpl === 'nineties' || tpl === '90s') {
      // 8. Nineties: Minimalist Editorial Lookbook / Indie Zine
      const m = 54;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      // Crop / registration marks at corners
      const corners = [[leftGutter + 30, 30], [pw - rightGutter - 30, 30], [leftGutter + 30, ph - 30], [pw - rightGutter - 30, ph - 30]];
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
      ctx.fillText('[ ISSUE 09 // LOOKBOOK ARCHIVE ]', x1, 52);
      ctx.textAlign = 'right';
      ctx.fillText('REF: 1994-AUTUMN-WINTER', x2, 52);

      // Title
      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.38, w, 36);

      // Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#555555';
        ctx.fillText(options.studyTitle, x1, endTitleY + 22);
      }

      // Subtle hairline divider
      const divY = endTitleY + (options.studyTitle ? 40 : 26);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, divY);
      ctx.lineTo(x2, divY);
      ctx.stroke();

      // Bottom metadata
      const metaY = ph * 0.82;
      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = '#777777';
      ctx.textAlign = 'left';
      ctx.fillText('DIRECTOR / STUDENT:', x1, metaY);
      ctx.fillText('COMPILATION DATE:', x1 + w * 0.52, metaY);

      ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#111111';
      ctx.fillText(options.coverAuthor || 'Studio Dossier', x1, metaY + 16);
      ctx.fillText(dateFormatted, x1 + w * 0.52, metaY + 16);

    } else if (tpl === 'twothousands' || tpl === '2000s' || tpl === '2000' || tpl === 'y2k' || tpl === 'noughties') {
      // 2000s Y2K Millennium Tech & Dot-Com Era
      const m = 42;
      const cobalt = '#0f4c9e';
      const cyanY2K = '#1aa3d1';

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, pw, ph);

      ctx.fillStyle = cobalt;
      ctx.fillRect(x1, m, w, 12);
      ctx.fillStyle = cyanY2K;
      ctx.fillRect(x1, m + 12, w, 3);

      ctx.strokeStyle = cobalt;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x2 - 44, m + 33, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = cobalt;
      ctx.textAlign = 'center';
      ctx.fillText('Y2K-2000', x2 - 44, m + 36);

      ctx.font = '700 8.5px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Y2K MILLENNIUM DOSSIER // DIGITAL ERA', x1, m + 34);

      ctx.font = '700 27px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#141e2e';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.38, w - 50, 35);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = cyanY2K;
        ctx.fillText(options.studyTitle, x1, subY);
        subY += 22;
      }

      ctx.strokeStyle = cyanY2K;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, subY); ctx.lineTo(x1 + 100, subY);
      ctx.stroke();

      const metaY = ph * 0.80;
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = cobalt;
      ctx.fillText(`<AUTHOR>    ${options.coverAuthor || 'Y2K.User'}`, x1, metaY);
      ctx.fillText(`<TIMESTAMP> ${dateFormatted}`, x1, metaY + 16);
      ctx.fillText(`<FOLIOS>    ${options.totalPages || 0} Slides Processed`, x1, metaY + 32);

    } else if (tpl === 'twenty10s' || tpl === '2010s' || tpl === '2010' || tpl === 'flatdesign' || tpl === 'startup') {
      // 2010s Flat Design & Startup Minimalist
      const m = 46;
      const charcoal = '#1a1e28';
      const indigo = '#5961e0';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pw, ph);

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = indigo;
      ctx.textAlign = 'left';
      ctx.fillText('2010s MINIMALIST // STARTUP EDITION', x1, m + 20);

      ctx.font = '7.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#80808d';
      ctx.textAlign = 'right';
      ctx.fillText('FLAT DESIGN ARCHIVE · VOL. 14', x2, m + 20);

      ctx.strokeStyle = 'rgba(30, 30, 40, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, m + 30); ctx.lineTo(x2, m + 30);
      ctx.stroke();

      ctx.font = '700 27px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = charcoal;
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1, ph * 0.38, w - 40, 35);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#666675';
        ctx.fillText(options.studyTitle, x1, subY);
        subY += 22;
      }

      ctx.fillStyle = indigo;
      ctx.beginPath();
      ctx.arc(x1 + 4, subY + 6, 3, 0, Math.PI * 2);
      ctx.fill();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = indigo;
      ctx.fillText('AUTHOR', x1, metaY);
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = charcoal;
      ctx.fillText(options.coverAuthor || 'Startup Notes', x1, metaY + 14);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = indigo;
      ctx.fillText('DATE', x1 + w * 0.52, metaY);
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = charcoal;
      ctx.fillText(dateFormatted || '2015 Edition', x1 + w * 0.52, metaY + 14);

    } else if (tpl === 'twentytwenties' || tpl === '2020s' || tpl === '2020' || tpl === 'neubrutalism' || tpl === 'contemporary' || tpl === 'ai_era') {
      // 2020s Modern Neubrutalism & Contemporary AI Era
      const m = 40;
      const pitchBlack = '#0d0d10';
      const emerald = '#0cb873';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pw, ph);

      ctx.strokeStyle = pitchBlack;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = pitchBlack;
      ctx.textAlign = 'left';
      ctx.fillText('[ 2020s // CONTEMPORARY STUDY FOLIO ]', x1 + 16, m + 24);

      ctx.fillStyle = emerald;
      ctx.fillRect(x2 - 80, m + 14, 64, 16);
      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = pitchBlack;
      ctx.textAlign = 'center';
      ctx.fillText('2026.AI', x2 - 48, m + 25);

      ctx.font = '700 27px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = pitchBlack;
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1 + 16, ph * 0.38, w - 50, 35);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#4a4a55';
        ctx.fillText(options.studyTitle, x1 + 16, subY);
        subY += 22;
      }

      ctx.fillStyle = pitchBlack;
      ctx.fillRect(x1 + 16, subY + 4, 120, 3);

      const boxY = ph * 0.80;
      const boxW = w - 32;
      const boxH = 56;
      const bx = x1 + 16;
      ctx.strokeStyle = pitchBlack;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, boxY, boxW, boxH);

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = pitchBlack;
      ctx.fillText(`AUTHOR    : ${options.coverAuthor || 'User.2020'}`, bx + 12, boxY + 18);
      ctx.fillText(`TIMESTAMP : ${dateFormatted}`, bx + 12, boxY + 34);
      ctx.fillText(`DATASETS  : ${options.totalPages || 0} Slide Folios`, bx + 12, boxY + 48);

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
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.strokeStyle = forestLight;
      ctx.lineWidth = 0.4;
      ctx.strokeRect(x1 + 4.5, m + 4.5, w - 9, ph - 2 * (m + 4.5));

      ctx.strokeStyle = brassGold;
      ctx.lineWidth = 0.6;
      for (const [cx, cy] of [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]]) {
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
        ctx.stroke();
      }

      ctx.fillStyle = forestDark;
      ctx.fillRect(x1 + 16, m + 14, w - 32, 24);

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#f8f9fa';
      ctx.textAlign = 'left';
      ctx.fillText('NATURAL COMPENDIUM // EDITORIAL STUDY FOLIO', x1 + 26, m + 29);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = brassGold;
      ctx.textAlign = 'right';
      ctx.fillText('VOL. 01 · DEEP FOREST ARCHIVE', x2 - 26, m + 29);

      ctx.fillStyle = brassGold;
      ctx.fillRect(x1 + 16, m + 38, w - 32, 1.2);

      const titleX = x1 + 22;
      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = forestMid;
      ctx.textAlign = 'left';
      ctx.fillText('STUDY DOSSIER · NATURAL EDITION', titleX, ph * 0.35);

      ctx.font = '700 27px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = forestDark;
      const endTitleY = drawWrappedText(ctx, titleText, titleX, ph * 0.39, w - 60, 35);

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
      ctx.lineTo(x2 - 22, ruleY);
      ctx.stroke();

      const gridY = ph * 0.80;
      const colW = (w - 44) / 2;

      ctx.strokeStyle = forestDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(titleX, gridY);
      ctx.lineTo(x2 - 22, gridY);
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
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.strokeStyle = 'rgba(85, 130, 101, 0.18)';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));

      const lozY = ph * 0.32;
      ctx.strokeStyle = sageDeep;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(centerX, lozY, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = blossomTint;
      ctx.beginPath();
      ctx.moveTo(centerX - 15, lozY); ctx.lineTo(centerX + 15, lozY);
      ctx.moveTo(centerX, lozY - 15); ctx.lineTo(centerX, lozY + 15);
      ctx.stroke();

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = sageDeep;
      ctx.textAlign = 'center';
      ctx.fillText('V E R N A L   C O M P E N D I U M', centerX, m + 28);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText('SPRING SERIES · NEW CYCLE · VOL. I', centerX, m + 42);

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#1c3022';
      const endTitleY = drawWrappedText(ctx, titleText, centerX, lozY + 42, w - 60, 33);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = sageSoft;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 22;
      }

      ctx.strokeStyle = sageSoft;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 36, subY); ctx.lineTo(centerX + 36, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText('CURATED STUDY FOLIO', centerX, metaY);

      ctx.font = '10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageDeep;
      ctx.fillText(options.coverAuthor || 'Spring Session Notes', centerX, metaY + 14);

      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = sageSoft;
      ctx.fillText(dateFormatted || 'Springtime', centerX, metaY + 28);

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
      ctx.fillText('SOLSTICE COMPENDIUM · SUMMER FOLIO', x1, 22);
      ctx.textAlign = 'right';
      ctx.fillText('MEDITERRANEAN ARCHIVE // 02', x2, 22);

      ctx.strokeStyle = 'rgba(15, 58, 99, 0.25)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x1, barH + 16, w, ph - barH - m - 16);

      ctx.font = '700 27px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.textAlign = 'left';
      const endTitleY = drawWrappedText(ctx, titleText, x1 + 18, ph * 0.38, w - 50, 35);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 13px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#3a668f';
        ctx.fillText(options.studyTitle, x1 + 18, subY);
        subY += 22;
      }

      ctx.strokeStyle = azureDeep;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1 + 18, subY); ctx.lineTo(x1 + 80, subY);
      ctx.stroke();
      ctx.strokeStyle = solarGold;
      ctx.beginPath();
      ctx.moveTo(x1 + 80, subY); ctx.lineTo(x1 + 120, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = solarGold;
      ctx.fillText('STUDY RESEARCHER', x1 + 18, metaY);
      ctx.font = '10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.fillText(options.coverAuthor || 'Summer Study Compendium', x1 + 18, metaY + 14);

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = solarGold;
      ctx.fillText('CALENDAR REGISTRY', x1 + 18, metaY + 28);
      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = azureDeep;
      ctx.fillText(dateFormatted || 'Summer Solstice', x1 + 18, metaY + 40);

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
      ctx.strokeRect(x1, m, w, ph - 2 * m);

      ctx.strokeStyle = terracotta;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = terracotta;
      ctx.textAlign = 'center';
      ctx.fillText('E Q U I N O X   D O S S I E R', centerX, m + 28);

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = amber;
      ctx.fillText('AUTUMNAL COMPENDIUM · OCTOBER ARCHIVE', centerX, m + 42);

      const lozY = ph * 0.35;
      ctx.strokeStyle = terracotta;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(centerX, lozY - 11);
      ctx.lineTo(centerX + 11, lozY);
      ctx.lineTo(centerX, lozY + 11);
      ctx.lineTo(centerX - 11, lozY);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = amber;
      ctx.beginPath();
      ctx.arc(centerX, lozY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = espresso;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, lozY + 40, w - 60, 32);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = terracotta;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 22;
      }

      ctx.strokeStyle = amber;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(centerX - 45, subY); ctx.lineTo(centerX + 45, subY);
      ctx.stroke();

      const boxY = ph * 0.80;
      const boxW = w - 40;
      const boxH = 55;
      const bx = centerX - boxW / 2;
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
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = 'rgba(82, 117, 153, 0.25)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));
      ctx.strokeRect(x1 + 7, m + 7, w - 14, ph - 2 * (m + 7));

      const starY = ph * 0.32;
      ctx.strokeStyle = slateBlue;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(centerX, starY, 13, 0, Math.PI * 2);
      ctx.stroke();
      for (const deg of [0, 60, 120]) {
        const rad = (deg * Math.PI) / 180;
        const dx = 17 * Math.cos(rad);
        const dy = 17 * Math.sin(rad);
        ctx.beginPath();
        ctx.moveTo(centerX - dx, starY - dy); ctx.lineTo(centerX + dx, starY + dy);
        ctx.stroke();
      }

      ctx.font = '700 8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = midnight;
      ctx.textAlign = 'center';
      ctx.fillText('HIEMAL COMPENDIUM · ARCTIC ARCHIVE', centerX, m + 28);
      ctx.font = '7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText('NORDIC ALPINE EDITION · NO. 04', centerX, m + 42);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = midnight;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, starY + 44, w - 60, 34);

      let subY = endTitleY + 22;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = slateBlue;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 22;
      }

      ctx.strokeStyle = slateBlue;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 30, subY); ctx.lineTo(centerX + 30, subY);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText('OPERATOR / CURATOR', centerX, metaY);
      ctx.font = '9.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = midnight;
      ctx.fillText(options.coverAuthor || 'Winter Session', centerX, metaY + 14);
      ctx.font = '8px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = slateBlue;
      ctx.fillText(dateFormatted || 'Winter Season', centerX, metaY + 28);

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
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x1 + 4.5, m + 4.5, w - 9, ph - 2 * (m + 4.5));
      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 0.4;
      ctx.strokeRect(x1 + 8, m + 8, w - 16, ph - 2 * (m + 8.0));

      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.textAlign = 'center';
      ctx.fillText('P O L O   S T U D Y   C O M P E N D I U M', centerX, m + 28);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGreen;
      ctx.fillText('HERITAGE COLLEGIATE ARCHIVE · EST. 1967', centerX, m + 42);

      const shieldY = ph * 0.34;
      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX, shieldY - 16);
      ctx.lineTo(centerX + 16, shieldY);
      ctx.lineTo(centerX, shieldY + 16);
      ctx.lineTo(centerX - 16, shieldY);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(centerX, shieldY, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 11, shieldY); ctx.lineTo(centerX + 11, shieldY);
      ctx.moveTo(centerX, shieldY - 11); ctx.lineTo(centerX, shieldY + 11);
      ctx.stroke();

      ctx.font = '700 5.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.fillText('RL', centerX, shieldY + 2);

      ctx.font = '700 26px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, shieldY + 44, w - 60, 34);

      let subY = endTitleY + 20;
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = rlGreen;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 20;
      }

      ctx.strokeStyle = rlNavy;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, subY); ctx.lineTo(centerX + 40, subY);
      ctx.stroke();
      ctx.strokeStyle = rlGold;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 25, subY + 3); ctx.lineTo(centerX + 25, subY + 3);
      ctx.stroke();

      const metaY = ph * 0.82;
      ctx.font = '700 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGold;
      ctx.fillText('FELLOW / STUDENT RECORD', centerX, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlNavy;
      ctx.fillText(options.coverAuthor || 'Collegiate Member', centerX, metaY + 15);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = rlGreen;
      ctx.fillText(dateFormatted || 'Academic Term', centerX, metaY + 28);

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
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeStyle = brass;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x1 + 4, m + 4, w - 8, ph - 2 * (m + 4));

      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 0.4;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1 + 7.5, m + 7.5, w - 15, ph - 2 * (m + 7.5));
      ctx.setLineDash([]);

      ctx.font = '700 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      ctx.textAlign = 'center';
      ctx.fillText('E Q U E S T R I A N   &   F I E L D', centerX, m + 28);
      ctx.font = 'italic 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText('COUNTRY ESTATE ARCHIVE · SERIES IX', centerX, m + 42);

      const stirrupY = ph * 0.34;
      ctx.strokeStyle = brass;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX - 13, stirrupY - 12);
      ctx.lineTo(centerX - 13, stirrupY + 8);
      ctx.lineTo(centerX + 13, stirrupY + 8);
      ctx.lineTo(centerX + 13, stirrupY - 12);
      ctx.stroke();
      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX - 16, stirrupY + 8); ctx.lineTo(centerX + 16, stirrupY + 8);
      ctx.stroke();

      ctx.font = '700 25px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, stirrupY + 38, w - 60, 33);

      let subY = endTitleY + 20;
      if (options.studyTitle) {
        ctx.font = 'italic 12px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = saddleTan;
        ctx.fillText(options.studyTitle, centerX, subY);
        subY += 20;
      }

      ctx.strokeStyle = saddleTan;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(centerX - 45, subY); ctx.lineTo(centerX + 45, subY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = brass;
      ctx.beginPath();
      ctx.arc(centerX - 50, subY, 2, 0, Math.PI * 2);
      ctx.arc(centerX + 50, subY, 2, 0, Math.PI * 2);
      ctx.fill();

      const metaY = ph * 0.82;
      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText('ESTATE REGISTER', centerX, metaY);
      ctx.font = '700 10.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = hunterGreen;
      ctx.fillText(options.coverAuthor || 'Estate Member', centerX, metaY + 15);
      ctx.font = 'italic 8.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = saddleTan;
      ctx.fillText(dateFormatted || 'Season Archive', centerX, metaY + 28);

    } else if (tpl === 'quantum_flat' || tpl.includes('quantum_flat') || tpl.includes('mecanica_cuantica_flat') || tpl.includes('cuantica_flat') || tpl.includes('mq3_flat') || tpl.includes('atomic_flat')) {
      // Flat 90s Minimalist: Mecánica Cuántica III
      ctx.fillStyle = '#faf9f6';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#1e1b4b';
      const inkViolet = '#6d28d9';
      const inkMuted = '#6b7280';
      const hairline = 'rgba(30, 27, 75, 0.25)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'left';
      ctx.fillText('[ PREPRINT QM-III // THEORETICAL & ATOMIC PHYSICS ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('Ĥ |ψ⟩ = E |ψ⟩  ·  L⃗·S⃗  ·  σ_tot = (4π/k) Im f(0)', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const qmTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'QUANTUM MECHANICS III';
      const endTitleY = drawWrappedText(ctx, qmTitle, x1 + 14, m + 68, w - 28, 32);

      const qmSub = options.studyTitle || 'Dirac Fine Structure · Hyperfine Interactions · Hartree-Fock · Collision Theory';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(qmSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: Quantum Harmonic Oscillator Well & Wavefunctions
      const diagCy = ph * 0.44;
      const diagW = Math.min(w * 0.78, 300);
      const diagX1 = centerX - diagW / 2;
      const diagX2 = centerX + diagW / 2;

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * 2 - 1;
        const px = centerX + t * (diagW * 0.42);
        const py = diagCy + 70 - (t * t) * 130;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const levelLabels = ['E₀ = ½ħω', 'E₁ = ³⁄₂ħω', 'E₂ = ⁵⁄₂ħω', 'E₃ = ⁷⁄₂ħω'];
      for (let n = 0; n < 4; n++) {
        const ly = diagCy + 50 - n * 32;
        const lw = diagW * (0.35 + n * 0.14);
        const lx1 = centerX - lw / 2;
        const lx2 = centerX + lw / 2;

        ctx.strokeStyle = inkMuted;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(lx1, ly); ctx.lineTo(lx2, ly);
        ctx.stroke();

        ctx.font = '700 7px monospace, monospace';
        ctx.fillStyle = inkViolet;
        ctx.textAlign = 'left';
        ctx.fillText(levelLabels[n], lx2 + 6, ly + 2.5);

        ctx.strokeStyle = inkViolet;
        ctx.lineWidth = (n === 0 || n === 1) ? 1.0 : 0.7;
        ctx.beginPath();
        const wSteps = 36;
        for (let ws = 0; ws <= wSteps; ws++) {
          const wt = (ws / wSteps) * 2 - 1;
          const wx = centerX + wt * (lw * 0.46);
          const env = Math.exp(-2.5 * wt * wt);
          let amp = 0;
          if (n === 0) amp = 14 * env;
          else if (n === 1) amp = 16 * (wt * 2) * env;
          else if (n === 2) amp = 14 * (4 * wt * wt - 1) * env;
          else amp = 14 * (8 * wt * wt * wt - 6 * wt) * 0.5 * env;
          const wy = ly - amp;
          if (ws === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = inkDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(diagX1 + 10, diagCy + 70); ctx.lineTo(diagX2 - 10, diagCy + 70);
      ctx.stroke();

      ctx.font = 'italic 8px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'center';
      ctx.fillText('x (Position / Spatial Coordinate)', centerX, diagCy + 84);
      ctx.textAlign = 'right';
      ctx.fillText('+∞', diagX2 - 10, diagCy + 84);
      ctx.textAlign = 'left';
      ctx.fillText('-∞', diagX1 + 10, diagCy + 84);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'left';
      ctx.fillText('CURATOR / STUDENT', x1 + 14, metaY + 16);
      ctx.fillText('TERM / CONVOCATION', x1 + w * 0.42, metaY + 16);
      ctx.fillText('VOLUME / REF', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Department of Theoretical Physics', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'Academic Semester', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Complete Dossier', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'biophysics_flat' || tpl.includes('biophysics_flat') || tpl.includes('biofisica_flat') || tpl.includes('alphafold_flat')) {
      // Flat 90s Minimalist: Biofísica
      ctx.fillStyle = '#f7faf9';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#064e3b';
      const inkTeal = '#0d9488';
      const inkMuted = '#64748b';
      const hairline = 'rgba(6, 78, 59, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkTeal;
      ctx.textAlign = 'left';
      ctx.fillText('[ MOLECULAR BIOPHYSICS // MONOGRAPH DOSSIER ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('ΔG = ΔH - TΔS  ·  k_B T ln(K_eq)', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const bioTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'BIOPHYSICS';
      const endTitleY = drawWrappedText(ctx, bioTitle, x1 + 14, m + 68, w - 28, 32);

      const bioSub = options.studyTitle || 'Macromolecular Thermodynamics · Machine Learning · Turing Patterns · Hodgkin-Huxley';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(bioSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: Interlaced DNA Double Helix
      const diagCy = ph * 0.44;
      const helixH = 160;
      const helixW = 70;
      const helixTop = diagCy - helixH / 2;
      const numTurns = 2.5;
      const rungs = 14;

      for (let r = 0; r <= rungs; r++) {
        const ry = helixTop + (r / rungs) * helixH;
        const phase = (r / rungs) * numTurns * 2 * Math.PI;
        const rx1 = centerX + Math.sin(phase) * (helixW / 2);
        const rx2 = centerX - Math.sin(phase) * (helixW / 2);
        ctx.strokeStyle = inkTeal;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(rx1, ry); ctx.lineTo(rx2, ry);
        ctx.stroke();

        ctx.fillStyle = inkDark;
        ctx.beginPath(); ctx.arc(rx1, ry, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx2, ry, 2, 0, Math.PI * 2); ctx.fill();
      }

      for (let strand = 0; strand < 2; strand++) {
        ctx.strokeStyle = strand === 0 ? inkDark : inkTeal;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const sPts = 60;
        for (let sp = 0; sp <= sPts; sp++) {
          const py = helixTop + (sp / sPts) * helixH;
          const phase = (sp / sPts) * numTurns * 2 * Math.PI + (strand === 0 ? 0 : Math.PI);
          const px = centerX + Math.sin(phase) * (helixW / 2);
          if (sp === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      const scaleX = centerX + helixW / 2 + 28;
      ctx.strokeStyle = inkMuted;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(scaleX, diagCy - 40); ctx.lineTo(scaleX, diagCy + 40);
      ctx.moveTo(scaleX - 3, diagCy - 40); ctx.lineTo(scaleX + 3, diagCy - 40);
      ctx.moveTo(scaleX - 3, diagCy + 40); ctx.lineTo(scaleX + 3, diagCy + 40);
      ctx.stroke();

      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = inkMuted;
      ctx.textAlign = 'left';
      ctx.fillText('PITCH: 3.4 nm (10 bp)', scaleX + 6, diagCy + 2.5);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkTeal;
      ctx.textAlign = 'left';
      ctx.fillText('INVESTIGATOR / SCHOLAR', x1 + 14, metaY + 16);
      ctx.fillText('REGISTRATION DATE', x1 + w * 0.42, metaY + 16);
      ctx.fillText('DOSSIER / PAGES', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Biophysics Laboratory', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'Research Archive', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Complete Dossier', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'complex_systems_flat' || tpl.includes('complex_systems_flat') || tpl.includes('sistemas_complejos_flat') || tpl.includes('chaos_flat') || tpl.includes('atmospheric_flat') || tpl.includes('atmosferica_flat')) {
      // Flat 90s Minimalist: Física de los Sistemas Complejos
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#0f172a';
      const inkAmber = '#d97706';
      const inkMuted = '#64748b';
      const hairline = 'rgba(15, 23, 42, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkAmber;
      ctx.textAlign = 'left';
      ctx.fillText('[ NONLINEAR DYNAMICS // COMPLEX SYSTEMS & CHAOS ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('ẋ=σ(y-x) · ẏ=x(ρ-z)-y · ż=xy-βz · δ≈4.6692', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const cTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'PHYSICS OF COMPLEX SYSTEMS';
      const endTitleY = drawWrappedText(ctx, cTitle, x1 + 14, m + 68, w - 28, 30);

      const cSub = options.studyTitle || 'Nonlinear Dynamics · Lorenz Strange Attractor · Complex Networks · Criticality';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(cSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: Lorenz Strange Attractor Butterfly Orbits
      const diagCy = ph * 0.44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 120, diagCy); ctx.lineTo(centerX + 120, diagCy);
      ctx.moveTo(centerX, diagCy - 75); ctx.lineTo(centerX, diagCy + 70);
      ctx.stroke();

      ctx.font = '700 7px monospace, monospace';
      ctx.fillStyle = inkMuted;
      ctx.textAlign = 'left';
      ctx.fillText('X', centerX + 122, diagCy + 2.5);
      ctx.fillText('Z', centerX - 3, diagCy - 78);

      for (let loop = 0; loop < 4; loop++) {
        ctx.strokeStyle = (loop % 2 === 1) ? inkAmber : inkDark;
        ctx.lineWidth = loop === 3 ? 0.9 : 0.6;
        const rx = 42 + loop * 14;
        const ry = 35 + loop * 9;
        ctx.beginPath();
        ctx.ellipse(centerX - 48, diagCy, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let loop = 0; loop < 4; loop++) {
        ctx.strokeStyle = (loop % 2 === 0) ? inkAmber : inkDark;
        ctx.lineWidth = loop === 3 ? 0.9 : 0.6;
        const rx = 42 + loop * 14;
        const ry = 35 + loop * 9;
        ctx.beginPath();
        ctx.ellipse(centerX + 48, diagCy, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = inkAmber;
      ctx.beginPath(); ctx.arc(centerX - 48, diagCy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(centerX + 48, diagCy, 3, 0, Math.PI * 2); ctx.fill();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkMuted;
      ctx.textAlign = 'center';
      ctx.fillText('LORENZ (1963) · σ = 10.0 · ρ = 28.0 · β = 8/3 · DIM = 2.06', centerX, diagCy + 72);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkAmber;
      ctx.textAlign = 'left';
      ctx.fillText('OPERATOR / RESEARCHER', x1 + 14, metaY + 16);
      ctx.fillText('DATE / REGISTER', x1 + w * 0.42, metaY + 16);
      ctx.fillText('VOLUME / DOSSIER', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Complex Systems Research Group', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'Chaos & Dynamics Log', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Theoretical Fascicle', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'materials_sim_flat' || tpl.includes('materials_sim_flat') || tpl.includes('simulacion_materiales_flat') || tpl.includes('simulacion_fisica_materiales_flat') || tpl.includes('fortran_flat') || tpl.includes('materiales_flat')) {
      // Flat 90s Minimalist: Simulación en Física de Materiales
      ctx.fillStyle = '#f6f8f6';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#18181b';
      const inkGreen = '#15803d';
      const inkMuted = '#71717a';
      const hairline = 'rgba(24, 24, 27, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'left';
      ctx.fillText('[ HPC SIMULATION // COMPUTATIONAL MATERIALS & MOLECULAR DYNAMICS ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('F_i = -∇_i V(r_ij)  ·  Δt = 1.0 fs  ·  D = ⅙ lim d⟨Δr²⟩/dt', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 23px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const matTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'MATERIALS PHYSICS SIMULATION';
      const endTitleY = drawWrappedText(ctx, matTitle, x1 + 14, m + 68, w - 28, 29);

      const matSub = options.studyTitle || 'Molecular Dynamics · Monte Carlo & Metropolis · Lennard-Jones · Transport';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(matSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: 3D Isometric FCC Unit Cell
      const diagCy = ph * 0.44;
      const boxS = 60;
      const vx = [boxS * 0.866, -boxS * 0.5];
      const vy = [-boxS * 0.866, -boxS * 0.5];
      const vz = [0, -boxS];

      const corners3D = [];
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
          for (let dz = 0; dz <= 1; dz++) {
            const px = centerX + dx * vx[0] + dy * vy[0] + dz * vz[0] - (vx[0] + vy[0]) / 2;
            const py = diagCy + 40 + dx * vx[1] + dy * vy[1] + dz * vz[1] - (vx[1] + vy[1] + vz[1]) / 2;
            corners3D.push([px, py]);
          }
        }
      }

      const cubeEdges = [
        [0, 1], [0, 2], [1, 3], [2, 3],
        [4, 5], [4, 6], [5, 7], [6, 7],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      ctx.beginPath();
      for (const [i1, i2] of cubeEdges) {
        ctx.moveTo(corners3D[i1][0], corners3D[i1][1]);
        ctx.lineTo(corners3D[i2][0], corners3D[i2][1]);
      }
      ctx.stroke();

      ctx.fillStyle = inkDark;
      for (const [px, py] of corners3D) {
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      }

      const faceCenters = [
        [(corners3D[0][0] + corners3D[3][0]) / 2, (corners3D[0][1] + corners3D[3][1]) / 2],
        [(corners3D[4][0] + corners3D[7][0]) / 2, (corners3D[4][1] + corners3D[7][1]) / 2],
        [(corners3D[0][0] + corners3D[5][0]) / 2, (corners3D[0][1] + corners3D[5][1]) / 2],
        [(corners3D[2][0] + corners3D[7][0]) / 2, (corners3D[2][1] + corners3D[7][1]) / 2],
      ];
      ctx.fillStyle = inkGreen;
      for (const [fx, fy] of faceCenters) {
        ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'center';
      ctx.fillText('FCC CRYSTAL LATTICE · LENNARD-JONES · MPI FORTRAN 90', centerX, diagCy + 72);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'left';
      ctx.fillText('SCIENTIST / PROGRAMMER', x1 + 14, metaY + 16);
      ctx.fillText('COMPILATION TIMESTAMP', x1 + w * 0.42, metaY + 16);
      ctx.fillText('RUN ARCHIVE / SLIDES', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Computational Materials Lab', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'High-Performance Computing Cluster', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Simulation Dossier', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'circuits_flat' || tpl.includes('circuits_flat') || tpl.includes('circuitos_flat') || tpl.includes('instrumentacion_flat') || tpl.includes('fundamentos_instrumentacion_flat') || tpl.includes('electronica_flat')) {
      // Flat 90s Minimalist: Fundamentos de Instrumentación Electrónica
      ctx.fillStyle = '#fcfbf9';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#1e293b';
      const inkGreen = '#047857';
      const inkMuted = '#64748b';
      const hairline = 'rgba(30, 41, 59, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'left';
      ctx.fillText('[ IEEE INSTRUMENTATION // ANALOG FRONT-END & DAQ ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('V_out = -(R_f / R_in) V_in  ·  CMRR > 120 dB  ·  f_s ≥ 2·f_max', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const instTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'FUNDAMENTALS OF ELECTRONIC INSTRUMENTATION';
      const endTitleY = drawWrappedText(ctx, instTitle, x1 + 14, m + 68, w - 28, 28);

      const instSub = options.studyTitle || 'Operational Amplifiers · Active Filter Design · ADC/DAC Conversion · DAQ & LabVIEW';
      ctx.font = 'italic 11px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(instSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: Op-Amp Inverting Amplifier
      const diagCy = ph * 0.44;
      const triW = 60;
      const triH = 70;
      const triX = centerX - 10;

      ctx.strokeStyle = inkDark;
      ctx.lineWidth = 1.4;
      ctx.fillStyle = '#f2f7f4';
      ctx.beginPath();
      ctx.moveTo(triX, diagCy - triH / 2);
      ctx.lineTo(triX, diagCy + triH / 2);
      ctx.lineTo(triX + triW, diagCy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 10px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      ctx.fillText('-', triX + 6, diagCy - 14);
      ctx.fillText('+', triX + 6, diagCy + 22);

      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(triX - 80, diagCy - 18); ctx.lineTo(triX - 50, diagCy - 18);
      ctx.stroke();
      ctx.strokeRect(triX - 50, diagCy - 24, 26, 12);
      ctx.font = '700 6.5px monospace, monospace';
      ctx.fillText('R_in', triX - 46, diagCy - 27);
      ctx.beginPath();
      ctx.moveTo(triX - 24, diagCy - 18); ctx.lineTo(triX, diagCy - 18);
      ctx.stroke();

      // Feedback loop
      ctx.beginPath();
      ctx.moveTo(triX - 12, diagCy - 18); ctx.lineTo(triX - 12, diagCy - 52);
      ctx.lineTo(triX + 10, diagCy - 52);
      ctx.stroke();
      ctx.strokeRect(triX + 10, diagCy - 58, 26, 12);
      ctx.fillText('R_f', triX + 16, diagCy - 61);
      ctx.beginPath();
      ctx.moveTo(triX + 36, diagCy - 52); ctx.lineTo(triX + 75, diagCy - 52);
      ctx.lineTo(triX + 75, diagCy);
      ctx.stroke();

      // Non-inverting input tied to Ground
      ctx.beginPath();
      ctx.moveTo(triX, diagCy + 18); ctx.lineTo(triX - 24, diagCy + 18);
      ctx.lineTo(triX - 24, diagCy + 30);
      ctx.moveTo(triX - 30, diagCy + 30); ctx.lineTo(triX - 18, diagCy + 30);
      ctx.moveTo(triX - 28, diagCy + 33); ctx.lineTo(triX - 20, diagCy + 33);
      ctx.moveTo(triX - 26, diagCy + 36); ctx.lineTo(triX - 22, diagCy + 36);
      ctx.stroke();

      // Output line
      ctx.beginPath();
      ctx.moveTo(triX + triW, diagCy); ctx.lineTo(triX + triW + 35, diagCy);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(triX + triW + 35, diagCy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('V_out', triX + triW + 42, diagCy + 3);

      ctx.beginPath(); ctx.arc(triX - 80, diagCy - 18, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('V_in', triX - 105, diagCy - 15);

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'center';
      ctx.fillText('ANALOG CIRCUITS · TEKTRONIX BENCH · LAB STANDARD', centerX, diagCy + 68);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkGreen;
      ctx.textAlign = 'left';
      ctx.fillText('LEAD ENGINEER / STUDENT', x1 + 14, metaY + 16);
      ctx.fillText('TESTBENCH / CALIBRATION', x1 + w * 0.42, metaY + 16);
      ctx.fillText('INSTRUMENTATION REPORT', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Electronic Instrumentation Group', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'National Instruments GPIB / DAQ', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Laboratory Log', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'solid_state_flat' || tpl.includes('solid_state_flat') || tpl.includes('estado_solido_flat') || tpl.includes('condensed_matter_flat')) {
      // Flat 90s Minimalist: Física del Estado Sólido
      ctx.fillStyle = '#fbfaf7';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#172554';
      const inkCopper = '#b45309';
      const inkMuted = '#64748b';
      const hairline = 'rgba(23, 37, 84, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkCopper;
      ctx.textAlign = 'left';
      ctx.fillText('[ CONDENSED MATTER // SOLID STATE & BRILLOUIN ARCHIVE ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('ψ_k(r) = e^{ik·r} u_k(r)  ·  E_F = ħ²k_F² / 2m*  ·  Φ_0 = h/2e', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const ssTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'SOLID STATE PHYSICS';
      const endTitleY = drawWrappedText(ctx, ssTitle, x1 + 14, m + 68, w - 28, 32);

      const ssSub = options.studyTitle || 'Crystal Lattices & Reciprocal Space · Phonons · Bloch Bands · Superconductivity & BCS';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(ssSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: 1st Brillouin Zone Hexagon & Fermi Contour
      const diagCy = ph * 0.44;
      const hexR = 55;
      ctx.strokeStyle = inkDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * 2 * Math.PI;
        const hx = centerX + hexR * Math.cos(ang);
        const hy = diagCy + hexR * Math.sin(ang);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = inkCopper;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX, diagCy); ctx.lineTo(centerX + hexR * 0.9, diagCy);
      ctx.moveTo(centerX, diagCy); ctx.lineTo(centerX + hexR * 0.45, diagCy - hexR * 0.78);
      ctx.stroke();

      ctx.fillStyle = inkDark;
      ctx.beginPath(); ctx.arc(centerX, diagCy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillText('Γ', centerX - 12, diagCy + 2);

      ctx.beginPath(); ctx.arc(centerX + hexR, diagCy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('K', centerX + hexR + 4, diagCy + 3);

      const mx = centerX + hexR * 0.866 * Math.cos(Math.PI / 6);
      const my = diagCy - hexR * 0.866 * Math.sin(Math.PI / 6);
      ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('M', mx + 4, my - 2);

      ctx.strokeStyle = inkCopper;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(centerX, diagCy, hexR * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkCopper;
      ctx.textAlign = 'center';
      ctx.fillText('RECIPROCAL SPACE · 1ST BRILLOUIN ZONE · FERMI SPHERE', centerX, diagCy + 72);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkCopper;
      ctx.textAlign = 'left';
      ctx.fillText('PROFESSOR / SCHOLAR', x1 + 14, metaY + 16);
      ctx.fillText('ACADEMIC TERM', x1 + w * 0.42, metaY + 16);
      ctx.fillText('VOLUME / RECORD', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'Condensed Matter Physics Group', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'Academic Year', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Theoretical Monograph', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'nuclear_flat' || tpl.includes('nuclear_flat') || tpl.includes('particulas_flat') || tpl.includes('nuclear_particles_flat') || tpl.includes('particle_physics_flat')) {
      // Flat 90s Minimalist: Física Nuclear y de Partículas
      ctx.fillStyle = '#fafaf9';
      ctx.fillRect(0, 0, pw, ph);

      const m = 44;
      const x1 = leftGutter + m;
      const x2 = pw - rightGutter - m;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      const inkDark = '#0f172a';
      const inkViolet = '#6366f1';
      const inkMuted = '#64748b';
      const hairline = 'rgba(15, 23, 42, 0.22)';

      // 1. Corner registration marks
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      const corners = [[x1, m], [x2, m], [x1, ph - m], [x2, ph - m]];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
      }

      // 2. Framing rule
      ctx.strokeRect(x1, m, w, ph - 2 * m);
      ctx.strokeRect(x1 + 3.5, m + 3.5, w - 7, ph - 2 * m - 7);

      // 3. Header band
      ctx.font = '700 8px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'left';
      ctx.fillText('[ HIGH ENERGY PHYSICS // CERN-SLAC COLLIDER ARCHIVE ]', x1 + 14, m + 22);
      ctx.font = 'italic 700 9px "Times New Roman", Times, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('SU(3)_C × SU(2)_L × U(1)_Y  ·  B(A,Z)  ·  √s = 14 TeV', x2 - 14, m + 22);

      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, m + 30); ctx.lineTo(x2 - 14, m + 30);
      ctx.stroke();

      // 4. Title block
      ctx.font = '700 23px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      const nucTitle = (options.coverTitle && options.coverTitle.trim()) ? options.coverTitle : 'NUCLEAR & PARTICLE PHYSICS';
      const endTitleY = drawWrappedText(ctx, nucTitle, x1 + 14, m + 68, w - 28, 29);

      const nucSub = options.studyTitle || 'Nuclear Shell Model · Radioactive Decay · Quark Model & QCD · Electroweak Model';
      ctx.font = 'italic 11.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkMuted;
      ctx.fillText(nucSub, x1 + 14, endTitleY + 22);

      // 5. Scientific Vector Illustration: e+ e- -> Z0/gamma* -> q qbar Feynman Diagram
      const diagCy = ph * 0.44;
      const v1x = centerX - 30;
      const v2x = centerX + 30;

      ctx.strokeStyle = inkDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(v1x - 60, diagCy - 40); ctx.lineTo(v1x, diagCy);
      ctx.moveTo(v1x - 60, diagCy + 40); ctx.lineTo(v1x, diagCy);
      ctx.stroke();

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'right';
      ctx.fillText('e⁻', v1x - 66, diagCy - 38);
      ctx.fillText('e⁺', v1x - 66, diagCy + 42);

      // Wavy propagator
      ctx.strokeStyle = inkViolet;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const wSteps = 24;
      for (let ws = 0; ws <= wSteps; ws++) {
        const wx = v1x + (ws / wSteps) * (v2x - v1x);
        const wy = diagCy + 5 * Math.sin((ws / wSteps) * 4 * Math.PI);
        if (ws === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'center';
      ctx.fillText('γ* / Z⁰', centerX, diagCy - 10);

      ctx.strokeStyle = inkDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(v2x, diagCy); ctx.lineTo(v2x + 60, diagCy - 40);
      ctx.moveTo(v2x, diagCy); ctx.lineTo(v2x + 60, diagCy + 40);
      ctx.stroke();

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.textAlign = 'left';
      ctx.fillText('q', v2x + 66, diagCy - 38);
      ctx.fillText('q̄', v2x + 66, diagCy + 42);

      ctx.fillStyle = inkDark;
      ctx.beginPath(); ctx.arc(v1x, diagCy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(v2x, diagCy, 3, 0, Math.PI * 2); ctx.fill();

      // Detector arcs
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(centerX, diagCy, 85, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, diagCy, 85, (3 * Math.PI) / 4, (5 * Math.PI) / 4);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'center';
      ctx.fillText('ELECTROWEAK ANNIHILATION · FEYNMAN DIAGRAM · 4π DETECTOR', centerX, diagCy + 68);

      // 6. Lower Technical Metadata Grid
      const metaY = ph - m - 44;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1 + 14, metaY); ctx.lineTo(x2 - 14, metaY);
      ctx.stroke();

      ctx.font = '700 7.5px monospace, monospace';
      ctx.fillStyle = inkViolet;
      ctx.textAlign = 'left';
      ctx.fillText('PHYSICIST / EXPERIMENTER', x1 + 14, metaY + 16);
      ctx.fillText('COLLABORATION / DATE', x1 + w * 0.42, metaY + 16);
      ctx.fillText('ARCHIVE / DATASET', x1 + w * 0.75, metaY + 16);

      ctx.font = '700 10px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = inkDark;
      ctx.fillText(options.coverAuthor || 'High Energy Physics Collaboration', x1 + 14, metaY + 32);
      ctx.fillText(dateFormatted || 'Research Preprint', x1 + w * 0.42, metaY + 32);
      ctx.fillText('Particle Physics Monograph', x1 + w * 0.75, metaY + 32);

    } else if (tpl === 'composition' || tpl === 'compbook' || tpl === 'composition_book' || tpl === 'comp_classic' || tpl === 'marble_bw' || tpl === 'cuaderno' || tpl === 'compo' ||
               tpl === 'comp_blue' || tpl === 'comp_ocean' || tpl === 'comp_wave' || tpl === 'academic_wave' || tpl === 'suminagashi' || tpl === 'ocean_wave' || tpl === 'academic_navy' || tpl === 'academic_burgundy' ||
               tpl === 'comp_coral' || tpl === 'comp_terracotta' || tpl === 'comp_slate' || tpl === 'academic_teal' || tpl === 'ebru' || tpl === 'bubble' || tpl === 'academic_ebru' || tpl === 'academic_stone' || tpl === 'academic_blue' ||
               tpl === 'comp_amber' || tpl === 'comp_gold' || tpl === 'comp_onyx' || tpl === 'academic_green' || tpl === 'academic' || tpl === 'peacock' || tpl === 'florentine' || tpl === 'academic_peacock' || tpl === 'academic_yellow' ||
               tpl === 'comp_morris' || tpl === 'morris' || tpl === 'strawberry_thief' || tpl === 'william_morris' || tpl === 'botanical' ||
               tpl === 'comp_ukiyoe' || tpl === 'ukiyoe' || tpl === 'japanese' || tpl === 'sakura' || tpl === 'woodblock' ||
               tpl === 'comp_flora' || tpl === 'flora' || tpl === 'still_life' || tpl === 'dutch_flora' || tpl === 'bouquet' || tpl === 'baroque_flora' ||
               tpl === 'comp_pastoral' || tpl === 'pastoral' || tpl === 'landscape' || tpl === 'oil_landscape' || tpl === 'romantic_landscape' ||
               tpl === 'comp_marbled' || tpl === 'marbled' || tpl === 'florentine_stone' || tpl === 'ebru_stone' ||
               (!tpl.includes('_flat') && (
                 tpl.includes('biophysics') || tpl.includes('biofisica') || tpl.includes('alphafold') || tpl.includes('neural_bio') ||
                 tpl.includes('atmospheric') || tpl.includes('atmosferica') || tpl.includes('complex_systems') || tpl.includes('sistemas_complejos') || tpl.includes('chaos') || tpl.includes('lorenz') ||
                 tpl.includes('fortran') || tpl.includes('materiales') || tpl.includes('materials_sim') || tpl.includes('computational_materials') || tpl.includes('simulacion_materiales') || tpl.includes('f77') || tpl.includes('f90') ||
                 tpl.includes('nuclear') || tpl.includes('particulas') || tpl.includes('particle_physics') || tpl.includes('cern') || tpl.includes('lhc') || tpl.includes('feynman') ||
                 tpl.includes('solid_state') || tpl.includes('estado_solido') || tpl.includes('solido') || tpl.includes('condensed_matter') || tpl.includes('brillouin') || tpl.includes('fermi_surface') ||
                 tpl.includes('atomic') || tpl.includes('atomica') || tpl.includes('quantum_atomic') || tpl.includes('spectroscopy') || tpl.includes('rydberg') || tpl.includes('mecanica_cuantica') || tpl.includes('cuantica') ||
                 tpl.includes('circuits') || tpl.includes('instrumentacion') || tpl.includes('fundamentos_instrumentacion') || tpl.includes('opamps') || tpl.includes('electronica') || tpl.includes('filters') || tpl.includes('adc_dac')
               ))) {
      let assetKey = 'composition';
      let spineColor = '#141416';
      let seamColor = '#333338';
      let fallbackBg = '#1c1c1e';
      let bookTitle = 'COMPOSITION BOOK';
      let editionTag = 'Archival Edition';

      if (tpl.includes('biophysics') || tpl.includes('biofisica') || tpl.includes('alphafold') || tpl.includes('neural_bio')) {
        assetKey = 'science_biophysics';
        spineColor = '#0a1f29';
        seamColor = '#1a5261';
        fallbackBg = '#0f2633';
        bookTitle = 'BIOPHYSICS';
        editionTag = 'Biophysics Dossier · Molecular Dynamics';
      } else if (tpl.includes('atmospheric') || tpl.includes('atmosferica') || tpl.includes('complex_systems') || tpl.includes('sistemas_complejos') || tpl.includes('chaos') || tpl.includes('lorenz')) {
        assetKey = 'science_atmospheric';
        spineColor = '#121c2e';
        seamColor = '#2e4766';
        fallbackBg = '#16233b';
        bookTitle = 'PHYSICS OF COMPLEX SYSTEMS';
        editionTag = 'Nonlinear Dynamics & Complex Systems Archive';
      } else if (tpl.includes('fortran') || tpl.includes('materiales') || tpl.includes('materials_sim') || tpl.includes('computational_materials') || tpl.includes('simulacion_materiales') || tpl.includes('f77') || tpl.includes('f90')) {
        assetKey = 'science_fortran';
        spineColor = '#141c17';
        seamColor = '#2e4733';
        fallbackBg = '#19241d';
        bookTitle = 'MATERIALS PHYSICS SIMULATION';
        editionTag = 'Materials Simulation Archive · Computational Physics';
      } else if (tpl.includes('nuclear') || tpl.includes('particulas') || tpl.includes('particle_physics') || tpl.includes('cern') || tpl.includes('lhc') || tpl.includes('feynman')) {
        assetKey = 'science_nuclear';
        spineColor = '#140f1f';
        seamColor = '#402e57';
        fallbackBg = '#171124';
        bookTitle = 'NUCLEAR & PARTICLE PHYSICS';
        editionTag = 'High-Energy Physics Compendium';
      } else if (tpl.includes('solid_state') || tpl.includes('estado_solido') || tpl.includes('solido') || tpl.includes('condensed_matter') || tpl.includes('brillouin') || tpl.includes('fermi_surface')) {
        assetKey = 'science_solid_state';
        spineColor = '#121c29';
        seamColor = '#334761';
        fallbackBg = '#162333';
        bookTitle = 'SOLID STATE PHYSICS';
        editionTag = 'Condensed Matter Laboratory Log';
      } else if (tpl.includes('atomic') || tpl.includes('atomica') || tpl.includes('quantum_atomic') || tpl.includes('spectroscopy') || tpl.includes('rydberg') || tpl.includes('mecanica_cuantica') || tpl.includes('cuantica')) {
        assetKey = 'science_atomic';
        spineColor = '#1a0d24';
        seamColor = '#472b61';
        fallbackBg = '#1f102b';
        bookTitle = 'QUANTUM MECHANICS III';
        editionTag = 'Quantum Mechanics III · Spectroscopy Register';
      } else if (tpl.includes('circuits') || tpl.includes('instrumentacion') || tpl.includes('fundamentos_instrumentacion') || tpl.includes('opamps') || tpl.includes('electronica') || tpl.includes('filters') || tpl.includes('adc_dac')) {
        assetKey = 'science_circuits';
        spineColor = '#0d1f14';
        seamColor = '#295238';
        fallbackBg = '#122619';
        bookTitle = 'FUNDAMENTALS OF ELECTRONIC INSTRUMENTATION';
        editionTag = 'Electronic Instrumentation & Laboratory Dossier';
      } else if (tpl.includes('morris') || tpl.includes('strawberry') || tpl.includes('botanical')) {
        assetKey = 'comp_morris';
        spineColor = '#122036';      // Deep Victorian Indigo
        seamColor = '#2d3b50';
        fallbackBg = '#1d334e';
      } else if (tpl.includes('ukiyoe') || tpl.includes('japanese') || tpl.includes('sakura') || tpl.includes('woodblock')) {
        assetKey = 'comp_ukiyoe';
        spineColor = '#731c18';      // Traditional Lacquer Vermilion
        seamColor = '#9c342b';
        fallbackBg = '#335248';
      } else if (tpl.includes('flora') || tpl.includes('bouquet') || tpl.includes('still_life')) {
        assetKey = 'comp_flora';
        spineColor = '#101012';      // Velvet Black / Charcoal
        seamColor = '#383226';       // Dark bronze gold
        fallbackBg = '#111113';
      } else if (tpl.includes('pastoral') || tpl.includes('landscape')) {
        assetKey = 'comp_pastoral';
        spineColor = '#2e2218';      // Dark Walnut Leather
        seamColor = '#4d3a2b';
        fallbackBg = '#473d2a';
      } else if (tpl.includes('marbled') || tpl.includes('florentine_stone')) {
        assetKey = 'comp_marbled';
        spineColor = '#4c141d';      // Deep Burgundy Wine
        seamColor = '#70252e';
        fallbackBg = '#7a3424';
      } else if (tpl.includes('blue') || tpl.includes('wave') || tpl.includes('ocean') || tpl.includes('suminagashi') || tpl.includes('navy')) {
        assetKey = 'comp_blue';
        spineColor = '#0e1e33';      // Royal navy
        seamColor = '#243e62';
        fallbackBg = '#1c3452';
      } else if (tpl.includes('coral') || tpl.includes('terracotta') || tpl.includes('slate') || tpl.includes('teal') || tpl.includes('ebru') || tpl.includes('bubble') || tpl.includes('stone')) {
        assetKey = 'comp_coral';
        spineColor = '#1c2929';      // Deep slate teal
        seamColor = '#334848';
        fallbackBg = '#c8684a';
      } else if (tpl.includes('amber') || tpl.includes('gold') || tpl.includes('onyx') || tpl.includes('green') || tpl.includes('peacock') || tpl.includes('florentine') || tpl.includes('academic')) {
        assetKey = 'comp_amber';
        spineColor = '#23150d';      // Rich espresso walnut
        seamColor = '#462c1d';
        fallbackBg = '#966028';
      }

      // 1. Capa Fondo (Full-bleed texture)
      const img = getCoverImage(assetKey);
      if (img && img.complete && img.naturalWidth) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const pageAspect = pw / ph;
        let drawW = pw, drawH = ph, drawX = 0, drawY = 0;
        if (imgAspect > pageAspect) {
          drawW = ph * imgAspect;
          drawX = (pw - drawW) / 2;
        } else {
          drawH = pw / imgAspect;
          drawY = (ph - drawH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = fallbackBg;
        ctx.fillRect(0, 0, pw, ph);
      }

      // 2. Capa Lomo (Harmonized spine on binding edge)
      const baseSpineW = Math.max(pw * 0.145, 68);
      const spineW = isVerso ? (rightGutter + baseSpineW) : (leftGutter + baseSpineW);
      const spineX = isVerso ? (pw - spineW) : 0;

      ctx.fillStyle = spineColor;
      ctx.fillRect(spineX, 0, spineW, ph);

      const seamX = isVerso ? (pw - spineW) : spineW;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = seamColor;
      ctx.beginPath();
      ctx.moveTo(seamX, 0);
      ctx.lineTo(seamX, ph);
      ctx.stroke();

      const shadowDir = isVerso ? -1 : 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(seamX, 0, shadowDir * 2.5, ph);

      // 3. Capa Etiqueta (Centered badge with title lines)
      const visibleX1 = isVerso ? 0 : spineW;
      const visibleX2 = isVerso ? (pw - spineW) : pw;
      const visibleW = visibleX2 - visibleX1;
      const visibleCenterX = (visibleX1 + visibleX2) / 2;

      const badgeW = Math.min(visibleW * 0.72, 330);
      const badgeH = 178;
      const badgeX = visibleCenterX - badgeW / 2;
      const badgeY = ph * 0.16;

      const isBw = (assetKey === 'composition');
      const badgeBg = isBw ? '#ffffff' : '#faf4e8';
      const outerStroke = isBw ? '#141416' : '#1f1c18';
      const innerStroke = isBw ? '#222224' : '#2e2924';
      const lineStroke = isBw ? 'rgba(120, 120, 128, 0.45)' : 'rgba(145, 130, 115, 0.45)';
      const textHeadColor = isBw ? '#111111' : '#141210';
      const textTitleColor = isBw ? '#1a1a1c' : '#1a1816';
      const textSubColor = isBw ? '#444444' : '#3a3530';
      const textMetaDark = isBw ? '#222222' : '#24201c';
      const textMetaMuted = isBw ? '#555555' : '#574f46';

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.20)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = outerStroke;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();

      ctx.lineWidth = 0.8;
      ctx.strokeStyle = innerStroke;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX + 4.5, badgeY + 4.5, badgeW - 9, badgeH - 9, 8.5);
      } else {
        ctx.rect(badgeX + 4.5, badgeY + 4.5, badgeW - 9, badgeH - 9);
      }
      ctx.stroke();

      let headSize = 14.5;
      ctx.font = `700 ${headSize}px "Times New Roman", Times, Georgia, serif`;
      while (headSize > 7.5 && ctx.measureText(bookTitle).width > (badgeW - 24)) {
        headSize -= 0.5;
        ctx.font = `700 ${headSize}px "Times New Roman", Times, Georgia, serif`;
      }
      ctx.fillStyle = textHeadColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(bookTitle, visibleCenterX, badgeY + 32);

      const lineW = badgeW - 40;
      const lx1 = badgeX + 20;
      const lx2 = lx1 + lineW;
      const line1Y = badgeY + 58;
      const line2Y = badgeY + 83;
      const line3Y = badgeY + 108;

      ctx.strokeStyle = lineStroke;
      ctx.lineWidth = 0.6;
      for (const ly of [line1Y, line2Y, line3Y]) {
        ctx.beginPath();
        ctx.moveTo(lx1, ly);
        ctx.lineTo(lx2, ly);
        ctx.stroke();
      }

      ctx.fillStyle = textTitleColor;
      ctx.font = '700 11.5px "Times New Roman", Times, Georgia, serif';
      const cWords = titleText.split(' ');
      if (ctx.measureText(titleText).width > lineW - 10 && cWords.length > 1) {
        const mid = Math.ceil(cWords.length / 2);
        ctx.fillText(cWords.slice(0, mid).join(' '), visibleCenterX, line1Y - 4);
        ctx.fillText(cWords.slice(mid).join(' '), visibleCenterX, line2Y - 4);
        ctx.font = '500 10px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = textSubColor;
        ctx.fillText(options.coverAuthor || dateFormatted || 'Study Compendium', visibleCenterX, line3Y - 4);
      } else {
        ctx.fillText(titleText, visibleCenterX, line1Y - 4);
        ctx.font = 'italic 10.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = textSubColor;
        ctx.fillText(options.studyTitle || options.coverAuthor || 'Subject Notes', visibleCenterX, line2Y - 4);
        ctx.font = '500 9.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillText((options.coverAuthor ? options.coverAuthor + ' · ' : '') + dateFormatted, visibleCenterX, line3Y - 4);
      }

      ctx.font = '700 7px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = textMetaDark;
      const slideCountStr = options.numSlides ? `${options.numSlides} ${options.numSlides === 1 ? 'Slide' : 'Slides'} Bound` : '100 Sheets · 200 Pages';
      ctx.fillText(slideCountStr, visibleCenterX, badgeY + badgeH - 36);
      ctx.font = '500 6.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = textMetaMuted;
      ctx.fillText('9 3/4 in × 7 1/2 in (24.7cm × 19cm)', visibleCenterX, badgeY + badgeH - 24);
      ctx.font = '700 6.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = textMetaDark;
      ctx.fillText(editionTag, visibleCenterX, badgeY + badgeH - 12);
      ctx.restore();

    } else {
      // Default: Atelier Notebook (Zara Home Classic)
      const inset = 36;
      const x1 = leftGutter + inset;
      const x2 = pw - rightGutter - inset;
      const w = x2 - x1;
      const centerX = x1 + w / 2;

      ctx.strokeStyle = 'rgba(40, 40, 40, 0.22)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x1, inset, w, ph - 2 * inset);

      ctx.strokeStyle = 'rgba(40, 40, 40, 0.10)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(x1 + 6, inset + 6, w - 12, ph - 2 * (inset + 6));

      // Top Header
      ctx.font = '500 7.5px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = 'rgba(80, 80, 80, 0.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('N O T E B O O K', centerX, inset + 45);

      ctx.strokeStyle = 'rgba(70, 70, 70, 0.20)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(centerX - 24, inset + 53);
      ctx.lineTo(centerX + 24, inset + 53);
      ctx.stroke();

      // Presentation Title
      ctx.font = '700 24px "Times New Roman", Times, Georgia, "Newsreader", serif';
      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';

      const maxTextW = w - 60;
      const titleStartY = ph * 0.40;
      const endTitleY = drawWrappedText(ctx, titleText, centerX, titleStartY, maxTextW, 31);

      // Optional Subtitle
      if (options.studyTitle) {
        ctx.font = 'italic 12.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#57534e';
        ctx.fillText(options.studyTitle, centerX, endTitleY + 24);
      }

      // Delicate accent rule
      const dividerY = endTitleY + (options.studyTitle ? 44 : 28);
      ctx.strokeStyle = 'rgba(70, 70, 70, 0.18)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(centerX - 32, dividerY);
      ctx.lineTo(centerX + 32, dividerY);
      ctx.stroke();

      // Author & Date Block
      let metaY = ph * 0.72;
      if (options.coverAuthor) {
        ctx.font = '500 10.5px "Times New Roman", Times, Georgia, serif';
        ctx.fillStyle = '#292524';
        ctx.fillText(options.coverAuthor, centerX, metaY);
        metaY += 18;
      }

      ctx.font = 'italic 9px "Times New Roman", Times, Georgia, serif';
      ctx.fillStyle = '#78716c';
      ctx.fillText(dateFormatted, centerX, metaY);
    }
  }

  return {
    renderPreview,
    resetCache,
  };
});
