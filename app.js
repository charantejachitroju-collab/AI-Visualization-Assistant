/* ═══════════════════════════════════════════════════════════════
   AI DATA VISUALIZATION ASSISTANT — app.js
   Full engine: Theme, Upload, CSV Analysis, Charts, AI Insights,
   Image Viewer, PDF Viewer, History, Export
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════
   COLOR PALETTES
   ══════════════════════════════════════ */
const PALETTES = {
  default: ['#3B82F6','#8B5CF6','#EC4899','#F97316','#22C55E','#06B6D4','#FBBF24','#EF4444','#2DD4BF','#A78BFA'],
  warm:    ['#F59E0B','#EF4444','#F97316','#FBBF24','#E11D48','#DC2626','#EA580C','#D97706','#B45309','#92400E'],
  cool:    ['#06B6D4','#10B981','#3B82F6','#6366F1','#0EA5E9','#22C55E','#14B8A6','#0284C7','#047857','#1D4ED8'],
  mono:    ['#475569','#64748B','#94A3B8','#CBD5E1','#334155','#1E293B','#0F172A','#374151','#6B7280','#9CA3AF'],
  vivid:   ['#F472B6','#FBBF24','#34D399','#60A5FA','#A78BFA','#FB923C','#4ADE80','#38BDF8','#F87171','#C084FC'],
};
let activePalette = 'default';
const PALETTE = () => PALETTES[activePalette];
const alpha = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ══════════════════════════════════════
   STATE
   ══════════════════════════════════════ */
let state = {
  theme: 'dark',
  data: [],
  fields: [],
  numericCols: [],
  stringCols: [],
  dateCols: [],
  fileName: '',
  fileType: '',
  history: [],
  previewRows: 20,
  defaultChart: 'auto',
  chartInstances: {},
  pdfDoc: null,
  pdfPage: 1,
  pdfZoom: 1,
  rightPanelOpen: true,
  sidebarCollapsed: false,
};

/* ══════════════════════════════════════
   CHART.JS GLOBAL DEFAULTS
   ══════════════════════════════════════ */
Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels = { display: false };
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.weight = 500;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = { duration: 700, easing: 'easeOutQuart' };

function applyChartTheme() {
  const isDark = state.theme === 'dark';
  Chart.defaults.color = isDark ? '#94A3B8' : '#64748B';
  Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  Chart.defaults.plugins.tooltip.backgroundColor = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.92)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(59,130,246,0.3)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleColor = '#F8FAFC';
  Chart.defaults.plugins.tooltip.bodyColor = '#94A3B8';
}

/* ══════════════════════════════════════
   THEME MANAGER
   ══════════════════════════════════════ */
function loadTheme() {
  const saved = localStorage.getItem('dv_theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = saved || (systemDark ? 'dark' : 'light');
  applyTheme(state.theme, false);
}

function applyTheme(theme, save = true) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('dv_theme', theme);

  // Sync settings toggle
  const st = document.getElementById('settings-theme-toggle');
  if (st) st.checked = theme === 'light';

  // Footer label
  const fl = document.getElementById('footer-theme-label');
  if (fl) fl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';

  applyChartTheme();

  // Re-render existing charts with new theme colors
  Object.values(state.chartInstances).forEach(c => { if (c && c.update) c.update('none'); });
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/* ══════════════════════════════════════
   TOAST
   ══════════════════════════════════════ */
function toast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]||'📢'}</span><span style="flex:1">${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════
   SIDEBAR & NAVIGATION
   ══════════════════════════════════════ */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');

  toggle.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    sidebar.classList.toggle('mobile-open', !state.sidebarCollapsed);
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;
      setActiveNav(section);
    });
  });
}

function setActiveNav(section) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const navEl = document.getElementById(`nav-${section}`);
  if (navEl) navEl.classList.add('active');

  // Section visibility + scroll to target block
  const sectionMap = {
    upload:    () => showSection('section-upload'),
    url:       () => { showSection('section-upload'); showURLInput(); },
    dashboard: () => showSection('dashboard-area'),
    charts:    () => { showSection('dashboard-area'); scrollToBlock('charts-block'); },
    insights:  () => { showSection('dashboard-area'); scrollToBlock('insights-block'); },
    reports:   () => { showSection('dashboard-area'); scrollToBlock('stats-block'); },
    history:   () => showHistorySection(),
    settings:  () => showSettingsSection(),
  };
  if (sectionMap[section]) sectionMap[section]();
}

