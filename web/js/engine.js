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

  const { PDFDocument, rgb, PDFName, PDFArray, PDFDict } = PDFLib;

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
   * Recalculates and re-maps /Rect coordinates for hyperlinks and interactive annotations.
   */
  function transformAndCopyAnnotations(srcDoc, srcPage, outDoc, newPage, scale, tx, ty) {
    const annots = srcPage.node.Annots();
    if (!annots || typeof annots.size !== 'function' || annots.size() === 0) {
      return;
    }

    const newAnnots = outDoc.context.obj([]);

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
        newAnnots.push(newAnnotRef);
      } catch (err) {
        console.warn('Could not transform annotation:', err);
      }
    }

    if (newAnnots.size() > 0) {
      newPage.node.set(PDFName.of('Annots'), newAnnots);
    }
  }

  /**
   * Draws note-taking patterns onto the page.
   * Matches slide_printer.patterns.create_notes_overlay styling.
   */
  function drawNotesOverlay(page, options) {
    const { margin, width, ySep, bottomMargin, style, step, dotRadius = 0.65 } = options;
    const x1 = margin;
    const x2 = margin + width;
    const yStart = ySep - 10;

    // 1. Separator line with subtle end ticks
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
      let currY = yStart;
      while (currY >= bottomMargin) {
        page.drawLine({
          start: { x: x1, y: currY },
          end: { x: x2, y: currY },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
        currY -= step;
      }

      const yMin = currY + step;
      let currX = x1;
      while (currX <= x2) {
        page.drawLine({
          start: { x: currX, y: yMin },
          end: { x: currX, y: yStart },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
        currX += step;
      }
    } else if (normStyle === 'dots') {
      let currY = yStart;
      while (currY >= bottomMargin) {
        let currX = x1;
        while (currX <= x2) {
          page.drawCircle({
            x: currX,
            y: currY,
            size: dotRadius,
            color: rgb(0.25, 0.25, 0.25),
            opacity: 0.35,
          });
          currX += step;
        }
        currY -= step;
      }
    }
    // 'blank' style only draws the separator line
  }

  /**
   * Main conversion function.
   * 
   * @param {ArrayBuffer|Uint8Array} pdfBytes Source PDF buffer.
   * @param {Object} options Configuration options.
   * @returns {Promise<Uint8Array>} Generated handout PDF bytes.
   */
  async function convertSlidesToHandout(pdfBytes, options = {}) {
    const style = (options.style || 'lines').toLowerCase();
    const paperKey = (options.paperSize || 'a4').toLowerCase();
    const [paperWidth, paperHeight] = PAPER_SIZES[paperKey] || PAPER_SIZES.a4;
    const margin = options.margin !== undefined ? Number(options.margin) : DEFAULT_MARGIN;
    const step = options.step !== undefined ? Number(options.step) : DEFAULT_STEP;
    const separation = options.separation !== undefined ? Number(options.separation) : DEFAULT_SEPARATION;
    const onProgress = options.onProgress || null;

    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const outDoc = await PDFDocument.create();

    const totalPages = srcDoc.getPageCount();
    const availableWidth = paperWidth - 2 * margin;

    for (let i = 0; i < totalPages; i++) {
      const srcPage = srcDoc.getPage(i);
      const { width: origWidth, height: origHeight } = srcPage.getSize();
      const rotation = (srcPage.getRotation().angle || 0) % 360;

      let effectiveWidth = origWidth;
      let effectiveHeight = origHeight;
      if (rotation === 90 || rotation === 270) {
        effectiveWidth = origHeight;
        effectiveHeight = origWidth;
      }

      if (effectiveWidth <= 0 || effectiveHeight <= 0) {
        throw new Error(`Invalid dimensions on slide page ${i + 1}`);
      }

      const scale = availableWidth / effectiveWidth;
      const scaledHeight = effectiveHeight * scale;
      const yTranslation = paperHeight - scaledHeight - margin;

      const [embeddedPage] = await outDoc.embedPdf(srcDoc, [i]);
      const newPage = outDoc.addPage([paperWidth, paperHeight]);

      // Draw scaled presentation slide
      newPage.drawPage(embeddedPage, {
        x: margin,
        y: yTranslation,
        width: availableWidth,
        height: scaledHeight,
      });

      // Transfer and scale clickable hyperlinks
      transformAndCopyAnnotations(
        srcDoc,
        srcPage,
        outDoc,
        newPage,
        scale,
        margin,
        yTranslation
      );

      // Draw notes area pattern
      const sepY = yTranslation - separation;
      drawNotesOverlay(newPage, {
        margin,
        width: availableWidth,
        ySep: sepY,
        bottomMargin: margin,
        style,
        step,
      });

      if (onProgress) {
        onProgress(i + 1, totalPages, style);
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
    convertSlidesToHandout,
  };
});
