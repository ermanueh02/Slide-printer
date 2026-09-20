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
      dropTitle: "Drop presentation PDF(s) here",
      dropSub: "Compatible with 16:9 and 4:3 slide formats · Multi-file batch ready",
      browseBtn: "Select Documents",
      batchTitle: "Presentation Queue",
      addMoreBtn: "Add More",
      addFilesHeader: "+ Add Another PDF",
      exportBatchBtn: "Download Batch (ZIP)",
      exportBatchSidebar: "Download Full Batch ({count} PDFs)",
      readingBatchMsg: "Loading presentation {current} of {total}...",
      generatingBatchMsg: "Generating handouts for all {count} presentations...",
      removeTip: "Remove presentation",
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
      paperLabel: "Page & Layout",
      section2: "02",
      coverSectionLabel: "Cover & Header",
      section3: "03",
      printSectionLabel: "Print & Binding",
      section4: "04",
      paperSelectLabel: "Paper Size",
      paperA4: "DIN A4 (210 × 297 mm)",
      paperLetter: "US Letter (8.5 × 11 in)",
      paperLegal: "US Legal (8.5 × 14 in)",
      paperA3: "DIN A3 (297 × 420 mm)",
      pageNumberLabel: "Page numbers in footer",
      tuningSummary: "Margins & Spacing",
      marginLabel: "Page Margin",
      densityLabel: "Line / Dot Spacing",
      sepLabel: "Slide Separation",
      restoreBtn: "Reset to Defaults",
      exportBtn: "Download PDF",
      archiveBtn: "Download All 4 (ZIP)",
      archiveBtnCount: "Download Selected ({count} in ZIP)",
      archiveBtnSingle: "Download Selected (ZIP)",
      styleSelectionCount: "{count} styles selected",
      styleSelectionSingle: "1 style selected",
      quickAll: "All",
      quickLinesGrid: "Lined + Grid",
      quickOnlyCurrent: "Current only",
      previewBadge: "Preview",
      statusExporting: "In export",
      statusNotExporting: "Not included",
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
      bundlingSelectedMsg: "Generating {count} selected styles in ZIP...",
      compressingMsg: "Compressing archive...",
      preparingPrintMsg: "Preparing print view...",
      invalidPdfMsg: "Please select a valid PDF presentation file.",
      pptxNotice: "PowerPoint file detected. Slide-Printer operates directly on PDF to guarantee 100% exact vector layout, fonts, and active hyperlinks.\n\nTo convert: In PowerPoint, choose File > Export > Create PDF, then drop the resulting PDF here!",
      slidesLabel: "slides",
      slideLabel: "slide",
      layoutLabel: "Sheet Layout",
      layout1Up: "1 Slide",
      layout2Up: "2 Slides (Compact)",
      coverLabel: "Document Cover",
      optCoverNone: "Standard (No cover)",
      optCoverCleanFirst: "1st slide as cover (No notes)",
      optCoverGenerate: "Generate editorial cover",
      coverTemplateLabel: "Cover Template Style",
      groupClassics: "Classics / Zara",
      groupDecades: "Decades",
      groupSeasons: "Seasons",
      groupRalphLauren: "Ralph Lauren",
      groupNature: "Nature",
      optTemplateAtelier: "Atelier Notebook (Zara Home Classic)",
      optTemplateGeorge: "George 90s (JFK Jr Executive)",
      optTemplateMonograph: "Archival Monograph (Heritage Bookplate)",
      optTemplateBauhaus: "Swiss Modernist (Mid-Century Editorial)",
      optTemplateFifties: "Fifties (Mid-Century Pelican 1950s)",
      optTemplateSixties: "Sixties (Swiss International 1960s)",
      optTemplateSeventies: "Seventies (Retro Warm Groove 1970s)",
      optTemplateEighties: "Eighties (Memphis Tech 1980s)",
      optTemplateNineties: "Nineties (Minimalist Lookbook 1990s)",
      optTemplateSpring: "Spring (Vernal Blossom & Sage)",
      optTemplateSummer: "Summer (Aegean Azure & Gold)",
      optTemplateAutumn: "Autumn (Terracotta & Amber)",
      optTemplateWinter: "Winter (Nordic Frost & Slate)",
      optTemplatePolo: "Polo (Collegiate Navy & Shield)",
      optTemplateEquestrian: "Equestrian (Heritage Green & Crest)",
      optTemplateNatural: "Natural (Deep Forest Editorial)",
      coverTitlePlaceholder: "Cover title",
      coverAuthorPlaceholder: "Author / Student / Subject",
      pageRangeLabel: "Slide Range",
      pageRangePlaceholder: "All (e.g. 1-10, 2-, 15)",
      gutterLabel: "Binder / Ring margin (+11 mm)",
      bindingLabel: "Binding",
      bindingNone: "None",
      bindingBinder: "Ring Binder (+11mm)",
      bindingSpiral: "Spiral (+8mm)",
      bindingPrintSideLabel: "Print Sides & Guides",
      holeGuidesLabel: "Punch / Spiral guides",
      duplexSimplex: "Single-sided (Simplex)",
      duplexDuplex: "Double-sided (Duplex)",
      studyHeaderLabel: "Study Header (Subject & Date)",
      studyTitlePlaceholder: "Subject or topic name (optional)",
      pageFormatTotal: "Total (1 / N)",
      pageFormatSimple: "Simple (1)",
      ecoPrintLabel: "Ink-Saver Mode (Grayscale)",
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
      dropTitle: "Arrastra tus presentaciones PDF aquí",
      dropSub: "Compatible con diapositivas 16:9 y 4:3 · Procesa múltiples archivos a la vez",
      browseBtn: "Seleccionar documentos",
      batchTitle: "Cola de presentaciones",
      addMoreBtn: "Añadir más",
      addFilesHeader: "+ Añadir otro PDF",
      exportBatchBtn: "Descargar lote (ZIP)",
      exportBatchSidebar: "Descargar lote completo ({count} PDFs)",
      readingBatchMsg: "Cargando presentación {current} de {total}...",
      generatingBatchMsg: "Generando apuntes para las {count} presentaciones...",
      removeTip: "Quitar presentación",
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
      pageNumberLabel: "Números de página al pie",
      tuningSummary: "Márgenes y espaciado",
      marginLabel: "Margen de página",
      densityLabel: "Espaciado de líneas / puntos",
      sepLabel: "Separación de diapositiva",
      restoreBtn: "Restablecer valores",
      exportBtn: "Descargar PDF",
      archiveBtn: "Descargar los 4 (ZIP)",
      archiveBtnCount: "Descargar seleccionados ({count} en ZIP)",
      archiveBtnSingle: "Descargar seleccionado (ZIP)",
      styleSelectionCount: "{count} pautas seleccionadas",
      styleSelectionSingle: "1 pauta seleccionada",
      quickAll: "Todas",
      quickLinesGrid: "Líneas + Cuadrícula",
      quickOnlyCurrent: "Solo actual",
      previewBadge: "Vista previa",
      statusExporting: "En exportación",
      statusNotExporting: "No incluido",
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
      bundlingSelectedMsg: "Generando {count} estilos seleccionados en ZIP...",
      compressingMsg: "Comprimiendo archivo ZIP...",
      preparingPrintMsg: "Preparando vista de impresión...",
      invalidPdfMsg: "Por favor, selecciona un archivo PDF válido.",
      pptxNotice: "Has seleccionado un archivo de PowerPoint (.pptx).\n\nSlide-Printer procesa archivos PDF para mantener el diseño vectorial, las tipografías y los hipervínculos intactos.\n\nCómo convertirlo:\n1. En PowerPoint, ve a Archivo > Exportar > Crear documento PDF/XPS (o Imprimir > Microsoft Print to PDF).\n2. Arrastra aquí el PDF generado.",
      slidesLabel: "diapositivas",
      slideLabel: "diapositiva",
      layoutLabel: "Distribución por folio",
      layout1Up: "1 Diapositiva",
      layout2Up: "2 Diapositivas (Compacto)",
      coverLabel: "Portada del documento",
      optCoverNone: "Sin portada especial",
      optCoverCleanFirst: "1ª diapositiva como portada (sin notas)",
      optCoverGenerate: "Generar portada nueva",
      coverTemplateLabel: "Estilo de portada editorial",
      groupClassics: "Clásicos / Zara",
      groupDecades: "Décadas",
      groupSeasons: "Estaciones",
      groupRalphLauren: "Ralph Lauren",
      groupNature: "Naturaleza",
      optTemplateAtelier: "Cuaderno Atelier (Zara Home / Clásico)",
      optTemplateGeorge: "George años 90 (JFK Jr / Ejecutivo)",
      optTemplateMonograph: "Monografía de archivo (Ex libris)",
      optTemplateBauhaus: "Modernismo suizo (Editorial mid-century)",
      optTemplateFifties: "Años 50 (Pelican / Mid-century 1950s)",
      optTemplateSixties: "Años 60 (Estilo suizo internacional 1960s)",
      optTemplateSeventies: "Años 70 (Retro warm groove 1970s)",
      optTemplateEighties: "Años 80 (Memphis tech 1980s)",
      optTemplateNineties: "Años 90 (Minimal lookbook editorial 1990s)",
      optTemplateSpring: "Primavera (Flor de Cerezo y Salvia)",
      optTemplateSummer: "Verano (Azul Egeo y Dorado Solar)",
      optTemplateAutumn: "Otoño (Terracota y Ámbar Cálido)",
      optTemplateWinter: "Invierno (Escarcha Nórdica y Pizarra)",
      optTemplatePolo: "Polo (Azul Marino Colegial y Escudo)",
      optTemplateEquestrian: "Hípica / Equestrian (Verde Inglés y Emblema)",
      optTemplateNatural: "Natural (Editorial Verde Bosque)",
      coverTitlePlaceholder: "Título para la portada",
      coverAuthorPlaceholder: "Autor / Estudiante / Asignatura",
      pageRangeLabel: "Rango de diapositivas",
      pageRangePlaceholder: "Todas (ej. 1-10, 15)",
      gutterLabel: "Margen para archivador / anillas (+11 mm)",
      bindingLabel: "Encuadernación",
      bindingNone: "Ninguna",
      bindingBinder: "Archivador (+11mm)",
      bindingSpiral: "Espiral (+8mm)",
      bindingPrintSideLabel: "Caras de impresión y guías",
      holeGuidesLabel: "Guías de perforación / espiral",
      duplexSimplex: "Una cara (Simplex)",
      duplexDuplex: "Doble cara (Dúplex)",
      studyHeaderLabel: "Cabecera de estudio (Asignatura y fecha)",
      studyTitlePlaceholder: "Nombre de asignatura o tema (opcional)",
      pageFormatTotal: "Total (1 / N)",
      pageFormatSimple: "Simple (1)",
      ecoPrintLabel: "Modo ahorro de tinta (Escala de grises)",
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
      dropTitle: "Arrastra as túas presentacións PDF aquí",
      dropSub: "Compatible con diapositivas 16:9 e 4:3 · Procesa múltiples ficheiros á vez",
      browseBtn: "Seleccionar documentos",
      batchTitle: "Fila de presentacións",
      addMoreBtn: "Engadir máis",
      addFilesHeader: "+ Engadir outro PDF",
      exportBatchBtn: "Descargar lote (ZIP)",
      exportBatchSidebar: "Descargar lote completo ({count} PDFs)",
      readingBatchMsg: "Cargando presentación {current} de {total}...",
      generatingBatchMsg: "Xerando apuntamentos para as {count} presentacións...",
      removeTip: "Eliminar presentación",
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
      pageNumberLabel: "Números de páxina ao pé",
      tuningSummary: "Marxes e espazado",
      marginLabel: "Marxe de páxina",
      densityLabel: "Espazado de liñas / puntos",
      sepLabel: "Separación de diapositiva",
      restoreBtn: "Restablecer valores",
      exportBtn: "Descargar PDF",
      archiveBtn: "Descargar os 4 estilos (ZIP)",
      archiveBtnCount: "Descargar seleccionados ({count} en ZIP)",
      archiveBtnSingle: "Descargar seleccionado (ZIP)",
      styleSelectionCount: "{count} pautas seleccionadas",
      styleSelectionSingle: "1 pauta seleccionada",
      quickAll: "Todas",
      quickLinesGrid: "Liñas + Cuadrícula",
      quickOnlyCurrent: "Só actual",
      previewBadge: "Vista previa",
      statusExporting: "En exportación",
      statusNotExporting: "Non incluído",
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
      bundlingSelectedMsg: "Xerando {count} estilos seleccionados en ZIP...",
      compressingMsg: "Comprimindo arquivo ZIP...",
      preparingPrintMsg: "Preparando vista de impresión...",
      invalidPdfMsg: "Por favor, selecciona un arquivo PDF válido.",
      pptxNotice: "Seleccionaches un arquivo de PowerPoint (.pptx).\n\nSlide-Printer procesa arquivos PDF para manter o deseño vectorial, as tipografías e os hiperenlaces intactos.\n\nComo convertelo:\n1. En PowerPoint, vai a Ficheiro > Exportar > Crear documento PDF/XPS (ou Imprimir > Gardar como PDF).\n2. Arrastra aquí o PDF xerado.",
      slidesLabel: "diapositivas",
      slideLabel: "diapositiva",
      layoutLabel: "Distribución por folio",
      layout1Up: "1 Diapositiva",
      layout2Up: "2 Diapositivas (Compacto)",
      coverLabel: "Portada do documento",
      optCoverNone: "Sen portada especial",
      optCoverCleanFirst: "1ª diapositiva como portada (sen notas)",
      optCoverGenerate: "Xerar portada nova",
      coverTemplateLabel: "Estilo de portada editorial",
      groupClassics: "Clásicos / Zara",
      groupDecades: "Décadas",
      groupSeasons: "Estacións",
      groupRalphLauren: "Ralph Lauren",
      groupNature: "Natureza",
      optTemplateAtelier: "Caderno Atelier (Zara Home / Clásico)",
      optTemplateGeorge: "George anos 90 (JFK Jr / Executivo)",
      optTemplateMonograph: "Monografía de arquivo (Ex libris)",
      optTemplateBauhaus: "Modernismo suízo (Editorial mid-century)",
      optTemplateFifties: "Anos 50 (Pelican / Mid-century 1950s)",
      optTemplateSixties: "Anos 60 (Estilo suízo internacional 1960s)",
      optTemplateSeventies: "Anos 70 (Retro warm groove 1970s)",
      optTemplateEighties: "Anos 80 (Memphis tech 1980s)",
      optTemplateNineties: "Anos 90 (Minimal lookbook editorial 1990s)",
      optTemplateSpring: "Primavera (Flor de Cerdeira e Salvia)",
      optTemplateSummer: "Verán (Azul Exeo e Dourado Solar)",
      optTemplateAutumn: "Outono (Terracota e Ámbar Cálido)",
      optTemplateWinter: "Inverno (Xeada Nórdica e Lousa)",
      optTemplatePolo: "Polo (Azul Mariño Colexial e Escudo)",
      optTemplateEquestrian: "Hípica / Equestrian (Verde Inglés e Emblema)",
      optTemplateNatural: "Natural (Editorial Verde Bosque)",
      coverTitlePlaceholder: "Título para a portada",
      coverAuthorPlaceholder: "Autor / Estudante / Materia",
      pageRangeLabel: "Rango de diapositivas",
      pageRangePlaceholder: "Todas (ex. 1-10, 15)",
      gutterLabel: "Marxe para arquivador / anelas (+11 mm)",
      bindingLabel: "Encuadernación",
      bindingNone: "Ningunha",
      bindingBinder: "Arquivador (+11mm)",
      bindingSpiral: "Espiral (+8mm)",
      bindingPrintSideLabel: "Caras de impresión e guías",
      holeGuidesLabel: "Guías de perforación / espiral",
      duplexSimplex: "Unha cara (Simplex)",
      duplexDuplex: "Dobre cara (Dúplex)",
      studyHeaderLabel: "Cabeceira de estudo (Materia e data)",
      studyTitlePlaceholder: "Nome da materia ou tema (opcional)",
      pageFormatTotal: "Total (1 / N)",
      pageFormatSimple: "Simple (1)",
      ecoPrintLabel: "Modo aforro de tinta (Escala de grises)",
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
    files: [],
    activeFileIndex: 0,
    file: null,
    fileName: '',
    fileSizeStr: '',
    pdfBytes: null,
    pdfjsDoc: null,
    numPages: 0,
    currentPage: 1,
    style: 'grid',
    selectedStyles: ['grid', 'lines'],
    paperSize: 'a4',
    margin: 40,
    step: 14,
    separation: 10,
    layout: '1-up',
    coverMode: 'generate',
    coverTemplate: 'atelier',
    coverTitle: '',
    coverAuthor: '',
    pageRanges: '',
    binding: 'none',
    gutter: 0,
    hasGutter: false,
    holeGuides: false,
    duplex: false,
    studyHeader: false,
    studyTitle: '',
    pageNumbers: true,
    pageNumberFormat: 'total',
    ecoPrint: false,
    isProcessing: false,
    lang: 'en',
  };

  // --- Presets & Persistent Settings Management ---
  const PRESET_STORAGE_KEY = 'slide_printer_user_presets';

  function savePresets() {
    try {
      const presetData = {
        paperSize: state.paperSize,
        margin: state.margin,
        step: state.step,
        separation: state.separation,
        layout: state.layout,
        coverTemplate: state.coverTemplate,
        binding: state.binding,
        hasGutter: state.hasGutter,
        holeGuides: state.holeGuides,
        duplex: state.duplex,
        pageNumbers: state.pageNumbers,
        pageNumberFormat: state.pageNumberFormat,
        ecoPrint: state.ecoPrint,
        selectedStyles: state.selectedStyles,
      };
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presetData));
    } catch (e) {
      // localStorage may fail in private mode
    }
  }

  function loadPresets() {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.paperSize) state.paperSize = data.paperSize;
      if (typeof data.margin === 'number') state.margin = data.margin;
      if (typeof data.step === 'number') state.step = data.step;
      if (typeof data.separation === 'number') state.separation = data.separation;
      if (data.layout) state.layout = data.layout;
      if (data.coverTemplate) state.coverTemplate = data.coverTemplate;
      if (data.binding && ['none', 'binder', 'spiral'].includes(data.binding)) {
        state.binding = data.binding;
        state.hasGutter = data.binding !== 'none';
        state.gutter = data.binding === 'binder' ? 30 : (data.binding === 'spiral' ? 22 : 0);
      } else if (typeof data.hasGutter === 'boolean') {
        state.hasGutter = data.hasGutter;
        state.binding = data.hasGutter ? 'binder' : 'none';
        state.gutter = state.hasGutter ? 30 : 0;
      }
      if (typeof data.holeGuides === 'boolean') state.holeGuides = data.holeGuides;
      if (typeof data.duplex === 'boolean') state.duplex = data.duplex;
      if (typeof data.pageNumbers === 'boolean') state.pageNumbers = data.pageNumbers;
      if (data.pageNumberFormat) state.pageNumberFormat = data.pageNumberFormat;
      if (typeof data.ecoPrint === 'boolean') state.ecoPrint = data.ecoPrint;
      if (Array.isArray(data.selectedStyles) && data.selectedStyles.length > 0) {
        state.selectedStyles = data.selectedStyles;
      }
    } catch (e) {}
  }

  function applyStateToDOM() {
    const paperSelect = document.getElementById('paperSelect');
    const marginSlider = document.getElementById('marginSlider');
    const marginValue = document.getElementById('marginValue');
    const stepSlider = document.getElementById('stepSlider');
    const stepValue = document.getElementById('stepValue');
    const separationSlider = document.getElementById('separationSlider');
    const separationValue = document.getElementById('separationValue');

    if (paperSelect) paperSelect.value = state.paperSize;
    if (marginSlider) marginSlider.value = state.margin;
    if (marginValue) marginValue.textContent = `${state.margin} pt`;
    if (stepSlider) stepSlider.value = state.step;
    if (stepValue) stepValue.textContent = `${state.step} pt`;
    if (separationSlider) separationSlider.value = state.separation;
    if (separationValue) separationValue.textContent = `${state.separation} pt`;

    // Layout
    const layout1UpBtn = document.getElementById('layout1UpBtn');
    const layout2UpBtn = document.getElementById('layout2UpBtn');
    if (layout1UpBtn) layout1UpBtn.classList.toggle('active', state.layout === '1-up');
    if (layout2UpBtn) layout2UpBtn.classList.toggle('active', state.layout === '2-up');

    // Cover
    const coverSelect = document.getElementById('coverSelect');
    const coverTemplateSelect = document.getElementById('coverTemplateSelect');
    const coverMetaFields = document.getElementById('coverMetaFields');
    const coverTitleInput = document.getElementById('coverTitleInput');
    const coverAuthorInput = document.getElementById('coverAuthorInput');
    if (coverSelect) coverSelect.value = state.coverMode;
    if (coverTemplateSelect) coverTemplateSelect.value = state.coverTemplate || 'atelier';
    if (coverMetaFields) coverMetaFields.classList.toggle('hidden', state.coverMode !== 'generate');
    if (coverTitleInput) coverTitleInput.value = state.coverTitle;
    if (coverAuthorInput) coverAuthorInput.value = state.coverAuthor;

    // Slide range
    const pageRangeInput = document.getElementById('pageRangeInput');
    if (pageRangeInput) pageRangeInput.value = state.pageRanges;

    // Binding & Duplex & Hole Guides
    const bindingNoneBtn = document.getElementById('bindingNoneBtn');
    const bindingBinderBtn = document.getElementById('bindingBinderBtn');
    const bindingSpiralBtn = document.getElementById('bindingSpiralBtn');
    const bindingOptionsGroup = document.getElementById('bindingOptionsGroup');
    const holeGuidesToggle = document.getElementById('holeGuidesToggle');
    const duplexSimplexBtn = document.getElementById('duplexSimplexBtn');
    const duplexDuplexBtn = document.getElementById('duplexDuplexBtn');

    if (bindingNoneBtn) bindingNoneBtn.classList.toggle('active', state.binding === 'none');
    if (bindingBinderBtn) bindingBinderBtn.classList.toggle('active', state.binding === 'binder');
    if (bindingSpiralBtn) bindingSpiralBtn.classList.toggle('active', state.binding === 'spiral');
    if (bindingOptionsGroup) bindingOptionsGroup.classList.toggle('hidden', state.binding === 'none');
    if (holeGuidesToggle) holeGuidesToggle.checked = state.holeGuides;
    if (duplexSimplexBtn) duplexSimplexBtn.classList.toggle('active', !state.duplex);
    if (duplexDuplexBtn) duplexDuplexBtn.classList.toggle('active', state.duplex);

    // Study Header
    const studyHeaderToggle = document.getElementById('studyHeaderToggle');
    const studyHeaderField = document.getElementById('studyHeaderField');
    const studyTitleInput = document.getElementById('studyTitleInput');
    if (studyHeaderToggle) studyHeaderToggle.checked = state.studyHeader;
    if (studyHeaderField) studyHeaderField.classList.toggle('hidden', !state.studyHeader);
    if (studyTitleInput) studyTitleInput.value = state.studyTitle;

    // Page Numbers
    const pageNumberToggle = document.getElementById('pageNumberToggle');
    const pageNumberFormatGroup = document.getElementById('pageNumberFormatGroup');
    const pageFormatTotalBtn = document.getElementById('pageFormatTotalBtn');
    const pageFormatSimpleBtn = document.getElementById('pageFormatSimpleBtn');
    if (pageNumberToggle) pageNumberToggle.checked = state.pageNumbers;
    if (pageNumberFormatGroup) pageNumberFormatGroup.classList.toggle('hidden', !state.pageNumbers);
    if (pageFormatTotalBtn) pageFormatTotalBtn.classList.toggle('active', state.pageNumberFormat === 'total');
    if (pageFormatSimpleBtn) pageFormatSimpleBtn.classList.toggle('active', state.pageNumberFormat === 'simple');

    // Eco Print
    const ecoPrintToggle = document.getElementById('ecoPrintToggle');
    if (ecoPrintToggle) ecoPrintToggle.checked = state.ecoPrint;
  }

  // Global variables initialized safely
  const systemPrefersDark = (typeof window !== 'undefined' && window.matchMedia) 
    ? window.matchMedia('(prefers-color-scheme: dark)') 
    : { matches: false, addEventListener: () => {} };

  let currentThemeMode = 'auto';

  // --- Localization (i18n) Engine ---
  function detectInitialLanguage() {
    // Check if user previously made an explicit manual choice
    try {
      const explicitLang = localStorage.getItem('slide_printer_user_lang');
      if (explicitLang && ['en', 'es', 'gl'].includes(explicitLang)) {
        return explicitLang;
      }
    } catch (e) {
      // localStorage may be restricted or unavailable
    }

    // Default to English as requested
    return 'en';
  }

  function setLanguage(lang, isManualChoice = false) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    state.lang = lang;
    if (isManualChoice) {
      try {
        localStorage.setItem('slide_printer_user_lang', lang);
      } catch (e) {}
    }

    document.documentElement.lang = lang;
    document.title = lang === 'en'
      ? "Slide-Printer — Print slides with dedicated note space"
      : (lang === 'gl'
        ? "Slide-Printer — Imprime diapositivas con espazo para notas"
        : "Slide-Printer — Imprime diapositivas con espacio para notas");

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

    setText('selectAllStylesBtn', dict.quickAll);
    setText('selectLinesGridBtn', dict.quickLinesGrid);
    setText('selectOnlyCurrentBtn', dict.quickOnlyCurrent);

    setText('paperSectionLabel', dict.paperLabel || "Page & Layout");
    setText('paperSectionSub', dict.section2 || "02");
    setText('coverSectionLabel', dict.coverSectionLabel || "Cover & Header");
    setText('coverSectionSub', dict.section3 || "03");
    setText('printSectionLabel', dict.printSectionLabel || "Print & Binding");
    setText('printSectionSub', dict.section4 || "04");
    setText('paperSelectLabelText', dict.paperSelectLabel);
    setText('optA4', dict.paperA4);
    setText('optLetter', dict.paperLetter);
    setText('optLegal', dict.paperLegal);
    setText('optA3', dict.paperA3);

    // Layout
    setText('layoutLabelText', dict.layoutLabel);
    setText('layout1UpText', dict.layout1Up);
    setText('layout2UpText', dict.layout2Up);

    // Cover
    setText('coverLabelText', dict.coverLabel);
    setText('optCoverNone', dict.optCoverNone);
    setText('optCoverCleanFirst', dict.optCoverCleanFirst);
    setText('optCoverGenerate', dict.optCoverGenerate);
    setText('coverTemplateLabelText', dict.coverTemplateLabel);
    const setOptgroupLabel = (id, label) => {
      const el = document.getElementById(id);
      if (el && label) el.label = label;
    };
    setOptgroupLabel('groupClassics', dict.groupClassics);
    setOptgroupLabel('groupDecades', dict.groupDecades);
    setOptgroupLabel('groupSeasons', dict.groupSeasons);
    setOptgroupLabel('groupRalphLauren', dict.groupRalphLauren);
    setOptgroupLabel('groupNature', dict.groupNature);

    setText('optTemplateAtelier', dict.optTemplateAtelier);
    setText('optTemplateGeorge', dict.optTemplateGeorge);
    setText('optTemplateMonograph', dict.optTemplateMonograph);
    setText('optTemplateBauhaus', dict.optTemplateBauhaus);
    setText('optTemplateFifties', dict.optTemplateFifties);
    setText('optTemplateSixties', dict.optTemplateSixties);
    setText('optTemplateSeventies', dict.optTemplateSeventies);
    setText('optTemplateEighties', dict.optTemplateEighties);
    setText('optTemplateNineties', dict.optTemplateNineties);
    setText('optTemplateSpring', dict.optTemplateSpring);
    setText('optTemplateSummer', dict.optTemplateSummer);
    setText('optTemplateAutumn', dict.optTemplateAutumn);
    setText('optTemplateWinter', dict.optTemplateWinter);
    setText('optTemplatePolo', dict.optTemplatePolo);
    setText('optTemplateEquestrian', dict.optTemplateEquestrian);
    setText('optTemplateNatural', dict.optTemplateNatural);
    const coverTitleInput = document.getElementById('coverTitleInput');
    if (coverTitleInput && dict.coverTitlePlaceholder) coverTitleInput.placeholder = dict.coverTitlePlaceholder;
    const coverAuthorInput = document.getElementById('coverAuthorInput');
    if (coverAuthorInput && dict.coverAuthorPlaceholder) coverAuthorInput.placeholder = dict.coverAuthorPlaceholder;

    // Slide Range
    setText('pageRangeLabelText', dict.pageRangeLabel);
    const pageRangeInput = document.getElementById('pageRangeInput');
    if (pageRangeInput && dict.pageRangePlaceholder) pageRangeInput.placeholder = dict.pageRangePlaceholder;

    // Binding & Duplex
    setText('bindingLabelText', dict.bindingLabel || "Binding");
    setText('bindingNoneText', dict.bindingNone || "None");
    setText('bindingBinderText', dict.bindingBinder || "Ring Binder (+11mm)");
    setText('bindingSpiralText', dict.bindingSpiral || "Spiral (+8mm)");
    setText('bindingPrintSideLabel', dict.bindingPrintSideLabel || "Print Sides & Guides");
    setText('holeGuidesLabelText', dict.holeGuidesLabel || "Punch / Spiral guides");
    setText('duplexSimplexText', dict.duplexSimplex);
    setText('duplexDuplexText', dict.duplexDuplex);

    // Study Header
    setText('studyHeaderLabelText', dict.studyHeaderLabel);
    const studyTitleInput = document.getElementById('studyTitleInput');
    if (studyTitleInput && dict.studyTitlePlaceholder) studyTitleInput.placeholder = dict.studyTitlePlaceholder;

    // Page Numbers & Format
    setText('pageNumberLabelText', dict.pageNumberLabel);
    setText('pageFormatTotalText', dict.pageFormatTotal);
    setText('pageFormatSimpleText', dict.pageFormatSimple);

    // Eco Print
    setText('ecoPrintLabelText', dict.ecoPrintLabel);

    setText('tuningSummaryText', dict.tuningSummary);
    setText('marginLabelText', dict.marginLabel);
    setText('densityLabelText', dict.densityLabel);
    setText('sepLabelText', dict.sepLabel);
    setText('resetStylesBtn', dict.restoreBtn);
    setText('resetLayoutBtn', dict.restoreBtn);
    setText('resetCoverBtn', dict.restoreBtn);
    setText('resetPrintBtn', dict.restoreBtn);
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

    // Batch Bar & Multi-File Labels
    setText('batchBarTitle', dict.batchTitle);
    setText('addMoreFilesText', dict.addMoreBtn);
    setText('addFilesHeaderBtn', dict.addFilesHeader);
    if (state.files && state.files.length > 1) {
      setText('exportBatchBtnText', (dict.exportBatchBtn || 'Download Batch (ZIP)').replace('{count}', state.files.length));
      setText('exportBatchSidebarBtnText', (dict.exportBatchSidebar || 'Download Full Batch ({count} PDFs)').replace('{count}', state.files.length));
    }

    // Update metadata count if loaded
    if (state.numPages > 0) {
      const label = state.numPages === 1 ? dict.slideLabel : dict.slidesLabel;
      setText('metaPageCount', `${state.numPages} ${label}`);
    }

    updateStyleSelectionUI();
  }

  function setupLanguage() {
    const initialLang = detectInitialLanguage();
    setLanguage(initialLang, false);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        setLanguage(lang, true);
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

  // --- Drag & Drop / Multi-File Batch Loading ---
  let isAppendMode = false;

  function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const replaceFileBtn = document.getElementById('replaceFileBtn');
    const addFilesHeaderBtn = document.getElementById('addFilesHeaderBtn');
    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');

    if (!fileInput) return;

    // Window-wide drag prevention + smart drop handling
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
      }, false);
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        const workspace = document.getElementById('workspace');
        const isWorkspaceActive = workspace && !workspace.classList.contains('hidden');
        handleFiles(dt.files, isWorkspaceActive);
      }
    }, false);

    let dragCounter = 0;

    if (dropZone) {
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
          handleFiles(dt.files, false);
        }
      }, false);

      dropZone.addEventListener('click', (e) => {
        openReplacePicker(e);
      });

      dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openReplacePicker(e);
        }
      });
    }

    function openReplacePicker(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isAppendMode = false;
      fileInput.click();
    }

    function openAddPicker(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isAppendMode = true;
      fileInput.click();
    }

    if (browseBtn) {
      browseBtn.addEventListener('click', openReplacePicker);
    }
    if (replaceFileBtn) {
      replaceFileBtn.addEventListener('click', openReplacePicker);
    }
    if (addFilesHeaderBtn) {
      addFilesHeaderBtn.addEventListener('click', openAddPicker);
    }
    if (addMoreFilesBtn) {
      addMoreFilesBtn.addEventListener('click', openAddPicker);
    }

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files, isAppendMode);
      }
      fileInput.value = '';
      isAppendMode = false;
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function handleFiles(fileList, append = false) {
    if (!fileList || fileList.length === 0) return;
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;
    const rawFiles = Array.from(fileList);

    // 1. Check for PowerPoint files
    const pptxFound = rawFiles.some(f => {
      const name = (f.name || '').toLowerCase();
      return name.endsWith('.pptx') || name.endsWith('.ppt');
    });
    if (pptxFound) {
      alert(dict.pptxNotice);
    }

    // 2. Filter for PDF files
    const pdfFiles = rawFiles.filter(f => {
      const name = (f.name || '').toLowerCase();
      return name.endsWith('.pdf') || (f.type && f.type.includes('pdf'));
    });

    if (pdfFiles.length === 0) {
      if (!pptxFound) {
        alert(dict.invalidPdfMsg);
      }
      return;
    }

    showLoading(true, dict.readingMsg);

    try {
      const parsedItems = [];
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        if (pdfFiles.length > 1) {
          const msg = (dict.readingBatchMsg || 'Loading presentation {current} of {total}...')
            .replace('{current}', i + 1)
            .replace('{total}', pdfFiles.length);
          updateProgress(Math.round(((i) / pdfFiles.length) * 100), msg);
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        const pdfjsData = new Uint8Array(arrayBuffer.slice(0));

        const loadingTask = pdfjsLib.getDocument({
          data: pdfjsData,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });
        const pdfjsDoc = await loadingTask.promise;
        const numPages = pdfjsDoc.numPages;

        const firstPage = await pdfjsDoc.getPage(1);
        const vp = firstPage.getViewport({ scale: 1.0 });
        const ratio = vp.width / vp.height;
        let ratioText = 'Standard';
        if (Math.abs(ratio - 16 / 9) < 0.15) {
          ratioText = '16:9';
        } else if (Math.abs(ratio - 4 / 3) < 0.15) {
          ratioText = '4:3';
        } else if (Math.abs(ratio - 16 / 10) < 0.15) {
          ratioText = '16:10';
        } else {
          ratioText = `${ratio.toFixed(2)}:1`;
        }

        parsedItems.push({
          id: 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          file,
          name: file.name,
          sizeStr: formatBytes(file.size),
          pdfBytes,
          pdfjsDoc,
          numPages,
          ratioText,
        });
      }

      if (append && state.files && state.files.length > 0) {
        for (const item of parsedItems) {
          const exists = state.files.some(f => f.name === item.name && f.sizeStr === item.sizeStr);
          if (!exists) {
            state.files.push(item);
          }
        }
      } else {
        state.files = parsedItems;
        state.activeFileIndex = 0;
      }

      activateFile(state.activeFileIndex);

      const initialHero = document.getElementById('initialHero');
      const workspace = document.getElementById('workspace');
      if (initialHero) initialHero.classList.add('hidden');
      if (workspace) workspace.classList.remove('hidden');
      document.body.classList.add('editor-mode');

      showLoading(false);
    } catch (err) {
      showLoading(false);
      console.error('Error loading presentations:', err);
      alert(`Error loading presentation: ${err.message || err}`);
    }
  }

  function activateFile(index) {
    if (!state.files || index < 0 || index >= state.files.length) return;
    state.activeFileIndex = index;
    const item = state.files[index];

    state.file = item.file;
    state.fileName = item.name;
    state.fileSizeStr = item.sizeStr;
    state.pdfBytes = item.pdfBytes;
    state.pdfjsDoc = item.pdfjsDoc;
    state.numPages = item.numPages;
    state.currentPage = 1;

    SlidePrinterPreview.resetCache();

    // Update UI elements
    const metaFileName = document.getElementById('metaFileName');
    const metaPageCount = document.getElementById('metaPageCount');
    const metaFileSize = document.getElementById('metaFileSize');
    const metaAspectRatio = document.getElementById('metaAspectRatio');
    const totalPagesSpan = document.getElementById('totalPagesSpan');
    const pageInput = document.getElementById('pageInput');
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

    if (metaFileName) metaFileName.textContent = item.name;
    const countLabel = state.numPages === 1 ? dict.slideLabel : dict.slidesLabel;
    if (metaPageCount) metaPageCount.textContent = `${state.numPages} ${countLabel}`;
    if (metaFileSize) metaFileSize.textContent = item.sizeStr;
    if (metaAspectRatio) metaAspectRatio.textContent = item.ratioText;

    // Reset document-specific fields so past notes/titles never pollute a new file
    state.studyTitle = '';
    state.coverTitle = getBaseFileName();
    state.coverAuthor = '';
    state.pageRanges = '';
    state.coverMode = 'generate';
    state.coverTemplate = state.coverTemplate || 'atelier';
    state.studyHeader = false;

    const coverSelect = document.getElementById('coverSelect');
    const coverMetaFields = document.getElementById('coverMetaFields');
    const coverTitleInput = document.getElementById('coverTitleInput');
    const coverAuthorInput = document.getElementById('coverAuthorInput');
    const studyHeaderToggle = document.getElementById('studyHeaderToggle');
    const studyHeaderField = document.getElementById('studyHeaderField');
    const studyTitleInput = document.getElementById('studyTitleInput');
    const pageRangeInput = document.getElementById('pageRangeInput');

    if (coverSelect) coverSelect.value = 'generate';
    if (coverMetaFields) coverMetaFields.classList.remove('hidden');
    if (coverTitleInput) coverTitleInput.value = state.coverTitle;
    if (coverAuthorInput) coverAuthorInput.value = '';
    if (studyHeaderToggle) studyHeaderToggle.checked = false;
    if (studyHeaderField) studyHeaderField.classList.add('hidden');
    if (studyTitleInput) studyTitleInput.value = '';
    if (pageRangeInput) pageRangeInput.value = '';

    updatePageNavigatorUI();
    renderBatchTabs();
    requestAnimationFrame(() => {
      renderCurrentPreview();
    });
  }

  function removeFileAt(index) {
    if (!state.files || index < 0 || index >= state.files.length) return;
    state.files.splice(index, 1);

    if (state.files.length === 0) {
      // Return to hero section
      const initialHero = document.getElementById('initialHero');
      const workspace = document.getElementById('workspace');
      if (initialHero) initialHero.classList.remove('hidden');
      if (workspace) workspace.classList.add('hidden');
      document.body.classList.remove('editor-mode');
      state.file = null;
      state.fileName = '';
      state.pdfBytes = null;
      state.pdfjsDoc = null;
      state.numPages = 0;
      SlidePrinterPreview.resetCache();
      return;
    }

    if (state.activeFileIndex >= state.files.length) {
      state.activeFileIndex = state.files.length - 1;
    }
    activateFile(state.activeFileIndex);
  }

  function renderBatchTabs() {
    const batchBar = document.getElementById('batchBar');
    const batchTabsTrack = document.getElementById('batchTabsTrack');
    const batchCountBadge = document.getElementById('batchCountBadge');
    const exportBatchSidebarBtn = document.getElementById('exportBatchSidebarBtn');

    if (!batchBar || !batchTabsTrack) return;

    const totalFiles = state.files ? state.files.length : 0;
    if (totalFiles <= 1) {
      batchBar.style.display = 'none';
      if (exportBatchSidebarBtn) exportBatchSidebarBtn.style.display = 'none';
      return;
    }

    batchBar.style.display = 'flex';
    if (exportBatchSidebarBtn) exportBatchSidebarBtn.style.display = 'inline-flex';
    if (batchCountBadge) batchCountBadge.textContent = totalFiles;

    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;
    const sidebarBtnText = document.getElementById('exportBatchSidebarBtnText');
    if (sidebarBtnText) {
      sidebarBtnText.textContent = (dict.exportBatchSidebar || "Download Full Batch ({count} PDFs)").replace('{count}', totalFiles);
    }
    const exportBatchBtnText = document.getElementById('exportBatchBtnText');
    if (exportBatchBtnText) {
      exportBatchBtnText.textContent = (dict.exportBatchBtn || "Download Batch (ZIP)").replace('{count}', totalFiles);
    }

    batchTabsTrack.innerHTML = '';
    state.files.forEach((item, idx) => {
      const chip = document.createElement('div');
      chip.className = `batch-chip ${idx === state.activeFileIndex ? 'active' : ''}`;
      chip.setAttribute('data-idx', idx);
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', idx === state.activeFileIndex ? 'true' : 'false');

      const icon = document.createElement('span');
      icon.className = 'batch-chip-icon';
      icon.textContent = '📄';

      const name = document.createElement('span');
      name.className = 'batch-chip-name';
      name.textContent = item.name;
      name.title = item.name;

      const pages = document.createElement('span');
      pages.className = 'batch-chip-pages';
      pages.textContent = `${item.numPages}p`;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'batch-chip-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = dict.removeTip || 'Remove';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFileAt(idx);
      });

      chip.appendChild(icon);
      chip.appendChild(name);
      chip.appendChild(pages);
      chip.appendChild(closeBtn);

      chip.addEventListener('click', () => {
        activateFile(idx);
      });

      batchTabsTrack.appendChild(chip);
    });
  }

  function updateStyleSelectionUI() {
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;
    const styleOptions = document.querySelectorAll('.style-card');

    styleOptions.forEach(card => {
      const s = card.getAttribute('data-style');
      const isSelected = state.selectedStyles.includes(s);
      const isPreview = state.style === s;

      card.classList.toggle('is-selected', isSelected);
      card.classList.toggle('active', isPreview);

      const previewBadge = card.querySelector('.preview-badge');
      if (previewBadge) {
        previewBadge.classList.toggle('hidden', !isPreview);
        previewBadge.textContent = dict.previewBadge || 'Vista previa';
      }

      const statusLabel = card.querySelector('.export-status-label');
      if (statusLabel) {
        if (isPreview) {
          statusLabel.textContent = isSelected ? '✓ Exportando' : '';
        } else {
          statusLabel.textContent = isSelected
            ? (dict.statusExporting || 'En exportación')
            : (dict.statusNotExporting || 'No incluido');
        }
      }
    });

    // Update count pill
    const countEl = document.getElementById('styleSelectionCountText');
    if (countEl) {
      const count = state.selectedStyles.length;
      if (count === 1) {
        countEl.textContent = dict.styleSelectionSingle || '1 pauta seleccionada';
      } else {
        countEl.textContent = (dict.styleSelectionCount || '{count} pautas seleccionadas').replace('{count}', count);
      }
    }

    // Update ZIP export button text
    const exportAllBtnText = document.getElementById('exportAllBtnText');
    if (exportAllBtnText) {
      const count = state.selectedStyles.length;
      if (count === 4) {
        exportAllBtnText.textContent = dict.archiveBtn || 'Descargar los 4 (ZIP)';
      } else if (count === 1) {
        exportAllBtnText.textContent = dict.archiveBtnSingle || 'Descargar seleccionado (ZIP)';
      } else {
        exportAllBtnText.textContent = (dict.archiveBtnCount || 'Descargar seleccionados ({count} en ZIP)').replace('{count}', count);
      }
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

    // Style Selection UI Helper
    updateStyleSelectionUI();

    styleOptions.forEach(card => {
      const s = card.getAttribute('data-style');

      // Click on card body switches preview and selects this style if unselected
      card.addEventListener('click', (e) => {
        if (e.target.closest('.style-checkbox-btn')) return;
        state.style = s;
        if (!state.selectedStyles.includes(s)) {
          state.selectedStyles.push(s);
        }
        updateStyleSelectionUI();
        renderCurrentPreview();
      });

      // Click on checkbox toggle
      const checkBtn = card.querySelector('.style-checkbox-btn');
      if (checkBtn) {
        checkBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = state.selectedStyles.indexOf(s);
          if (idx >= 0) {
            // Keep at least one style selected
            if (state.selectedStyles.length > 1) {
              state.selectedStyles.splice(idx, 1);
            }
          } else {
            state.selectedStyles.push(s);
          }
          updateStyleSelectionUI();
        });
      }
    });

    // Toolbar Quick Action Buttons
    const selectAllBtn = document.getElementById('selectAllStylesBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        state.selectedStyles = ['lines', 'grid', 'dots', 'blank'];
        updateStyleSelectionUI();
      });
    }

    const selectLinesGridBtn = document.getElementById('selectLinesGridBtn');
    if (selectLinesGridBtn) {
      selectLinesGridBtn.addEventListener('click', () => {
        state.selectedStyles = ['lines', 'grid'];
        updateStyleSelectionUI();
      });
    }

    const selectOnlyCurrentBtn = document.getElementById('selectOnlyCurrentBtn');
    if (selectOnlyCurrentBtn) {
      selectOnlyCurrentBtn.addEventListener('click', () => {
        state.selectedStyles = [state.style];
        updateStyleSelectionUI();
      });
    }

    if (paperSelect) {
      paperSelect.addEventListener('change', (e) => {
        state.paperSize = e.target.value;
        savePresets();
        renderCurrentPreview();
      });
    }

    // Layout (1-Up vs 2-Up)
    const layout1UpBtn = document.getElementById('layout1UpBtn');
    const layout2UpBtn = document.getElementById('layout2UpBtn');
    if (layout1UpBtn) {
      layout1UpBtn.addEventListener('click', () => {
        state.layout = '1-up';
        layout1UpBtn.classList.add('active');
        if (layout2UpBtn) layout2UpBtn.classList.remove('active');
        savePresets();
        updatePageNavigatorUI();
        renderCurrentPreview();
      });
    }
    if (layout2UpBtn) {
      layout2UpBtn.addEventListener('click', () => {
        state.layout = '2-up';
        layout2UpBtn.classList.add('active');
        if (layout1UpBtn) layout1UpBtn.classList.remove('active');
        savePresets();
        updatePageNavigatorUI();
        renderCurrentPreview();
      });
    }

    // Cover Page
    const coverSelect = document.getElementById('coverSelect');
    const coverTemplateSelect = document.getElementById('coverTemplateSelect');
    const coverMetaFields = document.getElementById('coverMetaFields');
    const coverTitleInput = document.getElementById('coverTitleInput');
    const coverAuthorInput = document.getElementById('coverAuthorInput');

    if (coverSelect) {
      coverSelect.addEventListener('change', (e) => {
        state.coverMode = e.target.value;
        if (coverMetaFields) {
          coverMetaFields.classList.toggle('hidden', state.coverMode !== 'generate');
        }
        if (state.coverMode === 'generate') {
          if (!state.coverTitle) {
            state.coverTitle = getBaseFileName();
            if (coverTitleInput) coverTitleInput.value = state.coverTitle;
          }
          goToPage(1);
        } else {
          updatePageNavigatorUI();
          renderCurrentPreview();
        }
        savePresets();
      });
    }
    if (coverTemplateSelect) {
      coverTemplateSelect.addEventListener('change', (e) => {
        state.coverTemplate = e.target.value;
        savePresets();
        if (state.coverMode === 'generate') {
          renderCurrentPreview();
        }
      });
    }
    if (coverTitleInput) {
      coverTitleInput.addEventListener('input', (e) => {
        state.coverTitle = e.target.value;
        savePresets();
        if (state.coverMode === 'generate') {
          renderCurrentPreview();
        }
      });
    }
    if (coverAuthorInput) {
      coverAuthorInput.addEventListener('input', (e) => {
        state.coverAuthor = e.target.value;
        savePresets();
        if (state.coverMode === 'generate') {
          renderCurrentPreview();
        }
      });
    }

    // Slide Range Filtering
    const pageRangeInput = document.getElementById('pageRangeInput');
    if (pageRangeInput) {
      pageRangeInput.addEventListener('input', (e) => {
        state.pageRanges = e.target.value;
        state.currentPage = 1;
        updatePageNavigatorUI();
        renderCurrentPreview();
      });
    }

    // Binding Type (None, Binder, Spiral) & Duplex & Hole Guides
    const bindingNoneBtn = document.getElementById('bindingNoneBtn');
    const bindingBinderBtn = document.getElementById('bindingBinderBtn');
    const bindingSpiralBtn = document.getElementById('bindingSpiralBtn');
    const bindingOptionsGroup = document.getElementById('bindingOptionsGroup');
    const holeGuidesToggle = document.getElementById('holeGuidesToggle');
    const duplexSimplexBtn = document.getElementById('duplexSimplexBtn');
    const duplexDuplexBtn = document.getElementById('duplexDuplexBtn');

    function setBindingMode(mode) {
      state.binding = mode;
      state.hasGutter = (mode !== 'none');
      state.gutter = (mode === 'binder') ? 30 : ((mode === 'spiral') ? 22 : 0);

      if (bindingNoneBtn) bindingNoneBtn.classList.toggle('active', mode === 'none');
      if (bindingBinderBtn) bindingBinderBtn.classList.toggle('active', mode === 'binder');
      if (bindingSpiralBtn) bindingSpiralBtn.classList.toggle('active', mode === 'spiral');
      if (bindingOptionsGroup) bindingOptionsGroup.classList.toggle('hidden', mode === 'none');

      savePresets();
      renderCurrentPreview();
    }

    if (bindingNoneBtn) {
      bindingNoneBtn.addEventListener('click', () => setBindingMode('none'));
    }
    if (bindingBinderBtn) {
      bindingBinderBtn.addEventListener('click', () => setBindingMode('binder'));
    }
    if (bindingSpiralBtn) {
      bindingSpiralBtn.addEventListener('click', () => setBindingMode('spiral'));
    }

    if (holeGuidesToggle) {
      holeGuidesToggle.addEventListener('change', (e) => {
        state.holeGuides = Boolean(e.target.checked);
        savePresets();
        renderCurrentPreview();
      });
    }

    if (duplexSimplexBtn) {
      duplexSimplexBtn.addEventListener('click', () => {
        state.duplex = false;
        duplexSimplexBtn.classList.add('active');
        if (duplexDuplexBtn) duplexDuplexBtn.classList.remove('active');
        savePresets();
        renderCurrentPreview();
      });
    }
    if (duplexDuplexBtn) {
      duplexDuplexBtn.addEventListener('click', () => {
        state.duplex = true;
        duplexDuplexBtn.classList.add('active');
        if (duplexSimplexBtn) duplexSimplexBtn.classList.remove('active');
        savePresets();
        renderCurrentPreview();
      });
    }

    // Study Header
    const studyHeaderToggle = document.getElementById('studyHeaderToggle');
    const studyHeaderField = document.getElementById('studyHeaderField');
    const studyTitleInput = document.getElementById('studyTitleInput');

    if (studyHeaderToggle) {
      studyHeaderToggle.addEventListener('change', (e) => {
        state.studyHeader = Boolean(e.target.checked);
        if (studyHeaderField) {
          studyHeaderField.classList.toggle('hidden', !state.studyHeader);
        }
        savePresets();
        renderCurrentPreview();
      });
    }
    if (studyTitleInput) {
      studyTitleInput.addEventListener('input', (e) => {
        state.studyTitle = e.target.value;
        savePresets();
        if (state.studyHeader) {
          renderCurrentPreview();
        }
      });
    }

    // Page Numbers & Format
    const pageNumberToggle = document.getElementById('pageNumberToggle');
    const pageNumberFormatGroup = document.getElementById('pageNumberFormatGroup');
    const pageFormatTotalBtn = document.getElementById('pageFormatTotalBtn');
    const pageFormatSimpleBtn = document.getElementById('pageFormatSimpleBtn');

    if (pageNumberToggle) {
      pageNumberToggle.addEventListener('change', (e) => {
        state.pageNumbers = Boolean(e.target.checked);
        if (pageNumberFormatGroup) {
          pageNumberFormatGroup.classList.toggle('hidden', !state.pageNumbers);
        }
        savePresets();
        renderCurrentPreview();
      });
    }
    if (pageFormatTotalBtn) {
      pageFormatTotalBtn.addEventListener('click', () => {
        state.pageNumberFormat = 'total';
        pageFormatTotalBtn.classList.add('active');
        if (pageFormatSimpleBtn) pageFormatSimpleBtn.classList.remove('active');
        savePresets();
        renderCurrentPreview();
      });
    }
    if (pageFormatSimpleBtn) {
      pageFormatSimpleBtn.addEventListener('click', () => {
        state.pageNumberFormat = 'simple';
        pageFormatSimpleBtn.classList.add('active');
        if (pageFormatTotalBtn) pageFormatTotalBtn.classList.remove('active');
        savePresets();
        renderCurrentPreview();
      });
    }

    // Eco Print Mode
    const ecoPrintToggle = document.getElementById('ecoPrintToggle');
    if (ecoPrintToggle) {
      ecoPrintToggle.addEventListener('change', (e) => {
        state.ecoPrint = Boolean(e.target.checked);
        savePresets();
        renderCurrentPreview();
      });
    }

    if (marginSlider && marginValue) {
      marginSlider.addEventListener('input', (e) => {
        state.margin = Number(e.target.value);
        marginValue.textContent = `${state.margin} pt`;
        savePresets();
        renderCurrentPreview();
      });
    }

    if (stepSlider && stepValue) {
      stepSlider.addEventListener('input', (e) => {
        state.step = Number(e.target.value);
        stepValue.textContent = `${state.step} pt`;
        savePresets();
        renderCurrentPreview();
      });
    }

    if (separationSlider && separationValue) {
      separationSlider.addEventListener('input', (e) => {
        state.separation = Number(e.target.value);
        separationValue.textContent = `${state.separation} pt`;
        savePresets();
        renderCurrentPreview();
      });
    }

    // Section 01: Note Styles Reset
    const resetStylesBtn = document.getElementById('resetStylesBtn');
    if (resetStylesBtn) {
      resetStylesBtn.addEventListener('click', () => {
        state.style = 'grid';
        state.selectedStyles = ['grid', 'lines'];
        updateStyleSelectionUI();
        savePresets();
        renderCurrentPreview();
      });
    }

    // Section 02: Page & Layout Reset
    const resetLayoutBtn = document.getElementById('resetLayoutBtn');
    if (resetLayoutBtn) {
      resetLayoutBtn.addEventListener('click', () => {
        state.paperSize = 'a4';
        state.layout = '1-up';
        state.pageRanges = '';

        const paperSelect = document.getElementById('paperSelect');
        const layout1UpBtn = document.getElementById('layout1UpBtn');
        const layout2UpBtn = document.getElementById('layout2UpBtn');
        const pageRangeInput = document.getElementById('pageRangeInput');

        if (paperSelect) paperSelect.value = 'a4';
        if (layout1UpBtn) layout1UpBtn.classList.add('active');
        if (layout2UpBtn) layout2UpBtn.classList.remove('active');
        if (pageRangeInput) pageRangeInput.value = '';

        savePresets();
        goToPage(1);
        updatePageNavigatorUI();
        renderCurrentPreview();
      });
    }

    // Section 03: Cover & Header Reset
    const resetCoverBtn = document.getElementById('resetCoverBtn');
    if (resetCoverBtn) {
      resetCoverBtn.addEventListener('click', () => {
        state.coverMode = 'generate';
        state.coverTemplate = 'atelier';
        state.coverTitle = getBaseFileName();
        state.coverAuthor = '';
        state.studyHeader = false;
        state.studyTitle = '';

        const coverSelect = document.getElementById('coverSelect');
        const coverTemplateSelect = document.getElementById('coverTemplateSelect');
        const coverMetaFields = document.getElementById('coverMetaFields');
        const coverTitleInput = document.getElementById('coverTitleInput');
        const coverAuthorInput = document.getElementById('coverAuthorInput');
        const studyHeaderToggle = document.getElementById('studyHeaderToggle');
        const studyHeaderField = document.getElementById('studyHeaderField');
        const studyTitleInput = document.getElementById('studyTitleInput');

        if (coverSelect) coverSelect.value = 'generate';
        if (coverTemplateSelect) coverTemplateSelect.value = 'atelier';
        if (coverMetaFields) coverMetaFields.classList.remove('hidden');
        if (coverTitleInput) coverTitleInput.value = state.coverTitle;
        if (coverAuthorInput) coverAuthorInput.value = '';
        if (studyHeaderToggle) studyHeaderToggle.checked = false;
        if (studyHeaderField) studyHeaderField.classList.add('hidden');
        if (studyTitleInput) studyTitleInput.value = '';

        updatePageNavigatorUI();
        renderCurrentPreview();
      });
    }

    // Section 04: Print & Binding Reset
    const resetPrintBtn = document.getElementById('resetPrintBtn');
    if (resetPrintBtn) {
      resetPrintBtn.addEventListener('click', () => {
        state.binding = 'none';
        state.hasGutter = false;
        state.gutter = 0;
        state.holeGuides = false;
        state.duplex = false;
        state.pageNumbers = true;
        state.pageNumberFormat = 'total';
        state.ecoPrint = false;

        const bindingNoneBtn = document.getElementById('bindingNoneBtn');
        const bindingBinderBtn = document.getElementById('bindingBinderBtn');
        const bindingSpiralBtn = document.getElementById('bindingSpiralBtn');
        const bindingOptionsGroup = document.getElementById('bindingOptionsGroup');
        const holeGuidesToggle = document.getElementById('holeGuidesToggle');
        const duplexSimplexBtn = document.getElementById('duplexSimplexBtn');
        const duplexDuplexBtn = document.getElementById('duplexDuplexBtn');
        const pageNumberToggle = document.getElementById('pageNumberToggle');
        const pageNumberFormatGroup = document.getElementById('pageNumberFormatGroup');
        const pageFormatTotalBtn = document.getElementById('pageFormatTotalBtn');
        const pageFormatSimpleBtn = document.getElementById('pageFormatSimpleBtn');
        const ecoPrintToggle = document.getElementById('ecoPrintToggle');

        if (bindingNoneBtn) bindingNoneBtn.classList.add('active');
        if (bindingBinderBtn) bindingBinderBtn.classList.remove('active');
        if (bindingSpiralBtn) bindingSpiralBtn.classList.remove('active');
        if (bindingOptionsGroup) bindingOptionsGroup.classList.add('hidden');
        if (holeGuidesToggle) holeGuidesToggle.checked = false;
        if (duplexSimplexBtn) duplexSimplexBtn.classList.add('active');
        if (duplexDuplexBtn) duplexDuplexBtn.classList.remove('active');
        if (pageNumberToggle) pageNumberToggle.checked = true;
        if (pageNumberFormatGroup) pageNumberFormatGroup.classList.remove('hidden');
        if (pageFormatTotalBtn) pageFormatTotalBtn.classList.add('active');
        if (pageFormatSimpleBtn) pageFormatSimpleBtn.classList.remove('active');
        if (ecoPrintToggle) ecoPrintToggle.checked = false;

        savePresets();
        renderCurrentPreview();
      });
    }

    // Section 05: Margins & Spacing Reset (ONLY margins & spacing)
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        state.margin = 40;
        state.step = 14;
        state.separation = 10;

        const marginSlider = document.getElementById('marginSlider');
        const marginValue = document.getElementById('marginValue');
        const stepSlider = document.getElementById('stepSlider');
        const stepValue = document.getElementById('stepValue');
        const separationSlider = document.getElementById('separationSlider');
        const separationValue = document.getElementById('separationValue');

        if (marginSlider) marginSlider.value = 40;
        if (marginValue) marginValue.textContent = '40 pt';
        if (stepSlider) stepSlider.value = 14;
        if (stepValue) stepValue.textContent = '14 pt';
        if (separationSlider) separationSlider.value = 10;
        if (separationValue) separationValue.textContent = '10 pt';

        savePresets();
        renderCurrentPreview();
      });
    }
  }

  // --- Page Navigation ---
  function getSelectedSlideIndices() {
    if (!state.numPages) return [];
    return SlidePrinterEngine.parsePageRanges(state.pageRanges, state.numPages);
  }

  function getTotalSheets() {
    const indices = getSelectedSlideIndices();
    const n = indices.length > 0 ? indices.length : (state.numPages || 1);
    const slideSheets = state.layout === '2-up' ? Math.ceil(n / 2) : n;
    return state.coverMode === 'generate' ? slideSheets + 1 : slideSheets;
  }

  function updatePageNavigatorUI() {
    const totalSheets = getTotalSheets();
    const totalPagesSpan = document.getElementById('totalPagesSpan');
    const pageInput = document.getElementById('pageInput');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const slideFolioText = document.getElementById('slideFolioText');

    if (state.currentPage > totalSheets) {
      state.currentPage = totalSheets;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    if (totalPagesSpan) totalPagesSpan.textContent = totalSheets;
    if (pageInput) {
      pageInput.max = totalSheets;
      pageInput.value = state.currentPage;
    }
    if (prevPageBtn) prevPageBtn.disabled = state.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = state.currentPage >= totalSheets;

    if (slideFolioText) {
      if (state.coverMode === 'generate' && state.currentPage === 1) {
        slideFolioText.textContent = (state.lang === 'en' ? 'Cover' : 'Portada');
      } else {
        slideFolioText.textContent = (state.lang === 'en' ? 'Page' : (state.lang === 'gl' ? 'Páxina' : 'Página'));
      }
    }
  }

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
        const totalSheets = getTotalSheets();
        if (state.currentPage < totalSheets) {
          goToPage(state.currentPage + 1);
        }
      });
    }

    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 1;
        goToPage(val);
      });
    }
  }

  function setupKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }
      const totalSheets = getTotalSheets();
      if (e.key === 'ArrowLeft' && state.currentPage > 1) {
        goToPage(state.currentPage - 1);
      } else if (e.key === 'ArrowRight' && state.currentPage < totalSheets) {
        goToPage(state.currentPage + 1);
      }
    });
  }

  function goToPage(sheetNum) {
    const totalSheets = getTotalSheets();
    state.currentPage = Math.max(1, Math.min(sheetNum, totalSheets));
    updatePageNavigatorUI();
    renderCurrentPreview();
  }

  // --- Preview Rendering ---
  function renderCurrentPreview() {
    if (!state.pdfjsDoc) return;
    const previewCanvas = document.getElementById('previewCanvas');
    if (!previewCanvas) return;

    const paperDims = SlidePrinterEngine.PAPER_SIZES[state.paperSize] || SlidePrinterEngine.PAPER_SIZES.a4;
    const totalSheets = getTotalSheets();

    const selectedIndices = getSelectedSlideIndices();
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
        pageNumbers: state.pageNumbers,
        pageNumberFormat: state.pageNumberFormat,
        totalPages: totalSheets,
        layout: state.layout,
        binding: state.binding,
        gutter: state.gutter,
        holeGuides: state.holeGuides,
        duplex: state.duplex,
        studyHeader: state.studyHeader,
        studyTitle: state.studyTitle,
        coverMode: state.coverMode,
        coverTemplate: state.coverTemplate || 'atelier',
        coverTitle: state.coverTitle || getBaseFileName(),
        coverAuthor: state.coverAuthor,
        ecoPrint: state.ecoPrint,
        selectedIndices: selectedIndices,
      }
    );
  }

  // --- Action Handlers ---
  function setupActions() {
    const downloadBtn = document.getElementById('downloadBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const printBtn = document.getElementById('printBtn');
    const exportBatchBtn = document.getElementById('exportBatchBtn');
    const exportBatchSidebarBtn = document.getElementById('exportBatchSidebarBtn');

    if (downloadBtn) downloadBtn.addEventListener('click', () => exportCurrentHandout());
    if (exportAllBtn) exportAllBtn.addEventListener('click', () => exportAllStylesZip());
    if (printBtn) printBtn.addEventListener('click', () => printCurrentHandout());
    if (exportBatchBtn) exportBatchBtn.addEventListener('click', () => exportBatchZip());
    if (exportBatchSidebarBtn) exportBatchSidebarBtn.addEventListener('click', () => exportBatchZip());
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

  async function exportBatchZip() {
    if (!state.files || state.files.length === 0 || state.isProcessing) return;
    if (typeof JSZip === 'undefined') {
      alert('JSZip library is required for batch ZIP archive.');
      return;
    }
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS.en;
    state.isProcessing = true;
    const msg = (dict.generatingBatchMsg || 'Generating handouts for all presentations...').replace('{count}', state.files.length);
    showLoading(true, msg);

    try {
      const zip = new JSZip();
      const styles = state.selectedStyles && state.selectedStyles.length > 0
        ? state.selectedStyles
        : [state.style];
      const totalFiles = state.files.length;
      const totalSteps = totalFiles * styles.length;
      let stepCount = 0;

      for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
        const item = state.files[fIdx];
        const baseName = item.name.replace(/\.[^/.]+$/, '');

        for (let sIdx = 0; sIdx < styles.length; sIdx++) {
          const s = styles[sIdx];
          const styleCode = SlidePrinterEngine.STYLES[s]?.code || s;

          const outBytes = await SlidePrinterEngine.convertSlidesToHandout(
            item.pdfBytes.slice(0),
            {
              style: s,
              paperSize: state.paperSize,
              margin: state.margin,
              step: state.step,
              separation: state.separation,
              pageNumbers: state.pageNumbers,
              pageNumberFormat: state.pageNumberFormat,
              layout: state.layout,
              binding: state.binding,
              gutter: state.gutter,
              holeGuides: state.holeGuides,
              duplex: state.duplex,
              coverMode: state.coverMode,
              coverTemplate: state.coverTemplate || 'atelier',
              coverTitle: state.coverTitle,
              coverAuthor: state.coverAuthor,
              pageRanges: state.pageRanges,
              studyHeader: state.studyHeader,
              studyTitle: state.studyTitle,
              ecoPrint: state.ecoPrint,
              onProgress: (current, total) => {
                const filePct = Math.round((stepCount / totalSteps) * 100 + (current / total) * (100 / totalSteps));
                updateProgress(
                  filePct,
                  `[${fIdx + 1}/${totalFiles}] ${item.name} · ${styleCode} (${current}/${total} ${dict.slidesLabel})...`
                );
              },
            }
          );
          stepCount++;
          zip.file(`${baseName}_${styleCode}.pdf`, outBytes);
        }
      }

      updateProgress(98, dict.compressingMsg || 'Compressing ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const styleSuffix = styles.length === 4 ? 'all_styles' : styles.join('_');
      const zipFileName = `handouts_${styleSuffix}_${totalFiles}_presentations.zip`;
      triggerDownload(zipBlob, zipFileName);
    } catch (err) {
      console.error('Batch ZIP export failed:', err);
      alert(`Batch ZIP export failed: ${err.message || err}`);
    } finally {
      state.isProcessing = false;
      showLoading(false);
    }
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
          pageNumbers: state.pageNumbers,
          pageNumberFormat: state.pageNumberFormat,
          layout: state.layout,
          binding: state.binding,
          gutter: state.gutter,
          holeGuides: state.holeGuides,
          duplex: state.duplex,
          coverMode: state.coverMode,
          coverTemplate: state.coverTemplate || 'atelier',
          coverTitle: state.coverTitle,
          coverAuthor: state.coverAuthor,
          pageRanges: state.pageRanges,
          studyHeader: state.studyHeader,
          studyTitle: state.studyTitle,
          ecoPrint: state.ecoPrint,
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

    // Only bundle the selected styles!
    const styles = state.selectedStyles && state.selectedStyles.length > 0
      ? state.selectedStyles
      : [state.style];

    state.isProcessing = true;
    const countMsg = styles.length === 4
      ? dict.bundlingMsg
      : (dict.bundlingSelectedMsg || 'Generating {count} selected styles in ZIP...').replace('{count}', styles.length);
    showLoading(true, countMsg);

    try {
      const zip = new JSZip();
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
            pageNumbers: state.pageNumbers,
            pageNumberFormat: state.pageNumberFormat,
            layout: state.layout,
            binding: state.binding,
            gutter: state.gutter,
            holeGuides: state.holeGuides,
            duplex: state.duplex,
            coverMode: state.coverMode,
            coverTemplate: state.coverTemplate || 'atelier',
            coverTitle: state.coverTitle,
            coverAuthor: state.coverAuthor,
            pageRanges: state.pageRanges,
            studyHeader: state.studyHeader,
            studyTitle: state.studyTitle,
            ecoPrint: state.ecoPrint,
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
      const styleSuffix = styles.length === 4 ? 'all_styles' : styles.join('_');
      const zipFileName = `${getBaseFileName()}_${styleSuffix}.zip`;
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
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' || 
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    try {
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html ${isDarkTheme ? 'data-theme="dark"' : ''}>
            <head>
              <meta charset="utf-8">
              <title>${dict.printBtn || 'Print Folio'} · Slide-Printer</title>
              <style>
                :root {
                  --bg: #fdfbf7;
                  --text: #1a2332;
                  --text-sub: #5a6578;
                  --spinner-track: rgba(197, 160, 89, 0.2);
                  --spinner-accent: #c5a059;
                }
                html[data-theme="dark"],
                @media (prefers-color-scheme: dark) {
                  :root:not([data-theme="light"]) {
                    --bg: #141517;
                    --text: #f4f1ea;
                    --text-sub: #a39f97;
                    --spinner-track: rgba(234, 88, 12, 0.2);
                    --spinner-accent: #ea580c;
                  }
                }
                body {
                  margin: 0;
                  padding: 40px;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: var(--bg);
                  color: var(--text);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 75vh;
                  text-align: center;
                  transition: background 0.3s ease, color 0.3s ease;
                }
                .spinner {
                  width: 38px;
                  height: 38px;
                  border: 3px solid var(--spinner-track);
                  border-top-color: var(--spinner-accent);
                  border-radius: 50%;
                  animation: spin 0.9s linear infinite;
                  margin-bottom: 1.5rem;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                h2 { font-weight: 600; font-size: 1.25rem; margin: 0 0 0.5rem; color: var(--text); }
                p { color: var(--text-sub); font-size: 0.95rem; margin: 0; }
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
          pageNumbers: state.pageNumbers,
          pageNumberFormat: state.pageNumberFormat,
          layout: state.layout,
          gutter: state.hasGutter ? 30 : 0,
          duplex: state.duplex,
          coverMode: state.coverMode,
          coverTemplate: state.coverTemplate || 'atelier',
          coverTitle: state.coverTitle,
          coverAuthor: state.coverAuthor,
          pageRanges: state.pageRanges,
          studyHeader: state.studyHeader,
          studyTitle: state.studyTitle,
          ecoPrint: state.ecoPrint,
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
    loadPresets();
    setupLanguage();
    setupTheme();
    setupDropZone();
    setupControls();
    applyStateToDOM();
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