function showSection(id) {
  ['section-upload','dashboard-area','image-viewer-section',
   'pdf-viewer-section','section-history','section-settings'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = id === 'section-upload' ? 'block' : 'block';
}

function scrollToBlock(blockId) {
  // Small delay so the section is visible before scrolling
  setTimeout(() => {
    const block = document.getElementById(blockId);
    const workspace = document.getElementById('workspace');
    if (block && workspace) {
      // Calculate the block's position relative to the workspace scroll container
      const blockRect = block.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const scrollOffset = blockRect.top - workspaceRect.top + workspace.scrollTop;
      workspace.scrollTo({ top: scrollOffset - 16, behavior: 'smooth' });
    }
  }, 150);
}

function showURLInput() {
  const urlSec = document.getElementById('url-section');
  if (urlSec) urlSec.style.display = 'block';
}

function showHistorySection() {
  showSection('section-history');
  renderHistory();
}

function showSettingsSection() {
  showSection('section-settings');
}

/* ══════════════════════════════════════
   RIGHT PANEL
   ══════════════════════════════════════ */
function initRightPanel() {
  const panel = document.getElementById('right-panel');
  const btn   = document.getElementById('btn-right-panel');
  const close = document.getElementById('right-panel-close');

  const toggle = () => {
    state.rightPanelOpen = !state.rightPanelOpen;
    panel.classList.toggle('hidden', !state.rightPanelOpen);
  };
  btn.addEventListener('click', toggle);
  close.addEventListener('click', toggle);
}

/* ══════════════════════════════════════
   UPLOAD WIRING
   ══════════════════════════════════════ */
function initUpload() {
  // Card clicks
  const cardMap = {
    'card-csv':   'csv-input',
    'card-pdf':   'pdf-input',
    'card-image': 'image-input',
    'card-url':   null,
  };

  Object.entries(cardMap).forEach(([cardId, inputId]) => {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.addEventListener('click', () => {
      if (inputId) {
        document.getElementById(inputId).click();
      } else {
        showURLInput();
        document.getElementById('url-section').style.display = 'block';
        document.getElementById('url-input').focus();
      }
    });
    card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') card.click(); });
  });

  // File inputs
  document.getElementById('csv-input').addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('pdf-input').addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('image-input').addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  // Big drop zone
  const dz = document.getElementById('big-dropzone');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  dz.addEventListener('click', () => {
    // Show a file picker for any type
    const tmp = document.createElement('input');
    tmp.type = 'file';
    tmp.accept = '.csv,.tsv,.xlsx,.pdf,.doc,.docx,image/*,.json,.txt';
    tmp.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    tmp.click();
  });

  // URL load
  document.getElementById('url-load-btn').addEventListener('click', handleURL);
  document.getElementById('url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleURL();
  });

  // New upload button (in dashboard banner)
  document.getElementById('btn-new-upload').addEventListener('click', () => {
    setActiveNav('upload');
  });
}

/* ══════════════════════════════════════
   FILE HANDLER — DISPATCH BY TYPE
   ══════════════════════════════════════ */
function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const type = file.type;

  setProgress(10, `Reading "${file.name}"…`);

  if (['csv','tsv','txt'].includes(ext) || type.includes('text')) {
    handleCSV(file);
  } else if (['pdf'].includes(ext) || type === 'application/pdf') {
    handlePDF(file);
  } else if (type.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) {
    handleImage(file);
  } else if (['xlsx','xls'].includes(ext)) {
    toast('Excel files: save as CSV first for best results. Trying as CSV…','warn');
    handleCSV(file);
  } else if (ext === 'json') {
    handleJSON(file);
  } else {
    toast(`Unsupported file type: .${ext}. Try CSV, PDF, or an image.`, 'error');
    hideProgress();
  }

  // Add to history
  addHistory({ name: file.name, size: file.size, type: ext.toUpperCase(), date: new Date().toLocaleString() });
}

/* ══════════════════════════════════════
   PROGRESS BAR
   ══════════════════════════════════════ */
function setProgress(pct, msg) {
  const bar = document.getElementById('upload-status-bar');
  const fill = document.getElementById('status-progress-fill');
  const text = document.getElementById('status-text');
  const icon = document.getElementById('status-icon');
  bar.style.display = 'flex';
  fill.style.width = pct + '%';
  text.textContent = msg;
  icon.style.animation = pct < 100 ? 'spin 1.5s linear infinite' : 'none';
  icon.textContent = pct < 100 ? '⚙️' : '✅';
}
function hideProgress() {
  setTimeout(() => {
    document.getElementById('upload-status-bar').style.display = 'none';
  }, 1500);
}

/* ══════════════════════════════════════
   CSV HANDLER
   ══════════════════════════════════════ */
function handleCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    complete: results => {
      setProgress(60, 'Cleaning & analyzing data…');
      if (!results.data.length) {
        toast('No data found in file.', 'error');
        hideProgress();
        return;
      }
      state.data   = results.data;
      state.fields = results.meta.fields || Object.keys(results.data[0]);
      state.fileName = file.name;
      state.fileType = 'CSV';
      detectColumnTypes();
      setProgress(85, 'Generating visualizations…');
      setTimeout(() => {
        renderDashboard();
        setProgress(100, '✅ Done!');
        hideProgress();
        toast(`Loaded ${state.data.length.toLocaleString()} rows × ${state.fields.length} columns from "${file.name}"`, 'success');
      }, 200);
    },
    error: err => {
      toast('CSV parse error: ' + err.message, 'error');
      hideProgress();
    }
  });
}

/* ══════════════════════════════════════
   JSON HANDLER
   ══════════════════════════════════════ */
function handleJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let json = JSON.parse(e.target.result);
      if (!Array.isArray(json)) json = [json];
      state.data   = json;
      state.fields = Object.keys(json[0]);
      state.fileName = file.name;
      state.fileType = 'JSON';
      detectColumnTypes();
      renderDashboard();
      setProgress(100, '✅ Done!');
      hideProgress();
      toast(`Loaded ${json.length} records from "${file.name}"`, 'success');
    } catch(err) {
      toast('JSON parse error: ' + err.message, 'error');
      hideProgress();
    }
  };
  reader.readAsText(file);
}

/* ══════════════════════════════════════
   IMAGE HANDLER
   ══════════════════════════════════════ */
function handleImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    const img = document.getElementById('main-image');
    img.src = src;
    img.onload = () => {
      document.getElementById('image-meta-bar').innerHTML = [
        `📐 ${img.naturalWidth} × ${img.naturalHeight} px`,
        `💾 ${(file.size/1024).toFixed(1)} KB`,
        `🏷️ ${file.type || 'image'}`,
        `📄 ${file.name}`,
      ].map(s=>`<span>${s}</span>`).join('');
      document.getElementById('img-size-badge').textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    };
    state.fileName = file.name;
    state.fileType = 'Image';
    setProgress(100,'✅ Image loaded!');
    hideProgress();
    showImageViewer();
    toast(`Image "${file.name}" loaded successfully.`,'success');
  };
  reader.onerror = () => { toast('Failed to read image.','error'); hideProgress(); };
  reader.readAsDataURL(file);
}

