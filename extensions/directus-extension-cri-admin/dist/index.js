// ─── Constantes partagées backend ────────────────────────────────────────────
const OFFICIAL_PROVINCES = ['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan'];
const OFFICIAL_TYPES = new Set(['grand_projet', 'tpme', 'porteur_projet']);
const OFFICIAL_TYPES_MAP = {
  'grand projet': 'grand_projet',
  'grand_projet': 'grand_projet',
  'tpme': 'tpme',
  'porteur de projet': 'porteur_projet',
  'porteur_projet': 'porteur_projet'
};
const OFFICIAL_SECTEURS = {
  'agriculture': 'agriculture',
  'industrie': 'industrie',
  'energie': 'énergie',
  'environnement': 'environnement',
  'tourisme': 'tourisme',
  'service': 'service',
  'services': 'service'
};
const PROJECT_FIELDS = new Set([
  'code_projet', 'titre', 'secteur', 'filiere', 'description',
  'type_projet', 'provinces', 'investissement_mad', 'nombre_postes',
]);

function requireAdmin(req, res) {
  if (req.accountability?.admin === true) return true;
  res.status(403).json({ error: 'ADMIN_REQUIRED', message: 'Accès administrateur requis.' });
  return false;
}
function arr(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter(Boolean) : []; } catch { return []; }
  }
  return [];
}
function uniqueCount(rows, key) { return new Set(rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined)).size; }
function groupRows(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    for (const key of [].concat(keyFn(row) ?? []).filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }
  return groups;
}
function getMonthKey(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function getYearKey(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}`;
}
function statsForGroups(groups) {
  return [...groups.entries()].map(([name, rows]) => ({
    name, demandes: rows.length,
    investisseurs_distincts: uniqueCount(rows, 'investisseur'),
    validees: rows.filter((r) => ['validee', 'telechargee'].includes(r.statut)).length,
    refusees: rows.filter((r) => r.statut === 'refusee').length,
    telechargees: rows.filter((r) => r.statut === 'telechargee' || r.date_telechargement).length,
  })).sort((a, b) => b.demandes - a.demandes || b.investisseurs_distincts - a.investisseurs_distincts || String(a.name).localeCompare(String(b.name)));
}
function safeProject(project) {
  const out = {};
  for (const field of PROJECT_FIELDS) if (field in project) out[field] = project[field];
  out.provinces = arr(out.provinces).filter((p) => OFFICIAL_PROVINCES.includes(p));
  if (out.secteur) {
    const n = String(out.secteur).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    out.secteur = OFFICIAL_SECTEURS[n] || null;
  }
  if (out.type_projet) {
    const n = String(out.type_projet).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    out.type_projet = OFFICIAL_TYPES_MAP[n] || (OFFICIAL_TYPES.has(out.type_projet) ? out.type_projet : null);
  }
  out.status_publication = 'brouillon';
  return out;
}
function missing(project) {
  return ['titre', 'secteur', 'type_projet', 'provinces', 'investissement_mad', 'nombre_postes'].filter((field) =>
    field === 'provinces' ? !arr(project.provinces).length : project[field] === null || project[field] === undefined || project[field] === ''
  );
}

const ADMIN_HTML = String.raw`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Outils CRI</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a;line-height:1.5}
.wrap{max-width:1200px;margin:auto;padding:20px 24px}
.header-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
h1{color:#0f2744;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.03)}
.card-header{margin-bottom:14px}
.card-header h2{margin:0;font-size:16px;font-weight:700;color:#0f2744}
.tabs{display:flex;gap:6px;margin:16px 0;padding:4px;background:#e2e8f0;border-radius:8px;width:fit-content}
.tab-btn{padding:8px 18px;border:none;border-radius:6px;background:transparent;cursor:pointer;font-size:13px;font-weight:600;color:#475569;transition:all .15s}
.tab-btn.active{background:#fff;color:#0f2744;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.tab-btn:hover:not(.active){color:#0f2744;background:rgba(255,255,255,.5)}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s}
.btn:hover{background:#f1f5f9;border-color:#94a3b8}
.btn:disabled{opacity:.4;cursor:not-allowed;pointer-events:none}
.btn.primary{background:#0f2744;color:#fff;border-color:#0f2744}
.btn.primary:hover{background:#1e3a5f;border-color:#1e3a5f}

/* Filtres */
.filters-card{padding:14px 20px}
.filters-grid{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(120px,.8fr) minmax(140px,1fr) minmax(140px,1fr) minmax(160px,1.15fr) minmax(160px,1.15fr) auto;gap:10px;align-items:flex-end}
@media(max-width:900px){.filters-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}}
.filter-item{display:flex;flex-direction:column;gap:5px}
.filter-item label{margin:0;font-size:12px;font-weight:600;color:#334155;white-space:nowrap}
.filter-item input,.filter-item select{width:100%;height:34px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;color:#0f172a;min-width:0}
.filter-item input:focus,.filter-item select:focus{outline:2px solid #0284c7;border-color:#0284c7}
.filter-btn-item{display:flex;align-items:flex-end}
.btn-filter{width:auto;min-width:90px;height:34px;padding:0 16px;margin:0;font-weight:600;white-space:nowrap}

/* KPIs */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:16px 0}
.kpi{padding:16px;background:#fff;border:1px solid #e2e8f0;border-top:3px solid #0f2744;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.03);transition:transform .15s ease,box-shadow .15s ease}
.kpi:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(0,0,0,.06)}
.kpi b{font-size:28px;line-height:1.2;display:block;color:#0f2744;font-weight:700}
.kpi span{font-size:12px;color:#475569;font-weight:600;display:block;margin-top:6px;letter-spacing:.02em}

/* Tableaux */
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:540px}
th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left}
th{background:#f8fafc;font-weight:600;color:#0f2744;white-space:nowrap;border-top:none}
th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:none}
tr:hover td{background:#f8fafc}
.table-note{font-size:12px;color:#64748b;margin-bottom:10px;font-style:italic}
.empty-state{color:#64748b;font-size:13px;margin:10px 0;font-style:italic}

/* Alertes et états */
.hidden{display:none !important}
.warn{background:#fffbeb;padding:12px 16px;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;margin-bottom:14px;color:#92400e}
.ok{background:#f0fdf4;padding:12px;border-radius:6px;border-left:4px solid #22c55e;color:#166534}
.err{background:#fef2f2;padding:12px;border-radius:6px;border-left:4px solid #ef4444;color:#991b1b}
.scroll{overflow:auto;max-height:520px}
.mapping-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #f1f5f9;padding:8px 0;align-items:center}
pre{background:#f1f5f9;padding:12px;border-radius:6px;overflow:auto;font-size:12px;max-height:300px;color:#0f172a}
/* CRI Import UI enhancements */
.import-summary{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.import-stat{background:#f1f5f9;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1}
.issues-table{width:100%;border-collapse:collapse;margin-top:8px}
.issues-table th,.issues-table td{border:1px solid #e2e8f0;padding:6px 8px}
.issues-table th{background:#f8fafc;color:#0f2744}
.issues-table td.num{text-align:right}
.import-result .ok{background:#f0fdf4;border-left:4px solid #22c55e}
.modal-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000}
.modal-dialog{background:#fff;padding:20px;border-radius:8px;max-width:90%;box-shadow:0 2px 8px rgba(0,0,0,0.2)}
.modal-dialog h2{margin-top:0;color:#0f2744}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
</style>
</head>
<body>
<div class="wrap">
  <div class="header-bar">
    <h1>Tableau de bord et outils CRI</h1>
  </div>
  <div id="cri-auth-error" class="hidden"></div>
  <div id="cri-content">
    <div class="tabs">
      <button class="tab-btn active" id="cri-btn-dash">Tableau de bord CRI</button>
      <button class="tab-btn" id="cri-btn-import">Import Excel projets</button>
    </div>
    <section id="cri-dash">
      <div class="card filters-card">
        <div class="card-header">
          <h2>Période et filtres</h2>
        </div>
        <div class="filters-grid">
          <div class="filter-item">
            <label for="cri-from">Du</label>
            <input id="cri-from" type="date">
          </div>
          <div class="filter-item">
            <label for="cri-to">Au</label>
            <input id="cri-to" type="date">
          </div>
          <div class="filter-item">
            <label for="cri-province">Province</label>
            <select id="cri-province"><option value="">Toutes les provinces</option></select>
          </div>
          <div class="filter-item">
            <label for="cri-secteur">Secteur</label>
            <select id="cri-secteur"><option value="">Tous les secteurs</option></select>
          </div>
          <div class="filter-item">
            <label for="cri-categorie">Catégorie de projet</label>
            <select id="cri-categorie"><option value="">Toutes les catégories</option></select>
          </div>
          <div class="filter-item">
            <label for="cri-projet">Projet</label>
            <select id="cri-projet"><option value="">Tous les projets</option></select>
          </div>
          <div class="filter-item filter-btn-item">
            <button class="btn primary btn-filter" id="cri-btn-analytics">Actualiser</button>
          </div>
        </div>
      </div>
      <div id="cri-analytics"></div>
    </section>
    <section id="cri-imp" class="hidden">
      <div class="card">
        <div class="card-header"><h2>1. Charger le classeur Excel</h2></div>
        <input id="cri-xlsx" type="file" accept=".xlsx">
        <div style="margin-top:12px" class="filter-item">
          <label for="cri-sheet">Feuille</label>
          <select id="cri-sheet"></select>
        </div>
        <button class="btn" id="cri-btn-sheet" style="margin-top:10px">Lire la feuille</button>
      </div>
      <div id="cri-mapping" class="card hidden"></div>
      <div id="cri-preview" class="card hidden"></div>
    </section>
  </div>
</div>
<script src="/cri-admin/app.js"></script>
</body>
</html>`;

export default {
  id: 'cri-admin',
  handler: (router, { database, logger, services, getSchema }) => {
    const { ItemsService } = services;

    router.get('/', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(ADMIN_HTML));

    router.get('/app.js', (_req, res) => {
      const js = `
(function () {
  'use strict';

  function $id(id) { return document.getElementById(id); }

  var cachedToken = null;

  async function getAccessToken() {
    if (cachedToken) return cachedToken;

    try {
      var r = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ mode: 'json' })
      });
      if (r.ok) {
        var res = await r.json();
        if (res && res.data && res.data.access_token) {
          cachedToken = res.data.access_token;
          return cachedToken;
        }
      }
    } catch (e) {
      console.warn('[CRI] Refresh cookie non disponible:', e);
    }

    return null;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  function showAuthError(msg) {
    var errDiv = $id('cri-auth-error');
    var statusDiv = $id('cri-auth-status');
    var contentDiv = $id('cri-content');
    if (errDiv) {
      errDiv.classList.remove('hidden');
      errDiv.innerHTML = '<div class="err" style="margin-bottom:16px;font-size:14px;">' +
        '<strong>Accès refusé :</strong> ' + esc(msg || 'Veuillez vous connecter à l’interface d’administration Directus.') +
        '<div style="margin-top:12px"><a href="/admin/login" class="btn primary" style="text-decoration:none;display:inline-block">Se connecter à Directus (/admin)</a></div>' +
        '</div>';
    }
    if (statusDiv) statusDiv.classList.add('hidden');
    if (contentDiv) contentDiv.classList.add('hidden');
  }

  async function api(path, opts) {
    opts = opts || {};
    var tok = await getAccessToken();
    var headers = Object.assign({}, opts.headers || {});
    if (tok) {
      headers['Authorization'] = 'Bearer ' + tok;
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    var r = await fetch('/cri-admin' + path, Object.assign({}, opts, {
      credentials: 'same-origin',
      headers: headers
    }));
    var b = await r.json();
    if (!r.ok) {
      if (r.status === 401 || r.status === 403 || (b && b.error === 'ADMIN_REQUIRED')) {
        cachedToken = null;
        showAuthError(b.message || 'Accès administrateur requis.');
      }
      throw new Error(b.message || JSON.stringify(b));
    }
    return b.data;
  }

  function formatMonth(val) {
    if (!val) return '—';
    var str = String(val).trim();
    var match = str.match(/^(\d{4})-(\d{2})/);
    if (match) {
      var year = parseInt(match[1], 10);
      var month = parseInt(match[2], 10) - 1;
      try {
        var d = new Date(Date.UTC(year, month, 15));
        var formatted = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
      } catch (e) {
        return str;
      }
    }
    return str;
  }

  var COL_LABELS = {
    'mois': 'Mois',
    'annee': 'Année',
    'projet': 'Projet',
    'secteur': 'Secteur',
    'provinces': 'Province(s)',
    'province': 'Province',
    'demandes': 'Demandes',
    'investisseurs_distincts': 'Investisseurs distincts',
    'validees': 'Validées',
    'refusees': 'Refusées',
    'telechargees': 'Téléchargements',
    'titre': 'Titre',
    'code_projet': 'Code projet',
    'type_projet': 'Type de projet',
    'champs_manquants': 'Champs manquants',
  };

  var NUMERIC_COLS = new Set([
    'demandes',
    'investisseurs_distincts',
    'validees',
    'refusees',
    'telechargees'
  ]);

  function formatCell(colKey, val) {
    if (val == null || val === '') return '<span style="color:#94a3b8;">—</span>';
    if (colKey === 'mois') return esc(formatMonth(val));
    if (colKey === 'annee') return esc(val);
    if (Array.isArray(val)) return esc(val.join(', ') || '—');
    if (colKey === 'secteur') {
      var s = String(val);
      return esc(s.charAt(0).toUpperCase() + s.slice(1));
    }
    return esc(val);
  }

  function mkTable(title, rows, opts) {
    opts = opts || {};
    var note = opts.note ? '<div class="table-note">' + esc(opts.note) + '</div>' : '';
    if (!rows || !rows.length) {
      var emptyHtml = '<p class="empty-state">Aucune donnée disponible pour cette sélection.</p>' + note;
      return opts.noCard ? emptyHtml : '<div class="card"><div class="card-header"><h2>' + esc(title) + '</h2></div>' + emptyHtml + '</div>';
    }

    var hiddenKeys = new Set(opts.hiddenKeys || ['projet_id']);
    var keys = opts.columns || Object.keys(rows[0]).filter(function(k) { return !hiddenKeys.has(k); });
    var headerOverride = opts.headerLabels || {};

    var tableHtml = note +
      '<div class="table-wrap"><table><thead><tr>' +
      keys.map(function(k) {
        var label = headerOverride[k] || COL_LABELS[k] || esc(k.replace(/_/g, ' '));
        var isNum = NUMERIC_COLS.has(k);
        return '<th class="' + (isNum ? 'num' : '') + '">' + esc(label) + '</th>';
      }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function(r) {
        return '<tr>' + keys.map(function(k) {
          var isNum = NUMERIC_COLS.has(k);
          return '<td class="' + (isNum ? 'num' : '') + '">' + formatCell(k, r[k]) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';

    return opts.noCard ? tableHtml : '<div class="card"><div class="card-header"><h2>' + esc(title) + '</h2></div>' + tableHtml + '</div>';
  }

  // ---------- UI helper functions ----------
  var lastDryRunReport = null;

  function renderImportSummary(report) {
    return '<div class="import-summary">' +
      '<div class="import-stat"><strong>Lignes analysées</strong> ' + esc(report.total) + '</div>' +
      '<div class="import-stat"><strong>Lignes complètes</strong> ' + esc(report.complete) + '</div>' +
      '<div class="import-stat"><strong>À vérifier</strong> ' + esc(report.incomplete) + '</div>' +
      '<div class="import-stat"><strong>Doublons</strong> ' + esc(report.duplicates) + '</div>' +
    '</div>';
  }

  function renderMissingFields(missing) {
    var keys = Object.keys(missing);
    if (!keys.length) return '';
    var html = '<div class="card"><div class="card-header"><h2>Champs à compléter</h2></div><ul>';
    var labelMap = { secteur: 'Secteur', type_projet: 'Type de projet', investissement_mad: 'Investissement', nombre_postes: 'Nombre de postes' };
    keys.forEach(function(k){
      var label = labelMap[k] || k;
      html += '<li>' + esc(label) + ' ' + esc(missing[k]) + ' lignes</li>';
    });
    html += '</ul></div>';
    return html;
  }

  function renderDuplicates(rows, count) {
    if (!count) return '';
    var html = '<div class="card"><div class="card-header"><h2>Doublons détectés</h2></div>' +
      '<p>' + esc(count) + ' doublon(s) détecté(s) — ils seront ignorés lors de l’import.</p>';
    if (rows && rows.length) {
      html += '<div class="table-wrap"><table><thead><tr><th class="num">Ligne</th><th>Code projet</th></tr></thead><tbody>';
      rows.forEach(function(r) {
        html += '<tr><td class="num">' + esc(r.line) + '</td><td>' + esc(r.code_projet || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  }

  function renderIssues(errors) {
    if (!errors || !errors.length) return '';
    var fieldErrors = errors.filter(function(e){ return e.field; });
    var blockErrors = errors.filter(function(e){ return !e.field; });
    var html = '';
    if (fieldErrors.length) {
      html += '<div class="card"><div class="card-header"><h2>Anomalies de données</h2></div>' +
        '<table class="issues-table"><thead><tr><th>Ligne</th><th>Champ</th><th>Valeur</th><th>Problème</th></tr></thead><tbody>';
      var labelMap = { secteur: 'Secteur', type_projet: 'Type de projet', investissement_mad: 'Investissement', nombre_postes: 'Nombre de postes' };
      fieldErrors.forEach(function(e){
        var champ = labelMap[e.field] || e.field;
        html += '<tr><td class="num">' + esc(e.line) + '</td><td>' + esc(champ) + '</td><td>' + esc(e.value || '') + '</td><td>' + esc(e.message) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    if (blockErrors.length) {
      html += '<div class="card"><div class="card-header"><h2>Erreurs bloquantes</h2></div>' +
        '<table class="issues-table"><thead><tr><th>Ligne</th><th>Problème</th></tr></thead><tbody>';
      blockErrors.forEach(function(e){
        html += '<tr><td class="num">' + esc(e.line) + '</td><td>' + esc(e.error) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }



  function renderApplyResult(report) {
    var html = '<div class="card ok"><div class="card-header"><h2>Import terminé</h2></div>' +
      '<p>Projets créés : ' + esc(report.imported) + '</p>' +
      '<p>Doublons ignorés : ' + esc(report.duplicates) + '</p>' +
      renderIssues(report.errors) +
    '</div>';
    return html;
  }

  // ---------- Modal handling ----------
  function openConfirmModal() {
    if (!lastDryRunReport) return;
    // Remove any existing modal to avoid stale data
    var old = document.getElementById('import-modal');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.innerHTML = '<div class="modal-backdrop"><div class="modal-dialog"><h2>Confirmer l’import</h2>' +
      '<p>Les projets seront importés avec le statut brouillon. Les doublons détectés seront ignorés.</p>' +
      '<p>Lignes analysées : ' + esc(lastDryRunReport.total) + '</p>' +
      '<p>Doublons détectés : ' + esc(lastDryRunReport.duplicates) + '</p>' +
      '<p>Lignes à vérifier : ' + esc(lastDryRunReport.incomplete) + '</p>' +
      '<div class="modal-actions"><button class="btn" id="modal-cancel">Annuler</button>' +
      '<button class="btn primary" id="modal-confirm">Importer en brouillon</button></div>' +
      '</div></div>';
    document.body.appendChild(modal);
    $id('modal-cancel').addEventListener('click', hideModal);
    $id('modal-confirm').addEventListener('click', applyImport);
  }

  function hideModal() {
    var modal = $id('import-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ---------- CSS extensions (injected into ADMIN_HTML) ----------


  function fillSel(id, items, lbl, val, allLabel) {
    lbl = lbl || 'name'; val = val || 'name';
    allLabel = allLabel || (id === 'cri-province' ? 'Toutes les provinces' : (id === 'cri-secteur' ? 'Tous les secteurs' : 'Tous les projets'));
    var s = $id(id); if (!s) return;
    var cur = s.value;
    s.innerHTML = '<option value="">' + esc(allLabel) + '</option>' +
      items.map(function(x){return '<option value="'+esc(x[val])+'">'+esc(x[lbl])+'</option>';}).join('');
    s.value = cur;
  }

  // ── Onglets ────────────────────────────────────────────────────────────────
  function showTab(id) {
    var dash = $id('cri-dash'), imp = $id('cri-imp');
    var bDash = $id('cri-btn-dash'), bImp = $id('cri-btn-import');
    if (!dash || !imp) { console.error('[CRI] Éléments onglet introuvables'); return; }
    if (id === 'dash') {
      dash.classList.remove('hidden'); imp.classList.add('hidden');
      if (bDash) bDash.classList.add('active');
      if (bImp) bImp.classList.remove('active');
    } else {
      imp.classList.remove('hidden'); dash.classList.add('hidden');
      if (bImp) bImp.classList.add('active');
      if (bDash) bDash.classList.remove('active');
    }
    console.log('[CRI] Tab =>', id);
  }

  var KPI_CONFIG = [
    { key: 'demandes_bp', label: 'Demandes de Business Plan' },
    { key: 'investisseurs_distincts', label: 'Investisseurs distincts' },
    { key: 'demandes_validees', label: 'Demandes validées' },
    { key: 'demandes_refusees', label: 'Demandes refusées' },
    { key: 'bp_telecharges', label: 'Business Plans téléchargés' },
  ];

  // ── Analytics ──────────────────────────────────────────────────────────────
  var currentAnalyticsData = null;
  var projetsLimit = '5';
  var detailPage = 1;
  var DETAIL_PAGE_SIZE = 20;

  function renderTopProjets() {
    var container = $id('cri-projets-table-container');
    if (!container || !currentAnalyticsData) return;
    var rows = currentAnalyticsData.projets || [];
    var limit = projetsLimit === 'all' ? rows.length : parseInt(projetsLimit, 10);
    if (isNaN(limit)) limit = 5;
    var sliced = rows.slice(0, limit);
    container.innerHTML = mkTable('', sliced, { hiddenKeys: ['projet_id'], noCard: true });
  }

  function populateTopProjetsSelect(totalCount) {
    var sel = $id('cri-top-projets');
    if (!sel) return;
    var options = [5];
    for (var i = 10; i <= totalCount; i += 5) {
      options.push(i);
    }
    var html = options.map(function(opt) {
      return '<option value="' + opt + '">' + opt + '</option>';
    }).join('');
    html += '<option value="all">Tous (' + totalCount + ')</option>';
    sel.innerHTML = html;
    sel.value = projetsLimit;
    if (!sel.value) { sel.value = '5'; projetsLimit = '5'; }
  }

  function renderDetail() {
    var tableContainer = $id('cri-detail-table-container');
    var navContainer = $id('cri-detail-pagination');
    if (!tableContainer || !currentAnalyticsData) return;
    var rows = currentAnalyticsData.detail || [];
    var totalPages = Math.ceil(rows.length / DETAIL_PAGE_SIZE) || 1;
    if (detailPage > totalPages) detailPage = totalPages;
    if (detailPage < 1) detailPage = 1;

    var start = (detailPage - 1) * DETAIL_PAGE_SIZE;
    var end = start + DETAIL_PAGE_SIZE;
    var sliced = rows.slice(start, end);

    tableContainer.innerHTML = mkTable('', sliced, { hiddenKeys: ['projet_id'], noCard: true });

    if (rows.length <= DETAIL_PAGE_SIZE) {
      if (navContainer) navContainer.innerHTML = '';
      return;
    }

    if (navContainer) {
      var navHtml = '<button class="btn secondary" id="cri-pg-prev" style="height:30px;padding:0 12px;font-size:12px;" ' + (detailPage <= 1 ? 'disabled' : '') + '>Précédent</button>';
      navHtml += '<span style="font-weight:600;color:#334155;">Page ' + detailPage + ' sur ' + totalPages + ' (' + rows.length + ' projets)</span>';
      navHtml += '<button class="btn secondary" id="cri-pg-next" style="height:30px;padding:0 12px;font-size:12px;" ' + (detailPage >= totalPages ? 'disabled' : '') + '>Suivant</button>';
      navContainer.innerHTML = navHtml;

      var btnPrev = $id('cri-pg-prev');
      var btnNext = $id('cri-pg-next');
      if (btnPrev) btnPrev.onclick = function() { if (detailPage > 1) { detailPage--; renderDetail(); } };
      if (btnNext) btnNext.onclick = function() { if (detailPage < totalPages) { detailPage++; renderDetail(); } };
    }
  }

  async function loadAnalytics() {
    var div = $id('cri-analytics');
    if (div) div.innerHTML = '<p>Chargement...</p>';
    var q = new URLSearchParams();
    [['from','cri-from'],['to','cri-to'],['province','cri-province'],['secteur','cri-secteur'],['type','cri-categorie'],['projet','cri-projet'],['evo_from','cri-evo-from'],['evo_to','cri-evo-to']].forEach(function(pair){
      var el = $id(pair[1]);
      var v = el ? el.value : '';
      if (v) q.set(pair[0], v);
    });
    try {
      var d = await api('/analytics?' + q.toString());
      currentAnalyticsData = d;
      detailPage = 1;

      fillSel('cri-province', d.facets.provinces.map(function(n){return {name:n};}), 'name', 'name', 'Toutes les provinces');
      fillSel('cri-secteur', d.facets.secteurs.map(function(n){return {name:n};}), 'name', 'name', 'Tous les secteurs');
      fillSel('cri-categorie', d.facets.categories, 'label', 'value', 'Toutes les cat\u00e9gories');
      fillSel('cri-projet', d.facets.projets, 'titre', 'id', 'Tous les projets');

      var evoTitle = d.timeline_title || 'Évolution mensuelle';

      if (div) {
        div.innerHTML =
          '<div class="grid">' +
          KPI_CONFIG.map(function(kpi) {
            var val = d.kpis && d.kpis[kpi.key] != null ? d.kpis[kpi.key] : 0;
            return '<div class="kpi"><b>' + esc(val) + '</b><span>' + esc(kpi.label) + '</span></div>';
          }).join('') +
          '</div>' +
          '<div class="card">' +
            '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
              '<h2 style="margin:0;">Projets les plus demandés</h2>' +
              '<div style="display:flex;align-items:center;gap:6px;font-size:13px;">' +
                '<label for="cri-top-projets" style="font-weight:600;color:#334155;margin:0;">Afficher :</label>' +
                '<select id="cri-top-projets" style="height:30px;padding:2px 8px;font-size:13px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;"></select>' +
              '</div>' +
            '</div>' +
            '<div id="cri-projets-table-container"></div>' +
          '</div>' +
          mkTable('Secteurs les plus sollicités', d.secteurs, { headerLabels: { name: 'Secteur' } }) +
          mkTable('Provinces les plus sollicitées', d.provinces, { headerLabels: { name: 'Province' }, note: d.note_provinces }) +
          '<div class="card">' +
            '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
              '<h2 style="margin:0;">' + esc(evoTitle) + '</h2>' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:12px;">' +
                '<label style="font-weight:600;color:#334155;margin:0;">Du</label>' +
                '<input id="cri-evo-from" type="date" value="' + esc(q.get('evo_from') || '') + '" style="height:30px;padding:2px 6px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;">' +
                '<label style="font-weight:600;color:#334155;margin:0;">Au</label>' +
                '<input id="cri-evo-to" type="date" value="' + esc(q.get('evo_to') || '') + '" style="height:30px;padding:2px 6px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;">' +
                '<button class="btn secondary" id="cri-btn-evo-refresh" style="height:30px;padding:0 12px;font-size:12px;">Appliquer</button>' +
              '</div>' +
            '</div>' +
            mkTable('', d.timeline, { noCard: true }) +
          '</div>' +
          '<div class="card">' +
            '<div class="card-header" style="margin-bottom:10px;">' +
              '<h2 style="margin:0;">Détail par projet</h2>' +
            '</div>' +
            '<div id="cri-detail-table-container"></div>' +
            '<div id="cri-detail-pagination" style="display:flex;justify-content:center;align-items:center;gap:12px;padding:12px 0 4px 0;font-size:13px;"></div>' +
          '</div>';

        populateTopProjetsSelect((d.projets || []).length);
        renderTopProjets();
        renderDetail();

        var selTop = $id('cri-top-projets');
        if (selTop) {
          selTop.onchange = function() {
            projetsLimit = this.value;
            renderTopProjets();
          };
        }

        var btnEvo = $id('cri-btn-evo-refresh');
        if (btnEvo) {
          btnEvo.onclick = function() {
            loadAnalytics();
          };
        }
      }
    } catch(e) {
      if (div) div.innerHTML = '<div class="err">Erreur : '+esc(e.message)+'</div>';
    }
  }

  // ── Lecteur XLSX ───────────────────────────────────────────────────────────
  var zipEntries = null, workbookInfo = null, currentRows = [];
  function u16(dv,o){return dv.getUint16(o,true);}
  function u32(dv,o){return dv.getUint32(o,true);}

  async function unzip(file) {
    var ab = await file.arrayBuffer(), dv = new DataView(ab), eocd = -1;
    for (var i = dv.byteLength-22; i >= Math.max(0,dv.byteLength-65557); i--) {
      if (dv.getUint32(i,true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP invalide');
    var n = u16(dv,eocd+10), off = u32(dv,eocd+16), out = {};
    for (var j = 0; j < n; j++) {
      if (u32(dv,off) !== 0x02014b50) break;
      var method=u16(dv,off+10), cs=u32(dv,off+20), ns=u16(dv,off+28), xs=u16(dv,off+30), csz=u16(dv,off+32);
      var lo=u32(dv,off+42), name=new TextDecoder().decode(new Uint8Array(ab,off+46,ns));
      var ln=u16(dv,lo+26), lx=u16(dv,lo+28), start=lo+30+ln+lx;
      var bytes = new Uint8Array(ab,start,cs);
      if (method===8) {
        var st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(st).arrayBuffer());
      } else if (method!==0) throw new Error('Compression non support\\u00e9e');
      out[name]=bytes; off+=46+ns+xs+csz;
    }
    return out;
  }

  function txt(name) {
    if (!zipEntries||!zipEntries[name]) throw new Error('Entrée manquante: '+name);
    return new TextDecoder().decode(zipEntries[name]);
  }
  function xml(s) { return new DOMParser().parseFromString(s,'application/xml'); }

  async function loadWorkbook() {
    var fi = $id('cri-xlsx'), f = fi && fi.files[0]; if (!f) return;
    zipEntries = await unzip(f);
    var wb = xml(txt('xl/workbook.xml')), rels = xml(txt('xl/_rels/workbook.xml.rels')), rm = {};
    rels.querySelectorAll('Relationship').forEach(function(r){ rm[r.getAttribute('Id')]=r.getAttribute('Target'); });
    var sheets = Array.from(wb.querySelectorAll('sheet')).map(function(s){
      var t = rm[s.getAttribute('r:id')]||'';
      var bs = String.fromCharCode(92);
      var clean = t;
      if (clean.charAt(0)===bs || clean.charAt(0)==='/') clean = clean.substring(1);
      if (clean.substring(0,3)==='xl'+bs || clean.substring(0,3)==='xl/') clean = clean.substring(3);
      if (clean.charAt(0)===bs || clean.charAt(0)==='/') clean = clean.substring(1);
      return {name:s.getAttribute('name'), path:'xl/'+clean};
    });
    workbookInfo = {sheets:sheets};
    var ss = $id('cri-sheet');
    if (ss) ss.innerHTML = sheets.map(function(s,i){return '<option value="'+i+'">'+esc(s.name)+'</option>';}).join('');
    console.log('[CRI] Workbook:', sheets.length, 'feuilles');
  }

  function colNum(s) { var n=0; for(var i=0;i<s.length;i++) n=n*26+s.charCodeAt(i)-64; return n; }
  function norm(s) {
    return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  var SUGG = {'n projet':'code_projet','intitule du projet':'titre','titre':'titre','secteur':'secteur','filiere':'filiere',
    'description':'description','localite':'provinces_source','categorie':'type_projet','type':'type_projet',
    'montant de l investissement':'investissement_mad','investissement':'investissement_mad',
    'nombre d emplois':'nombre_postes','emplois':'nombre_postes',
    'guelmim':'province:Guelmim','tan tan':'province:Tan-Tan','sidi ifni':'province:Sidi Ifni','assa zag':'province:Assa-Zag'};
  function suggest(h) { return SUGG[norm(h)]||'ignore'; }

  var OPTS = [['ignore','Ignorer'],['code_projet','Code projet'],['titre','Titre'],['secteur','Secteur'],
    ['filiere','Fili\\u00e8re'],['description','Description'],['type_projet','Type projet'],
    ['provinces_source','Provinces / Localit\\u00e9'],['investissement_mad','Montant investissement (MAD)'],
    ['nombre_postes','Nombre emplois'],
    ['province:Guelmim','Marqueur province : Guelmim'],['province:Tan-Tan','Marqueur province : Tan-Tan'],
    ['province:Sidi Ifni','Marqueur province : Sidi Ifni'],['province:Assa-Zag','Marqueur province : Assa-Zag']];

  function readSelectedSheet() {
    if (!workbookInfo) { alert('Chargez d’abord un fichier Excel.'); return; }
    var ss = $id('cri-sheet');
    var info = workbookInfo.sheets[Number(ss ? ss.value : 0)];
    if (!info) { alert('Feuille introuvable.'); return; }
    var shared = [];
    if (zipEntries['xl/sharedStrings.xml']) {
      shared = Array.from(xml(txt('xl/sharedStrings.xml')).querySelectorAll('si')).map(function(si){
        return Array.from(si.querySelectorAll('t')).map(function(t){return t.textContent;}).join('');
      });
    }
    var doc = xml(txt(info.path)), rows = [];
    doc.querySelectorAll('sheetData row').forEach(function(r){
      var obj={};
      r.querySelectorAll('c').forEach(function(c){
        var ref=c.getAttribute('r'), col=ref.replace(/\\d+/g,''), t=c.getAttribute('t');
        var vEl=c.querySelector('v'), isEl=c.querySelector('is t');
        var v=vEl?vEl.textContent:(isEl?isEl.textContent:'');
        if(t==='s') v=shared[Number(v)]!==undefined?shared[Number(v)]:'';
        obj[col]=v;
      });
      rows.push(obj);
    });
    if (!rows.length) { alert('Feuille vide.'); return; }
    var cols=Object.keys(rows[0]).sort(function(a,b){return colNum(a)-colNum(b);});
    var headers=cols.map(function(c){return rows[0][c];});
    currentRows=rows.slice(1).map(function(r){
      return cols.map(function(c){return r[c]!==undefined?r[c]:null;});
    });
    renderMapping(headers);
    console.log('[CRI]', currentRows.length, 'lignes,', headers.length, 'colonnes');
  }

  function renderMapping(headers) {
    var md = $id('cri-mapping'); if (!md) return;
    md.classList.remove('hidden');
    md.innerHTML = '<h2>2. Correspondance des colonnes</h2>' +
      '<p>Le syst\\u00e8me propose un mapping automatique. Vous pouvez le modifier.</p>' +
      headers.map(function(h,i){
        var sugg=suggest(h);
        var opts=OPTS.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===sugg?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');
        return '<div class="mapping-row"><b>'+esc(h||'(vide)')+'</b><select data-map="'+i+'">'+opts+'</select></div>';
      }).join('') +
      '<button class="btn primary" id="cri-btn-preview">Vérifier les données</button>';
    var pb = document.getElementById('cri-btn-preview');
    if (pb) { pb.addEventListener('click', previewImport); console.log('[CRI] listener preview OK'); }
  }

  function provVal(v) {
    var n=norm(v), m={'guelmim':'Guelmim','assa zag':'Assa-Zag','sidi ifni':'Sidi Ifni','tan tan':'Tan-Tan'};
    return m[n]||null;
  }

  function mappedProjects() {
    var sels=Array.from(document.querySelectorAll('[data-map]'));
    return currentRows.map(function(row){
      var p={provinces:[]};
      sels.forEach(function(s){
        var i = Number(s.getAttribute('data-map'));
        var tgt=s.value, val=row[i];
        if(tgt==='ignore'||val==null||String(val).trim()==='') return;
        if(tgt.startsWith('province:')){if(/^x$/i.test(String(val).trim()))p.provinces.push(tgt.slice(9));return;}
        if(tgt==='provinces_source'){String(val).split(/[,+;/]/).forEach(function(x){var pv=provVal(x);if(pv)p.provinces.push(pv);});return;}
        p[tgt]=typeof val==='string'?val.trim():val;
      });
      p.provinces=Array.from(new Set(p.provinces));
      return p;
    });
  }

  async function previewImport() {
    try {
      var projs = mappedProjects();
      var d = await api('/import-preview',{method:'POST',body:JSON.stringify({projects:projs})});
      var pd = $id('cri-preview'); if(!pd) return;
      pd.classList.remove('hidden');
      // Store report for later use in apply
      lastDryRunReport = d.report;
      // Build UI
      var html = '<h2>3. Contrôle des données</h2>' +
        '<p>Aucune donnée n’est créée à cette étape. Vérifiez les informations avant l’import.</p>' +
        renderImportSummary(d.report) +
        renderMissingFields(d.report.missingFields) +
        renderDuplicates(d.report.duplicateRows, d.report.duplicates) +
        renderIssues(d.report.errors) +
        (function() {
          if (!d.preview || !d.preview.length) {
            if (d.report.duplicates > 0 && d.report.duplicates === d.report.total) {
              return '<div class="card"><div class="card-header"><h2>Aperçu des projets</h2></div>' +
                '<p>Aucun nouveau projet à prévisualiser.</p>' +
                '<p>Toutes les lignes du fichier correspondent à des projets déjà existants.</p></div>';
            }
            return '<div class="card"><div class="card-header"><h2>Aperçu des projets</h2></div>' +
              '<p>Aucun projet disponible dans l’aperçu.</p></div>';
          }
          return mkTable('Aperçu des projets', d.preview, { note: '10 premières lignes maximum' });
        }()) +
        '<button class=\"btn primary\" id=\"cri-btn-apply\">Importer en brouillon</button>' +
        '<div id=\"cri-apply-result\"></div>';
      pd.innerHTML = html;
      var ab = document.getElementById('cri-btn-apply');
      if(ab){ab.addEventListener('click', openConfirmModal); console.log('[CRI] listener apply (modal) OK');}
    } catch(e){
      var errDiv = $id('cri-preview');
      if (errDiv) {
        errDiv.classList.remove('hidden');
        errDiv.innerHTML = '<div class="err">Erreur pendant l’analyse : ' + esc(e.message) + '</div>';
      }
    }
  }

  async function applyImport() {
    var confirmBtn = $id('modal-confirm');
    var originalLabel = confirmBtn ? confirmBtn.textContent : null;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Import en cours…';
    }
    try {
      var d = await api('/import-apply', {method:'POST', body:JSON.stringify({projects: mappedProjects()})});
      var rpt = d.report;
      var rd = $id('cri-apply-result');
      if (rd) rd.innerHTML = renderApplyResult(rpt);
    } catch(e) {
      var rd = $id('cri-apply-result');
      if (rd) rd.innerHTML = '<div class="err">Erreur import : ' + esc(e.message) + '</div>';
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        if (originalLabel !== null) confirmBtn.textContent = originalLabel;
      }
      hideModal();
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    console.log('[CRI] init() — readyState:', document.readyState);

    var bDash = $id('cri-btn-dash');
    var bImp  = $id('cri-btn-import');
    var bAna  = $id('cri-btn-analytics');
    var bSh   = $id('cri-btn-sheet');
    var xl    = $id('cri-xlsx');

    if (bDash) bDash.addEventListener('click', function(){ showTab('dash'); });
    if (bImp)  bImp.addEventListener('click', function(){ showTab('imp'); });
    if (bAna)  bAna.addEventListener('click', loadAnalytics);
    if (bSh)   bSh.addEventListener('click', readSelectedSheet);
    if (xl)    xl.addEventListener('change', function(){ loadWorkbook().catch(function(e){alert('Erreur Excel: '+e.message);}); });

    console.log('[CRI] Listeners: dash='+!!bDash+' imp='+!!bImp+' analytics='+!!bAna+' sheet='+!!bSh+' xlsx='+!!xl);
    loadAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
`;
      res.set('Cache-Control', 'no-store').type('application/javascript; charset=utf-8').send(js);
    });

    router.get('/analytics', async (req, res, next) => {
      if (!requireAdmin(req, res)) return;
      try {
        // ── 1. Récupération des libellés Directus pour type_projet ─────────────
        // On interroge directus_fields pour obtenir la map value -> label
        // configurée dans l'interface Directus, sans rien coder en dur.
        let typeLabelsMap = {};
        try {
          const fieldRow = await database('directus_fields')
            .where({ collection: 'PROJETS', field: 'type_projet' })
            .first();
          if (fieldRow && fieldRow.options) {
            let opts = fieldRow.options;
            if (typeof opts === 'string') {
              try { opts = JSON.parse(opts); } catch { opts = {}; }
            }
            // Directus stocke les choix sous options.choices : [{value, text}]
            // ou options.choices : [{value, label}] selon la version.
            const choices = Array.isArray(opts.choices) ? opts.choices : [];
            for (const c of choices) {
              if (c && c.value != null) {
                typeLabelsMap[String(c.value)] = String(c.text || c.label || c.value);
              }
            }
          }
        } catch (labelErr) {
          // Non bloquant : si la table directus_fields est inaccessible,
          // on affiche la valeur brute comme fallback.
          logger.warn(labelErr, 'CRI: impossible de lire les libelles type_projet');
        }

        // ── 2. Chargement des données brutes ──────────────────────────────────
        // Périmètre : toutes les demandes de business plan (jointure LEFT avec PROJETS).
        // Aucun filtre sur status_publication — la philosophie du dashboard
        // est inchangée : seuls les projets ayant au moins une demande apparaissent.
        let allRows = await database('demandes_business_plan as d')
          .leftJoin('PROJETS as p', 'p.id', 'd.projet')
          .select(['d.id','d.projet','d.investisseur','d.statut','d.date_created',
                   'd.date_telechargement','p.titre','p.code_projet',
                   'p.secteur','p.provinces','p.type_projet']);
        allRows = allRows.map((r) => ({ ...r, provinces: arr(r.provinces) }));

        // ── 3. Application des filtres sur les données analytiques ─────────────
        const { from, to, province, secteur, projet, type, evo_from, evo_to } = req.query;
        let rows = allRows;
        if (from) rows = rows.filter((r) => r.date_created && new Date(r.date_created) >= new Date(`${from}T00:00:00`));
        if (to)   rows = rows.filter((r) => r.date_created && new Date(r.date_created) <= new Date(`${to}T23:59:59.999`));
        if (province) rows = rows.filter((r) => r.provinces.includes(province));
        if (secteur)  rows = rows.filter((r) => r.secteur === secteur);
        if (type)     rows = rows.filter((r) => r.type_projet === type);
        if (projet)   rows = rows.filter((r) => String(r.projet) === String(projet));

        // ── 4. Calcul des statistiques analytiques ────────────────────────────
        const projectStats = statsForGroups(groupRows(rows, (r) => String(r.projet))).map((x) => {
          const sample = rows.find((r) => String(r.projet) === x.name) || {};
          return { projet_id: x.name, projet: sample.titre || sample.code_projet || x.name, ...x };
        }).sort((a, b) => b.demandes - a.demandes || b.investisseurs_distincts - a.investisseurs_distincts || String(a.projet).localeCompare(String(b.projet)))
          .map(({ name, ...x }) => x);
        const sectorStats  = statsForGroups(groupRows(rows, (r) => r.secteur)).filter((x) => x.demandes > 0);
        const provinceStats = statsForGroups(groupRows(rows, (r) => r.provinces));

        // ── 4b. Calcul de la section Évolution ─────────────────────────────────
        let evoRows = allRows;
        if (province) evoRows = evoRows.filter((r) => r.provinces.includes(province));
        if (secteur)  evoRows = evoRows.filter((r) => r.secteur === secteur);
        if (type)     evoRows = evoRows.filter((r) => r.type_projet === type);
        if (projet)   evoRows = evoRows.filter((r) => String(r.projet) === String(projet));

        const effEvoFrom = evo_from || from;
        const effEvoTo   = evo_to || to;

        if (effEvoFrom) evoRows = evoRows.filter((r) => r.date_created && new Date(r.date_created) >= new Date(`${effEvoFrom}T00:00:00`));
        if (effEvoTo)   evoRows = evoRows.filter((r) => r.date_created && new Date(r.date_created) <= new Date(`${effEvoTo}T23:59:59.999`));

        let useAnnual = false;
        if (effEvoFrom && effEvoTo) {
          const d1 = new Date(effEvoFrom);
          const d2 = new Date(effEvoTo);
          const monthDiff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
          if (monthDiff > 24) useAnnual = true;
        } else if (evoRows.length > 0) {
          const timestamps = evoRows.map((r) => r.date_created ? new Date(r.date_created).getTime() : null).filter(Boolean);
          if (timestamps.length > 0) {
            const minD = new Date(Math.min(...timestamps));
            const maxD = new Date(Math.max(...timestamps));
            const monthDiff = (maxD.getFullYear() - minD.getFullYear()) * 12 + (maxD.getMonth() - minD.getMonth());
            if (monthDiff > 24) useAnnual = true;
          }
        }

        const evoKeyFn = useAnnual ? getYearKey : getMonthKey;
        const timeline_title = useAnnual ? 'Évolution annuelle' : 'Évolution mensuelle';
        const periodKey = useAnnual ? 'annee' : 'mois';

        const timeline = statsForGroups(groupRows(evoRows, (r) => evoKeyFn(r.date_created)))
          .map((x) => ({
            [periodKey]: x.name,
            demandes: x.demandes,
            investisseurs_distincts: x.investisseurs_distincts,
            validees: x.validees,
            refusees: x.refusees,
            telechargees: x.telechargees,
          }))
          .sort((a, b) => a[periodKey].localeCompare(b[periodKey]));

        const detail = projectStats.map((p) => {
          const sample = rows.find((r) => String(r.projet) === String(p.projet_id)) || {};
          return {
            projet: p.projet,
            secteur: sample.secteur || '',
            provinces: sample.provinces || [],
            demandes: p.demandes,
            investisseurs_distincts: p.investisseurs_distincts,
            validees: p.validees,
            refusees: p.refusees,
            telechargees: p.telechargees,
          };
        });

        // ── 5. Facets croisés ─────────────────────────────────────────────────
        // Pour chaque filtre, on calcule les options disponibles en appliquant
        // TOUS les filtres actifs sauf le filtre du facet lui-même.
        // Cela permet :
        //   - de restreindre les options des autres filtres quand un filtre est actif ;
        //   - de ne pas invalider la sélection courante (le filtre ne se filtre pas lui-même).
        //
        // Fonction utilitaire : applique les filtres temporels (from/to) sur une base.
        function applyTimeFilers(base) {
          let r = base;
          if (from) r = r.filter((x) => x.date_created && new Date(x.date_created) >= new Date(`${from}T00:00:00`));
          if (to)   r = r.filter((x) => x.date_created && new Date(x.date_created) <= new Date(`${to}T23:59:59.999`));
          return r;
        }

        // Base temporellement filtrée (utilisée pour tous les facets)
        const timeFiltered = applyTimeFilers(allRows);

        // Facet Secteurs : appliquer province + type + projet, pas secteur
        const forSecteurs = timeFiltered
          .filter((r) => !province || r.provinces.includes(province))
          .filter((r) => !type    || r.type_projet === type)
          .filter((r) => !projet  || String(r.projet) === String(projet));
        const facetSecteurs = [...new Set(forSecteurs.map((r) => r.secteur).filter(Boolean))].sort();

        // Facet Provinces : appliquer secteur + type + projet, pas province
        const forProvinces = timeFiltered
          .filter((r) => !secteur || r.secteur === secteur)
          .filter((r) => !type   || r.type_projet === type)
          .filter((r) => !projet || String(r.projet) === String(projet));
        const forProvincesValues = [...new Set(forProvinces.flatMap((r) => r.provinces))]
          .filter((p) => OFFICIAL_PROVINCES.includes(p))
          .sort();

        // Facet Catégories : appliquer secteur + province + projet, pas type
        const forCategories = timeFiltered
          .filter((r) => !secteur  || r.secteur === secteur)
          .filter((r) => !province || r.provinces.includes(province))
          .filter((r) => !projet   || String(r.projet) === String(projet));
        const facetCategoryValues = [...new Set(forCategories.map((r) => r.type_projet).filter(Boolean))].sort();
        // Enrichir avec le libellé Directus (fallback = valeur brute)
        const facetCategories = facetCategoryValues.map((v) => ({
          value: v,
          label: typeLabelsMap[v] || v,
        }));

        // Facet Projets : appliquer secteur + province + type, pas projet
        const forProjets = timeFiltered
          .filter((r) => !secteur  || r.secteur === secteur)
          .filter((r) => !province || r.provinces.includes(province))
          .filter((r) => !type     || r.type_projet === type);
        const facetProjets = [...new Map(
          forProjets
            .filter((r) => r.projet)
            .map((r) => [String(r.projet), {
              id: String(r.projet),
              titre: r.titre || r.code_projet || String(r.projet),
            }])
        ).values()].sort((a, b) => a.titre.localeCompare(b.titre));

        // ── 6. Réponse ────────────────────────────────────────────────────────
        res.json({ data: {
          kpis: {
            demandes_bp: rows.length,
            investisseurs_distincts: uniqueCount(rows, 'investisseur'),
            demandes_validees: rows.filter((r) => ['validee','telechargee'].includes(r.statut)).length,
            demandes_refusees: rows.filter((r) => r.statut === 'refusee').length,
            bp_telecharges: rows.filter((r) => r.statut === 'telechargee' || r.date_telechargement).length,
          },
          projets: projectStats, secteurs: sectorStats, provinces: provinceStats, timeline, timeline_title, detail,
          facets: {
            provinces: forProvincesValues,
            secteurs: facetSecteurs,
            categories: facetCategories,
            projets: facetProjets,
          },
          note_provinces: 'Une demande sur un projet multi-province compte dans chacune des provinces du projet.',
        }});
      } catch(error) { logger.error(error, 'CRI analytics'); next(error); }
    });

    async function importHandler(req, res, next, apply) {
      if (!requireAdmin(req, res)) return;
      try {
        const projects = Array.isArray(req.body?.projects) ? req.body.projects.slice(0,5000) : [];
        const existing = await database('PROJETS').select('code_projet').whereNotNull('code_projet');
        const existingCodes = new Set(existing.map((x) => String(x.code_projet).trim()));
        const seen = new Set();
        const report = { total: projects.length, complete:0, incomplete:0, imported:0, duplicates:0, missingFields:{}, errors:[], duplicateRows:[] };
        const preview = [];
        const schema = apply ? await getSchema() : null;
        const service = apply ? new ItemsService('PROJETS', { schema, accountability: req.accountability, knex: database }) : null;
        for (let i=0; i<projects.length; i++) {
          const rawProject = projects[i] || {};
          const project = safeProject(rawProject);
          const line = i+2;
          if (rawProject.secteur && !project.secteur) report.errors.push({ line, field: 'secteur', value: rawProject.secteur, message: 'Secteur non reconnu' });
          if (rawProject.type_projet && !project.type_projet) report.errors.push({ line, field: 'type_projet', value: rawProject.type_projet, message: 'Type de projet non reconnu' });
          if (!project.titre) { report.errors.push({ line, error: 'Titre absent' }); continue; }
          const code = project.code_projet ? String(project.code_projet).trim() : null;
          if (code && (existingCodes.has(code) || seen.has(code))) { report.duplicates++; report.duplicateRows.push({ line, code_projet: code }); continue; }
          if (code) seen.add(code);
          const miss = missing(project);
          if (miss.length) { report.incomplete++; for (const f of miss) report.missingFields[f] = (report.missingFields[f]||0)+1; } else report.complete++;
          if (preview.length < 10) preview.push({ ...project, champs_manquants: miss.join(', ')||'aucun' });
          if (apply) {
            try { await service.createOne(project); report.imported++; if (code) existingCodes.add(code); }
            catch(e) { report.errors.push({ line, error: e.message }); }
          }
        }
        res.json({ data: { mode: apply ? 'apply' : 'dry-run', report, preview } });
      } catch(error) { logger.error(error, 'CRI import Excel'); next(error); }
    }
    router.post('/import-preview', (req, res, next) => importHandler(req, res, next, false));
    router.post('/import-apply', (req, res, next) => importHandler(req, res, next, true));
  },
};