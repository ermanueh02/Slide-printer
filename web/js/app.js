/**
 * Slide-Printer Web Application Controller
 */

(function () {
  'use strict';

  // Configure PDF.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  }

  // App State
  const state = {
    file: null,
    fileName: '',
    fileSizeStr: '',
    pdfBytes: null,
    pdfjsDoc: null,
    numPages: 0,
    currentPage: 1,
    style: 'lines',
    paperSize: 'a4',
    margin: 40,
    step: 14,
    separation: 10,
    isProcessing: false,
  };

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const workspace = document.getElementById('workspace');
  const initialHero = document.getElementById('initialHero');

  // Metadata elements
  const metaFileName = document.getElementById('metaFileName');
  const metaPageCount = document.getElementById('metaPageCount');
  const metaFileSize = document.getElementById('metaFileSize');
  const metaAspectRatio = document.getElementById('metaAspectRatio');
  const replaceFileBtn = document.getElementById('replaceFileBtn');

  // Controls
  const styleOptions = document.querySelectorAll('.style-card');
  const paperSelect = document.getElementById('paperSelect');
  const marginSlider = document.getElementById('marginSlider');
  const marginValue = document.getElementById('marginValue');
  const stepSlider = document.getElementById('stepSlider');
  const stepValue = document.getElementById('stepValue');
  const separationSlider = document.getElementById('separationSlider');
  const separationValue = document.getElementById('separationValue');
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');

  // Preview elements
  const previewCanvas = document.getElementById('previewCanvas');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');
  const pageInput = document.getElementById('pageInput');
  const totalPagesSpan = document.getElementById('totalPagesSpan');

  // Actions
  const downloadBtn = document.getElementById('downloadBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const printBtn = document.getElementById('printBtn');

  // Progress overlay
  const progressOverlay = document.getElementById('progressOverlay');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressStatus = document.getElementById('progressStatus');

  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Initialize
  init();

  function init() {
    setupTheme();
    setupDropZone();
    setupControls();
    setupPageNavigation();
    setupActions();
    setupKeyboardNavigation();

    // Responsive preview re-render
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.pdfjsDoc) {
          renderCurrentPreview();
        }
      }, 150);
    });
  }

  // --- Theme Management (Automatic / Light / Dark) ---
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  let currentThemeMode = localStorage.getItem('slide_printer_theme_mode') || 'auto';

  function setupTheme() {
    applyThemeMode(currentThemeMode);

    // Real-time listener for OS dark/light mode changes when in Auto mode
    systemPrefersDark.addEventListener('change', () => {
      if (currentThemeMode === 'auto') {
        applyThemeMode('auto');
      }
    });

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        // Cycle: auto -> light -> dark -> auto
        if (currentThemeMode === 'auto') {
          currentThemeMode = 'light';
        } else if (currentThemeMode === 'light') {
          currentThemeMode = 'dark';
        } else {
          currentThemeMode = 'auto';
        }
        localStorage.setItem('slide_printer_theme_mode', currentThemeMode);
        applyThemeMode(currentThemeMode);
      });
    }
  }

  function applyThemeMode(mode) {
    const iconEl = document.getElementById('themeModeIcon');
    const textEl = document.getElementById('themeModeText');

    if (mode === 'auto') {
      const isDark = systemPrefersDark.matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      if (iconEl) iconEl.textContent = '✦';
      if (textEl) textEl.textContent = 'System';
      if (themeToggleBtn) themeToggleBtn.title = `Theme: Auto (${isDark ? 'Dark' : 'Light'} System)`;
    } else if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (iconEl) iconEl.textContent = '☀️';
      if (textEl) textEl.textContent = 'Light';
      if (themeToggleBtn) themeToggleBtn.title = 'Theme: Light (Click to switch to Dark)';
    } else if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (iconEl) iconEl.textContent = '🌙';
      if (textEl) textEl.textContent = 'Dark';
      if (themeToggleBtn) themeToggleBtn.title = 'Theme: Dark (Click to switch to Auto)';
    }

    if (state.pdfjsDoc) {
      renderCurrentPreview();
    }
  }

  // --- Drag & Drop / File Loading ---
  function setupDropZone() {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    });

    browseBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    if (replaceFileBtn) {
      replaceFileBtn.addEventListener('click', () => fileInput.click());
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    try {
      showLoading(true, 'Reading presentation PDF...');
      const arrayBuffer = await file.arrayBuffer();
      state.file = file;
      state.fileName = file.name;
      state.fileSizeStr = formatBytes(file.size);
      state.pdfBytes = arrayBuffer;

      // Load with PDF.js for preview
      SlidePrinterPreview.resetCache();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
      state.pdfjsDoc = await loadingTask.promise;
      state.numPages = state.pdfjsDoc.numPages;
      state.currentPage = 1;

      // Detect aspect ratio from first slide
      const firstPage = await state.pdfjsDoc.getPage(1);
      const vp = firstPage.getViewport({ scale: 1.0 });
      const ratio = vp.width / vp.height;
      let ratioText = 'Standard';
      if (Math.abs(ratio - 16 / 9) < 0.15) {
        ratioText = '16:9 Widescreen';
      } else if (Math.abs(ratio - 4 / 3) < 0.15) {
        ratioText = '4:3 Standard';
      } else if (Math.abs(ratio - 16 / 10) < 0.15) {
        ratioText = '16:10 Widescreen';
      } else {
        ratioText = `${ratio.toFixed(2)}:1`;
      }

      // Update UI metadata
      metaFileName.textContent = file.name;
      metaPageCount.textContent = `${state.numPages} ${state.numPages === 1 ? 'slide' : 'slides'}`;
      metaFileSize.textContent = state.fileSizeStr;
      metaAspectRatio.textContent = ratioText;
      totalPagesSpan.textContent = state.numPages;
      pageInput.max = state.numPages;
      pageInput.value = 1;

      // Switch views
      initialHero.classList.add('hidden');
      workspace.classList.remove('hidden');

      showLoading(false);
      renderCurrentPreview();
    } catch (err) {
      showLoading(false);
      console.error('Error loading PDF:', err);
      alert(`Could not load PDF: ${err.message || err}`);
    }
  }

  // --- Controls & Options ---
  function setupControls() {
    // Style selector cards
    styleOptions.forEach(card => {
      card.addEventListener('click', () => {
        styleOptions.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.style = card.getAttribute('data-style');
        renderCurrentPreview();
      });
    });

    // Paper size select
    paperSelect.addEventListener('change', (e) => {
      state.paperSize = e.target.value;
      renderCurrentPreview();
    });

    // Sliders
    marginSlider.addEventListener('input', (e) => {
      state.margin = Number(e.target.value);
      marginValue.textContent = `${state.margin} pt`;
      renderCurrentPreview();
    });

    stepSlider.addEventListener('input', (e) => {
      state.step = Number(e.target.value);
      stepValue.textContent = `${state.step} pt`;
      renderCurrentPreview();
    });

    separationSlider.addEventListener('input', (e) => {
      state.separation = Number(e.target.value);
      separationValue.textContent = `${state.separation} pt`;
      renderCurrentPreview();
    });

    // Reset settings
    resetSettingsBtn.addEventListener('click', () => {
      marginSlider.value = 40;
      stepSlider.value = 14;
      separationSlider.value = 10;
      state.margin = 40;
      state.step = 14;
      state.separation = 10;
      marginValue.textContent = '40 pt';
      stepValue.textContent = '14 pt';
      separationValue.textContent = '10 pt';
      renderCurrentPreview();
    });
  }

  // --- Page Navigation ---
  function setupPageNavigation() {
    prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        goToPage(state.currentPage - 1);
      }
    });

    nextPageBtn.addEventListener('click', () => {
      if (state.currentPage < state.numPages) {
        goToPage(state.currentPage + 1);
      }
    });

    pageInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 1;
      val = Math.max(1, Math.min(val, state.numPages));
      goToPage(val);
    });
  }

  function setupKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft' && state.currentPage > 1) {
        goToPage(state.currentPage - 1);
      } else if (e.key === 'ArrowRight' && state.currentPage < state.numPages) {
        goToPage(state.currentPage + 1);
      }
    });
  }

  function goToPage(pageNum) {
    state.currentPage = pageNum;
    pageInput.value = pageNum;
    prevPageBtn.disabled = state.currentPage <= 1;
    nextPageBtn.disabled = state.currentPage >= state.numPages;
    renderCurrentPreview();
  }

  // --- Preview Rendering ---
  function renderCurrentPreview() {
    if (!state.pdfjsDoc) return;

    const paperDims = SlidePrinterEngine.PAPER_SIZES[state.paperSize] || SlidePrinterEngine.PAPER_SIZES.a4;

    SlidePrinterPreview.renderPreview(
      previewCanvas,
      state.pdfjsDoc,
      state.currentPage,
      {
        paperSize: state.paperSize,
        paperDimensions: paperDims,
        style: state.style,
        margin: state.margin,
        step: state.step,
        separation: state.separation,
      }
    );
  }

  // --- Action Handlers ---
  function setupActions() {
    downloadBtn.addEventListener('click', () => exportCurrentHandout());
    exportAllBtn.addEventListener('click', () => exportAllStylesZip());
    printBtn.addEventListener('click', () => printCurrentHandout());
  }

  function getBaseFileName() {
    const orig = state.fileName || 'handout.pdf';
    return orig.replace(/\.[^/.]+$/, '');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportCurrentHandout() {
    if (!state.pdfBytes || state.isProcessing) return;

    state.isProcessing = true;
    showLoading(true, 'Generating printable handout...');

    try {
      const outBytes = await SlidePrinterEngine.convertSlidesToHandout(
        state.pdfBytes.slice(0),
        {
          style: state.style,
          paperSize: state.paperSize,
          margin: state.margin,
          step: state.step,
          separation: state.separation,
          onProgress: (current, total) => {
            const pct = Math.round((current / total) * 100);
            updateProgress(pct, `Processing slide ${current} of ${total}...`);
          },
        }
      );

      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const styleName = SlidePrinterEngine.STYLES[state.style]?.code || state.style;
      const filename = `${getBaseFileName()}_${styleName}.pdf`;

      triggerDownload(blob, filename);
    } catch (err) {
      console.error('Handout generation failed:', err);
      alert(`Handout generation failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
  }

  async function exportAllStylesZip() {
    if (!state.pdfBytes || state.isProcessing) return;
    if (typeof JSZip === 'undefined') {
      alert('JSZip library is required for batch ZIP download.');
      return;
    }

    state.isProcessing = true;
    showLoading(true, 'Bundling all 4 note styles into ZIP...');

    try {
      const zip = new JSZip();
      const styles = ['blank', 'lines', 'grid', 'dots'];
      const totalSteps = styles.length * state.numPages;
      let completedSteps = 0;

      for (let sIdx = 0; sIdx < styles.length; sIdx++) {
        const s = styles[sIdx];
        const sName = SlidePrinterEngine.STYLES[s]?.code || s;

        const outBytes = await SlidePrinterEngine.convertSlidesToHandout(
          state.pdfBytes.slice(0),
          {
            style: s,
            paperSize: state.paperSize,
            margin: state.margin,
            step: state.step,
            separation: state.separation,
            onProgress: (current, total) => {
              completedSteps++;
              const pct = Math.round((completedSteps / totalSteps) * 100);
              updateProgress(
                pct,
                `Generating ${sName} style (${current}/${total} slides)...`
              );
            },
          }
        );

        zip.file(`${getBaseFileName()}_${sName}.pdf`, outBytes);
      }

      updateProgress(98, 'Compressing archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${getBaseFileName()}_all_styles.zip`;
      triggerDownload(zipBlob, zipFileName);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert(`ZIP bundle export failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
  }

  async function printCurrentHandout() {
    if (!state.pdfBytes || state.isProcessing) return;

    state.isProcessing = true;
    showLoading(true, 'Preparing print preview...');

    try {
      const outBytes = await SlidePrinterEngine.convertSlidesToHandout(
        state.pdfBytes.slice(0),
        {
          style: state.style,
          paperSize: state.paperSize,
          margin: state.margin,
          step: state.step,
          separation: state.separation,
          onProgress: (current, total) => {
            const pct = Math.round((current / total) * 100);
            updateProgress(pct, `Preparing slide ${current} of ${total}...`);
          },
        }
      );

      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      // Open in hidden iframe for native print dialog
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = blobUrl;

      document.body.appendChild(printIframe);

      printIframe.onload = () => {
        try {
          printIframe.contentWindow.focus();
          printIframe.contentWindow.print();
        } catch (e) {
          // Fallback: open in new tab
          window.open(blobUrl, '_blank');
        }
        setTimeout(() => {
          document.body.removeChild(printIframe);
          URL.revokeObjectURL(blobUrl);
        }, 60000);
      };
    } catch (err) {
      console.error('Print preparation failed:', err);
      alert(`Print preparation failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
  }

  // --- Loading / Progress Overlay ---
  function showLoading(show, message = 'Processing...') {
    if (show) {
      progressOverlay.classList.remove('hidden');
      progressStatus.textContent = message;
      updateProgress(0, message);
    } else {
      progressOverlay.classList.add('hidden');
    }
  }

  function updateProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    if (text) {
      progressStatus.textContent = text;
    }
  }
})();