function showImageViewer() {
  showSection('image-viewer-section');
  document.getElementById('image-viewer-section').style.display = 'block';
  setActiveNav('dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('img-close-btn').addEventListener('click', () => {
    document.getElementById('image-viewer-section').style.display = 'none';
  });
});

/* ══════════════════════════════════════
   PDF HANDLER
   ══════════════════════════════════════ */
function handlePDF(file) {
  const reader = new FileReader();
  reader.onload = async e => {
    setProgress(50,'Loading PDF…');
    if (typeof pdfjsLib === 'undefined') {
      toast('PDF.js not loaded yet — please try again.','error');
      hideProgress();
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    try {
      state.pdfDoc  = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
      state.pdfPage = 1;
      document.getElementById('pdf-pages-badge').textContent = `${state.pdfDoc.numPages} pages`;
      setProgress(100,'✅ PDF loaded!');
      hideProgress();
      showPDFViewer();
      renderPDFPage(1);
      toast(`"${file.name}" loaded — ${state.pdfDoc.numPages} pages.`,'success');
    } catch(err) {
      toast('PDF error: '+err.message,'error');
      hideProgress();
    }
  };
  reader.onerror = () => { toast('Failed to read PDF.','error'); hideProgress(); };
  reader.readAsArrayBuffer(file);
}

function showPDFViewer() {
  showSection('pdf-viewer-section');
  document.getElementById('pdf-viewer-section').style.display = 'block';
}

async function renderPDFPage(num) {
  if (!state.pdfDoc) return;
  const page     = await state.pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: state.pdfZoom });
  const canvas   = document.getElementById('pdf-canvas');
  const ctx      = canvas.getContext('2d');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  state.pdfPage  = num;
  const total    = state.pdfDoc.numPages;
  document.getElementById('pdf-counter').textContent  = `Page ${num} of ${total}`;
  document.getElementById('pdf-prev').disabled = num <= 1;
  document.getElementById('pdf-next').disabled = num >= total;
}

/* ══════════════════════════════════════
   URL HANDLER
   ══════════════════════════════════════ */
function handleURL() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { toast('Please enter a URL.','warn'); return; }

  // Check if it's an image URL
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i.test(url)) {
    const img = document.getElementById('main-image');
    img.src = url;
    img.onload = () => {
      document.getElementById('image-meta-bar').innerHTML = [
        `📐 ${img.naturalWidth} × ${img.naturalHeight} px`,
        `🔗 URL`,
        `📄 ${url.split('/').pop().split('?')[0] || 'image'}`,
      ].map(s=>`<span>${s}</span>`).join('');
      document.getElementById('img-size-badge').textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    };
    img.onerror = () => toast('Could not load image from URL. Check the URL and CORS settings.','error');
    showImageViewer();
    toast('Loading image from URL…','info');
    return;
  }

  // For non-image URLs — show friendly message (CORS limitation client-side)
  toast('Direct URL scraping requires a backend. For now, download the page as CSV and upload it!','info',6000);
  setProgress(100,'ℹ️ URL noted');
  hideProgress();
}

/* ══════════════════════════════════════
   COLUMN TYPE DETECTION
   ══════════════════════════════════════ */
function detectColumnTypes() {
  const sample = state.data.slice(0, 30);
  state.numericCols = [];
  state.stringCols  = [];
  state.dateCols    = [];

  state.fields.forEach(f => {
    const vals = sample.map(r => r[f]).filter(v => v !== null && v !== '' && v !== undefined);
    const numericCount = vals.filter(v => !isNaN(+v) && typeof v !== 'boolean' && v !== '').length;
    const dateCount    = vals.filter(v => isLikelyDate(v)).length;

    if (dateCount > vals.length * 0.5) {
      state.dateCols.push(f);
    } else if (numericCount > vals.length * 0.7) {
      state.numericCols.push(f);
    } else {
      state.stringCols.push(f);
    }
  });
}

function isLikelyDate(val) {
  if (typeof val !== 'string') return false;
  return /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(val);
}

/* ══════════════════════════════════════
   AGGREGATION HELPERS
   ══════════════════════════════════════ */
const sum  = (arr, f) => arr.reduce((s,d) => s + (+d[f]||0), 0);
const avg  = (arr, f) => arr.length ? sum(arr,f)/arr.length : 0;
const min  = (arr, f) => Math.min(...arr.map(d=>+d[f]||0));
const max  = (arr, f) => Math.max(...arr.map(d=>+d[f]||0));
const med  = (arr, f) => {
  const s = arr.map(d=>+d[f]||0).sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
};
const std  = (arr, f) => {
  const m = avg(arr,f);
  return Math.sqrt(arr.reduce((s,d)=>s+(+d[f]-m)**2,0)/arr.length);
};
const groupBy = (arr, key) => {
  const m = {};
  arr.forEach(d => { const k=d[key]; if(!m[k]) m[k]=[]; m[k].push(d); });
  return m;
};

function fmtNum(n, dec=1) {
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1)+'K';
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(dec);
}

/* ══════════════════════════════════════
   RENDER FULL DASHBOARD
   ══════════════════════════════════════ */
function renderDashboard() {
  // Show dashboard area
  showSection('dashboard-area');
  document.getElementById('dashboard-area').style.display = 'block';

  renderBanner();
  renderDataQuality();
  renderKPIs();
  renderStatsTable();
  renderAutoCharts();
  renderInsights();
  renderPreviewTable();
  renderPanelFilters();
  renderAIRecs();
}

