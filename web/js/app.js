/**
 * Slide-Printer Web Application Controller
 * Atelier Edition — Multilingual (EN, ES, GL) & Heritage Aesthetics
 */

(function () {
  'use strict';

  // --- Translations (English, Español, Galego) ---
  const TRANSLATIONS = {
    en: {
      brandSubtitle: "Slides with notes",
      privacyBadge: "100% Private · In-Browser",
      themeAuto: "System",
      themeLight: "Light",
      themeDark: "Dark",
      themeAutoTitle: "Theme: Auto (System preference)",
      themeLightTitle: "Theme: Light",
      themeDarkTitle: "Theme: Dark",
      heroSuper: "PDF Handout Generator",
      heroTitle: "Print slides with dedicated note space",
      heroSubtitle: "Transform any presentation into clean, printable study handouts. Adds note-taking area beneath each slide while preserving aspect ratios and clickable links.",
      dropTitle: "Drop your presentation PDF here",
      dropSub: "Compatible with 16:9 and 4:3 slide formats",
      browseBtn: "Select Document",
      feat1Num: "01",
      feat1Title: "Active Hyperlinks",
      feat1Desc: "Original clickable links are mathematically recalculated and stay active in the output PDF.",
      feat2Num: "02",
      feat2Title: "4 Note Styles",
      feat2Desc: "Ruled lines, grid, bullet points, or blank space to match your note-taking style.",
      feat3Num: "03",
      feat3Title: "100% Private",
      feat3Desc: "Everything is processed locally in your browser. No files are uploaded to any server.",
      changeBtn: "Change PDF",
      patternLabel: "Note Style",
      section1: "01",
      styleLinesTitle: "Ruled lines",
      styleLinesDesc: "~5mm handwriting lines for notes",
      styleGridTitle: "Grid",
      styleGridDesc: "Technical grid for diagrams and math",
      styleDotsTitle: "Bullet points",
      styleDotsDesc: "Subtle dot matrix for flexible notes",
      styleBlankTitle: "Blank",
      styleBlankDesc: "Clean open space with subtle divider",
      paperLabel: "Page Format",
      section2: "02",
      paperSelectLabel: "Paper Size",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "Margins & Spacing",
      marginLabel: "Page Margin",
      densityLabel: "Line / Dot Spacing",
      sepLabel: "Slide Separation",
      restoreBtn: "Reset to Defaults",
      exportBtn: "Download PDF",
      archiveBtn: "Download All 4 (ZIP)",
      printBtn: "Print",
      folioLabel: "Slide",
      ofLabel: "of",
      progressTitle: "Generating handout...",
      footerTitle: "Slide—Printer",
      footerSubtitle: "Open-source presentation handout generator",
      footerPrivacy: "100% Client-Side Processing",
      readingMsg: "Reading PDF presentation...",
      generatingMsg: "Generating printable handout...",
      bundlingMsg: "Bundling all 4 note styles into ZIP...",
      compressingMsg: "Compressing archive...",
      preparingPrintMsg: "Preparing print view...",
      invalidPdfMsg: "Please select a valid PDF presentation file.",
      slidesLabel: "slides",
      slideLabel: "slide",
    },
    es: {
      brandSubtitle: "Diapositivas con notas",
      privacyBadge: "100% privado · En tu navegador",
      themeAuto: "Sistema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      themeAutoTitle: "Tema: Automático (Preferencia del sistema)",
      themeLightTitle: "Tema: Claro",
      themeDarkTitle: "Tema: Oscuro",
      heroSuper: "Conversor de PDF a apuntes",
      heroTitle: "Imprime diapositivas con espacio para notas",
      heroSubtitle: "Convierte cualquier presentación en documentos listos para imprimir. Añade espacio para escribir debajo de cada diapositiva conservando proporciones e hiperenlaces.",
      dropTitle: "Arrastra tu presentación PDF aquí",
      dropSub: "Compatible con diapositivas 16:9 y 4:3",
      browseBtn: "Seleccionar documento",
      feat1Num: "01",
      feat1Title: "Hiperenlaces activos",
      feat1Desc: "Los enlaces originales se recalculan y permanecen clicables en el PDF generado.",
      feat2Num: "02",
      feat2Title: "4 estilos de notas",
      feat2Desc: "Líneas de pauta, cuadrícula, bullet points o blanco según tu método de estudio.",
      feat3Num: "03",
      feat3Title: "100% privado",
      feat3Desc: "El procesamiento se realiza en tu navegador. El archivo nunca sale de tu ordenador.",
      changeBtn: "Cambiar archivo",
      patternLabel: "Estilo de notas",
      section1: "01",
      styleLinesTitle: "Líneas de pauta",
      styleLinesDesc: "Líneas de ~5mm para escritura manual",
      styleGridTitle: "Cuadrícula",
      styleGridDesc: "Cuadrícula técnica para diagramas",
      styleDotsTitle: "Bullet points",
      styleDotsDesc: "Matriz de puntos guía",
      styleBlankTitle: "Blanco",
      styleBlankDesc: "Espacio despejado con separador",
      paperLabel: "Formato de página",
      section2: "02",
      paperSelectLabel: "Tamaño de papel",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "Márgenes y espaciado",
      marginLabel: "Margen de página",
      densityLabel: "Espaciado de líneas / puntos",
      sepLabel: "Separación de diapositiva",
      restoreBtn: "Restablecer valores",
      exportBtn: "Descargar PDF",
      archiveBtn: "Descargar los 4 (ZIP)",
      printBtn: "Imprimir",
      folioLabel: "Diapositiva",
      ofLabel: "de",
      progressTitle: "Generando documento...",
      footerTitle: "Slide—Printer",
      footerSubtitle: "Conversor de presentaciones a formato de apuntes",
      footerPrivacy: "Procesamiento 100% en el navegador",
      readingMsg: "Cargando presentación...",
      generatingMsg: "Generando PDF...",
      bundlingMsg: "Generando los 4 estilos en ZIP...",
      compressingMsg: "Comprimiendo archivo ZIP...",
      preparingPrintMsg: "Preparando vista de impresión...",
      invalidPdfMsg: "Por favor, selecciona un archivo PDF válido.",
      slidesLabel: "diapositivas",
      slideLabel: "diapositiva",
    },
    gl: {
      brandSubtitle: "Diapositivas con notas",
      privacyBadge: "100% privado · No navegador",
      themeAuto: "Sistema",
      themeLight: "Claro",
      themeDark: "Escuro",
      themeAutoTitle: "Tema: Automático (Preferencia do sistema)",
      themeLightTitle: "Tema: Claro",
      themeDarkTitle: "Tema: Escuro",
      heroSuper: "Conversor de PDF a apuntamentos",
      heroTitle: "Imprime diapositivas con espazo para notas",
      heroSubtitle: "Converte calquera presentación en documentos listos para imprimir. Engade espazo para escribir debaixo de cada diapositiva conservando proporcións e ligazóns.",
      dropTitle: "Arrastra a túa presentación PDF aquí",
      dropSub: "Compatible con diapositivas 16:9 e 4:3",
      browseBtn: "Seleccionar documento",
      feat1Num: "01",
      feat1Title: "Ligazóns activas",
      feat1Desc: "As ligazóns orixinais son recalculadas e fican clicables no PDF xerado.",
      feat2Num: "02",
      feat2Title: "4 estilos de notas",
      feat2Desc: "Liñas de pauta, cuadrícula, bullet points ou branco segundo precises.",
      feat3Num: "03",
      feat3Title: "100% privado",
      feat3Desc: "O procesamento faise no teu navegador. O ficheiro nunca sae do teu ordenador.",
      changeBtn: "Cambiar ficheiro",
      patternLabel: "Estilo de notas",
      section1: "01",
      styleLinesTitle: "Liñas de pauta",
      styleLinesDesc: "Liñas de ~5mm para escrita manual",
      styleGridTitle: "Cuadrícula",
      styleGridDesc: "Cadro técnico para esquemas e diagramas",
      styleDotsTitle: "Bullet points",
      styleDotsDesc: "Matriz de puntos guía para notas",
      styleBlankTitle: "Branco",
      styleBlankDesc: "Espazo despexado con liña separadora",
      paperLabel: "Formato de páxina",
      section2: "02",
      paperSelectLabel: "Tamaño de papel",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "Marxes e espazado",
      marginLabel: "Marxe de páxina",
      densityLabel: "Espazado de liñas / puntos",
      sepLabel: "Separación de diapositiva",
      restoreBtn: "Restablecer valores",
      exportBtn: "Descargar PDF",
      archiveBtn: "Descargar os 4 estilos (ZIP)",
      printBtn: "Imprimir",
      folioLabel: "Diapositiva",
      ofLabel: "de",
      progressTitle: "Xerando documento...",
      footerTitle: "Slide—Printer",
      footerSubtitle: "Conversor de presentacións a formato de apuntamentos",
      footerPrivacy: "Procesamento 100% no navegador",
      readingMsg: "Cargando presentación...",
      generatingMsg: "Xerando PDF...",
      bundlingMsg: "Xerando os 4 estilos en ZIP...",
      compressingMsg: "Comprimindo arquivo ZIP...",
      preparingPrintMsg: "Preparando vista de impresión...",
      invalidPdfMsg: "Por favor, selecciona un arquivo PDF válido.",
      slidesLabel: "diapositivas",
      slideLabel: "diapositiva",
    }
  };

  // Configure PDF.js worker
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    } catch (e) {
      console.warn('Could not set workerSrc:', e);
    }
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
    lang: 'en',
  };

  // Global variables initialized safely
  const systemPrefersDark = (typeof window !== 'undefined' && window.matchMedia) 
    ? window.matchMedia('(prefers-color-scheme: dark)') 
    : { matches: false, addEventListener: () => {} };

  let currentThemeMode = 'auto';

  // --- Localization (i18n) Engine ---
  function detectInitialLanguage() {
    const savedLang = localStorage.getItem('slide_printer_lang');
    if (savedLang && ['en', 'es', 'gl'].includes(savedLang)) {
      return savedLang;
    }
    const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (navLang.startsWith('gl')) return 'gl';
    if (navLang.startsWith('es')) return 'es';
    return 'en';
  }

  function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    state.lang = lang;
    localStorage.setItem('slide_printer_lang', lang);

    // Update active state in language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    const dict = TRANSLATIONS[lang];

    // Helper to safely update text content
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtml = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    // Header
    setText('brandSubtitleText', dict.brandSubtitle);
    setText('privacyBadgeText', dict.privacyBadge);

    // Theme Mode button text
    updateThemeButtonUI();

    // Hero
    setText('heroSuperText', dict.heroSuper);
    setHtml('heroTitleText', dict.heroTitle);
    setText('heroSubText', dict.heroSubtitle);
    setText('dropZoneTitleText', dict.dropTitle);
    setText('dropZoneSubText', dict.dropSub);
    setText('browseBtnText', dict.browseBtn);

    // Features
    setText('feat1NumText', dict.feat1Num);
    setText('feat1TitleText', dict.feat1Title);
    setText('feat1DescText', dict.feat1Desc);
    setText('feat2NumText', dict.feat2Num);
    setText('feat2TitleText', dict.feat2Title);
    setText('feat2DescText', dict.feat2Desc);
    setText('feat3NumText', dict.feat3Num);
    setText('feat3TitleText', dict.feat3Title);
    setText('feat3DescText', dict.feat3Desc);

    // Controls
    setText('replaceFileBtn', dict.changeBtn);
    setText('patternSectionLabel', dict.patternLabel);
    setText('patternSectionSub', dict.section1);
    setText('styleLinesTitle', dict.styleLinesTitle);
    setText('styleLinesDesc', dict.styleLinesDesc);
    setText('styleGridTitle', dict.styleGridTitle);
    setText('styleGridDesc', dict.styleGridDesc);
    setText('styleDotsTitle', dict.styleDotsTitle);
    setText('styleDotsDesc', dict.styleDotsDesc);
    setText('styleBlankTitle', dict.styleBlankTitle);
    setText('styleBlankDesc', dict.styleBlankDesc);

    setText('paperSectionLabel', dict.paperLabel);
    setText('paperSectionSub', dict.section2);
    setText('paperSelectLabelText', dict.paperSelectLabel);
    setText('optA4', dict.paperA4);
    setText('optLetter', dict.paperLetter);
    setText('optLegal', dict.paperLegal);
    setText('optA3', dict.paperA3);

    setText('tuningSummaryText', dict.tuningSummary);
    setText('marginLabelText', dict.marginLabel);
    setText('densityLabelText', dict.densityLabel);
    setText('sepLabelText', dict.sepLabel);
    setText('resetSettingsBtn', dict.restoreBtn);

    // Actions
    setText('downloadBtnText', dict.exportBtn);
    setText('exportAllBtnText', dict.archiveBtn);
    setText('printBtnText', dict.printBtn);

    // Navigator
    setText('slideFolioText', dict.folioLabel);
    setText('slideOfText', dict.ofLabel);

    // Footer
    setText('footerTitleText', dict.footerTitle);
    setText('footerSubtitleText', dict.footerSubtitle);
    setText('footerPrivacyText', dict.footerPrivacy);

    // Update metadata count if loaded
    if (state.numPages > 0) {
      const label = state.numPages === 1 ? dict.slideLabel : dict.slidesLabel;
      setText('metaPageCount', `${state.numPages} ${label}`);
    }
  }

  function setupLanguage() {
    const initialLang = detectInitialLanguage();
    setLanguage(initialLang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        setLanguage(lang);
      });
    });
  }

  // --- Theme Management (Automatic / Light / Dark) ---
  function setupTheme() {
    currentThemeMode = localStorage.getItem('slide_printer_theme_mode') || 'auto';
    applyThemeMode(currentThemeMode);

    if (systemPrefersDark.addEventListener) {
      systemPrefersDark.addEventListener('change', () => {
        if (currentThemeMode === 'auto') {
          applyThemeMode('auto');
        }
      });
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
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

  function updateThemeButtonUI() {
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;
    const iconEl = document.getElementById('themeModeIcon');
    const textEl = document.getElementById('themeModeText');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    if (currentThemeMode === 'auto') {
      if (iconEl) iconEl.textContent = '◐';
      if (textEl) textEl.textContent = dict.themeAuto;
      if (themeToggleBtn) themeToggleBtn.title = dict.themeAutoTitle;
    } else if (currentThemeMode === 'light') {
      if (iconEl) iconEl.textContent = '☀️';
      if (textEl) textEl.textContent = dict.themeLight;
      if (themeToggleBtn) themeToggleBtn.title = dict.themeLightTitle;
    } else if (currentThemeMode === 'dark') {
      if (iconEl) iconEl.textContent = '🌙';
      if (textEl) textEl.textContent = dict.themeDark;
      if (themeToggleBtn) themeToggleBtn.title = dict.themeDarkTitle;
    }
  }

  function applyThemeMode(mode) {
    if (mode === 'auto') {
      const isDark = systemPrefersDark.matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }
    updateThemeButtonUI();

    if (state.pdfjsDoc) {
      renderCurrentPreview();
    }
  }

  // --- Drag & Drop / File Loading ---
  function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const replaceFileBtn = document.getElementById('replaceFileBtn');

    if (!dropZone || !fileInput) return;

    // 1. Prevent default file drop navigation across the whole window
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
      }, false);
    });

    let dragCounter = 0;

    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      dropZone.classList.add('drag-active');
    }, false);

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropZone.classList.add('drag-active');
    }, false);

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
      }
    }, false);

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dropZone.classList.remove('drag-active');

      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFile(dt.files[0]);
      }
    }, false);

    // 2. Click-to-browse handling
    function openFilePicker(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      fileInput.click();
    }

    dropZone.addEventListener('click', (e) => {
      openFilePicker(e);
    });

    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        openFilePicker(e);
      });
    }

    if (replaceFileBtn) {
      replaceFileBtn.addEventListener('click', (e) => {
        openFilePicker(e);
      });
    }

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFilePicker(e);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
      fileInput.value = '';
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function handleFile(file) {
    if (!file) return;
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type.includes('pdf'));
    if (!isPdf) {
      alert(dict.invalidPdfMsg);
      return;
    }

    try {
      showLoading(true, dict.readingMsg);
      const arrayBuffer = await file.arrayBuffer();
      state.file = file;
      state.fileName = file.name;
      state.fileSizeStr = formatBytes(file.size);

      // Keep a pristine, untouched Uint8Array copy that will NEVER be detached
      state.pdfBytes = new Uint8Array(arrayBuffer);

      // Provide a separate clone to pdfjsLib so worker transfer never touches state.pdfBytes
      const pdfjsData = new Uint8Array(arrayBuffer.slice(0));

      SlidePrinterPreview.resetCache();
      const loadingTask = pdfjsLib.getDocument({
        data: pdfjsData,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });
      state.pdfjsDoc = await loadingTask.promise;
      state.numPages = state.pdfjsDoc.numPages;
      state.currentPage = 1;

      // Aspect ratio
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

      // Update UI elements
      const metaFileName = document.getElementById('metaFileName');
      const metaPageCount = document.getElementById('metaPageCount');
      const metaFileSize = document.getElementById('metaFileSize');
      const metaAspectRatio = document.getElementById('metaAspectRatio');
      const totalPagesSpan = document.getElementById('totalPagesSpan');
      const pageInput = document.getElementById('pageInput');
      const initialHero = document.getElementById('initialHero');
      const workspace = document.getElementById('workspace');

      if (metaFileName) metaFileName.textContent = file.name;
      const countLabel = state.numPages === 1 ? dict.slideLabel : dict.slidesLabel;
      if (metaPageCount) metaPageCount.textContent = `${state.numPages} ${countLabel}`;
      if (metaFileSize) metaFileSize.textContent = state.fileSizeStr;
      if (metaAspectRatio) metaAspectRatio.textContent = ratioText;
      if (totalPagesSpan) totalPagesSpan.textContent = state.numPages;
      if (pageInput) {
        pageInput.max = state.numPages;
        pageInput.value = 1;
      }

      if (initialHero) initialHero.classList.add('hidden');
      if (workspace) workspace.classList.remove('hidden');

      showLoading(false);
      requestAnimationFrame(() => {
        renderCurrentPreview();
      });
    } catch (err) {
      showLoading(false);
      console.error('Error loading PDF:', err);
      alert(`Could not load presentation: ${err.message || err}`);
    }
  }

  // --- Controls & Options ---
  function setupControls() {
    const styleOptions = document.querySelectorAll('.style-card');
    const paperSelect = document.getElementById('paperSelect');
    const marginSlider = document.getElementById('marginSlider');
    const marginValue = document.getElementById('marginValue');
    const stepSlider = document.getElementById('stepSlider');
    const stepValue = document.getElementById('stepValue');
    const separationSlider = document.getElementById('separationSlider');
    const separationValue = document.getElementById('separationValue');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');

    styleOptions.forEach(card => {
      card.addEventListener('click', () => {
        styleOptions.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.style = card.getAttribute('data-style');
        renderCurrentPreview();
      });
    });

    if (paperSelect) {
      paperSelect.addEventListener('change', (e) => {
        state.paperSize = e.target.value;
        renderCurrentPreview();
      });
    }

    if (marginSlider && marginValue) {
      marginSlider.addEventListener('input', (e) => {
        state.margin = Number(e.target.value);
        marginValue.textContent = `${state.margin} pt`;
        renderCurrentPreview();
      });
    }

    if (stepSlider && stepValue) {
      stepSlider.addEventListener('input', (e) => {
        state.step = Number(e.target.value);
        stepValue.textContent = `${state.step} pt`;
        renderCurrentPreview();
      });
    }

    if (separationSlider && separationValue) {
      separationSlider.addEventListener('input', (e) => {
        state.separation = Number(e.target.value);
        separationValue.textContent = `${state.separation} pt`;
        renderCurrentPreview();
      });
    }

    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        if (marginSlider) marginSlider.value = 40;
        if (stepSlider) stepSlider.value = 14;
        if (separationSlider) separationSlider.value = 10;
        state.margin = 40;
        state.step = 14;
        state.separation = 10;
        if (marginValue) marginValue.textContent = '40 pt';
        if (stepValue) stepValue.textContent = '14 pt';
        if (separationValue) separationValue.textContent = '10 pt';
        renderCurrentPreview();
      });
    }
  }

  // --- Page Navigation ---
  function setupPageNavigation() {
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
          goToPage(state.currentPage - 1);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        if (state.currentPage < state.numPages) {
          goToPage(state.currentPage + 1);
        }
      });
    }

    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 1;
        val = Math.max(1, Math.min(val, state.numPages));
        goToPage(val);
      });
    }
  }

  function setupKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
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
    const pageInput = document.getElementById('pageInput');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (pageInput) pageInput.value = pageNum;
    if (prevPageBtn) prevPageBtn.disabled = state.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = state.currentPage >= state.numPages;
    renderCurrentPreview();
  }

  // --- Preview Rendering ---
  function renderCurrentPreview() {
    if (!state.pdfjsDoc) return;
    const previewCanvas = document.getElementById('previewCanvas');
    if (!previewCanvas) return;

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
    const downloadBtn = document.getElementById('downloadBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const printBtn = document.getElementById('printBtn');

    if (downloadBtn) downloadBtn.addEventListener('click', () => exportCurrentHandout());
    if (exportAllBtn) exportAllBtn.addEventListener('click', () => exportAllStylesZip());
    if (printBtn) printBtn.addEventListener('click', () => printCurrentHandout());
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
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

    state.isProcessing = true;
    showLoading(true, dict.generatingMsg);

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
            updateProgress(pct, `${dict.folioLabel} ${current} ${dict.ofLabel} ${total}...`);
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
      alert('JSZip library is required for batch ZIP archive.');
      return;
    }
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

    state.isProcessing = true;
    showLoading(true, dict.bundlingMsg);

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
                `${sName} (${current}/${total} ${dict.slidesLabel})...`
              );
            },
          }
        );

        zip.file(`${getBaseFileName()}_${sName}.pdf`, outBytes);
      }

      updateProgress(98, dict.compressingMsg);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${getBaseFileName()}_all_styles.zip`;
      triggerDownload(zipBlob, zipFileName);
    } catch (err) {
      console.error('ZIP export failed:', err);
      alert(`ZIP export failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
  }

  async function printCurrentHandout() {
    if (!state.pdfBytes || state.isProcessing) return;
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

    // Pre-open a blank tab synchronously to preserve user gesture and avoid popup blocker interception
    let printWindow = null;
    try {
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${dict.printBtn || 'Print Folio'} · Slide-Printer</title>
              <style>
                body {
                  margin: 0;
                  padding: 40px;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #fdfbf7;
                  color: #1a2332;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 70vh;
                  text-align: center;
                }
                .spinner {
                  width: 36px;
                  height: 36px;
                  border: 3px solid rgba(197, 160, 89, 0.2);
                  border-top-color: #c5a059;
                  border-radius: 50%;
                  animation: spin 0.9s linear infinite;
                  margin-bottom: 1.5rem;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                h2 { font-weight: 500; font-family: "Playfair Display", Georgia, serif; margin: 0 0 0.5rem; color: #1a2332; }
                p { color: #5a6578; font-size: 0.95rem; margin: 0; }
              </style>
            </head>
            <body>
              <div class="spinner"></div>
              <h2>${dict.preparingPrintMsg || 'Preparing handout...'}</h2>
              <p>Your high-resolution folio is being compiled for printing.</p>
            </body>
          </html>
        `);
      }
    } catch (e) {
      console.warn('Could not pre-open window:', e);
    }

    state.isProcessing = true;
    showLoading(true, dict.preparingPrintMsg);

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
            updateProgress(pct, `${dict.folioLabel || 'Folio'} ${current} ${dict.ofLabel || 'of'} ${total}...`);
          },
        }
      );

      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      if (printWindow && !printWindow.closed) {
        printWindow.location.href = blobUrl;
      } else {
        // Fallback: download the print-ready PDF directly
        const filename = `${getBaseFileName()}_${state.style}_print.pdf`;
        triggerDownload(blob, filename);
      }
    } catch (err) {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
      console.error('Print preparation failed:', err);
      alert(`Print preparation failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
  }

  // --- Loading / Progress Overlay ---
  function showLoading(show, message = 'Processing...') {
    const progressOverlay = document.getElementById('progressOverlay');
    const progressStatus = document.getElementById('progressStatus');
    if (!progressOverlay) return;

    if (show) {
      progressOverlay.classList.remove('hidden');
      if (progressStatus) progressStatus.textContent = message;
      updateProgress(0, message);
    } else {
      progressOverlay.classList.add('hidden');
    }
  }

  function updateProgress(percent, text) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressStatus = document.getElementById('progressStatus');

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;
    if (progressStatus && text) {
      progressStatus.textContent = text;
    }
  }

  // --- Main Initialization (Called after all definitions) ---
  function init() {
    setupLanguage();
    setupTheme();
    setupDropZone();
    setupControls();
    setupPageNavigation();
    setupActions();
    setupKeyboardNavigation();

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
