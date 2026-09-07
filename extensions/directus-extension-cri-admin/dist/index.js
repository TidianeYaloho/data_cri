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
function statsForGroups(groups) {
  return [...groups.entries()].map(([name, rows]) => ({
    name, demandes: rows.length,
    investisseurs_distincts: uniqueCount(rows, 'investisseur'),
    validees: rows.filter((r) => ['validee', 'telechargee'].includes(r.statut)).length,
    refusees: rows.filter((r) => r.statut === 'refusee').length,
    telechargees: rows.filter((r) => r.statut === 'telechargee' || r.date_telechargement).length,
  })).sort((a, b) => b.investisseurs_distincts - a.investisseurs_distincts || b.demandes - a.demandes);
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
body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f5f7fa;color:#17212b}
.wrap{max-width:1200px;margin:auto;padding:24px}
.card{background:#fff;border:1px solid #dce3ea;border-radius:10px;padding:18px;margin:14px 0}
h1,h2{color:#173f63;margin-top:0}
.tabs{display:flex;gap:8px;margin:16px 0;padding:4px;background:#eef4f8;border-radius:10px;width:fit-content}
.tab-btn{padding:10px 20px;border:none;border-radius:7px;background:transparent;cursor:pointer;font-size:14px;font-weight:500;color:#456;transition:all .2s}
.tab-btn.active{background:#fff;color:#173f63;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.tab-btn:hover{background:#fff;color:#173f63}
.btn{padding:9px 18px;margin:4px;border:1px solid #bcd;border-radius:7px;background:#fff;cursor:pointer;font-size:13px;transition:background .15s}
.btn:hover{background:#eef4f8}
.btn.primary{background:#173f63;color:#fff;border-color:#173f63}
.btn.primary:hover{background:#1a5080}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0}
.kpi{padding:16px;background:#eef4f8;border-radius:8px;text-align:center}
.kpi b{font-size:30px;display:block;color:#173f63}
.kpi span{font-size:12px;color:#678;text-transform:uppercase;letter-spacing:.05em}
label{display:block;margin:8px 0;font-size:13px;font-weight:500}
input,select{padding:8px 10px;min-width:160px;max-width:100%;border:1px solid #cdd;border-radius:6px;font-size:13px}
input:focus,select:focus{outline:2px solid #3a8fc7;border-color:#3a8fc7}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #d8e0e7;padding:8px 10px;text-align:left}
th{background:#eef4f8;font-weight:600;color:#173f63}
tr:hover{background:#f8fafb}
.hidden{display:none !important}
.warn{background:#fff4cc;padding:12px 16px;border-left:4px solid #d6a514;border-radius:0 6px 6px 0;margin-bottom:14px}
.ok{background:#e8f6ed;padding:12px;border-radius:6px;border-left:4px solid #2d9a5f}
.err{background:#fdecea;padding:12px;border-radius:6px;border-left:4px solid #d32f2f;color:#b71c1c}
.scroll{overflow:auto;max-height:520px}
.mapping-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #eee;padding:8px 0;align-items:center}
.filters-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end}
pre{background:#f4f6f8;padding:12px;border-radius:6px;overflow:auto;font-size:12px;max-height:300px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Outils internes CRI</h1>
  <div class="warn">Cette page est réservée à l'administration. Le jeton est conservé uniquement en mémoire dans cet onglet et n'est jamais enregistré.</div>
  <div class="card">
    <label for="cri-token">Jeton administrateur Directus</label>
    <input id="cri-token" type="password" autocomplete="off" style="width:460px;max-width:100%" placeholder="Collez votre token admin ici">
  </div>
  <div class="tabs">
    <button class="tab-btn active" id="cri-btn-dash">Tableau de bord CRI</button>
    <button class="tab-btn" id="cri-btn-import">Import Excel projets</button>
  </div>
  <section id="cri-dash">
    <div class="card">
      <h2>Filtres communs</h2>
      <div class="filters-grid">
        <label>Du <input id="cri-from" type="date"></label>
        <label>Au <input id="cri-to" type="date"></label>
        <label>Province <select id="cri-province"><option value="">Toutes</option></select></label>
        <label>Secteur <select id="cri-secteur"><option value="">Tous</option></select></label>
        <label>Projet <select id="cri-projet"><option value="">Tous</option></select></label>
      </div>
      <button class="btn primary" id="cri-btn-analytics">Actualiser</button>
    </div>
    <div id="cri-analytics"></div>
  </section>
  <section id="cri-imp" class="hidden">
    <div class="card">
      <h2>1. Charger le classeur Excel</h2>
      <input id="cri-xlsx" type="file" accept=".xlsx">
      <label style="margin-top:12px">Feuille <select id="cri-sheet"></select></label>
      <button class="btn" id="cri-btn-sheet">Lire la feuille</button>
    </div>
    <div id="cri-mapping" class="card hidden"></div>
    <div id="cri-preview" class="card hidden"></div>
  </section>
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
  function token() { var t = $id('cri-token'); return t ? t.value.trim() : ''; }
  function authHdr() { return { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' }; }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  async function api(path, opts) {
    opts = opts || {};
    var r = await fetch('/cri-admin' + path, Object.assign({}, opts, {
      headers: Object.assign({}, authHdr(), opts.headers || {})
    }));
    var b = await r.json();
    if (!r.ok) throw new Error(b.message || JSON.stringify(b));
    return b.data;
  }

  function mkTable(title, rows) {
    if (!rows || !rows.length) return '<div class="card"><h2>' + esc(title) + '</h2><p>Aucune donn\\u00e9e.</p></div>';
    var keys = Object.keys(rows[0]);
    return '<div class="card scroll"><h2>' + esc(title) + '</h2><table><thead><tr>' +
      keys.map(function(k){return '<th>'+esc(k)+'</th>';}).join('') +
      '</tr></thead><tbody>' +
      rows.map(function(r){return '<tr>'+keys.map(function(k){
        var v=r[k]; return '<td>'+esc(Array.isArray(v)?v.join(', '):v)+'</td>';
      }).join('')+'</tr>';}).join('') +
      '</tbody></table></div>';
  }

  function fillSel(id, items, lbl, val) {
    lbl = lbl || 'name'; val = val || 'name';
    var s = $id(id); if (!s) return;
    var cur = s.value;
    s.innerHTML = '<option value="">Tous</option>' +
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

  // ── Analytics ──────────────────────────────────────────────────────────────
  async function loadAnalytics() {
    var div = $id('cri-analytics');
    if (div) div.innerHTML = '<p>Chargement...</p>';
    var q = new URLSearchParams();
    [['from','cri-from'],['to','cri-to'],['province','cri-province'],['secteur','cri-secteur'],['projet','cri-projet']].forEach(function(pair){
      var v = $id(pair[1]) ? $id(pair[1]).value : '';
      if (v) q.set(pair[0], v);
    });
    try {
      var d = await api('/analytics?' + q.toString());
      fillSel('cri-province', d.facets.provinces.map(function(n){return {name:n};}));
      fillSel('cri-secteur', d.facets.secteurs.map(function(n){return {name:n};}));
      fillSel('cri-projet', d.facets.projets, 'titre', 'id');
      if (div) div.innerHTML =
        '<div class="grid">' +
        Object.entries(d.kpis).map(function(e){
          return '<div class="kpi"><b>'+esc(e[1])+'</b><span>'+esc(e[0].replace(/_/g,' '))+'</span></div>';
        }).join('') + '</div>' +
        mkTable('Projets les plus demand\\u00e9s', d.projets) +
        mkTable('Secteurs les plus sollicit\\u00e9s', d.secteurs) +
        mkTable('Provinces les plus sollicit\\u00e9es', d.provinces) +
        mkTable('\\u00c9volution mensuelle', d.timeline) +
        mkTable('D\\u00e9tail par projet', d.detail);
    } catch(e) {
      if (div) div.innerHTML = '<div class="err">Erreur : '+esc(e.message)+'<br>V\\u00e9rifiez le jeton.</div>';
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
    if (!workbookInfo) { alert('Chargez d\\'abord un fichier Excel.'); return; }
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
      '<button class="btn primary" id="cri-btn-preview">Dry-run / aper\\u00e7u</button>';
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
      var projs=mappedProjects();
      var d=await api('/import-preview',{method:'POST',body:JSON.stringify({projects:projs})});
      var pd=$id('cri-preview'); if(!pd) return;
      pd.classList.remove('hidden');
      pd.innerHTML='<h2>3. Dry-run (aucune donn\\u00e9e cr\\u00e9\\u00e9e)</h2>' +
        '<pre>'+esc(JSON.stringify(d.report,null,2))+'</pre>' +
        mkTable('Aper\\u00e7u transform\\u00e9 (10 premi\\u00e8res lignes)',d.preview) +
        '<button class="btn primary" id="cri-btn-apply">Importer en brouillon</button>' +
        '<div id="cri-apply-result"></div>';
      var ab=document.getElementById('cri-btn-apply');
      if(ab){ab.addEventListener('click',applyImport);console.log('[CRI] listener apply OK');}
    } catch(e){alert('Erreur dry-run : '+e.message);}
  }

  async function applyImport() {
    if(!confirm('Importer ces lignes en brouillon ? Les doublons seront ignor\\u00e9s.')) return;
    try {
      var d=await api('/import-apply',{method:'POST',body:JSON.stringify({projects:mappedProjects()})});
      var rpt=d.report;
      alert('Import termin\\u00e9 : '+rpt.imported+' cr\\u00e9\\u00e9(s), '+rpt.duplicates+' doublon(s), '+rpt.errors.length+' erreur(s).');
      var rd=$id('cri-apply-result');
      if(rd) rd.innerHTML='<div class="ok" style="margin-top:12px">R\\u00e9sultat du dernier import :</div><pre>'+esc(JSON.stringify(rpt,null,2))+'</pre>';
    } catch(e){alert('Erreur import : '+e.message);}
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
        let rows = await database('demandes_business_plan as d')
          .leftJoin('PROJETS as p', 'p.id', 'd.projet')
          .select(['d.id','d.projet','d.investisseur','d.statut','d.date_created','d.date_telechargement','p.titre','p.code_projet','p.secteur','p.provinces']);
        rows = rows.map((r) => ({ ...r, provinces: arr(r.provinces) }));
        const allRows = rows;
        const { from, to, province, secteur, projet } = req.query;
        if (from) rows = rows.filter((r) => r.date_created && new Date(r.date_created) >= new Date(`${from}T00:00:00`));
        if (to)   rows = rows.filter((r) => r.date_created && new Date(r.date_created) <= new Date(`${to}T23:59:59.999`));
        if (province) rows = rows.filter((r) => r.provinces.includes(province));
        if (secteur)  rows = rows.filter((r) => r.secteur === secteur);
        if (projet)   rows = rows.filter((r) => String(r.projet) === String(projet));
        const projectStats = statsForGroups(groupRows(rows, (r) => String(r.projet))).map((x) => {
          const sample = rows.find((r) => String(r.projet) === x.name) || {};
          return { projet_id: x.name, projet: sample.titre || sample.code_projet || x.name, ...x };
        }).map(({ name, ...x }) => x);
        const sectorStats = statsForGroups(groupRows(rows, (r) => r.secteur));
        const provinceStats = statsForGroups(groupRows(rows, (r) => r.provinces));
        const timeline = statsForGroups(groupRows(rows, (r) => r.date_created ? String(r.date_created).slice(0,7) : null))
          .map((x) => ({ mois: x.name, demandes: x.demandes, investisseurs_distincts: x.investisseurs_distincts }))
          .sort((a,b) => a.mois.localeCompare(b.mois));
        const detail = projectStats.map((p) => {
          const sample = rows.find((r) => String(r.projet) === String(p.projet_id)) || {};
          return { ...p, secteur: sample.secteur || '', provinces: sample.provinces || [] };
        });
        res.json({ data: {
          kpis: {
            demandes_bp: rows.length,
            investisseurs_distincts: uniqueCount(rows, 'investisseur'),
            demandes_validees: rows.filter((r) => ['validee','telechargee'].includes(r.statut)).length,
            demandes_refusees: rows.filter((r) => r.statut === 'refusee').length,
            bp_telecharges: rows.filter((r) => r.statut === 'telechargee' || r.date_telechargement).length,
          },
          projets: projectStats, secteurs: sectorStats, provinces: provinceStats, timeline, detail,
          facets: {
            provinces: OFFICIAL_PROVINCES,
            secteurs: [...new Set(allRows.map((r) => r.secteur).filter(Boolean))].sort(),
            projets: [...new Map(allRows.filter((r) => r.projet).map((r) => [String(r.projet), { id: String(r.projet), titre: r.titre || r.code_projet || String(r.projet) }])).values()].sort((a,b) => a.titre.localeCompare(b.titre)),
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