/* ── Banner ── */
function renderBanner() {
  const icon = { CSV:'📂', JSON:'🗂️', Image:'🖼️', PDF:'📄', Excel:'📊' };
  document.getElementById('dataset-icon').textContent = icon[state.fileType] || '📁';
  document.getElementById('dataset-name').textContent = state.fileName;
  document.getElementById('dataset-meta').textContent =
    `${state.data.length.toLocaleString()} rows · ${state.fields.length} columns · ` +
    `${state.numericCols.length} numeric · ${state.stringCols.length} categorical · ` +
    `${state.dateCols.length} date`;
}

/* ── Data Quality ── */
function renderDataQuality() {
  const data = state.data;
  const total = data.length * state.fields.length;
  let missing = 0, dups = 0;
  const seen = new Set();
  data.forEach(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) dups++;
    seen.add(key);
    state.fields.forEach(f => { if (row[f]===null||row[f]===''||row[f]===undefined) missing++; });
  });
  const complete = ((total-missing)/total*100).toFixed(1);

  const items = [
    { icon:'📊', value: data.length.toLocaleString(), label:'Total Rows',       cls:'info' },
    { icon:'🗂️', value: state.fields.length,           label:'Total Columns',    cls:'info' },
    { icon:'✅', value: complete+'%',                   label:'Data Completeness', cls:'good' },
    { icon:'⚠️', value: missing,                         label:'Missing Values',   cls: missing>0?'warn':'good' },
    { icon:'🔁', value: dups,                             label:'Duplicate Rows',   cls: dups>0?'warn':'good' },
    { icon:'🔢', value: state.numericCols.length,        label:'Numeric Columns',  cls:'info' },
    { icon:'🔤', value: state.stringCols.length,         label:'Category Columns', cls:'info' },
    { icon:'📅', value: state.dateCols.length,           label:'Date Columns',     cls:'info' },
  ];
  document.getElementById('quality-grid').innerHTML = items.map(i =>
    `<div class="quality-card quality-${i.cls}">
       <div class="quality-icon">${i.icon}</div>
       <div class="quality-value">${i.value}</div>
       <div class="quality-label">${i.label}</div>
     </div>`
  ).join('');
}

/* ── KPIs ── */
function renderKPIs() {
  const grid = document.getElementById('kpi-grid');
  const cards = [];
  const pal = PALETTE();

  state.numericCols.slice(0, 8).forEach((col, i) => {
    const vals = state.data.map(r => +r[col]).filter(v => !isNaN(v));
    if (!vals.length) return;
    const total = sum(state.data, col);
    const mean  = avg(state.data, col);
    const accent = pal[i % pal.length];
    cards.push({
      emoji: ['💰','📈','📦','⭐','🎯','💡','🔢','📉'][i] || '📊',
      label: col,
      value: fmtNum(total),
      sub: `Avg: ${fmtNum(mean)}  ·  Min: ${fmtNum(min(state.data,col))}  ·  Max: ${fmtNum(max(state.data,col))}`,
      accent,
    });
  });

  document.getElementById('kpi-count-badge').textContent = `${cards.length} KPIs`;
  grid.innerHTML = cards.map((c,i) =>
    `<div class="kpi-card" style="--kpi-accent:${c.accent};animation-delay:${i*0.05}s">
       <style>.kpi-card:nth-child(${i+1})::before{background:${c.accent}}</style>
       <div class="kpi-emoji">${c.emoji}</div>
       <div class="kpi-label-text">${c.label}</div>
       <div class="kpi-val">${c.value}</div>
       <div class="kpi-sub">${c.sub}</div>
     </div>`
  ).join('');
}

/* ── Stats Table ── */
function renderStatsTable() {
  const numCols = state.numericCols.slice(0, 8);
  if (!numCols.length) { document.getElementById('stats-block').style.display='none'; return; }

  const metrics = [
    { name:'Count',  fn: (d,f) => d.length },
    { name:'Sum',    fn: sum },
    { name:'Mean',   fn: avg },
    { name:'Median', fn: med },
    { name:'Std Dev',fn: std },
    { name:'Min',    fn: min },
    { name:'Max',    fn: max },
  ];

  document.getElementById('stats-table-head').innerHTML =
    `<th>Metric</th>` + numCols.map(c=>`<th>${c}</th>`).join('');

  document.getElementById('stats-table-body').innerHTML = metrics.map(m =>
    `<tr><td>${m.name}</td>` +
    numCols.map(c => `<td>${fmtNum(m.fn(state.data, c), 2)}</td>`).join('') +
    '</tr>'
  ).join('');
}

/* ══════════════════════════════════════
   AUTO CHART GENERATION
   ══════════════════════════════════════ */
function destroyAllCharts() {
  Object.values(state.chartInstances).forEach(c => { if(c && c.destroy) c.destroy(); });
  state.chartInstances = {};
}

function renderAutoCharts() {
  destroyAllCharts();
  const grid = document.getElementById('charts-auto-grid');
  grid.innerHTML = '';

  const charts = buildChartConfigs();
  document.getElementById('charts-count-badge').textContent = `${charts.length} Charts`;

  charts.forEach((cfg, i) => {
    const canvasId = `auto-chart-${i}`;
    const card = document.createElement('div');
    card.className = 'auto-chart-card';
    card.innerHTML = `<div class="auto-chart-title">${cfg.title}</div>
                      <div class="auto-chart-wrap"><canvas id="${canvasId}"></canvas></div>`;
    grid.appendChild(card);

    requestAnimationFrame(() => {
      const ctx = document.getElementById(canvasId).getContext('2d');
      state.chartInstances[canvasId] = new Chart(ctx, cfg.config);
    });
  });

  if (!charts.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px">No chart patterns detected automatically. Upload a CSV with numeric and categorical columns.</p>';
  }
}

