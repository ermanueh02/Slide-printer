/**
 * Slide-Printer Engine (Client-Side)
 * 
 * Transforms presentation slide PDFs into printable handouts with note-taking space.
 * Matches the exact behavior, mathematical coordinates, and style overlays
 * of the Slide-Printer Python core engine.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../vendor/pdf-lib.min.js'));
  } else {
    root.SlidePrinterEngine = factory(root.PDFLib);
  }
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';

  if (!PDFLib) {
    throw new Error('PDFLib is required for SlidePrinterEngine.');
  }

  const { PDFDocument, rgb, PDFName, PDFArray, PDFDict, StandardFonts } = PDFLib;

  // Standard paper sizes in points (1 pt = 1/72 inch)
  const PAPER_SIZES = {
    a4: [595.28, 841.89],
    letter: [612.0, 792.0],
    legal: [612.0, 1008.0],
    a3: [841.89, 1190.55],
  };

  const DEFAULT_MARGIN = 40.0;
  const DEFAULT_STEP = 14.0; // ~4.94 mm
  const DEFAULT_SEPARATION = 10.0;

  const STYLES = {
    blank: { id: 'blank', name: 'Blank', code: 'blank' },
    lines: { id: 'lines', name: 'Lined', code: 'lines' },
    grid: { id: 'grid', name: 'Grid', code: 'grid' },
    dots: { id: 'dots', name: 'Dot Grid', code: 'dots' },
  };

  /**
   * Parses page ranges string (e.g. '1-5, 8, 11-15') into 0-based indices array.
   */
  function parsePageRanges(rangeStr, totalPages) {
    if (!rangeStr || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all' || rangeStr.trim() === '*') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const indices = [];
    const parts = rangeStr.split(',');
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      if (clean.includes('-')) {
        const sub = clean.split('-');
        const startStr = sub[0].trim();
        const endStr = sub[1] !== undefined ? sub[1].trim() : '';
        const start = startStr === '' ? 1 : parseInt(startStr, 10);
        const end = endStr === '' ? totalPages : parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, start);
          const e = Math.min(totalPages, end);
          const step = s <= e ? 1 : -1;
          for (let p = s; step > 0 ? p <= e : p >= e; p += step) {
            const idx = p - 1;
            if (idx >= 0 && idx < totalPages && !indices.includes(idx)) {
              indices.push(idx);
            }
          }
        }
      } else {
        const p = parseInt(clean, 10);
        const idx = p - 1;
        if (!isNaN(p) && idx >= 0 && idx < totalPages && !indices.includes(idx)) {
          indices.push(idx);
        }
      }
    }
    return indices.length > 0 ? indices : Array.from({ length: totalPages }, (_, i) => i);
  }

  /**
   * Recalculates and re-maps /Rect coordinates for hyperlinks and interactive annotations.
   */
  function transformAndCopyAnnotations(srcDoc, srcPage, outDoc, newPage, scale, tx, ty) {
    const annots = srcPage.node.Annots();
    if (!annots || typeof annots.size !== 'function' || annots.size() === 0) {
      return;
    }

    let existingAnnots = newPage.node.Annots();
    if (!existingAnnots) {
      existingAnnots = outDoc.context.obj([]);
      newPage.node.set(PDFName.of('Annots'), existingAnnots);
    }

    for (let i = 0; i < annots.size(); i++) {
      try {
        const annotRefOrDict = annots.get(i);
        const annotDict = srcDoc.context.lookup(annotRefOrDict);
        if (!annotDict || !(annotDict instanceof PDFDict)) {
          continue;
        }

        const rect = annotDict.lookup(PDFName.of('Rect'));
        if (!rect || !(rect instanceof PDFArray) || rect.size() < 4) {
          continue;
        }

        const x1 = rect.get(0).asNumber();
        const y1 = rect.get(1).asNumber();
        const x2 = rect.get(2).asNumber();
        const y2 = rect.get(3).asNumber();

        const newX1 = x1 * scale + tx;
        const newY1 = y1 * scale + ty;
        const newX2 = x2 * scale + tx;
        const newY2 = y2 * scale + ty;

        // Clone annotation dictionary into target document context
        const clonedDict = annotDict.clone(outDoc.context);
        clonedDict.set(
          PDFName.of('Rect'),
          outDoc.context.obj([newX1, newY1, newX2, newY2])
        );

        const newAnnotRef = outDoc.context.register(clonedDict);
        existingAnnots.push(newAnnotRef);
      } catch (err) {
        console.warn('Could not transform annotation:', err);
      }
    }
  }

  /**
   * Draws note-taking patterns onto the page for 1-Up layout.
   */
  function drawNotesOverlay(page, options) {
    const { margin, width, ySep, bottomMargin, style, step, dotRadius = 0.65, drawSeparator = true } = options;
    const x1 = margin;
    const x2 = margin + width;
    const yStart = ySep - 10;

    if (drawSeparator) {
      // Upper separator line with subtle end ticks
      page.drawLine({
        start: { x: x1, y: ySep },
        end: { x: x2, y: ySep },
        thickness: 0.8,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      // Left tick
      page.drawLine({
        start: { x: x1, y: ySep - 3 },
        end: { x: x1, y: ySep + 3 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      // Right tick
      page.drawLine({
        start: { x: x2, y: ySep - 3 },
        end: { x: x2, y: ySep + 3 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
    }

    const normStyle = (style || 'lines').toLowerCase();

    if (normStyle === 'lines') {
      let currY = yStart - step;
      while (currY >= bottomMargin) {
        page.drawLine({
          start: { x: x1, y: currY },
          end: { x: x2, y: currY },
          thickness: 0.4,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.22,
        });
        currY -= step;
      }
    } else if (normStyle === 'grid') {
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;
      const gridX2 = gridX1 + gridW;

      let currY = yStart;
      while (currY >= bottomMargin) {
        page.drawLine({
          start: { x: gridX1, y: currY },
          end: { x: gridX2, y: currY },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
        currY -= step;
      }

      const yMin = currY + step;
      for (let col = 0; col <= numCols; col++) {
        const cx = gridX1 + col * step;
        page.drawLine({
          start: { x: cx, y: yMin },
          end: { x: cx, y: yStart },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
      }
    } else if (normStyle === 'dots') {
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;

      let currY = yStart;
      while (currY >= bottomMargin) {
        for (let col = 0; col <= numCols; col++) {
          const cx = gridX1 + col * step;
          page.drawCircle({
            x: cx,
            y: currY,
            size: dotRadius,
            color: rgb(0.25, 0.25, 0.25),
            opacity: 0.35,
          });
        }
        currY -= step;
      }
    }
  }

  /**
   * Draws note-taking patterns for 2-Up layout.
   */
  function draw2UpNotesOverlay(page, options) {
    const { margin, width, slot1SepY, slot1Bottom, slot2SepY, slot2Bottom, style, step, dotRadius = 0.65 } = options;
    const x1 = margin;
    const x2 = margin + width;

    function drawZone(sepY, bottomLimit) {
      if (sepY === null || sepY === undefined) return;
      page.drawLine({
        start: { x: x1, y: sepY },
        end: { x: x2, y: sepY },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      page.drawLine({
        start: { x: x1, y: sepY - 2 },
        end: { x: x1, y: sepY + 2 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      page.drawLine({
        start: { x: x2, y: sepY - 2 },
        end: { x: x2, y: sepY + 2 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });

      const yStart = sepY - 8;
      const normStyle = (style || 'lines').toLowerCase();

      if (normStyle === 'lines') {
        let currY = yStart - step;
        while (currY >= bottomLimit) {
          page.drawLine({
            start: { x: x1, y: currY },
            end: { x: x2, y: currY },
            thickness: 0.4,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.22,
          });
          currY -= step;
        }
      } else if (normStyle === 'grid') {
        const numCols = Math.max(1, Math.floor(width / step));
        const gridW = numCols * step;
        const gridX1 = x1 + (width - gridW) / 2;
        const gridX2 = gridX1 + gridW;

        let currY = yStart;
        while (currY >= bottomLimit) {
          page.drawLine({
            start: { x: gridX1, y: currY },
            end: { x: gridX2, y: currY },
            thickness: 0.35,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.18,
          });
          currY -= step;
        }
        const yMin = currY + step;
        for (let col = 0; col <= numCols; col++) {
          const cx = gridX1 + col * step;
          page.drawLine({
            start: { x: cx, y: yMin },
            end: { x: cx, y: yStart },
            thickness: 0.35,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.18,
          });
        }
      } else if (normStyle === 'dots') {
        const numCols = Math.max(1, Math.floor(width / step));
        const gridW = numCols * step;
        const gridX1 = x1 + (width - gridW) / 2;

        let currY = yStart;
        while (currY >= bottomLimit) {
          for (let col = 0; col <= numCols; col++) {
            const cx = gridX1 + col * step;
            page.drawCircle({
              x: cx,
              y: currY,
              size: dotRadius,
              color: rgb(0.25, 0.25, 0.25),
              opacity: 0.35,
            });
          }
          currY -= step;
        }
      }
    }

    drawZone(slot1SepY, slot1Bottom);

    // Subtle dashed divider line at mid-height
    const midY = page.getHeight() / 2;
    page.drawLine({
      start: { x: x1, y: midY },
      end: { x: x2, y: midY },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
      opacity: 0.18,
      dashArray: [2, 4],
    });

    if (slot2SepY !== null && slot2SepY !== undefined) {
      drawZone(slot2SepY, slot2Bottom);
    }
  }

  /**
   * Draws study header at the top of the page.
   */
  function drawStudyHeader(page, options, font) {
    const { margin, width, title, topMargin } = options;
    const x1 = margin;
    const x2 = margin + width;
    const effectiveTopMargin = topMargin !== undefined ? topMargin : DEFAULT_MARGIN;
    const headerY = page.getHeight() - effectiveTopMargin + 4;

    const leftText = title ? `SUBJECT / TOPIC: ${title}` : 'SUBJECT / TOPIC: _____________________________';
    const rightText = 'DATE: _____ / _____ / 20___';

    if (font) {
      page.drawText(leftText, {
        x: x1,
        y: headerY,
        size: 8,
        font: font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.85,
      });

      const rightW = font.widthOfTextAtSize(rightText, 8);
      page.drawText(rightText, {
        x: x2 - rightW,
        y: headerY,
        size: 8,
        font: font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.85,
      });
    }

    page.drawLine({
      start: { x: x1, y: headerY - 4 },
      end: { x: x2, y: headerY - 4 },
      thickness: 0.5,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.25,
    });
  }

  /**
   * Helper function to wrap text into multiple lines for PDF-Lib text drawing.
   */
  function wrapText(font, text, fontSize, maxWidth) {
    if (!font || !text) return [text || ''];
    const words = String(text).trim().split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      let width = 0;
      try {
        width = font.widthOfTextAtSize(testLine, fontSize);
      } catch (e) {
        width = testLine.length * fontSize * 0.55;
      }
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
          currentLine = '';
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [text];
  }

  /**
   * Draws binding guide markings (ISO 838 punches or spiral clearance line) on a PDF-lib page.
   */
  function drawBindingGuides(page, options) {
    const { binding, duplex, isVerso = false } = options;
    if (!binding || binding === 'none') return;

    const pw = page.getWidth();
    const ph = page.getHeight();

    if (binding === 'binder') {
      const holeX = isVerso ? (pw - 34.0) : 34.0;
      const mmToPt = 72.0 / 25.4;
      const hRatio = ph / 841.89;
      const holeYList = [
        42.0 * mmToPt * hRatio,
        122.0 * mmToPt * hRatio,
        202.0 * mmToPt * hRatio,
        282.0 * mmToPt * hRatio,
      ];

      for (const y of holeYList) {
        page.drawCircle({
          x: holeX,
          y: y,
          size: 8.5,
          borderColor: rgb(0.3, 0.3, 0.3),
          borderWidth: 0.6,
          borderOpacity: 0.5,
        });
        page.drawLine({
          start: { x: holeX - 11, y: y },
          end: { x: holeX + 11, y: y },
          thickness: 0.4,
          color: rgb(0.3, 0.3, 0.3),
          opacity: 0.5,
        });
        page.drawLine({
          start: { x: holeX, y: y - 11 },
          end: { x: holeX, y: y + 11 },
          thickness: 0.4,
          color: rgb(0.3, 0.3, 0.3),
          opacity: 0.5,
        });
      }

      // Vertical dashed line
      page.drawLine({
        start: { x: holeX, y: 28 },
        end: { x: holeX, y: ph - 28 },
        thickness: 0.4,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.3,
        dashArray: [3, 4],
      });
    } else if (binding === 'spiral') {
      const guideX = isVerso ? (pw - 22.0) : 22.0;
      page.drawLine({
        start: { x: guideX, y: 24 },
        end: { x: guideX, y: ph - 24 },
        thickness: 0.5,
        color: rgb(0.35, 0.35, 0.35),
        opacity: 0.4,
        dashArray: [2, 3],
      });

      const coilPitch = 14.17; // ~5mm pitch
      for (let y = 32; y <= ph - 32; y += coilPitch) {
        page.drawLine({
          start: { x: guideX - 3, y: y },
          end: { x: guideX + 3, y: y },
          thickness: 0.4,
          color: rgb(0.35, 0.35, 0.35),
          opacity: 0.4,
        });
      }
    }
  }

  /**
   * Generates an editorial mid-century modern notebook cover page in English.
   */
  async function generateCoverPage(outDoc, options, fontMap) {
    const [pw, ph] = options.paperDimensions || PAPER_SIZES.a4;
    const page = outDoc.addPage([pw, ph]);

    const timesFont = fontMap.timesFont || fontMap.helveticaFont;
    const timesBold = fontMap.timesBold || fontMap.helveticaBold;
    const timesItalic = fontMap.timesItalic || fontMap.helveticaFont;

    const tpl = (options.coverTemplate || 'atelier').toLowerCase();
    const titleText = (options.title || 'Presentation').trim();
    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (tpl === 'george') {
      // 1. George 90s Editorial / JFK Jr Executive Style
      const m = 44;
      page.drawLine({
        start: { x: m, y: ph - 58 },
        end: { x: pw - m, y: ph - 58 },
        thickness: 2.0,
        color: rgb(0.12, 0.12, 0.14),
      });
      page.drawLine({
        start: { x: m, y: ph - 63 },
        end: { x: pw - m, y: ph - 63 },
        thickness: 0.5,
        color: rgb(0.12, 0.12, 0.14),
      });

      if (timesBold) {
        page.drawText('STUDY DOSSIER', {
          x: m,
          y: ph - 50,
          size: 8.5,
          font: timesBold,
          color: rgb(0.15, 0.15, 0.18),
        });
      }
      if (timesItalic) {
        const rightLabel = 'EXECUTIVE BRIEF · 90S ARCHIVE';
        const rightW = timesItalic.widthOfTextAtSize(rightLabel, 8.0);
        page.drawText(rightLabel, {
          x: pw - m - rightW,
          y: ph - 50,
          size: 8.0,
          font: timesItalic,
          color: rgb(0.45, 0.45, 0.48),
        });
      }

      // Title (Authoritative, Left-aligned with word wrap)
      const titleSize = 28;
      const titleLineHeight = 36;
      const maxTitleW = pw - 2 * m - 20;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.64;

      if (timesBold) {
        for (const line of titleLines) {
          page.drawText(line, {
            x: m,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.08, 0.08, 0.10),
          });
          curTitleY -= titleLineHeight;
        }
      }

      // Subtitle / Subject
      let dividerY = curTitleY + (titleLineHeight - 28);
      if (options.subtitle && timesItalic) {
        const subLines = wrapText(timesItalic, options.subtitle, 13.5, maxTitleW);
        for (const subLine of subLines) {
          page.drawText(subLine, {
            x: m,
            y: dividerY,
            size: 13.5,
            font: timesItalic,
            color: rgb(0.35, 0.35, 0.38),
          });
          dividerY -= 20;
        }
      }

      page.drawLine({
        start: { x: m, y: dividerY - 10 },
        end: { x: m + 80, y: dividerY - 10 },
        thickness: 0.6,
        color: rgb(0.2, 0.2, 0.25),
        opacity: 0.3,
      });

      // Metadata at bottom
      const metaY = ph * 0.18;
      page.drawLine({
        start: { x: m, y: metaY + 40 },
        end: { x: pw - m, y: metaY + 40 },
        thickness: 0.8,
        color: rgb(0.12, 0.12, 0.14),
      });

      if (timesBold) {
        page.drawText('AUTHOR / STUDENT', { x: m, y: metaY + 26, size: 7.5, font: timesBold, color: rgb(0.35, 0.35, 0.38) });
        page.drawText('DATE / COMPILATION', { x: m + (pw - 2 * m) * 0.52, y: metaY + 26, size: 7.5, font: timesBold, color: rgb(0.35, 0.35, 0.38) });
      }
      if (timesFont) {
        page.drawText(options.author || 'General Notes', { x: m, y: metaY + 12, size: 10, font: timesFont, color: rgb(0.12, 0.12, 0.14) });
        page.drawText(todayStr, { x: m + (pw - 2 * m) * 0.52, y: metaY + 12, size: 10, font: timesFont, color: rgb(0.12, 0.12, 0.14) });
      }

      if (options.numSlides && timesItalic) {
        const slideWord = options.numSlides === 1 ? 'slide' : 'slides';
        const numStr = `${options.numSlides} ${slideWord} with study notes`;
        const numW = timesItalic.widthOfTextAtSize(numStr, 8.0);
        page.drawText(numStr, {
          x: pw - m - numW,
          y: metaY - 10,
          size: 8.0,
          font: timesItalic,
          color: rgb(0.48, 0.48, 0.50),
        });
      }

    } else if (tpl === 'monograph') {
      // 2. Archival Monograph (Heritage Stationery Bookplate)
      const inset = 34;
      page.drawRectangle({
        x: inset,
        y: inset,
        width: pw - 2 * inset,
        height: ph - 2 * inset,
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
        borderOpacity: 0.18,
      });

      const boxW = pw - 2 * inset - 70;
      const boxH = 190;
      const boxX = (pw - boxW) / 2;
      const boxY = ph * 0.42;

      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: rgb(0.2, 0.2, 0.22),
        borderWidth: 0.75,
        borderOpacity: 0.35,
      });
      page.drawRectangle({
        x: boxX + 4.5,
        y: boxY + 4.5,
        width: boxW - 9,
        height: boxH - 9,
        borderColor: rgb(0.2, 0.2, 0.22),
        borderWidth: 0.35,
        borderOpacity: 0.14,
      });

      if (timesFont) {
        const monoHdr = 'M O N O G R A P H   ·   N O T E S';
        const monoW = timesFont.widthOfTextAtSize(monoHdr, 8);
        page.drawText(monoHdr, {
          x: (pw - monoW) / 2,
          y: boxY + boxH - 26,
          size: 8,
          font: timesFont,
          color: rgb(0.45, 0.45, 0.45),
        });
      }

      page.drawLine({
        start: { x: pw / 2 - 20, y: boxY + boxH - 33 },
        end: { x: pw / 2 + 20, y: boxY + boxH - 33 },
        thickness: 0.35,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.25,
      });

      // Title inside cartouche with word wrap
      const titleSize = 21;
      const titleLineHeight = 27;
      const titleLines = wrapText(timesBold, titleText, titleSize, boxW - 36);
      let curTitleY = boxY + boxH * 0.52 + ((titleLines.length - 1) * titleLineHeight) / 2;

      if (timesBold) {
        for (const line of titleLines) {
          const lineW = timesBold.widthOfTextAtSize(line, titleSize);
          page.drawText(line, {
            x: (pw - lineW) / 2,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.12, 0.12, 0.14),
          });
          curTitleY -= titleLineHeight;
        }
      }

      if (options.subtitle && timesItalic) {
        const subW = timesItalic.widthOfTextAtSize(options.subtitle, 12);
        page.drawText(options.subtitle, {
          x: (pw - subW) / 2,
          y: Math.min(curTitleY - 6, boxY + boxH * 0.24),
          size: 12,
          font: timesItalic,
          color: rgb(0.35, 0.35, 0.38),
        });
      }

      let metaY = ph * 0.22;
      if (options.author && timesFont) {
        const authW = timesFont.widthOfTextAtSize(options.author, 10.5);
        page.drawText(options.author, {
          x: (pw - authW) / 2,
          y: metaY,
          size: 10.5,
          font: timesFont,
          color: rgb(0.22, 0.22, 0.24),
        });
        metaY -= 18;
      }
      if (timesItalic) {
        const dateStr = `Date: ${todayStr}`;
        const dateW = timesItalic.widthOfTextAtSize(dateStr, 9);
        page.drawText(dateStr, {
          x: (pw - dateW) / 2,
          y: metaY,
          size: 9,
          font: timesItalic,
          color: rgb(0.42, 0.42, 0.42),
        });
        metaY -= 16;
      }
      if (options.numSlides && timesFont) {
        const slideWord = options.numSlides === 1 ? 'slide' : 'slides';
        const numStr = `${options.numSlides} ${slideWord} with dedicated notes`;
        const numW = timesFont.widthOfTextAtSize(numStr, 8.5);
        page.drawText(numStr, {
          x: (pw - numW) / 2,
          y: metaY,
          size: 8.5,
          font: timesFont,
          color: rgb(0.48, 0.48, 0.48),
        });
      }

    } else if (tpl === 'bauhaus') {
      // 3. Swiss Modernist Bauhaus Layout
      const m = 48;
      const vertX = m + 28;
      page.drawLine({
        start: { x: vertX, y: m },
        end: { x: vertX, y: ph - m },
        thickness: 0.6,
        color: rgb(0.15, 0.15, 0.18),
        opacity: 0.2,
      });

      const hdrY = ph - m - 20;
      page.drawLine({
        start: { x: m, y: hdrY },
        end: { x: pw - m, y: hdrY },
        thickness: 0.6,
        color: rgb(0.15, 0.15, 0.18),
        opacity: 0.2,
      });

      if (timesBold) {
        page.drawText('VOLUME I  ·  STUDY COMPENDIUM', {
          x: vertX + 14,
          y: hdrY + 8,
          size: 8.0,
          font: timesBold,
          color: rgb(0.2, 0.2, 0.25),
        });
      }

      // Large modern title with word wrap
      const titleSize = 26;
      const titleLineHeight = 34;
      const maxTitleW = pw - vertX - m - 20;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.58;

      if (timesBold) {
        for (const line of titleLines) {
          page.drawText(line, {
            x: vertX + 14,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.08, 0.08, 0.10),
          });
          curTitleY -= titleLineHeight;
        }
      }

      if (options.subtitle && timesItalic) {
        page.drawText(options.subtitle, {
          x: vertX + 14,
          y: curTitleY - 8,
          size: 13,
          font: timesItalic,
          color: rgb(0.35, 0.35, 0.38),
        });
      }

      const metaY = ph * 0.25;
      if (timesBold) {
        page.drawText('STUDENT:', { x: vertX + 14, y: metaY + 36, size: 7.0, font: timesBold, color: rgb(0.45, 0.45, 0.48) });
        page.drawText('DATE:', { x: vertX + 14, y: metaY + 18, size: 7.0, font: timesBold, color: rgb(0.45, 0.45, 0.48) });
      }
      if (timesFont) {
        page.drawText(options.author || 'General Study Notes', { x: vertX + 72, y: metaY + 36, size: 10, font: timesFont, color: rgb(0.12, 0.12, 0.14) });
        page.drawText(todayStr, { x: vertX + 72, y: metaY + 18, size: 10, font: timesFont, color: rgb(0.12, 0.12, 0.14) });
      }

      if (options.numSlides && timesItalic) {
        const slideWord = options.numSlides === 1 ? 'slide' : 'slides';
        page.drawText(`${options.numSlides} ${slideWord} included`, {
          x: vertX + 14,
          y: metaY - 4,
          size: 8.0,
          font: timesItalic,
          color: rgb(0.5, 0.5, 0.52),
        });
      }

    } else if (tpl === 'fifties' || tpl === '50s') {
      // 4. Fifties: Mid-Century Pelican Tri-Band
      const band1H = ph * 0.32;
      const band2H = ph * 0.38;
      const band3H = ph * 0.30;

      // Top band (amber/terracotta)
      page.drawRectangle({
        x: 0,
        y: ph - band1H,
        width: pw,
        height: band1H,
        color: rgb(0.85, 0.38, 0.22),
      });

      if (timesBold) {
        const topHdr = 'P E L I C A N   C O M P E N D I U M';
        const topW = timesBold.widthOfTextAtSize(topHdr, 9.0);
        page.drawText(topHdr, {
          x: (pw - topW) / 2,
          y: ph - band1H * 0.48,
          size: 9.0,
          font: timesBold,
          color: rgb(1, 1, 1),
        });
      }
      if (timesItalic) {
        const subHdr = 'SERIES IN STUDY & SCHOLARSHIP · NO. 52';
        const subW = timesItalic.widthOfTextAtSize(subHdr, 8.0);
        page.drawText(subHdr, {
          x: (pw - subW) / 2,
          y: ph - band1H * 0.65,
          size: 8.0,
          font: timesItalic,
          color: rgb(1, 1, 1),
          opacity: 0.85,
        });
      }

      // Middle band (cream/white)
      page.drawRectangle({
        x: 0,
        y: band3H,
        width: pw,
        height: band2H,
        color: rgb(0.99, 0.98, 0.96),
      });

      // Diamond emblem at top of middle band
      const emblemY = ph - band1H - 34;
      const dSize = 10;
      page.drawLine({ start: { x: pw / 2, y: emblemY + dSize }, end: { x: pw / 2 + dSize, y: emblemY }, thickness: 1.0, color: rgb(0.85, 0.38, 0.22) });
      page.drawLine({ start: { x: pw / 2 + dSize, y: emblemY }, end: { x: pw / 2, y: emblemY - dSize }, thickness: 1.0, color: rgb(0.85, 0.38, 0.22) });
      page.drawLine({ start: { x: pw / 2, y: emblemY - dSize }, end: { x: pw / 2 - dSize, y: emblemY }, thickness: 1.0, color: rgb(0.85, 0.38, 0.22) });
      page.drawLine({ start: { x: pw / 2 - dSize, y: emblemY }, end: { x: pw / 2, y: emblemY + dSize }, thickness: 1.0, color: rgb(0.85, 0.38, 0.22) });

      // Title
      const titleSize = 24;
      const titleLineHeight = 31;
      const maxTitleW = pw - 80;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph - band1H - 78;

      if (timesBold) {
        for (const line of titleLines) {
          const lineW = timesBold.widthOfTextAtSize(line, titleSize);
          page.drawText(line, {
            x: (pw - lineW) / 2,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.11, 0.10, 0.09),
          });
          curTitleY -= titleLineHeight;
        }
      }

      if (options.subtitle && timesItalic) {
        const subW = timesItalic.widthOfTextAtSize(options.subtitle, 12.5);
        page.drawText(options.subtitle, {
          x: (pw - subW) / 2,
          y: curTitleY - 6,
          size: 12.5,
          font: timesItalic,
          color: rgb(0.34, 0.32, 0.30),
        });
      }

      // Bottom band (amber/terracotta)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: band3H,
        color: rgb(0.85, 0.38, 0.22),
      });

      if (timesBold) {
        const authStr = (options.author || 'STUDENT COMPOSITION').toUpperCase();
        const authW = timesBold.widthOfTextAtSize(authStr, 11.0);
        page.drawText(authStr, {
          x: (pw - authW) / 2,
          y: band3H * 0.56,
          size: 11.0,
          font: timesBold,
          color: rgb(1, 1, 1),
        });
      }

      if (timesItalic) {
        const dateStr = `${todayStr} · MID-CENTURY EDITION`;
        const dateW = timesItalic.widthOfTextAtSize(dateStr, 8.5);
        page.drawText(dateStr, {
          x: (pw - dateW) / 2,
          y: band3H * 0.42,
          size: 8.5,
          font: timesItalic,
          color: rgb(1, 1, 1),
          opacity: 0.88,
        });
      }

    } else if (tpl === 'sixties' || tpl === '60s') {
      // 5. Sixties: Swiss International Typography (Josef Müller-Brockmann)
      const m = 44;
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.97, 0.97, 0.98),
      });

      // Heavy black bar across top
      page.drawRectangle({
        x: m,
        y: ph - m - 8,
        width: pw - 2 * m,
        height: 8,
        color: rgb(0, 0, 0),
      });

      const swissFont = fontMap.helveticaBold || timesBold;
      const swissRegular = fontMap.helveticaFont || timesFont;

      if (swissFont) {
        page.drawText('01 / TYPOGRAFISCHE MONOGRAFIE', {
          x: m,
          y: ph - m - 24,
          size: 8.0,
          font: swissFont,
          color: rgb(0, 0, 0),
        });
      }
      if (swissRegular) {
        const rightLabel = 'SWISS INT. 1968 · ZÜRICH';
        const rightW = swissRegular.widthOfTextAtSize(rightLabel, 8.0);
        page.drawText(rightLabel, {
          x: pw - m - rightW,
          y: ph - m - 24,
          size: 8.0,
          font: swissRegular,
          color: rgb(0, 0, 0),
        });
      }

      page.drawLine({
        start: { x: m, y: ph - m - 30 },
        end: { x: pw - m, y: ph - m - 30 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });

      // Giant bold title
      const titleSize = 30;
      const titleLineHeight = 38;
      const maxTitleW = pw - 2 * m;
      const titleLines = wrapText(swissFont, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.64;

      if (swissFont) {
        for (const line of titleLines) {
          page.drawText(line, {
            x: m,
            y: curTitleY,
            size: titleSize,
            font: swissFont,
            color: rgb(0, 0, 0),
          });
          curTitleY -= titleLineHeight;
        }
      }

      let midRuleY = curTitleY + 12;
      if (options.subtitle && swissRegular) {
        page.drawText(options.subtitle, {
          x: m,
          y: curTitleY + 8,
          size: 13,
          font: swissRegular,
          color: rgb(0.3, 0.3, 0.35),
        });
        midRuleY = curTitleY - 14;
      }

      page.drawLine({
        start: { x: m, y: midRuleY },
        end: { x: pw - m, y: midRuleY },
        thickness: 1.0,
        color: rgb(0, 0, 0),
      });

      // Bottom metadata
      const metaY = ph * 0.16;
      if (swissFont) {
        page.drawText('AUTHOR / BEARBEITER', { x: m, y: metaY + 16, size: 7.5, font: swissFont, color: rgb(0.42, 0.45, 0.5) });
        page.drawText('DATUM / DATE', { x: m + (pw - 2 * m) * 0.52, y: metaY + 16, size: 7.5, font: swissFont, color: rgb(0.42, 0.45, 0.5) });
      }
      if (swissFont) {
        page.drawText(options.author || 'Allgemeine Notizen', { x: m, y: metaY, size: 10.5, font: swissFont, color: rgb(0, 0, 0) });
        page.drawText(todayStr, { x: m + (pw - 2 * m) * 0.52, y: metaY, size: 10.5, font: swissFont, color: rgb(0, 0, 0) });
      }

    } else if (tpl === 'seventies' || tpl === '70s') {
      // 6. Seventies: Retro Warm Groove & Apollo
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.99, 0.98, 0.95),
      });

      // Triple concentric frames
      page.drawRectangle({
        x: 32,
        y: 32,
        width: pw - 64,
        height: ph - 64,
        borderColor: rgb(0.83, 0.33, 0.0),
        borderWidth: 2.2,
      });
      page.drawRectangle({
        x: 39,
        y: 39,
        width: pw - 78,
        height: ph - 78,
        borderColor: rgb(0.90, 0.49, 0.13),
        borderWidth: 2.0,
      });
      page.drawRectangle({
        x: 46,
        y: 46,
        width: pw - 92,
        height: ph - 92,
        borderColor: rgb(0.36, 0.25, 0.22),
        borderWidth: 1.8,
      });

      // Top banner
      if (timesBold) {
        const topBanner = '✦   V I N T A G E   D O S S I E R   ·   1 9 7 4   ✦';
        const topW = timesBold.widthOfTextAtSize(topBanner, 8.0);
        page.drawText(topBanner, {
          x: (pw - topW) / 2,
          y: ph - 76,
          size: 8.0,
          font: timesBold,
          color: rgb(0.83, 0.33, 0.0),
        });
      }

      // Title in warm espresso
      const titleSize = 26;
      const titleLineHeight = 34;
      const maxTitleW = pw - 120;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.58;

      if (timesBold) {
        for (const line of titleLines) {
          const lineW = timesBold.widthOfTextAtSize(line, titleSize);
          page.drawText(line, {
            x: (pw - lineW) / 2,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.24, 0.13, 0.07),
          });
          curTitleY -= titleLineHeight;
        }
      }

      if (options.subtitle && timesItalic) {
        const subW = timesItalic.widthOfTextAtSize(options.subtitle, 13);
        page.drawText(options.subtitle, {
          x: (pw - subW) / 2,
          y: curTitleY - 4,
          size: 13,
          font: timesItalic,
          color: rgb(0.70, 0.33, 0.12),
        });
        curTitleY -= 22;
      }

      // Triple groove lines
      const gColors = [rgb(0.83, 0.33, 0.0), rgb(0.90, 0.49, 0.13), rgb(0.36, 0.25, 0.22)];
      for (let gi = 0; gi < 3; gi++) {
        page.drawLine({
          start: { x: pw / 2 - 40, y: curTitleY - 8 - gi * 4 },
          end: { x: pw / 2 + 40, y: curTitleY - 8 - gi * 4 },
          thickness: 1.2,
          color: gColors[gi],
        });
      }

      // Bottom metadata
      const metaY = ph * 0.18;
      if (timesBold) {
        const authStr = options.author || 'Apollo Edition';
        const authW = timesBold.widthOfTextAtSize(authStr, 10.5);
        page.drawText(authStr, {
          x: (pw - authW) / 2,
          y: metaY,
          size: 10.5,
          font: timesBold,
          color: rgb(0.24, 0.13, 0.07),
        });
      }
      if (timesItalic) {
        const dateW = timesItalic.widthOfTextAtSize(todayStr, 9.0);
        page.drawText(todayStr, {
          x: (pw - dateW) / 2,
          y: metaY - 16,
          size: 9.0,
          font: timesItalic,
          color: rgb(0.48, 0.32, 0.19),
        });
      }

    } else if (tpl === 'eighties' || tpl === '80s') {
      // 7. Eighties: Memphis Design & 1984 Technical Manual
      const m = 44;

      // Diagonal hatch box
      page.drawRectangle({
        x: m,
        y: ph - m - 46,
        width: 46,
        height: 46,
        borderColor: rgb(0.07, 0.09, 0.15),
        borderWidth: 1.5,
      });

      for (let d = -46; d <= 46; d += 8) {
        const x1 = Math.max(m, m + d);
        const y1 = ph - m - 46 + Math.max(0, -d);
        const x2 = Math.min(m + 46, m + 46 + d);
        const y2 = ph - m - 46 + Math.min(46, 46 - d);
        if (x1 < x2) {
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: 1.0,
            color: rgb(0.05, 0.65, 0.91),
          });
        }
      }

      const techBold = fontMap.helveticaBold || timesBold;
      const techFont = fontMap.helveticaFont || timesFont;

      if (techBold) {
        page.drawText('PERSONAL STUDY SYSTEM // 1984', {
          x: m + 58,
          y: ph - m - 20,
          size: 9.0,
          font: techBold,
          color: rgb(0.07, 0.09, 0.15),
        });
      }
      if (techFont) {
        page.drawText('REF. MODEL 84-MKII · MEMPHIS TECH EDITION', {
          x: m + 58,
          y: ph - m - 34,
          size: 7.5,
          font: techFont,
          color: rgb(0.39, 0.45, 0.55),
        });
      }

      page.drawLine({
        start: { x: m, y: ph - m - 58 },
        end: { x: pw - m, y: ph - m - 58 },
        thickness: 2.0,
        color: rgb(0.07, 0.09, 0.15),
      });
      page.drawLine({
        start: { x: m, y: ph - m - 62 },
        end: { x: m + 96, y: ph - m - 62 },
        thickness: 2.0,
        color: rgb(0.96, 0.25, 0.37),
      });

      // Title
      const titleSize = 28;
      const titleLineHeight = 36;
      const maxTitleW = pw - 2 * m - 30;
      const titleLines = wrapText(techBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.62;

      if (techBold) {
        for (const line of titleLines) {
          page.drawText(line, {
            x: m,
            y: curTitleY,
            size: titleSize,
            font: techBold,
            color: rgb(0.06, 0.09, 0.16),
          });
          curTitleY -= titleLineHeight;
        }
      }

      if (options.subtitle && techBold) {
        page.drawText(options.subtitle, {
          x: m,
          y: curTitleY - 4,
          size: 13,
          font: techBold,
          color: rgb(0.05, 0.65, 0.91),
        });
      }

      // Floating Memphis shapes
      page.drawCircle({
        x: pw - m - 20,
        y: ph * 0.64,
        size: 6,
        color: rgb(0.96, 0.62, 0.04),
      });

      // Bottom operator card
      const bY = ph * 0.18;
      page.drawRectangle({
        x: m,
        y: bY,
        width: pw - 2 * m,
        height: 54,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.07, 0.09, 0.15),
        borderWidth: 1.0,
      });

      if (techFont) {
        page.drawText('OPERATOR / STUDENT:', { x: m + 14, y: bY + 36, size: 7.0, font: techFont, color: rgb(0.39, 0.45, 0.55) });
        page.drawText('TIMESTAMP:', { x: m + (pw - 2 * m) * 0.52, y: bY + 36, size: 7.0, font: techFont, color: rgb(0.39, 0.45, 0.55) });
      }
      if (techBold) {
        page.drawText(options.author || 'SYSTEM USER 01', { x: m + 14, y: bY + 18, size: 10.5, font: techBold, color: rgb(0.06, 0.09, 0.16) });
      }
      if (techFont) {
        page.drawText(todayStr, { x: m + (pw - 2 * m) * 0.52, y: bY + 18, size: 10.0, font: techFont, color: rgb(0.06, 0.09, 0.16) });
      }

    } else if (tpl === 'nineties' || tpl === '90s') {
      // 8. Nineties: Minimalist Editorial Lookbook / Indie Zine
      const m = 54;

      // Crop / registration marks at corners
      const corners = [[30, 30], [pw - 30, 30], [30, ph - 30], [pw - 30, ph - 30]];
      for (const [cx, cy] of corners) {
        page.drawCircle({
          x: cx,
          y: cy,
          size: 3.5,
          borderColor: rgb(0.12, 0.12, 0.12),
          borderWidth: 0.5,
          borderOpacity: 0.4,
        });
        page.drawLine({ start: { x: cx - 7, y: cy }, end: { x: cx + 7, y: cy }, thickness: 0.5, color: rgb(0.12, 0.12, 0.12), opacity: 0.4 });
        page.drawLine({ start: { x: cx, y: cy - 7 }, end: { x: cx, y: cy + 7 }, thickness: 0.5, color: rgb(0.12, 0.12, 0.12), opacity: 0.4 });
      }

      const zineFont = fontMap.helveticaFont || timesFont;
      if (zineFont) {
        page.drawText('[ ISSUE 09 // LOOKBOOK ARCHIVE ]', {
          x: m,
          y: ph - 52,
          size: 7.5,
          font: zineFont,
          color: rgb(0.07, 0.07, 0.07),
        });

        const rightTag = 'REF: 1994-AUTUMN-WINTER';
        const rightW = zineFont.widthOfTextAtSize(rightTag, 7.5);
        page.drawText(rightTag, {
          x: pw - m - rightW,
          y: ph - 52,
          size: 7.5,
          font: zineFont,
          color: rgb(0.07, 0.07, 0.07),
        });
      }

      // Title
      const titleSize = 26;
      const titleLineHeight = 36;
      const maxTitleW = pw - 2 * m;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.62;

      if (timesBold) {
        for (const line of titleLines) {
          page.drawText(line, {
            x: m,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.07, 0.07, 0.07),
          });
          curTitleY -= titleLineHeight;
        }
      }

      let divY = curTitleY + 8;
      if (options.subtitle && timesItalic) {
        page.drawText(options.subtitle, {
          x: m,
          y: curTitleY + 4,
          size: 12,
          font: timesItalic,
          color: rgb(0.33, 0.33, 0.33),
        });
        divY = curTitleY - 14;
      }

      page.drawLine({
        start: { x: m, y: divY },
        end: { x: pw - m, y: divY },
        thickness: 0.5,
        color: rgb(0, 0, 0),
        opacity: 0.20,
      });

      // Bottom metadata
      const metaY = ph * 0.18;
      if (zineFont) {
        page.drawText('DIRECTOR / STUDENT:', { x: m, y: metaY + 16, size: 7.0, font: zineFont, color: rgb(0.47, 0.47, 0.47) });
        page.drawText('COMPILATION DATE:', { x: m + (pw - 2 * m) * 0.52, y: metaY + 16, size: 7.0, font: zineFont, color: rgb(0.47, 0.47, 0.47) });
      }
      if (timesFont) {
        page.drawText(options.author || 'Studio Dossier', { x: m, y: metaY, size: 10.5, font: timesFont, color: rgb(0.07, 0.07, 0.07) });
        page.drawText(todayStr, { x: m + (pw - 2 * m) * 0.52, y: metaY, size: 10.5, font: timesFont, color: rgb(0.07, 0.07, 0.07) });
      }

    } else if (tpl === 'natural' || tpl === 'forest' || tpl === 'verde' || tpl === 'bosque' || tpl === 'nature') {
      // 10. Natural Deep Forest Editorial (Luxury Architectural Notebook)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.965, 0.958, 0.942),
      });

      const m = 40;
      const forestDark = rgb(0.06, 0.18, 0.11);
      const forestMid = rgb(0.12, 0.28, 0.18);
      const forestLight = rgb(0.24, 0.44, 0.32);
      const brassGold = rgb(0.72, 0.58, 0.36);

      page.drawRectangle({
        x: m,
        y: m,
        width: pw - 2 * m,
        height: ph - 2 * m,
        borderColor: forestDark,
        borderWidth: 1.4,
      });

      page.drawRectangle({
        x: m + 4.5,
        y: m + 4.5,
        width: pw - 2 * (m + 4.5),
        height: ph - 2 * (m + 4.5),
        borderColor: forestLight,
        borderWidth: 0.4,
        borderOpacity: 0.35,
      });

      for (const [cx, cy] of [[m, m], [pw - m, m], [m, ph - m], [pw - m, ph - m]]) {
        page.drawLine({ start: { x: cx - 5, y: cy }, end: { x: cx + 5, y: cy }, thickness: 0.6, color: brassGold });
        page.drawLine({ start: { x: cx, y: cy - 5 }, end: { x: cx, y: cy + 5 }, thickness: 0.6, color: brassGold });
      }

      page.drawRectangle({
        x: m + 16,
        y: ph - m - 32,
        width: pw - 2 * m - 32,
        height: 24,
        color: forestDark,
      });

      const natSansBold = fontMap.helveticaBold || timesBold;
      const natItalic = fontMap.timesItalic || timesFont;
      const natSerifBold = timesBold;

      if (natSansBold) {
        page.drawText('NATURAL COMPENDIUM // EDITORIAL STUDY FOLIO', {
          x: m + 26,
          y: ph - m - 22,
          size: 8.0,
          font: natSansBold,
          color: rgb(0.97, 0.97, 0.96),
        });
      }

      if (natItalic) {
        const rightLabel = 'VOL. 01 · DEEP FOREST ARCHIVE';
        const rightW = natItalic.widthOfTextAtSize(rightLabel, 8.0);
        page.drawText(rightLabel, {
          x: pw - m - 26 - rightW,
          y: ph - m - 22,
          size: 8.0,
          font: natItalic,
          color: brassGold,
        });
      }

      page.drawRectangle({
        x: m + 16,
        y: ph - m - 35,
        width: pw - 2 * m - 32,
        height: 1.0,
        color: brassGold,
      });

      const titleX = m + 22;
      if (natSansBold) {
        page.drawText('STUDY DOSSIER · NATURAL EDITION', {
          x: titleX,
          y: ph * 0.65,
          size: 8.0,
          font: natSansBold,
          color: forestMid,
        });
      }

      const titleSize = 27;
      const titleLineHeight = 35;
      const maxTitleW = pw - 2 * m - 60;
      const titleLines = wrapText(natSerifBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.60 + (titleLines.length - 1) * 16;

      for (const line of titleLines) {
        if (natSerifBold) {
          page.drawText(line, {
            x: titleX,
            y: curTitleY,
            size: titleSize,
            font: natSerifBold,
            color: forestDark,
          });
        }
        curTitleY -= titleLineHeight;
      }

      if (options.subtitle && natItalic) {
        page.drawText(options.subtitle, {
          x: titleX,
          y: curTitleY - 6,
          size: 13.0,
          font: natItalic,
          color: forestMid,
        });
        curTitleY -= 26;
      }

      const ruleY = curTitleY - 12;
      page.drawLine({
        start: { x: titleX, y: ruleY },
        end: { x: titleX + 60, y: ruleY },
        thickness: 1.0,
        color: forestDark,
      });
      page.drawRectangle({
        x: titleX + 64,
        y: ruleY - 2,
        width: 4,
        height: 4,
        color: brassGold,
      });
      page.drawLine({
        start: { x: titleX + 72, y: ruleY },
        end: { x: pw - m - 22, y: ruleY },
        thickness: 0.5,
        color: forestLight,
        opacity: 0.35,
      });

      const gridY = m + 36;
      const colW = (pw - 2 * m - 44) / 2;
      page.drawLine({
        start: { x: titleX, y: gridY + 44 },
        end: { x: pw - m - 22, y: gridY + 44 },
        thickness: 0.8,
        color: forestDark,
      });
      page.drawLine({
        start: { x: titleX + colW, y: gridY + 44 },
        end: { x: titleX + colW, y: gridY - 16 },
        thickness: 0.5,
        color: forestLight,
        opacity: 0.35,
      });

      if (natSansBold) {
        page.drawText('STUDENT / AUTHOR', { x: titleX, y: gridY + 32, size: 7.0, font: natSansBold, color: forestMid });
        page.drawText('CONTENT FOLIOS', { x: titleX, y: gridY - 2, size: 6.5, font: natSansBold, color: forestMid });
      }
      if (natSerifBold) {
        page.drawText(options.author || 'Natural Dossier', { x: titleX, y: gridY + 16, size: 10.0, font: natSerifBold, color: forestDark });
      }
      if (natItalic) {
        const slideCount = options.totalSlides || 0;
        const slideWord = slideCount === 1 ? 'slide sheet' : 'slide sheets';
        page.drawText(`${slideCount} ${slideWord} compiled`, { x: titleX, y: gridY - 14, size: 9.0, font: natItalic, color: forestDark });
      }

      const col2X = titleX + colW + 16;
      if (natSansBold) {
        page.drawText('DATE / COMPILATION', { x: col2X, y: gridY + 32, size: 7.0, font: natSansBold, color: forestMid });
        page.drawText('EDITION', { x: col2X, y: gridY - 2, size: 6.5, font: natSansBold, color: forestMid });
      }
      if (natSerifBold) {
        page.drawText(todayStr || 'Archival Record', { x: col2X, y: gridY + 16, size: 10.0, font: natSerifBold, color: forestDark });
      }
      if (natItalic) {
        page.drawText('Natural Forest Series // No. 01', { x: col2X, y: gridY - 14, size: 9.0, font: natItalic, color: forestDark });
      }

    } else if (tpl === 'spring' || tpl === 'primavera' || tpl === 'vernal') {
      // 11. Spring / Vernal Editorial (Fresh Sage Green & Airy Geometry)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.985, 0.988, 0.982),
      });

      const m = 42;
      const sageDeep = rgb(0.18, 0.38, 0.25);
      const sageSoft = rgb(0.35, 0.55, 0.42);
      const blossomTint = rgb(0.78, 0.54, 0.48);

      page.drawRectangle({
        x: m,
        y: m,
        width: pw - 2 * m,
        height: ph - 2 * m,
        borderColor: sageSoft,
        borderWidth: 0.8,
      });
      page.drawRectangle({
        x: m + 4,
        y: m + 4,
        width: pw - 2 * (m + 4),
        height: ph - 2 * (m + 4),
        borderColor: sageSoft,
        borderWidth: 0.4,
        borderOpacity: 0.18,
      });

      const lozY = ph * 0.68;
      page.drawCircle({
        x: pw / 2,
        y: lozY,
        size: 11,
        borderColor: sageDeep,
        borderWidth: 0.6,
      });
      page.drawLine({ start: { x: pw / 2 - 15, y: lozY }, end: { x: pw / 2 + 15, y: lozY }, thickness: 0.6, color: blossomTint });
      page.drawLine({ start: { x: pw / 2, y: lozY - 15 }, end: { x: pw / 2, y: lozY + 15 }, thickness: 0.6, color: blossomTint });

      const sansBold = fontMap.helveticaBold || timesBold;
      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;
      const serifRoman = timesFont;

      if (sansBold) {
        const topHdr = 'V E R N A L   C O M P E N D I U M';
        const topW = sansBold.widthOfTextAtSize(topHdr, 8.0);
        page.drawText(topHdr, { x: (pw - topW) / 2, y: ph - m - 32, size: 8.0, font: sansBold, color: sageDeep });
      }
      if (serifItalic) {
        const subHdr = 'SPRING SERIES · NEW CYCLE · VOL. I';
        const subW = serifItalic.widthOfTextAtSize(subHdr, 8.0);
        page.drawText(subHdr, { x: (pw - subW) / 2, y: ph - m - 46, size: 8.0, font: serifItalic, color: sageSoft });
      }

      const titleLines = wrapText(serifBold, titleText, 25, pw - 2 * m - 60);
      let curY = lozY - 42;
      for (const line of titleLines) {
        if (serifBold) {
          const lW = serifBold.widthOfTextAtSize(line, 25);
          page.drawText(line, { x: (pw - lW) / 2, y: curY, size: 25, font: serifBold, color: rgb(0.12, 0.22, 0.16) });
        }
        curY -= 33;
      }

      if (options.subtitle && serifItalic) {
        const sW = serifItalic.widthOfTextAtSize(options.subtitle, 12);
        page.drawText(options.subtitle, { x: (pw - sW) / 2, y: curY - 8, size: 12, font: serifItalic, color: sageSoft });
        curY -= 24;
      }

      page.drawLine({ start: { x: pw / 2 - 36, y: curY - 12 }, end: { x: pw / 2 + 36, y: curY - 12 }, thickness: 0.5, color: sageSoft });

      const metaY = m + 40;
      if (sansBold) {
        const fHdr = 'CURATED STUDY FOLIO';
        const fW = sansBold.widthOfTextAtSize(fHdr, 7);
        page.drawText(fHdr, { x: (pw - fW) / 2, y: metaY + 24, size: 7, font: sansBold, color: sageSoft });
      }
      if (serifRoman) {
        const aTxt = options.author || 'Spring Session Notes';
        const aW = serifRoman.widthOfTextAtSize(aTxt, 10);
        page.drawText(aTxt, { x: (pw - aW) / 2, y: metaY + 10, size: 10, font: serifRoman, color: sageDeep });
      }
      if (serifItalic) {
        const dTxt = todayStr || 'Springtime';
        const dW = serifItalic.widthOfTextAtSize(dTxt, 8.5);
        page.drawText(dTxt, { x: (pw - dW) / 2, y: metaY - 4, size: 8.5, font: serifItalic, color: sageSoft });
      }

    } else if (tpl === 'summer' || tpl === 'verano' || tpl === 'estio') {
      // 12. Summer / Solstice Editorial (Aegean Azure & Solar Warmth)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.99, 0.99, 0.985),
      });

      const m = 42;
      const azureDeep = rgb(0.06, 0.24, 0.44);
      const azureLight = rgb(0.18, 0.45, 0.70);
      const solarGold = rgb(0.86, 0.60, 0.20);

      const barH = 36;
      page.drawRectangle({ x: 0, y: ph - barH, width: pw, height: barH, color: azureDeep });
      page.drawRectangle({ x: 0, y: ph - barH - 2.5, width: pw, height: 2.5, color: solarGold });

      const sansBold = fontMap.helveticaBold || timesBold;
      const sansRegular = fontMap.helveticaFont || timesFont;
      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;
      const serifRoman = timesFont;

      if (sansBold) {
        page.drawText('SOLSTICE COMPENDIUM · SUMMER FOLIO', { x: m, y: ph - 22, size: 8.5, font: sansBold, color: rgb(0.98, 0.98, 0.98) });
      }
      if (sansRegular) {
        const rTag = 'MEDITERRANEAN ARCHIVE // 02';
        const rW = sansRegular.widthOfTextAtSize(rTag, 8.0);
        page.drawText(rTag, { x: pw - m - rW, y: ph - 22, size: 8.0, font: sansRegular, color: rgb(0.98, 0.98, 0.98) });
      }

      page.drawRectangle({
        x: m,
        y: m,
        width: pw - 2 * m,
        height: ph - m - barH - 16,
        borderColor: azureLight,
        borderWidth: 0.6,
        borderOpacity: 0.3,
      });

      const titleLines = wrapText(serifBold, titleText, 27, pw - 2 * m - 50);
      let curY = ph * 0.58 + (titleLines.length - 1) * 16;
      for (const line of titleLines) {
        if (serifBold) {
          page.drawText(line, { x: m + 18, y: curY, size: 27, font: serifBold, color: azureDeep });
        }
        curY -= 35;
      }

      if (options.subtitle && serifItalic) {
        page.drawText(options.subtitle, { x: m + 18, y: curY - 6, size: 13, font: serifItalic, color: rgb(0.25, 0.40, 0.55) });
        curY -= 26;
      }

      const ruleY = curY - 14;
      page.drawLine({ start: { x: m + 18, y: ruleY }, end: { x: m + 80, y: ruleY }, thickness: 1.0, color: azureDeep });
      page.drawLine({ start: { x: m + 80, y: ruleY }, end: { x: m + 120, y: ruleY }, thickness: 1.0, color: solarGold });

      const metaY = m + 32;
      if (sansBold) {
        page.drawText('STUDY RESEARCHER', { x: m + 18, y: metaY + 36, size: 7.0, font: sansBold, color: solarGold });
        page.drawText('CALENDAR REGISTRY', { x: m + 18, y: metaY + 6, size: 7.0, font: sansBold, color: solarGold });
      }
      if (serifRoman) {
        page.drawText(options.author || 'Summer Study Compendium', { x: m + 18, y: metaY + 22, size: 10, font: serifRoman, color: azureDeep });
      }
      if (serifItalic) {
        page.drawText(todayStr || 'Summer Solstice', { x: m + 18, y: metaY - 8, size: 9, font: serifItalic, color: azureDeep });
      }

    } else if (tpl === 'autumn' || tpl === 'otono' || tpl === 'otonno' || tpl === 'fall') {
      // 13. Autumn / Equinox Editorial (Burnt Terracotta & Amber Warmth)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.965, 0.945, 0.915),
      });

      const m = 40;
      const terracotta = rgb(0.62, 0.22, 0.12);
      const amber = rgb(0.76, 0.50, 0.18);
      const espresso = rgb(0.18, 0.10, 0.08);

      page.drawRectangle({
        x: m,
        y: m,
        width: pw - 2 * m,
        height: ph - 2 * m,
        borderColor: amber,
        borderWidth: 0.5,
      });
      page.drawRectangle({
        x: m + 4,
        y: m + 4,
        width: pw - 2 * (m + 4),
        height: ph - 2 * (m + 4),
        borderColor: terracotta,
        borderWidth: 1.4,
      });

      const sansBold = fontMap.helveticaBold || timesBold;
      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;
      const serifRoman = timesFont;

      if (sansBold) {
        const topTag = 'E Q U I N O X   D O S S I E R';
        const topW = sansBold.widthOfTextAtSize(topTag, 8.0);
        page.drawText(topTag, { x: (pw - topW) / 2, y: ph - m - 32, size: 8.0, font: sansBold, color: terracotta });
      }
      if (serifItalic) {
        const subTag = 'AUTUMNAL COMPENDIUM · OCTOBER ARCHIVE';
        const subW = serifItalic.widthOfTextAtSize(subTag, 8.0);
        page.drawText(subTag, { x: (pw - subW) / 2, y: ph - m - 46, size: 8.0, font: serifItalic, color: amber });
      }

      const lozY = ph * 0.65;
      page.drawLine({ start: { x: pw / 2, y: lozY + 11 }, end: { x: pw / 2 + 11, y: lozY }, thickness: 0.8, color: terracotta });
      page.drawLine({ start: { x: pw / 2 + 11, y: lozY }, end: { x: pw / 2, y: lozY - 11 }, thickness: 0.8, color: terracotta });
      page.drawLine({ start: { x: pw / 2, y: lozY - 11 }, end: { x: pw / 2 - 11, y: lozY }, thickness: 0.8, color: terracotta });
      page.drawLine({ start: { x: pw / 2 - 11, y: lozY }, end: { x: pw / 2, y: lozY + 11 }, thickness: 0.8, color: terracotta });
      page.drawCircle({ x: pw / 2, y: lozY, size: 2.5, color: amber });

      const titleLines = wrapText(serifBold, titleText, 25, pw - 2 * m - 60);
      let curY = lozY - 36;
      for (const line of titleLines) {
        if (serifBold) {
          const lW = serifBold.widthOfTextAtSize(line, 25);
          page.drawText(line, { x: (pw - lW) / 2, y: curY, size: 25, font: serifBold, color: espresso });
        }
        curY -= 32;
      }

      if (options.subtitle && serifItalic) {
        const sW = serifItalic.widthOfTextAtSize(options.subtitle, 12);
        page.drawText(options.subtitle, { x: (pw - sW) / 2, y: curY - 8, size: 12, font: serifItalic, color: terracotta });
        curY -= 24;
      }

      page.drawLine({ start: { x: pw / 2 - 45, y: curY - 10 }, end: { x: pw / 2 + 45, y: curY - 10 }, thickness: 0.6, color: amber });

      const boxY = m + 32;
      const boxW = pw - 2 * m - 40;
      const boxH = 68;
      const bx = (pw - boxW) / 2;
      page.drawRectangle({
        x: bx,
        y: boxY,
        width: boxW,
        height: boxH,
        borderColor: terracotta,
        borderWidth: 0.5,
        borderOpacity: 0.25,
      });

      if (sansBold) {
        page.drawText('RESEARCHER / STUDENT:', { x: bx + 14, y: boxY + boxH - 18, size: 7.0, font: sansBold, color: terracotta });
        page.drawText('SESSION DATE:', { x: bx + 14, y: boxY + boxH - 36, size: 7.0, font: sansBold, color: terracotta });
        page.drawText('FOLIO ARCHIVE:', { x: bx + 14, y: boxY + boxH - 54, size: 7.0, font: sansBold, color: terracotta });
      }
      if (serifRoman) {
        page.drawText(options.author || 'Autumn Studies', { x: bx + 140, y: boxY + boxH - 18, size: 9.5, font: serifRoman, color: espresso });
        page.drawText(todayStr || 'Autumn Season', { x: bx + 140, y: boxY + boxH - 36, size: 9.5, font: serifRoman, color: espresso });
      }
      if (serifItalic) {
        const slideCount = options.totalSlides || 0;
        page.drawText(`${slideCount} Slide Sheets Compiled`, { x: bx + 140, y: boxY + boxH - 54, size: 8.5, font: serifItalic, color: amber });
      }

    } else if (tpl === 'winter' || tpl === 'invierno' || tpl === 'hiemal') {
      // 14. Winter / Hiemal Editorial (Nordic Alpine Midnight & Crystalline Slate)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.965, 0.975, 0.985),
      });

      const m = 44;
      const midnight = rgb(0.08, 0.14, 0.24);
      const slateBlue = rgb(0.32, 0.46, 0.60);

      page.drawRectangle({ x: m, y: m, width: pw - 2 * m, height: ph - 2 * m, borderColor: slateBlue, borderWidth: 0.8 });
      page.drawRectangle({ x: m + 4, y: m + 4, width: pw - 2 * (m + 4), height: ph - 2 * (m + 4), borderColor: slateBlue, borderWidth: 0.35, borderOpacity: 0.25 });
      page.drawRectangle({ x: m + 7, y: m + 7, width: pw - 2 * (m + 7), height: ph - 2 * (m + 7), borderColor: slateBlue, borderWidth: 0.35, borderOpacity: 0.25 });

      const starY = ph * 0.68;
      page.drawCircle({ x: pw / 2, y: starY, size: 13, borderColor: slateBlue, borderWidth: 0.7 });
      for (const deg of [0, 60, 120]) {
        const rad = (deg * Math.PI) / 180;
        const dx = 17 * Math.cos(rad);
        const dy = 17 * Math.sin(rad);
        page.drawLine({ start: { x: pw / 2 - dx, y: starY - dy }, end: { x: pw / 2 + dx, y: starY + dy }, thickness: 0.6, color: slateBlue });
      }

      const sansBold = fontMap.helveticaBold || timesBold;
      const sansRegular = fontMap.helveticaFont || timesFont;
      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;

      if (sansBold) {
        const hTxt = 'HIEMAL COMPENDIUM · ARCTIC ARCHIVE';
        const hW = sansBold.widthOfTextAtSize(hTxt, 8);
        page.drawText(hTxt, { x: (pw - hW) / 2, y: ph - m - 28, size: 8, font: sansBold, color: midnight });
      }
      if (sansRegular) {
        const sTxt = 'NORDIC ALPINE EDITION · NO. 04';
        const sW = sansRegular.widthOfTextAtSize(sTxt, 7);
        page.drawText(sTxt, { x: (pw - sW) / 2, y: ph - m - 42, size: 7, font: sansRegular, color: slateBlue });
      }

      const titleLines = wrapText(serifBold, titleText, 26, pw - 2 * m - 60);
      let curY = starY - 42;
      for (const line of titleLines) {
        if (serifBold) {
          const lW = serifBold.widthOfTextAtSize(line, 26);
          page.drawText(line, { x: (pw - lW) / 2, y: curY, size: 26, font: serifBold, color: midnight });
        }
        curY -= 34;
      }

      if (options.subtitle && serifItalic) {
        const sW = serifItalic.widthOfTextAtSize(options.subtitle, 12);
        page.drawText(options.subtitle, { x: (pw - sW) / 2, y: curY - 8, size: 12, font: serifItalic, color: slateBlue });
        curY -= 24;
      }

      page.drawLine({ start: { x: pw / 2 - 30, y: curY - 12 }, end: { x: pw / 2 + 30, y: curY - 12 }, thickness: 0.5, color: slateBlue });

      const metaY = m + 38;
      if (sansBold) {
        const oHdr = 'OPERATOR / CURATOR';
        const oW = sansBold.widthOfTextAtSize(oHdr, 7);
        page.drawText(oHdr, { x: (pw - oW) / 2, y: metaY + 24, size: 7, font: sansBold, color: slateBlue });
      }
      if (sansRegular) {
        const aTxt = options.author || 'Winter Session';
        const aW = sansRegular.widthOfTextAtSize(aTxt, 9.5);
        page.drawText(aTxt, { x: (pw - aW) / 2, y: metaY + 10, size: 9.5, font: sansRegular, color: midnight });

        const dTxt = todayStr || 'Winter Season';
        const dW = sansRegular.widthOfTextAtSize(dTxt, 8);
        page.drawText(dTxt, { x: (pw - dW) / 2, y: metaY - 4, size: 8, font: sansRegular, color: slateBlue });
      }

    } else if (tpl === 'polo' || tpl === 'ralph' || tpl === 'ralphlauren' || tpl === 'ralph_lauren' || tpl === 'rl_polo' || tpl === 'preppy') {
      // 15. Ralph Lauren Polo (Collegiate Navy & Gold Shield Heritage)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.975, 0.970, 0.960),
      });

      const m = 40;
      const rlNavy = rgb(0.06, 0.12, 0.25);
      const rlGreen = rgb(0.08, 0.22, 0.14);
      const rlGold = rgb(0.76, 0.60, 0.32);

      page.drawRectangle({ x: m, y: m, width: pw - 2 * m, height: ph - 2 * m, borderColor: rlNavy, borderWidth: 2.5 });
      page.drawRectangle({ x: m + 4.5, y: m + 4.5, width: pw - 2 * (m + 4.5), height: ph - 2 * (m + 4.5), borderColor: rlGold, borderWidth: 0.6 });
      page.drawRectangle({ x: m + 8.0, y: m + 8.0, width: pw - 2 * (m + 8.0), height: ph - 2 * (m + 8.0), borderColor: rlNavy, borderWidth: 0.4 });

      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;
      const serifRoman = timesFont;

      if (serifBold) {
        const topH = 'P O L O   S T U D Y   C O M P E N D I U M';
        const topW = serifBold.widthOfTextAtSize(topH, 8.5);
        page.drawText(topH, { x: (pw - topW) / 2, y: ph - m - 28, size: 8.5, font: serifBold, color: rlNavy });
      }
      if (serifItalic) {
        const subH = 'HERITAGE COLLEGIATE ARCHIVE · EST. 1967';
        const subW = serifItalic.widthOfTextAtSize(subH, 7.5);
        page.drawText(subH, { x: (pw - subW) / 2, y: ph - m - 42, size: 7.5, font: serifItalic, color: rlGreen });
      }

      const shieldY = ph * 0.66;
      page.drawLine({ start: { x: pw / 2, y: shieldY + 16 }, end: { x: pw / 2 + 16, y: shieldY }, thickness: 1.2, color: rlNavy });
      page.drawLine({ start: { x: pw / 2 + 16, y: shieldY }, end: { x: pw / 2, y: shieldY - 16 }, thickness: 1.2, color: rlNavy });
      page.drawLine({ start: { x: pw / 2, y: shieldY - 16 }, end: { x: pw / 2 - 16, y: shieldY }, thickness: 1.2, color: rlNavy });
      page.drawLine({ start: { x: pw / 2 - 16, y: shieldY }, end: { x: pw / 2, y: shieldY + 16 }, thickness: 1.2, color: rlNavy });
      page.drawCircle({ x: pw / 2, y: shieldY, size: 9, borderColor: rlGold, borderWidth: 0.6 });
      page.drawLine({ start: { x: pw / 2 - 11, y: shieldY }, end: { x: pw / 2 + 11, y: shieldY }, thickness: 0.6, color: rlGold });
      page.drawLine({ start: { x: pw / 2, y: shieldY - 11 }, end: { x: pw / 2, y: shieldY + 11 }, thickness: 0.6, color: rlGold });

      if (serifBold) {
        page.drawText('RL', { x: pw / 2 - 4.5, y: shieldY - 2, size: 5.5, font: serifBold, color: rlNavy });
      }

      const titleLines = wrapText(serifBold, titleText, 26, pw - 2 * m - 60);
      let curY = shieldY - 42;
      for (const line of titleLines) {
        if (serifBold) {
          const lW = serifBold.widthOfTextAtSize(line, 26);
          page.drawText(line, { x: (pw - lW) / 2, y: curY, size: 26, font: serifBold, color: rlNavy });
        }
        curY -= 34;
      }

      if (options.subtitle && serifItalic) {
        const sW = serifItalic.widthOfTextAtSize(options.subtitle, 12.5);
        page.drawText(options.subtitle, { x: (pw - sW) / 2, y: curY - 6, size: 12.5, font: serifItalic, color: rlGreen });
        curY -= 24;
      }

      page.drawLine({ start: { x: pw / 2 - 40, y: curY - 10 }, end: { x: pw / 2 + 40, y: curY - 10 }, thickness: 1.0, color: rlNavy });
      page.drawLine({ start: { x: pw / 2 - 25, y: curY - 13 }, end: { x: pw / 2 + 25, y: curY - 13 }, thickness: 0.5, color: rlGold });

      const metaY = m + 36;
      if (serifBold) {
        const rHdr = 'FELLOW / STUDENT RECORD';
        const rW = serifBold.widthOfTextAtSize(rHdr, 7.5);
        page.drawText(rHdr, { x: (pw - rW) / 2, y: metaY + 26, size: 7.5, font: serifBold, color: rlGold });

        const aTxt = options.author || 'Collegiate Member';
        const aW = serifBold.widthOfTextAtSize(aTxt, 10.5);
        page.drawText(aTxt, { x: (pw - aW) / 2, y: metaY + 12, size: 10.5, font: serifBold, color: rlNavy });
      }
      if (serifItalic) {
        const dTxt = todayStr || 'Academic Term';
        const dW = serifItalic.widthOfTextAtSize(dTxt, 8.5);
        page.drawText(dTxt, { x: (pw - dW) / 2, y: metaY - 2, size: 8.5, font: serifItalic, color: rlGreen });
      }

    } else if (tpl === 'equestrian' || tpl === 'ecuestre' || tpl === 'rl_equestrian' || tpl === 'saddlery') {
      // 16. Ralph Lauren Equestrian (British Country Estate & Hunter Green)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        color: rgb(0.965, 0.952, 0.925),
      });

      const m = 40;
      const hunterGreen = rgb(0.08, 0.20, 0.13);
      const saddleTan = rgb(0.55, 0.30, 0.14);
      const brass = rgb(0.74, 0.58, 0.30);

      page.drawRectangle({ x: m, y: m, width: pw - 2 * m, height: ph - 2 * m, borderColor: hunterGreen, borderWidth: 1.6 });
      page.drawRectangle({ x: m + 4, y: m + 4, width: pw - 2 * (m + 4), height: ph - 2 * (m + 4), borderColor: brass, borderWidth: 0.6 });
      page.drawRectangle({ x: m + 7.5, y: m + 7.5, width: pw - 2 * (m + 7.5), height: ph - 2 * (m + 7.5), borderColor: saddleTan, borderWidth: 0.4, borderDashArray: [4, 3] });

      const serifBold = timesBold;
      const serifItalic = fontMap.timesItalic || timesFont;
      const sansBold = fontMap.helveticaBold || timesBold;

      if (serifBold) {
        const topH = 'E Q U E S T R I A N   &   F I E L D';
        const topW = serifBold.widthOfTextAtSize(topH, 8.5);
        page.drawText(topH, { x: (pw - topW) / 2, y: ph - m - 28, size: 8.5, font: serifBold, color: hunterGreen });
      }
      if (serifItalic) {
        const subH = 'COUNTRY ESTATE ARCHIVE · SERIES IX';
        const subW = serifItalic.widthOfTextAtSize(subH, 7.5);
        page.drawText(subH, { x: (pw - subW) / 2, y: ph - m - 42, size: 7.5, font: serifItalic, color: saddleTan });
      }

      const stirrupY = ph * 0.66;
      page.drawLine({ start: { x: pw / 2 - 13, y: stirrupY - 8 }, end: { x: pw / 2 - 13, y: stirrupY + 12 }, thickness: 1.2, color: brass });
      page.drawLine({ start: { x: pw / 2 + 13, y: stirrupY - 8 }, end: { x: pw / 2 + 13, y: stirrupY + 12 }, thickness: 1.2, color: brass });
      page.drawLine({ start: { x: pw / 2 - 13, y: stirrupY + 12 }, end: { x: pw / 2 + 13, y: stirrupY + 12 }, thickness: 1.2, color: brass });
      page.drawLine({ start: { x: pw / 2 - 16, y: stirrupY - 8 }, end: { x: pw / 2 + 16, y: stirrupY - 8 }, thickness: 1.0, color: saddleTan });

      const titleLines = wrapText(serifBold, titleText, 25, pw - 2 * m - 60);
      let curY = stirrupY - 36;
      for (const line of titleLines) {
        if (serifBold) {
          const lW = serifBold.widthOfTextAtSize(line, 25);
          page.drawText(line, { x: (pw - lW) / 2, y: curY, size: 25, font: serifBold, color: hunterGreen });
        }
        curY -= 33;
      }

      if (options.subtitle && serifItalic) {
        const sW = serifItalic.widthOfTextAtSize(options.subtitle, 12);
        page.drawText(options.subtitle, { x: (pw - sW) / 2, y: curY - 6, size: 12, font: serifItalic, color: saddleTan });
        curY -= 24;
      }

      page.drawLine({ start: { x: pw / 2 - 45, y: curY - 10 }, end: { x: pw / 2 + 45, y: curY - 10 }, thickness: 0.8, color: saddleTan, dashArray: [3, 3] });
      page.drawCircle({ x: pw / 2 - 50, y: curY - 10, size: 2.0, color: brass });
      page.drawCircle({ x: pw / 2 + 50, y: curY - 10, size: 2.0, color: brass });

      const metaY = m + 36;
      if (sansBold) {
        const rHdr = 'ESTATE REGISTER';
        const rW = sansBold.widthOfTextAtSize(rHdr, 7);
        page.drawText(rHdr, { x: (pw - rW) / 2, y: metaY + 26, size: 7, font: sansBold, color: saddleTan });
      }
      if (serifBold) {
        const aTxt = options.author || 'Estate Member';
        const aW = serifBold.widthOfTextAtSize(aTxt, 10.5);
        page.drawText(aTxt, { x: (pw - aW) / 2, y: metaY + 12, size: 10.5, font: serifBold, color: hunterGreen });
      }
      if (serifItalic) {
        const dTxt = todayStr || 'Season Archive';
        const dW = serifItalic.widthOfTextAtSize(dTxt, 8.5);
        page.drawText(dTxt, { x: (pw - dW) / 2, y: metaY - 2, size: 8.5, font: serifItalic, color: saddleTan });
      }

    } else {
      // Default: Atelier Notebook (Zara Home Classic)
      const inset = 36;
      page.drawRectangle({
        x: inset,
        y: inset,
        width: pw - 2 * inset,
        height: ph - 2 * inset,
        borderColor: rgb(0.25, 0.25, 0.25),
        borderWidth: 0.6,
        borderOpacity: 0.22,
        color: rgb(1, 1, 1),
      });

      const innerInset = 42;
      page.drawRectangle({
        x: innerInset,
        y: innerInset,
        width: pw - 2 * innerInset,
        height: ph - 2 * innerInset,
        borderColor: rgb(0.25, 0.25, 0.25),
        borderWidth: 0.35,
        borderOpacity: 0.10,
      });

      // Top Super-header
      if (timesFont) {
        const superHdr = 'N O T E B O O K';
        const superW = timesFont.widthOfTextAtSize(superHdr, 7.5);
        page.drawText(superHdr, {
          x: (pw - superW) / 2,
          y: ph - 95,
          size: 7.5,
          font: timesFont,
          color: rgb(0.42, 0.42, 0.42),
          opacity: 0.75,
        });
      }

      page.drawLine({
        start: { x: pw / 2 - 24, y: ph - 105 },
        end: { x: pw / 2 + 24, y: ph - 105 },
        thickness: 0.4,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.20,
      });

      // Title with word wrap
      const titleSize = 24;
      const titleLineHeight = 32;
      const maxTitleW = pw - 2 * inset - 60;
      const titleLines = wrapText(timesBold, titleText, titleSize, maxTitleW);
      let curTitleY = ph * 0.58 + ((titleLines.length - 1) * titleLineHeight) / 2;

      if (timesBold) {
        for (const line of titleLines) {
          const lineW = timesBold.widthOfTextAtSize(line, titleSize);
          page.drawText(line, {
            x: (pw - lineW) / 2,
            y: curTitleY,
            size: titleSize,
            font: timesBold,
            color: rgb(0.12, 0.12, 0.14),
          });
          curTitleY -= titleLineHeight;
        }
      }

      let divY = curTitleY - 8;
      if (options.subtitle && timesItalic) {
        const subW = timesItalic.widthOfTextAtSize(options.subtitle, 12.5);
        page.drawText(options.subtitle, {
          x: (pw - subW) / 2,
          y: curTitleY - 4,
          size: 12.5,
          font: timesItalic,
          color: rgb(0.32, 0.32, 0.34),
          opacity: 0.9,
        });
        divY -= 22;
      }

      page.drawLine({
        start: { x: pw / 2 - 32, y: divY },
        end: { x: pw / 2 + 32, y: divY },
        thickness: 0.4,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.18,
      });

      let metaY = ph * 0.26;
      if (options.author && timesFont) {
        const authStr = options.author;
        const authW = timesFont.widthOfTextAtSize(authStr, 10.5);
        page.drawText(authStr, {
          x: (pw - authW) / 2,
          y: metaY,
          size: 10.5,
          font: timesFont,
          color: rgb(0.22, 0.22, 0.24),
          opacity: 0.9,
        });
        metaY -= 18;
      }

      if (timesItalic) {
        const dateStr = `Date: ${todayStr}`;
        const dateW = timesItalic.widthOfTextAtSize(dateStr, 9);
        page.drawText(dateStr, {
          x: (pw - dateW) / 2,
          y: metaY,
          size: 9,
          font: timesItalic,
          color: rgb(0.42, 0.42, 0.42),
          opacity: 0.8,
        });
        metaY -= 16;
      }

      if (options.numSlides && timesFont) {
        const slideWord = options.numSlides === 1 ? 'slide' : 'slides';
        const numStr = `${options.numSlides} ${slideWord} with dedicated notes`;
        const numW = timesFont.widthOfTextAtSize(numStr, 8.5);
        page.drawText(numStr, {
          x: (pw - numW) / 2,
          y: metaY,
          size: 8.5,
          font: timesFont,
          color: rgb(0.48, 0.48, 0.48),
          opacity: 0.75,
        });
      }
    }
    return page;
  }

  /**
   * Main conversion function.
   */
  async function convertSlidesToHandout(pdfBytes, options = {}) {
    const style = (options.style || 'lines').toLowerCase();
    const paperKey = (options.paperSize || 'a4').toLowerCase();
    const [paperWidth, paperHeight] = PAPER_SIZES[paperKey] || PAPER_SIZES.a4;
    const margin = options.margin !== undefined ? Number(options.margin) : DEFAULT_MARGIN;
    const step = options.step !== undefined ? Number(options.step) : DEFAULT_STEP;
    const separation = options.separation !== undefined ? Number(options.separation) : DEFAULT_SEPARATION;
    const layout = (options.layout || '1-up').toLowerCase();
    const binding = (options.binding || (options.gutter > 0 ? 'binder' : 'none')).toLowerCase();
    const holeGuides = Boolean(options.holeGuides);
    const gutterMargin = options.gutter !== undefined
      ? Number(options.gutter)
      : (binding === 'binder' ? 30.0 : (binding === 'spiral' ? 22.0 : 0.0));
    const duplex = Boolean(options.duplex);
    const coverMode = (options.coverMode || 'none').toLowerCase();
    const pageRanges = options.pageRanges || null;
    const studyHeader = Boolean(options.studyHeader);
    const studyTitle = options.studyTitle || '';
    const pageNumberFormat = options.pageNumberFormat || 'total';
    const onProgress = options.onProgress || null;

    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const outDoc = await PDFDocument.create();

    const pageNumbers = options.pageNumbers !== undefined ? Boolean(options.pageNumbers) : true;
    let helveticaFont = null;
    let helveticaBold = null;
    let timesFont = null;
    let timesBold = null;
    let timesItalic = null;
    if (StandardFonts) {
      try {
        helveticaFont = await outDoc.embedFont(StandardFonts.Helvetica);
        helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
        timesFont = await outDoc.embedFont(StandardFonts.TimesRoman);
        timesBold = await outDoc.embedFont(StandardFonts.TimesRomanBold);
        timesItalic = await outDoc.embedFont(StandardFonts.TimesRomanItalic);
      } catch (e) {
        console.warn('Could not embed fonts:', e);
      }
    }

    const totalInputPages = srcDoc.getPageCount();
    const selectedIndices = parsePageRanges(pageRanges, totalInputPages);

    const hasGenCover = (coverMode === 'generate');
    const handoutSheets = layout === '2-up'
      ? Math.ceil(selectedIndices.length / 2)
      : selectedIndices.length;
    const totalSheets = handoutSheets + (hasGenCover ? 1 : 0);

    // 1. Optional Generated Editorial Cover
    if (hasGenCover) {
      const coverPage = await generateCoverPage(
        outDoc,
        {
          paperDimensions: [paperWidth, paperHeight],
          title: options.coverTitle || 'Presentation',
          subtitle: studyTitle,
          author: options.coverAuthor || '',
          coverTemplate: options.coverTemplate || 'atelier',
          numSlides: selectedIndices.length,
        },
        {
          timesFont,
          timesBold,
          timesItalic,
          helveticaFont,
          helveticaBold,
        }
      );

      if (holeGuides && binding !== 'none') {
        drawBindingGuides(coverPage, { binding, duplex, isVerso: false });
      }
    }

    let sheetCounter = hasGenCover ? 2 : 1;

    // Helper for footer page number
    function drawFooter(page, sheetNum) {
      if (!pageNumbers || !helveticaFont) return;
      const numStr = pageNumberFormat === 'total' ? `${sheetNum} / ${totalSheets}` : String(sheetNum);
      const textSize = 9;
      const textWidth = helveticaFont.widthOfTextAtSize(numStr, textSize);
      const footerY = Math.max(margin / 2 - 3, 12);
      page.drawText(numStr, {
        x: (paperWidth - textWidth) / 2,
        y: footerY,
        size: textSize,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.7,
      });
    }

    // 2. Process Slides
    if (layout === '2-up') {
      for (let i = 0; i < selectedIndices.length; i += 2) {
        const idx1 = selectedIndices[i];
        const idx2 = i + 1 < selectedIndices.length ? selectedIndices[i + 1] : null;

        const leftGutter = duplex ? (sheetCounter % 2 === 1 ? gutterMargin : 0) : gutterMargin;
        const xOffset = margin + leftGutter;
        const availableWidth = paperWidth - 2 * margin - gutterMargin;

        const newPage = outDoc.addPage([paperWidth, paperHeight]);
        const halfHeight = paperHeight / 2;
        const headerHeight = studyHeader ? 22 : 0;
        const slot1Top = paperHeight - margin - headerHeight;
        const slot1Bottom = halfHeight + 6;

        // Slot 1
        const srcPage1 = srcDoc.getPage(idx1);
        const [emb1] = await outDoc.embedPdf(srcDoc, [idx1]);
        const { width: origW1, height: origH1 } = srcPage1.getSize();
        const maxH1 = (slot1Top - slot1Bottom) * 0.58;
        const scale1 = Math.min(availableWidth / origW1, maxH1 / origH1);
        const scaledW1 = origW1 * scale1;
        const scaledH1 = origH1 * scale1;
        const tx1 = xOffset + (availableWidth - scaledW1) / 2;
        const ty1 = slot1Top - scaledH1;

        newPage.drawPage(emb1, { x: tx1, y: ty1, width: scaledW1, height: scaledH1 });
        transformAndCopyAnnotations(srcDoc, srcPage1, outDoc, newPage, scale1, tx1, ty1);
        const sep1Y = ty1 - separation;

        // Slot 2
        let sep2Y = null;
        const slot2Bottom = margin;
        if (idx2 !== null) {
          const srcPage2 = srcDoc.getPage(idx2);
          const [emb2] = await outDoc.embedPdf(srcDoc, [idx2]);
          const { width: origW2, height: origH2 } = srcPage2.getSize();
          const slot2Top = halfHeight - 12;
          const maxH2 = (slot2Top - slot2Bottom) * 0.58;
          const scale2 = Math.min(availableWidth / origW2, maxH2 / origH2);
          const scaledW2 = origW2 * scale2;
          const scaledH2 = origH2 * scale2;
          const tx2 = xOffset + (availableWidth - scaledW2) / 2;
          const ty2 = slot2Top - scaledH2;

          newPage.drawPage(emb2, { x: tx2, y: ty2, width: scaledW2, height: scaledH2 });
          transformAndCopyAnnotations(srcDoc, srcPage2, outDoc, newPage, scale2, tx2, ty2);
          sep2Y = ty2 - separation;
        }

        if (studyHeader) {
          drawStudyHeader(newPage, { margin: xOffset, topMargin: margin, width: availableWidth, title: studyTitle }, helveticaFont);
        }

        draw2UpNotesOverlay(newPage, {
          margin: xOffset,
          width: availableWidth,
          slot1SepY: sep1Y,
          slot1Bottom,
          slot2SepY: sep2Y,
          slot2Bottom,
          style,
          step,
        });

        drawFooter(newPage, sheetCounter);

        if (holeGuides && binding !== 'none') {
          const isVerso = duplex && (sheetCounter % 2 === 0);
          drawBindingGuides(newPage, { binding, duplex, isVerso });
        }

        if (onProgress) {
          onProgress(Math.min(i + 2, selectedIndices.length), selectedIndices.length, style);
        }
        sheetCounter++;
      }
    } else {
      // 1-Up layout
      for (let sIdx = 0; sIdx < selectedIndices.length; sIdx++) {
        const srcIdx = selectedIndices[sIdx];
        const isCleanCover = (sIdx === 0 && coverMode === 'clean_first');

        const leftGutter = duplex ? (sheetCounter % 2 === 1 ? gutterMargin : 0) : gutterMargin;
        const xOffset = margin + leftGutter;
        const availableWidth = paperWidth - 2 * margin - gutterMargin;

        const srcPage = srcDoc.getPage(srcIdx);
        const { width: origWidth, height: origHeight } = srcPage.getSize();
        const rotation = (srcPage.getRotation().angle || 0) % 360;

        let effectiveWidth = origWidth;
        let effectiveHeight = origHeight;
        if (rotation === 90 || rotation === 270) {
          effectiveWidth = origHeight;
          effectiveHeight = origWidth;
        }

        const scale = availableWidth / effectiveWidth;
        const scaledHeight = effectiveHeight * scale;

        let yTranslation;
        if (isCleanCover) {
          yTranslation = (paperHeight - scaledHeight) / 2;
        } else {
          const headerOffset = studyHeader ? 24 : 0;
          yTranslation = paperHeight - scaledHeight - margin - headerOffset;
        }

        const [embeddedPage] = await outDoc.embedPdf(srcDoc, [srcIdx]);
        const newPage = outDoc.addPage([paperWidth, paperHeight]);

        newPage.drawPage(embeddedPage, {
          x: xOffset,
          y: yTranslation,
          width: availableWidth,
          height: scaledHeight,
        });

        transformAndCopyAnnotations(srcDoc, srcPage, outDoc, newPage, scale, xOffset, yTranslation);

        if (!isCleanCover) {
          if (studyHeader) {
            drawStudyHeader(newPage, { margin: xOffset, topMargin: margin, width: availableWidth, title: studyTitle }, helveticaFont);
          }

          const sepY = yTranslation - separation;
          drawNotesOverlay(newPage, {
            margin: xOffset,
            width: availableWidth,
            ySep: sepY,
            bottomMargin: margin,
            style,
            step,
            drawSeparator: true,
          });

          drawFooter(newPage, sheetCounter);
        }

        if (holeGuides && binding !== 'none') {
          const isVerso = duplex && (sheetCounter % 2 === 0);
          drawBindingGuides(newPage, { binding, duplex, isVerso });
        }

        if (onProgress) {
          onProgress(sIdx + 1, selectedIndices.length, style);
        }
        sheetCounter++;
      }
    }

    return await outDoc.save();
  }

  return {
    PAPER_SIZES,
    STYLES,
    DEFAULT_MARGIN,
    DEFAULT_STEP,
    DEFAULT_SEPARATION,
    parsePageRanges,
    convertSlidesToHandout,
  };
});
