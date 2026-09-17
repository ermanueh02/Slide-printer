/**
 * Slide-Printer Web Application Controller
 * Atelier Edition — Multilingual (EN, ES, GL) & Heritage Aesthetics
 */

(function () {
  'use strict';

  // --- Translations (English, Español, Galego) ---
  const TRANSLATIONS = {
    en: {
      brandSubtitle: "Atelier de Handouts · Est. 2026",
      privacyBadge: "Archival Privacy · 100% In-Browser",
      themeAuto: "System",
      themeLight: "Light",
      themeDark: "Dark",
      themeAutoTitle: "Theme: Auto (System Preference)",
      themeLightTitle: "Theme: Light (Click to switch to Dark)",
      themeDarkTitle: "Theme: Dark (Click to switch to Auto)",
      heroSuper: "Handout Studio & Repositorium",
      heroTitle: "The Art of the <em>Printed Handout</em>",
      heroSubtitle: "Transform digital presentation slides into timeless, printable lecture folios. Preserve slide aspect ratios and interactive hyperlinks while adorning each sheet with bespoke note-taking space.",
      dropTitle: "Deposit Presentation Manuscript",
      dropSub: "Drop any PDF presentation (16:9 widescreen or 4:3 standard)",
      browseBtn: "Select Document",
      feat1Num: "I. HYPERLINKS",
      feat1Title: "Coordinate Re-Alignment",
      feat1Desc: "Clickable hyperlinks and digital references are mathematically translated to remain active on the scaled slide.",
      feat2Num: "II. ATELIER PATTERNS",
      feat2Title: "Four Bespoke Styles",
      feat2Desc: "Choice of ruled handwriting lines (~5mm), quadrille graph grid, stipple dot matrix, or unadorned vellum.",
      feat3Num: "III. CONFIDENTIALITY",
      feat3Title: "Absolute Client Privacy",
      feat3Desc: "All compilation occurs locally in your browser with WebAssembly. No manuscripts are ever uploaded to any server.",
      changeBtn: "Change",
      patternLabel: "Note Taking Pattern",
      section1: "Section I",
      styleLinesTitle: "Ruled Cadence",
      styleLinesDesc: "Feint handwriting lines (~5mm)",
      styleGridTitle: "Quadrille Grid",
      styleGridDesc: "Architectural graph paper",
      styleDotsTitle: "Stipple Point",
      styleDotsDesc: "Discreet bullet dot matrix",
      styleBlankTitle: "Pure Vellum",
      styleBlankDesc: "Open space & hairline rule",
      paperLabel: "Paper Stock & Layout",
      section2: "Section II",
      paperSelectLabel: "Paper Standard",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "✦ Typography & Margin Metrics",
      marginLabel: "Page Margin",
      densityLabel: "Rule / Dot Density",
      sepLabel: "Slide Separation",
      restoreBtn: "Restore Standards",
      exportBtn: "Export Handout Manuscript (PDF)",
      archiveBtn: "Archive All 4 (ZIP)",
      printBtn: "Print Folio",
      folioLabel: "Folio",
      ofLabel: "of",
      progressTitle: "Preparing presentation folios...",
      footerTitle: "Slide—Printer Handout Atelier",
      footerSubtitle: "Bespoke Handout Repositorium · Open Source Typography",
      footerPrivacy: "100% In-Browser Confidentiality",
      readingMsg: "Reading presentation manuscript...",
      generatingMsg: "Generating printable handout...",
      bundlingMsg: "Bundling all 4 note styles into ZIP...",
      compressingMsg: "Compressing archive...",
      preparingPrintMsg: "Preparing print preview...",
      invalidPdfMsg: "Please select a valid PDF presentation file.",
      slidesLabel: "slides",
      slideLabel: "slide",
    },
    es: {
      brandSubtitle: "Taller de Handouts · Est. 2026",
      privacyBadge: "Privacidad de Archivo · 100% en el Navegador",
      themeAuto: "Sistema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      themeAutoTitle: "Tema: Automático (Preferencia del Sistema)",
      themeLightTitle: "Tema: Claro (Clic para cambiar a Oscuro)",
      themeDarkTitle: "Tema: Oscuro (Clic para cambiar a Automático)",
      heroSuper: "Estudio de Handouts & Repositorio",
      heroTitle: "El Arte del <em>Handout Impreso</em>",
      heroSubtitle: "Transforma diapositivas digitales en elegantes folios de estudio para imprimir. Conserva las proporciones y los enlaces hipertexto interactivos mientras añades espacio dedicado para notas.",
      dropTitle: "Depositar Manuscrito de Presentación",
      dropSub: "Arrastra cualquier presentación PDF (panorámica 16:9 o estándar 4:3)",
      browseBtn: "Seleccionar Documento",
      feat1Num: "I. HIPERENLACES",
      feat1Title: "Realineación de Coordenadas",
      feat1Desc: "Los enlaces clicables y referencias digitales se recalculan matemáticamente para permanecer activos en la diapositiva escalada.",
      feat2Num: "II. PATRONES DE TALLER",
      feat2Title: "Cuatro Estilos Clásicos",
      feat2Desc: "Elección de líneas pautadas para escritura (~5mm), cuadrícula técnica, matriz de puntos o vellón en blanco.",
      feat3Num: "III. CONFIDENCIALIDAD",
      feat3Title: "Privacidad Absoluta",
      feat3Desc: "Toda la compilación se realiza localmente en tu navegador con WebAssembly. Ningún documento sale de tu equipo.",
      changeBtn: "Cambiar",
      patternLabel: "Patrón de Notas",
      section1: "Sección I",
      styleLinesTitle: "Pauta Clásica",
      styleLinesDesc: "Líneas de escritura manual (~5mm)",
      styleGridTitle: "Cuadrícula Técnica",
      styleGridDesc: "Papel milimetrado arquitectónico",
      styleDotsTitle: "Punteado Sutil",
      styleDotsDesc: "Matriz discreta de puntos guía",
      styleBlankTitle: "Vellón Puro",
      styleBlankDesc: "Espacio despejado con separador sutil",
      paperLabel: "Papel & Maquetación",
      section2: "Sección II",
      paperSelectLabel: "Formato de Papel",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "✦ Tipografía & Márgenes",
      marginLabel: "Margen de Página",
      densityLabel: "Densidad de Líneas / Puntos",
      sepLabel: "Separación de Diapositiva",
      restoreBtn: "Restablecer Valores",
      exportBtn: "Exportar Manuscrito (PDF)",
      archiveBtn: "Archivar los 4 (ZIP)",
      printBtn: "Imprimir Folio",
      folioLabel: "Folio",
      ofLabel: "de",
      progressTitle: "Preparando folios de presentación...",
      footerTitle: "Slide—Printer Handout Atelier",
      footerSubtitle: "Taller de Handouts a Medida · Tipografía de Código Abierto",
      footerPrivacy: "100% Confidencialidad en el Navegador",
      readingMsg: "Leyendo manuscrito de presentación...",
      generatingMsg: "Generando handout imprimible...",
      bundlingMsg: "Empaquetando los 4 estilos en archivo ZIP...",
      compressingMsg: "Comprimiendo archivo...",
      preparingPrintMsg: "Preparando vista previa de impresión...",
      invalidPdfMsg: "Por favor, selecciona un archivo PDF de presentación válido.",
      slidesLabel: "diapositivas",
      slideLabel: "diapositiva",
    },
    gl: {
      brandSubtitle: "Obradoiro de Handouts · Est. 2026",
      privacyBadge: "Privacidade de Arquivo · 100% no Navegador",
      themeAuto: "Sistema",
      themeLight: "Claro",
      themeDark: "Escuro",
      themeAutoTitle: "Tema: Automático (Preferencia do Sistema)",
      themeLightTitle: "Tema: Claro (Preme para cambiar a Escuro)",
      themeDarkTitle: "Tema: Escuro (Preme para cambiar a Automático)",
      heroSuper: "Estudio de Handouts & Repositorio",
      heroTitle: "A Arte do <em>Handout Impreso</em>",
      heroSubtitle: "Transforma diapositivas dixitais en elegantes folios de estudo para imprimir. Preserva as proporcións e as ligazóns interactivas mentres engades espazo dedicado para notas.",
      dropTitle: "Depositar Manuscrito de Presentación",
      dropSub: "Arrastra calquera presentación PDF (panorámica 16:9 ou estándar 4:3)",
      browseBtn: "Seleccionar Documento",
      feat1Num: "I. LIGAZÓNS",
      feat1Title: "Realineación de Coordenadas",
      feat1Desc: "As ligazóns clicables e citas dixitais son recalculadas matematicamente para permanecer activas na diapositiva escalada.",
      feat2Num: "II. PATRÓNS DO OBRADOIRO",
      feat2Title: "Catro Estilos Clásicos",
      feat2Desc: "Escolla entre liñas pautadas para escrita (~5mm), cuadrícula técnica, matriz de puntos ou vitela en branco.",
      feat3Num: "III. CONFIDENCIALIDADE",
      feat3Title: "Privacidade Absoluta",
      feat3Desc: "Toda a compilación realízase localmente no teu navegador con WebAssembly. Ningún documento sae do teu dispositivo.",
      changeBtn: "Cambiar",
      patternLabel: "Patrón de Notas",
      section1: "Sección I",
      styleLinesTitle: "Pauta Clásica",
      styleLinesDesc: "Liñas de escrita manual (~5mm)",
      styleGridTitle: "Cadro Técnico",
      styleGridDesc: "Papel milimetrado arquitectónico",
      styleDotsTitle: "Punteado Sutil",
      styleDotsDesc: "Matriz discreta de puntos guía",
      styleBlankTitle: "Vitela Pura",
      styleBlankDesc: "Espazo despexado con separador sutil",
      paperLabel: "Papel & Maquetación",
      section2: "Sección II",
      paperSelectLabel: "Formato de Papel",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      tuningSummary: "✦ Tipografía & Marxes",
      marginLabel: "Marxe de Páxina",
      densityLabel: "Densidade de Liñas / Puntos",
      sepLabel: "Separación de Diapositiva",
      restoreBtn: "Restablecer Valores",
      exportBtn: "Exportar Manuscrito (PDF)",
      archiveBtn: "Arquivar os 4 (ZIP)",
      printBtn: "Imprimir Folio",
      slideIndicator: "Folio",
      slideOf: "de",
      progressTitle: "Preparando folios de presentación...",
      footerTitle: "Slide—Printer Handout Atelier",
      footerSubtitle: "Obradoiro de Handouts á Medida · Tipografía de Código Aberto",
      footerPrivacy: "100% Confidencialidade no Navegador",
      readingMsg: "Lendo manuscrito de presentación...",
      generatingMsg: "Xerando handout imprimible...",
      bundlingMsg: "Empaquetando os 4 estilos en arquivo ZIP...",
      compressingMsg: "Comprimindo arquivo...",
      preparingPrintMsg: "Preparando vista previa de impresión...",
      invalidPdfMsg: "Por favor, selecciona un arquivo PDF de presentación válido.",
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
      const isDark = systemPrefersDark.matches;
      if (iconEl) iconEl.textContent = '✦';
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

    if (browseBtn) {
      browseBtn.addEventListener('click', openFilePicker);
    }
    dropZone.addEventListener('click', openFilePicker);

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
      fileInput.value = '';
    });

    if (replaceFileBtn) {
      replaceFileBtn.addEventListener('click', openFilePicker);
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
      state.pdfBytes = arrayBuffer;

      const uint8Data = new Uint8Array(arrayBuffer);

      SlidePrinterPreview.resetCache();
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Data,
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
      renderCurrentPreview();
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
            updateProgress(pct, `${dict.folioLabel} ${current} ${dict.ofLabel} ${total}...`);
          },
        }
      );

      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

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