function buildChartConfigs() {
  const configs = [];
  const pal = PALETTE();
  const { data, numericCols, stringCols, dateCols } = state;

  // 1. BAR CHARTS: each string col × first numeric col
  stringCols.slice(0,4).forEach((strCol, si) => {
    numericCols.slice(0,1).forEach(numCol => {
      const grp = groupBy(data, strCol);
      const entries = Object.entries(grp)
        .map(([k,v])=>({ label:k, value:sum(v,numCol) }))
        .sort((a,b)=>b.value-a.value).slice(0,15);
      if (entries.length < 2) return;

      const isHoriz = entries.length > 7;
      configs.push({
        title: `${numCol} by ${strCol}`,
        config: {
          type: 'bar',
          data: {
            labels: entries.map(e=>e.label),
            datasets: [{
              label: numCol,
              data: entries.map(e=>e.value),
              backgroundColor: entries.map((_,i)=>alpha(pal[i%pal.length],0.7)),
              borderColor: entries.map((_,i)=>pal[i%pal.length]),
              borderWidth: 1.5, borderRadius: 5,
            }]
          },
          options: {
            indexAxis: isHoriz ? 'y' : 'x',
            plugins: { legend:{ display:false }, datalabels:{ display:false } },
            scales: {
              x: { grid:{ color:'rgba(148,163,184,0.06)' } },
              y: { grid:{ color:'rgba(148,163,184,0.06)' } },
            }
          }
        }
      });

      // DONUT for this categorical col
      if (entries.length <= 10) {
        const total = entries.reduce((s,e)=>s+e.value,0);
        configs.push({
          title: `${strCol} Share of ${numCol}`,
          config: {
            type: 'doughnut',
            data: {
              labels: entries.map(e=>e.label),
              datasets: [{ data: entries.map(e=>e.value),
                backgroundColor: entries.map((_,i)=>pal[i%pal.length]),
                borderColor: '#0F172A', borderWidth:2, hoverOffset:8 }]
            },
            options: {
              cutout:'60%',
              plugins: {
                legend:{ position:'bottom', labels:{ font:{ size:11 } } },
                tooltip:{ callbacks:{ label: c=>`${c.label}: ${fmtNum(c.parsed)} (${(c.parsed/total*100).toFixed(1)}%)` } },
                datalabels:{
                  display: c => (c.dataset.data[c.dataIndex]/total*100)>=5,
                  color:'#fff', font:{ size:11, weight:700 },
                  formatter:(v)=>((v/total)*100).toFixed(1)+'%',
                }
              }
            }
          }
        });
      }
    });
  });

  // 2. LINE CHART: date col × numeric cols
  if (dateCols.length && numericCols.length) {
    const dateCol = dateCols[0];
    const grp = groupBy(data, dateCol);
    const sorted = Object.entries(grp).sort((a,b)=>new Date(a[0])-new Date(b[0]));
    if (sorted.length > 1) {
      configs.push({
        title: `Trend over ${dateCol}`,
        config: {
          type: 'line',
          data: {
            labels: sorted.map(([k])=>k),
            datasets: numericCols.slice(0,3).map((col,i)=>({
              label: col,
              data: sorted.map(([,v])=>sum(v,col)),
              borderColor: pal[i],
              backgroundColor: alpha(pal[i],0.08),
              fill: true, tension:0.4, borderWidth:2.5,
              pointRadius:4, pointHoverRadius:7,
              pointBackgroundColor:pal[i],
            }))
          },
          options:{
            interaction:{ mode:'index', intersect:false },
            plugins:{ legend:{ position:'bottom' }, datalabels:{ display:false } },
            scales:{
              x:{ grid:{ display:false } },
              y:{ grid:{ color:'rgba(148,163,184,0.06)' }, ticks:{ callback:v=>fmtNum(v) } }
            }
          }
        }
      });
    }
  }

  // 3. MULTI-NUMERIC LINE CHART (if 2+ numeric, no date)
  if (!dateCols.length && numericCols.length >= 2) {
    const sample = data.slice(0, 100);
    configs.push({
      title: 'Numeric Columns Trend',
      config: {
        type: 'line',
        data: {
          labels: sample.map((_,i)=>i+1),
          datasets: numericCols.slice(0,4).map((col,i)=>({
            label:col, data:sample.map(r=>+r[col]||0),
            borderColor:pal[i], backgroundColor:alpha(pal[i],0.06),
            fill:false, tension:0.3, borderWidth:2,
            pointRadius:sample.length>50?0:3,
          }))
        },
        options:{
          interaction:{ mode:'index', intersect:false },
          plugins:{ legend:{ position:'bottom' }, datalabels:{ display:false } },
          scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:'rgba(148,163,184,0.06)' } } }
        }
      }
    });
  }

  // 4. SCATTER: first two numeric cols
  if (numericCols.length >= 2) {
    const xCol = numericCols[0], yCol = numericCols[1];
    configs.push({
      title: `${xCol} vs ${yCol} (Scatter)`,
      config: {
        type:'scatter',
        data:{
          datasets:[{
            label:`${xCol} vs ${yCol}`,
            data: data.slice(0,500).map(r=>({ x:+r[xCol]||0, y:+r[yCol]||0 })),
            backgroundColor: alpha(pal[4],0.55),
            borderColor: pal[4], pointRadius:5, borderWidth:1,
          }]
        },
        options:{
          plugins:{ legend:{display:false}, datalabels:{display:false} },
          scales:{
            x:{ title:{display:true,text:xCol,color:'var(--chart-text)',font:{size:11}}, grid:{color:'rgba(148,163,184,0.06)'} },
            y:{ title:{display:true,text:yCol,color:'var(--chart-text)',font:{size:11}}, grid:{color:'rgba(148,163,184,0.06)'} }
          }
        }
      }
    });
  }

  // 5. POLAR AREA: first string col count distribution
  if (stringCols.length) {
    const col = stringCols[0];
    const freq = {};
    data.forEach(r => { const k=String(r[col]||'Unknown').trim(); freq[k]=(freq[k]||0)+1; });
    const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if (sorted.length>=3) {
      configs.push({
        title: `${col} Distribution (Count)`,
        config:{
          type:'polarArea',
          data:{
            labels:sorted.map(([k])=>k),
            datasets:[{ data:sorted.map(([,v])=>v),
              backgroundColor:sorted.map((_,i)=>alpha(pal[i%pal.length],0.55)),
              borderColor:sorted.map((_,i)=>pal[i%pal.length]), borderWidth:1.5 }]
          },
          options:{
            plugins:{ legend:{position:'bottom',labels:{font:{size:11}}}, datalabels:{display:false} },
            scales:{ r:{ grid:{color:'rgba(148,163,184,0.06)'}, ticks:{display:false} } }
          }
        }
      });
    }
  }

  // 6. HISTOGRAM: first numeric col
  if (numericCols.length) {
    const col = numericCols[0];
    const vals = data.map(r=>+r[col]).filter(v=>!isNaN(v));
    const mn=Math.min(...vals), mx=Math.max(...vals);
    const bins=10, binW=(mx-mn)/bins;
    const buckets=Array(bins).fill(0);
    vals.forEach(v=>{ const bi=Math.min(Math.floor((v-mn)/binW),bins-1); buckets[bi]++; });
    const labels=buckets.map((_,i)=>`${fmtNum(mn+i*binW)}–${fmtNum(mn+(i+1)*binW)}`);
    configs.push({
      title:`${col} Distribution (Histogram)`,
      config:{
        type:'bar',
        data:{ labels, datasets:[{ label:'Frequency', data:buckets,
          backgroundColor:alpha(pal[2],0.65), borderColor:pal[2], borderWidth:1.5, borderRadius:4 }] },
        options:{
          plugins:{ legend:{display:false}, datalabels:{display:false} },
          scales:{ x:{grid:{display:false}}, y:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{stepSize:1}} }
        }
      }
    });
  }

  return configs;
}

/* ══════════════════════════════════════
   AI INSIGHTS ENGINE
   ══════════════════════════════════════ */
function renderInsights() {
  const { data, numericCols, stringCols, dateCols, fields } = state;
  if (!data.length) return;

  // --- WHAT ---
  let what = `<strong>Dataset:</strong> ${data.length.toLocaleString()} records across ${fields.length} fields. `;
  if (numericCols.length) {
    const topCol = numericCols[0];
    const total  = sum(data, topCol);
    const mean   = avg(data, topCol);
    what += `The primary metric <strong>${topCol}</strong> has a total of <strong>${fmtNum(total)}</strong> with an average of <strong>${fmtNum(mean)}</strong>. `;
    if (numericCols.length > 1) {
      const topCols = numericCols.slice(0,3).map(c=>`<strong>${c}</strong>`).join(', ');
      what += `Key numeric columns include ${topCols}.`;
    }
  }
  if (stringCols.length) {
    const col = stringCols[0];
    const grp = groupBy(data, col);
    const top  = Object.entries(grp).sort((a,b)=>b[1].length-a[1].length)[0];
    if (top) what += ` The most common <strong>${col}</strong> is <strong>"${top[0]}"</strong> with ${top[1].length} occurrences.`;
  }

  // --- WHY ---
  let why = '';
  if (numericCols.length && stringCols.length) {
    const numCol = numericCols[0], strCol = stringCols[0];
    const grp = groupBy(data, strCol);
    const ranked = Object.entries(grp)
      .map(([k,v])=>({ k, total:sum(v,numCol) }))
      .sort((a,b)=>b.total-a.total);
    if (ranked.length >= 2) {
      why += `<strong>${ranked[0].k}</strong> leads in <strong>${numCol}</strong> with ${fmtNum(ranked[0].total)}, `+
             `followed by <strong>${ranked[1].k}</strong> at ${fmtNum(ranked[1].total)}. `;
      why += `The top performer accounts for ${((ranked[0].total / sum(data,numCol))*100).toFixed(1)}% of total. `;
    }
  }
  if (numericCols.length >= 2) {
    const c1=numericCols[0], c2=numericCols[1];
    const v1=data.map(r=>+r[c1]||0), v2=data.map(r=>+r[c2]||0);
    const m1=v1.reduce((a,b)=>a+b,0)/v1.length, m2=v2.reduce((a,b)=>a+b,0)/v2.length;
    const cor = pearsonCorr(v1,v2);
    why += `Correlation between <strong>${c1}</strong> and <strong>${c2}</strong>: <strong>${cor.toFixed(2)}</strong> `+
           `(${Math.abs(cor)>0.7?'strong':Math.abs(cor)>0.4?'moderate':'weak'} ${cor>0?'positive':'negative'} relationship). `;
  }
  if (!why) why = 'Upload more columns to detect patterns and correlations automatically.';

  // --- NEXT ---
  let next = '';
  if (numericCols.length && dateCols.length) {
    next = `📈 Based on the time series in <strong>${dateCols[0]}</strong>, monitor trends for seasonality and growth patterns. `;
    next += `Consider running a forecast model on <strong>${numericCols[0]}</strong> to predict future values. `;
  } else if (numericCols.length) {
    const col = numericCols[0];
    const vals = data.map(r=>+r[col]).filter(v=>!isNaN(v));
    const mn=avg(data,col), sd=std(data,col);
    const outliers = vals.filter(v=>Math.abs(v-mn)>2*sd).length;
    next = `${outliers > 0 ? `⚠️ <strong>${outliers} potential outliers</strong> detected in ${col} (>2σ from mean). ` : ''}`;
    next += `The data distribution for <strong>${col}</strong> suggests ${sd/mn > 0.5 ? 'high variance — segment by category for deeper insight.' : 'relatively stable values across records.'} `;
  }
  if (!next) next = 'Add date columns to enable time-series forecasting and trend detection.';

  // --- ACTION ---
  let action = '';
  if (stringCols.length && numericCols.length) {
    const col = stringCols[0], numCol = numericCols[0];
    const grp = groupBy(data, col);
    const ranked = Object.entries(grp).map(([k,v])=>({k,v:sum(v,numCol)})).sort((a,b)=>b.v-a.v);
    action += `<strong>1.</strong> Focus resources on <strong>${ranked[0]?.k}</strong> — the top performer in <strong>${numCol}</strong>.<br>`;
    if (ranked.length > 1) action += `<strong>2.</strong> Investigate <strong>${ranked[ranked.length-1]?.k}</strong> — the lowest performer; identify root causes.<br>`;
  }
  action += `<strong>${action?3:1}.</strong> Review any missing values (${state.data.filter(r=>state.fields.some(f=>r[f]===null||r[f]==='')).length} rows affected) and impute or remove them.<br>`;
  action += `<strong>${action?4:2}.</strong> Export this dashboard as PDF for stakeholder reporting. Use the Export button above.`;

  document.getElementById('insight-what').innerHTML   = what;
  document.getElementById('insight-why').innerHTML    = why;
  document.getElementById('insight-next').innerHTML   = next;
  document.getElementById('insight-action').innerHTML = action;
}

function pearsonCorr(x, y) {
  const n=x.length;
  if(!n) return 0;
  const mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
  const num=x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0);
  const den=Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0)*y.reduce((s,yi)=>s+(yi-my)**2,0));
  return den?num/den:0;
}

/* ══════════════════════════════════════
   DATA PREVIEW TABLE
   ══════════════════════════════════════ */
function renderPreviewTable(searchTerm = '') {
  const rows = state.data.filter(row => {
    if (!searchTerm) return true;
    return state.fields.some(f => String(row[f]||'').toLowerCase().includes(searchTerm.toLowerCase()));
  }).slice(0, state.previewRows);

  document.getElementById('preview-rows-badge').textContent = `${rows.length} / ${state.data.length} rows`;
  document.getElementById('preview-table-head').innerHTML = state.fields.map(f=>`<th>${f}</th>`).join('');
  document.getElementById('preview-table-body').innerHTML = rows.map(row =>
    '<tr>' + state.fields.map(f=>`<td title="${row[f]??''}">${row[f]??''}</td>`).join('') + '</tr>'
  ).join('');
}

/* ══════════════════════════════════════
   RIGHT PANEL — FILTERS & AI RECS
   ══════════════════════════════════════ */
function renderPanelFilters() {
  const area = document.getElementById('panel-filters-area');
  if (!state.stringCols.length) {
    area.innerHTML = '<p class="panel-empty">No categorical columns found</p>';
    return;
  }
  area.innerHTML = state.stringCols.slice(0,4).map(col => {
    const opts = [...new Set(state.data.map(r=>r[col]))].sort().slice(0,50);
    return `<div style="margin-bottom:10px;">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">${col}</div>
      <select class="panel-select" data-filter="${col}" onchange="applyPanelFilter()">
        <option value="">All ${col}s</option>
        ${opts.map(o=>`<option>${o}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
}

function applyPanelFilter() {
  const filters = {};
  document.querySelectorAll('[data-filter]').forEach(sel => {
    if (sel.value) filters[sel.dataset.filter] = sel.value;
  });
  const filtered = state.data.filter(row =>
    Object.entries(filters).every(([k,v])=>String(row[k])===String(v))
  );
  // Re-render preview with filtered data
  const orig = state.data;
  state.data = filtered;
  renderAutoCharts();
  renderInsights();
  renderPreviewTable();
  state.data = orig;
}

function renderAIRecs() {
  const recs = [];
  const { numericCols, stringCols, dateCols, data } = state;

  if (numericCols.length > 0) recs.push(`📊 Consider a histogram for <strong>${numericCols[0]}</strong> to understand value distribution.`);
  if (stringCols.length && numericCols.length) recs.push(`🔍 Segment <strong>${numericCols[0]}</strong> by <strong>${stringCols[0]}</strong> to identify top and bottom performers.`);
  if (numericCols.length >= 2) recs.push(`📈 Run correlation analysis between <strong>${numericCols[0]}</strong> and <strong>${numericCols[1]}</strong>.`);
  if (dateCols.length) recs.push(`📅 Build a time series dashboard using the <strong>${dateCols[0]}</strong> column.`);
  recs.push('💡 Export the dashboard as PDF for executive reporting.');
  recs.push('🎯 Apply filters in the panel above to drill down into specific segments.');

  document.getElementById('ai-recs-panel').innerHTML = recs.slice(0,5).map(r =>
    `<div class="ai-rec-item">${r}</div>`
  ).join('');
}

/* ══════════════════════════════════════
   HISTORY
   ══════════════════════════════════════ */
function addHistory(item) {
  state.history.unshift(item);
  if (state.history.length > 20) state.history.pop();
  localStorage.setItem('dv_history', JSON.stringify(state.history));
}

function loadHistory() {
  try {
    state.history = JSON.parse(localStorage.getItem('dv_history') || '[]');
  } catch { state.history = []; }
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!state.history.length) {
    list.innerHTML = '<div class="empty-state">No upload history yet.</div>';
    return;
  }
  const icons = { CSV:'📂', JSON:'🗂️', PDF:'📄', PNG:'🖼️', JPG:'🖼️', JPEG:'🖼️', XLSX:'📊', TXT:'📝' };
  list.innerHTML = state.history.map((h,i) =>
    `<div class="history-item">
       <div class="history-item-icon">${icons[h.type]||'📁'}</div>
       <div>
         <div class="history-item-name">${h.name}</div>
         <div class="history-item-meta">${h.type} · ${h.size?(h.size/1024).toFixed(1)+' KB':''} · ${h.date}</div>
       </div>
     </div>`
  ).join('');
}

/* ══════════════════════════════════════
   EXPORT
   ══════════════════════════════════════ */
function exportCSV() {
  if (!state.data.length) { toast('No data to export.','warn'); return; }
  const csv = [state.fields.join(','), ...state.data.map(row => state.fields.map(f=>`"${row[f]??''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = (state.fileName.replace(/\.[^.]+$/,'') || 'data') + '_export.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exported!','success');
}

function exportPDFReport() {
  const orig = document.title;
  document.title = 'AI-DataViz-Dashboard_' + new Date().toISOString().slice(0,10);
  Object.values(state.chartInstances).forEach(c => { if(c) { c.resize(); c.update('none'); } });
  setTimeout(() => { window.print(); setTimeout(()=>{ document.title=orig; },1000); }, 300);
  toast('Opening print dialog for PDF export…','info');
}

function exportPNG() {
  const canvas = document.querySelector('.auto-chart-wrap canvas');
  if (!canvas) { toast('No chart available to export.','warn'); return; }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'chart.png';
  a.click();
  toast('First chart exported as PNG!','success');
}

function exportHTML() {
  const html = `<!DOCTYPE html><html><head><title>Dashboard Export</title></head><body>
  <h1>AI Data Visualization Dashboard Export</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <p>Dataset: ${state.fileName} — ${state.data.length} rows × ${state.fields.length} columns</p>
  <p>Open the original dashboard for interactive charts.</p>
  </body></html>`;
  const blob = new Blob([html],{type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dashboard_export.html';
  a.click();
  toast('HTML summary exported!','success');
}

/* ══════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════ */
function loadSettings() {
  const s = JSON.parse(localStorage.getItem('dv_settings')||'{}');
  if (s.previewRows) state.previewRows = s.previewRows;
  if (s.defaultChart) state.defaultChart = s.defaultChart;
  if (s.palette) activePalette = s.palette;
}
function saveSettings() {
  localStorage.setItem('dv_settings', JSON.stringify({
    previewRows: state.previewRows,
    defaultChart: state.defaultChart,
    palette: activePalette,
  }));
}

/* ══════════════════════════════════════
   PALETTE SWITCHING
   ══════════════════════════════════════ */
function initPaletteSelector() {
  document.querySelectorAll('.palette-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.palette-dot').forEach(d=>d.classList.remove('active'));
      dot.classList.add('active');
      activePalette = dot.dataset.palette;
      saveSettings();
      if (state.data.length) { renderAutoCharts(); }
      toast(`Switched to "${activePalette}" palette`, 'info', 2000);
    });
  });
}

/* ══════════════════════════════════════
   CHART TYPE OVERRIDE (right panel)
   ══════════════════════════════════════ */
function initChartTypeSelector() {
  document.getElementById('panel-chart-type').addEventListener('change', e => {
    if (e.target.value !== 'auto') {
      toast(`Chart type set to ${e.target.value}. Re-analyzing…`,'info',2000);
      if (state.data.length) renderAutoCharts();
    }
  });
}

/* ══════════════════════════════════════
   SEARCH IN TABLE
   ══════════════════════════════════════ */
function initTableSearch() {
  const input = document.getElementById('table-search');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => renderPreviewTable(input.value), 300);
  });
}

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted preferences
  loadTheme();
  loadSettings();
  loadHistory();
  applyChartTheme();

  // Init modules
  initSidebar();
  initRightPanel();
  initUpload();
  initPaletteSelector();
  initChartTypeSelector();
  initTableSearch();

  // Theme toggle buttons
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('settings-theme-toggle').addEventListener('change', function() {
    applyTheme(this.checked ? 'light' : 'dark');
  });

  // PDF controls
  document.getElementById('pdf-prev').addEventListener('click', () => {
    if (state.pdfPage > 1) renderPDFPage(--state.pdfPage);
  });
  document.getElementById('pdf-next').addEventListener('click', () => {
    if (state.pdfDoc && state.pdfPage < state.pdfDoc.numPages) renderPDFPage(++state.pdfPage);
  });
  document.getElementById('pdf-zoom').addEventListener('change', e => {
    state.pdfZoom = +e.target.value;
    renderPDFPage(state.pdfPage);
  });
  document.getElementById('pdf-close-btn').addEventListener('click', () => {
    document.getElementById('pdf-viewer-section').style.display = 'none';
  });

  // Export buttons (banner)
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDFReport);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Export buttons (right panel)
  document.getElementById('exp-pdf').addEventListener('click', exportPDFReport);
  document.getElementById('exp-csv').addEventListener('click', exportCSV);
  document.getElementById('exp-png').addEventListener('click', exportPNG);
  document.getElementById('exp-html').addEventListener('click', exportHTML);

  // History clear
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    state.history = [];
    localStorage.removeItem('dv_history');
    renderHistory();
    toast('History cleared.','info');
  });

  // Settings selects
  document.getElementById('settings-preview-rows').addEventListener('change', e => {
    state.previewRows = +e.target.value;
    saveSettings();
    if (state.data.length) renderPreviewTable();
  });
  document.getElementById('settings-default-chart').addEventListener('change', e => {
    state.defaultChart = e.target.value;
    saveSettings();
  });

  // Welcome — default section
  setActiveNav('upload');

  toast('👋 Welcome! Drop any file to start visualizing.', 'info', 5000);
});
