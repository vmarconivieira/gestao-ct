const SUPABASE_URL = "https://jsoujnbaucvvwgfilnoc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzb3VqbmJhdWN2dndnZmlsbm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDA5MzIsImV4cCI6MjEwNDcxNjkzMn0.l-dTfSmQzEsQF0AP-CPx0xZI9ox6hFyF4G8bDKSg7yw";

let db;
try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } 
catch(e) { console.error("Falha ao inicializar o Supabase:", e); }

let vendasGlobais = [], vendasFiltradasGlobal = []; 
let catalogoSkusGlobais = [], skusFiltradosGlobal = [], catalogoSkus = {}; 
let usuariosGlobais = [];
let graficoInstance = null, chartAnalise = null;
let isDarkMode = false, isFetching = false;
let paginaAtualVendas = 1, paginaAtualSkus = 1;
const ITENS_POR_PAGINA = 50;
let rawDataGlobal = [], importDataGlobal = [], importHeadersGlobal = [], produtosUnicosGlobal = [];

async function hashSHA256(str) {
    if (window.crypto && window.crypto.subtle) {
        try {
            const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
            return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
        } catch(e) { return btoa(unescape(encodeURIComponent(str))); }
    } else { return btoa(unescape(encodeURIComponent(str))); }
}

function aplicarPermissoes() {
    const nivel = localStorage.getItem('app_auth_nivel') || 'OPERADOR';
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display = (nivel !== 'ADMIN') ? 'none' : ''; });
    const nt = document.getElementById('nivelText');
    if(nt) { nt.innerText = nivel === 'ADMIN' ? "👑 ADMIN" : "👤 OPERADOR"; nt.className = nivel === 'ADMIN' ? "text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"; }
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarTema(); configurarDataAtual();
    const token = localStorage.getItem('app_auth_token');
    const userName = localStorage.getItem('app_auth_name');
    if (token) {
        const ls = document.getElementById('loginScreen'); if(ls) ls.classList.add('hidden'); 
        const ac = document.getElementById('appContent'); if(ac) ac.classList.remove('hidden');
        const bv = document.getElementById('bemVindoText'); if(userName && bv) bv.innerText = `Olá, ${userName}`;
        aplicarPermissoes(); carregarRascunhoForm(); carregarDadosDaNuvem(); restaurarEstadoImportacao(); 
    } else {
        const ls = document.getElementById('loginScreen'); if(ls) ls.classList.remove('hidden'); 
        const ac = document.getElementById('appContent'); if(ac) ac.classList.add('hidden');
        testarConexaoLogin();
    }
    document.querySelectorAll('.form-draft').forEach(el => { el.addEventListener('input', salvarRascunhoForm); el.addEventListener('change', salvarRascunhoForm); });
    
    const skuEl = document.getElementById('sku');
    if (skuEl) {
        skuEl.addEventListener('blur', function() {
            const codigo = this.value.trim().toUpperCase();
            if(codigo && catalogoSkus[codigo]) {
                const d = document.getElementById('descricao'); if(d) d.value = catalogoSkus[codigo].produto; 
                const c = document.getElementById('custo'); if(c) c.value = catalogoSkus[codigo].custo_atual;
                calcularMargemForm(); showToast('SKU Localizado!', 'success');
            }
        });
    }
});

async function testarConexaoLogin() {
    const dot = document.getElementById('loginStatusDot'), text = document.getElementById('loginStatusText'), btn = document.getElementById('btnLogin');
    if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-yellow-400 mr-2 animate-pulse"; 
    if(text) text.innerText = "Testando conexão..."; 
    if(btn) btn.disabled = true;
    try {
        if (!window.supabase) throw new Error("Supabase não carregado.");
        const { error } = await db.from('usuarios').select('id').limit(1);
        if (error) throw new Error(error.message);
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2"; 
        if(text) text.innerText = "Sistema Online"; 
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed'); }
    } catch (e) {
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 mr-2"; 
        if(text) text.innerText = "Erro: " + e.message; 
        setTimeout(testarConexaoLogin, 6000);
    }
}

const formLogin = document.getElementById('formLogin');
if(formLogin) {
    formLogin.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = document.getElementById('btnLogin'), spinner = document.getElementById('loginSpinner');
        if(btn) btn.classList.add('hidden'); 
        if(spinner) spinner.classList.remove('hidden');
        
        const lu = document.getElementById('loginUser'); const lp = document.getElementById('loginPass');
        const u = lu ? lu.value.trim().toLowerCase() : ''; const p = lp ? lp.value.trim() : '';
        
        try {
            const hp = await hashSHA256(p);
            const { count } = await db.from('usuarios').select('*', { count: 'exact', head: true });
            if (count === 0 && u === 'admin' && p === 'admin') await db.from('usuarios').insert([{ usuario: 'admin', senha: hp, nome: 'Administrador', nivel: 'ADMIN' }]);
            const { data } = await db.from('usuarios').select('*').eq('usuario', u).eq('senha', hp);
            if (data && data.length > 0) {
                const ud = data[0]; localStorage.setItem('app_auth_token', ud.senha); localStorage.setItem('app_auth_name', ud.nome); localStorage.setItem('app_auth_nivel', ud.nivel); localStorage.setItem('app_auth_login', ud.usuario);
                document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appContent').classList.remove('hidden'); 
                const bv = document.getElementById('bemVindoText'); if(bv) bv.innerText = `Olá, ${ud.nome}`;
                aplicarPermissoes(); carregarRascunhoForm(); carregarDadosDaNuvem(); showToast('Login efetuado!', 'success');
            } else { 
                alert("Acesso negado."); 
                if(btn) btn.classList.remove('hidden'); 
                if(spinner) spinner.classList.add('hidden'); 
            }
        } catch (err) { 
            alert("Erro servidor."); 
            if(btn) btn.classList.remove('hidden'); 
            if(spinner) spinner.classList.add('hidden'); 
        }
    });
}

function fazerLogout() { localStorage.clear(); location.reload(); }
function abrirModalSenha() { const m = document.getElementById('modalSenha'); if(m) m.classList.remove('hidden'); const f = document.getElementById('formAlterarSenha'); if(f) f.reset(); }
function fecharModalSenha() { const m = document.getElementById('modalSenha'); if(m) m.classList.add('hidden'); }
function abrirModalExcluirMes() { const m = document.getElementById('modalExcluirMes'); if(m) m.classList.remove('hidden'); const da = document.getElementById('delMesAno'); if(da) da.value = new Date().getFullYear(); }
function fecharModalExcluirMes() { const m = document.getElementById('modalExcluirMes'); if(m) m.classList.add('hidden'); }
function showToast(m, t='info') { const c = document.getElementById('toast-container'); if(!c) return; const toast = document.createElement('div'); toast.className = `toast ${t}`; toast.innerHTML = `<span>${m}</span>`; c.appendChild(toast); setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000); }
function mostrarLoading(t="Processando...") { const ot = document.getElementById('globalOverlayText'); if(ot) ot.innerText = t; const go = document.getElementById('globalOverlay'); if(go) go.classList.remove('hidden'); }
function esconderLoading() { const go = document.getElementById('globalOverlay'); if(go) go.classList.add('hidden'); }
function fecharModalResumoLote() { const rm = document.getElementById('modalResumoLote'); if(rm) rm.classList.add('hidden'); const ala = document.getElementById('areaLogsAuditoria'); if(ala) ala.classList.add('hidden'); }

const formAltSenha = document.getElementById('formAlterarSenha');
if(formAltSenha) {
    formAltSenha.addEventListener('submit', async function(e) {
        e.preventDefault();
        const sa = document.getElementById('senhaAtual').value.trim(), sn = document.getElementById('senhaNova').value.trim(), sc = document.getElementById('senhaNovaConfirma').value.trim();
        if (sn !== sc) return showToast("Senhas não conferem.", "error");
        if (sn.length < 4) return showToast("Mínimo 4 caracteres.", "error");
        mostrarLoading("Alterando...");
        try {
            const u = localStorage.getItem('app_auth_login'), ha = await hashSHA256(sa);
            const { data } = await db.from('usuarios').select('*').eq('usuario', u).eq('senha', ha);
            if (data && data.length > 0) { const hn = await hashSHA256(sn); await db.from('usuarios').update({ senha: hn }).eq('usuario', u); localStorage.setItem('app_auth_token', hn); showToast("Senha alterada!", 'success'); fecharModalSenha(); }
            else showToast("Senha atual incorreta.", 'error');
        } catch (err) { showToast("Erro.", "error"); } finally { esconderLoading(); }
    });
}

const formExcMes = document.getElementById('formExcluirMes');
if(formExcMes) {
    formExcMes.addEventListener('submit', async function(e) {
        e.preventDefault();
        const a = document.getElementById('delMesAno').value, m = document.getElementById('delMesNome').value, s = document.getElementById('delMesSenha').value.trim();
        if(!confirm(`⚠️ Apagar TODOS os lançamentos de ${m}/${a}?`)) return;
        mostrarLoading("Apagando...");
        try {
            const u = localStorage.getItem('app_auth_login'), hs = await hashSHA256(s);
            const { data } = await db.from('usuarios').select('*').eq('usuario', u).eq('senha', hs);
            if (data && data.length > 0 && data[0].nivel === 'ADMIN') { const { error } = await db.from('vendas').delete().eq('ano', a).ilike('mes', m); if(!error) { showToast("Excluídos!", 'success'); fecharModalExcluirMes(); await carregarDadosDaNuvem(); } else showToast("Erro DB.", 'error'); }
            else showToast("Acesso negado.", 'error');
        } catch (err) { showToast("Erro.", "error"); } finally { esconderLoading(); }
    });
}

window.addEventListener('click', function(e){ const b = document.getElementById('exportMenuBtn'), d = document.getElementById('exportDropdown'); if (b && d && !b.contains(e.target) && !d.contains(e.target)) d.classList.add('hidden'); });
function toggleExportMenu() { const ed = document.getElementById('exportDropdown'); if(ed) ed.classList.toggle('hidden'); }
function switchTab(id) {
    ['dashboard', 'novo', 'calculadora', 'skus', 'usuarios', 'analise'].forEach(t => { const el = document.getElementById('tab-'+t), bt = document.getElementById('btn-tab-'+t); if(el) el.classList.add('hidden'); if(bt) bt.className = "px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-sm transition-all text-gray-600 dark:text-gray-300 hover:bg-white/40 hover-float " + (['usuarios','novo','skus','analise'].includes(t)?'admin-only':''); });
    const selTab = document.getElementById('tab-'+id); if(selTab) selTab.classList.remove('hidden'); 
    const selBtn = document.getElementById('btn-tab-'+id); if(selBtn) selBtn.className = "px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-sm transition-all bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md hover-float " + (['usuarios','novo','skus','analise'].includes(id)?'admin-only':''); 
    aplicarPermissoes();
}
function toggleGrafico() { const gc = document.getElementById('graficoContainer'); if(gc) gc.classList.toggle('hidden'); }
function salvarRascunhoForm() { const d = {}; document.querySelectorAll('.form-draft').forEach(el => d[el.id] = el.value); localStorage.setItem('vendaDraft', JSON.stringify(d)); }
function carregarRascunhoForm() { const d = localStorage.getItem('vendaDraft'); if (d) try { const o = JSON.parse(d); Object.keys(o).forEach(id => { const el = document.getElementById(id); if(el) el.value = o[id]; }); calcularMargemForm(); } catch(e){} }
function limparRascunho() { localStorage.removeItem('vendaDraft'); const vf = document.getElementById('vendaForm'); if(vf) vf.reset(); configurarDataAtual(); calcularMargemForm(); }
function inicializarTema() { if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) toggleDarkMode(true); }
function toggleDarkMode(f = null) { const h = document.documentElement; isDarkMode = f !== null ? f : !h.classList.contains('dark'); if (isDarkMode) { h.classList.add('dark'); localStorage.setItem('theme', 'dark'); } else { h.classList.remove('dark'); localStorage.setItem('theme', 'light'); } if(vendasGlobais.length > 0) aplicarFiltros(); }
function configurarDataAtual() { const d = new Date(); const anoEl = document.getElementById('ano'); if(anoEl) anoEl.value = d.getFullYear(); const m = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]; const mesEl = document.getElementById('mes'); if(mesEl) mesEl.value = m[d.getMonth()]; const faEl = document.getElementById('filtroAno'); if(faEl) faEl.value = d.getFullYear(); const fmEl = document.getElementById('filtroMes'); if(fmEl) fmEl.value = m[d.getMonth()]; }

async function carregarDadosDaNuvem() {
    if (isFetching) return; isFetching = true;
    const ind = document.getElementById('statusConexao'), txt = document.getElementById('textoConexao');
    if(ind) ind.className = "w-2.5 h-2.5 rounded-full bg-yellow-400 mr-2 animate-pulse"; 
    if(txt) txt.innerText = "Sincronizando DB...";
    try {
        const [vR, sR, uR] = await Promise.all([ db.from('vendas').select('*').order('created_at', { ascending: false }), db.from('custos_sku').select('*'), db.from('usuarios').select('*') ]);
        if (vR.error) throw vR.error;
        vendasGlobais = (vR.data || []).map(v => ({ originalIndex: v.id, ano: v.ano, mes: String(v.mes).toUpperCase(), qtd: v.quantidade, descricao: v.descricao, sku: v.sku, nVenda: v.n_venda, urlPlataforma: v.url_ml, plataforma: v.plataforma, valorVenda: Number(v.valor_venda), sobra: Number(v.sobra), imposto: Number(v.imposto), custo: Number(v.custo), lucro: Number(v.lucro), porcentagem: Number(v.porcentagem)*100, status: v.status }));
        aplicarFiltros();
        if (sR.data) { catalogoSkusGlobais = sR.data.map(s => ({ SKU: s.sku, PRODUTO: s.produto, CUSTO_ANTERIOR: s.custo_anterior, CUSTO_ATUAL: s.custo_atual, CUSTO_MEDIO: s.custo_medio, FORNECEDOR: s.fornecedor, DATA_ATUALIZACAO: s.data_atualizacao, STATUS: s.status })); parseSkusDictionary(); renderPaginaSkus(1); }
        if (uR.data) { usuariosGlobais = uR.data.map(u => ({ usuario: u.usuario, nome: u.nome, nivel: u.nivel, originalIndex: u.id })); renderTabelaUsuarios(); }
        carregarFiltroAnalise();
        if(ind) ind.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2"; 
        if(txt) txt.innerText = `Online`; 
        isFetching = false;
    } catch (e) { 
        if(ind) ind.className = "w-2.5 h-2.5 rounded-full bg-red-500 mr-2"; 
        if(txt) txt.innerText = "Offline"; 
        isFetching = false; 
        setTimeout(carregarDadosDaNuvem, 15000); 
    }
}

function parseSkusDictionary() { catalogoSkus = {}; catalogoSkusGlobais.forEach(s => { let c = String(s.SKU||"").trim().toUpperCase(); if(c && String(s.STATUS||"").trim().toUpperCase() !== "INATIVO") catalogoSkus[c] = { produto: String(s.PRODUTO).trim(), custo_atual: Number(s.CUSTO_ATUAL) }; }); }

function carregarFiltroAnalise() {
    const s = document.getElementById('selectAnaliseSku'); if(!s) return; s.innerHTML = '<option value="">-- Produto/SKU --</option>'; const m = new Map();
    catalogoSkusGlobais.forEach(x => { let k = String(x.SKU||"").trim().toUpperCase() || String(x.PRODUTO||"").trim(); if(k && !m.has(k)) m.set(k, {sku: x.SKU, nome: x.PRODUTO}); });
    vendasGlobais.forEach(v => { let k = String(v.sku||"").trim().toUpperCase() || String(v.descricao||"").trim(); if(k && !m.has(k)) m.set(k, {sku: v.sku, nome: v.descricao}); });
    Array.from(m.keys()).sort().forEach(k => { const d = m.get(k), o = document.createElement('option'); o.value = k; o.innerText = d.sku ? `${d.sku} - ${d.nome}` : d.nome; s.appendChild(o); });
}

function renderizarAbaInteligencia() {
    const sA = document.getElementById('selectAnaliseSku'); const k = sA ? sA.value : ''; 
    const v = document.getElementById('containerAnaliseVazia'), d = document.getElementById('containerAnaliseDados');
    if(!k) { if(v) v.classList.remove('hidden'); if(d) d.classList.add('hidden'); return; }
    if(v) v.classList.add('hidden'); if(d) d.classList.remove('hidden');
    const vs = vendasGlobais.filter(x => (String(x.sku||"").trim().toUpperCase() || String(x.descricao||"").trim()).toUpperCase() === k.toUpperCase()).sort((a,b) => new Date(a.ano, a.mes) - new Date(b.ano, b.mes));
    let u=0, r=0, l=0; const hP=[], hC=[], hM=[], lx=[];
    vs.forEach(x => { if(x.valorVenda<=0) return; const q=x.qtd>0?x.qtd:1; u+=q; r+=x.valorVenda; l+=x.lucro; lx.push(`${x.mes.substring(0,3)}/${x.ano}`); hP.push(x.valorVenda/q); hC.push(x.custo/q); hM.push(x.porcentagem); });
    const pm = u>0?(r/u):0, mm = r>0?(l/r)*100:0;
    const aqt = document.getElementById('analiseQtdTotal'); if(aqt) aqt.innerText = u; 
    const apm = document.getElementById('analisePrecoMedio'); if(apm) apm.innerText = `R$ ${pm.toFixed(2)}`; 
    const amm = document.getElementById('analiseMargemMedia'); if(amm) { amm.innerText = `${mm.toFixed(2)}%`; amm.className = mm < 10 ? "text-2xl font-extrabold text-red-600 dark:text-red-400" : (mm <= 20 ? "text-2xl font-extrabold text-yellow-500 dark:text-yellow-400" : "text-2xl font-extrabold text-emerald-600 dark:text-emerald-400"); }
    const cEl = document.getElementById('chartAnaliseSku');
    if(cEl) {
        if(chartAnalise) chartAnalise.destroy();
        chartAnalise = new Chart(cEl.getContext('2d'), { type:'line', data:{labels:lx, datasets:[{label:'Preço', data:hP, borderColor:'#3b82f6'}, {label:'Custo', data:hC, borderColor:'#ef4444'}, {label:'Margem', data:hM, borderColor:'#10b981', yAxisID:'y1'}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{position:'left'}, y1:{position:'right'}}} });
    }
}

function gerarCanvasAreaTopo() {
    return new Promise((res, rej) => {
        switchTab('dashboard'); window.scrollTo(0,0); const s = document.getElementById('secaoHistorico'); const w = s ? s.style.display !== 'none' : false; if(s) s.style.display = 'none';
        const a = document.getElementById('areaExport'); if(!a) return rej("Area not found");
        const oW = a.style.width, oP = a.style.padding, oB = a.style.backgroundColor, cW = a.offsetWidth || window.innerWidth;
        a.style.width = cW+'px'; a.style.padding = '24px'; a.style.backgroundColor = isDarkMode?'#1f2937':'#f8fafc';
        setTimeout(() => { html2canvas(a, {scale:2, useCORS:true, width:cW, windowWidth:cW}).then(c => { a.style.width=oW; a.style.padding=oP; a.style.backgroundColor=oB; if(s && w) s.style.display=''; res(c); }).catch(rej); }, 500);
    });
}
function exportarRelatorioPNG() { mostrarLoading(); gerarCanvasAreaTopo().then(c => { const l=document.createElement('a'); l.download=`Relatorio.png`; l.href=c.toDataURL('image/png'); l.click(); esconderLoading(); }).catch(e=>esconderLoading()); }
async function compartilharWhatsApp() { mostrarLoading(); try { const c = await gerarCanvasAreaTopo(); c.toBlob(async b => { const f = new File([b], 'Resumo.png', {type:'image/png'}); esconderLoading(); if(navigator.canShare&&navigator.canShare({files:[f]})) return navigator.share({files:[f]}); const i = new ClipboardItem({'image/png':b}); await navigator.clipboard.write([i]); window.open('https://api.whatsapp.com/send?text=Resumo', '_blank'); }, 'image/png'); } catch(e) { esconderLoading(); } }

function formatMoney(val) { const n=Number(val)||0; return (n<0?'-':'')+`R$ ${Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2})}`; }
const universalNumberParse = (val) => { 
    if(!val) return 0; if(typeof val==='number') return val; let s=String(val).trim(); const neg = s.includes('-')||(s.startsWith('(')&&s.endsWith(')')); s=s.replace(/[^0-9.,]/g,''); if(!s) return 0;
    const lc=s.lastIndexOf(','), ld=s.lastIndexOf('.'); if(lc>ld) s=s.replace(/\./g,'').replace(',','.'); else if(ld>lc && lc!==-1) s=s.replace(/,/g,'');
    return neg ? -Math.abs(parseFloat(s)||0) : Math.abs(parseFloat(s)||0);
};

function aplicarFiltros() {
    const fA = document.getElementById('filtroAno'), fM = document.getElementById('filtroMes'), fO = document.getElementById('ordenacao'), fB = document.getElementById('buscaVendas');
    const a = fA ? fA.value : "TODOS", m = fM ? fM.value : "TODOS", o = fO ? fO.value : "recentes", b = fB ? fB.value.toLowerCase() : "";
    vendasFiltradasGlobal = vendasGlobais.filter(v => (a==="TODOS"||String(v.ano)===a) && (m==="TODOS"||String(v.mes)===m) && (b===""||String(v.nVenda).toLowerCase().includes(b)||String(v.sku).toLowerCase().includes(b)||String(v.descricao).toLowerCase().includes(b)));
    if(o==="recentes") vendasFiltradasGlobal.sort((x,y)=>x.originalIndex<y.originalIndex?-1:1); else if(o==="margem_alta") vendasFiltradasGlobal.sort((x,y)=>y.porcentagem-x.porcentagem); else vendasFiltradasGlobal.sort((x,y)=>y.lucro-x.lucro);
    atualizarCardsPainel(vendasFiltradasGlobal); atualizarGrafico(vendasFiltradasGlobal); paginaAtualVendas=1; renderPaginaVendas(1);
}
function mudarPaginaVendas(d) { renderPaginaVendas(paginaAtualVendas+d); }
function renderPaginaVendas(p) {
    const tp=Math.ceil(vendasFiltradasGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualVendas=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaVendas'); if(tb) tb.innerHTML='';
    const i=vendasFiltradasGlobal.slice((paginaAtualVendas-1)*ITENS_POR_PAGINA, paginaAtualVendas*ITENS_POR_PAGINA);
    if(!i.length) { if(tb) tb.innerHTML=`<tr><td colspan="11" class="p-4 text-center text-gray-500">Nenhum dado</td></tr>`; return; }
    i.forEach(v => {
        const l=v.urlPlataforma?`<a href="${v.urlPlataforma}" target="_blank" class="text-blue-500 hover:text-blue-700 underline">${v.nVenda} ↗</a>`:v.nVenda;
        const sLow = v.status.toLowerCase();
        let corStatus = sLow.includes('cancelad') || sLow.includes('devol') ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : (sLow.includes('caminho') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300');
        
        let corMargem = "";
        if (v.porcentagem < 10) corMargem = "text-red-600 dark:text-red-400 font-extrabold";
        else if (v.porcentagem <= 20) corMargem = "text-yellow-500 dark:text-yellow-400 font-extrabold";
        else corMargem = "text-emerald-600 dark:text-emerald-400 font-extrabold";
        
        const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";
        tr.innerHTML=`<td class="p-4 text-xs text-gray-500">${v.mes.substring(0,3)}/${v.ano}</td><td class="p-4 truncate max-w-xs font-bold text-gray-800 dark:text-gray-200" title="${v.descricao}">${v.descricao} ${v.sku ? `<div class="text-[10px] text-gray-500 font-mono font-normal mt-0.5">${v.sku}</div>` : ''}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${corStatus}">${v.status}</span></td><td class="p-4 text-center text-xs font-bold bg-gray-50 dark:bg-gray-800/50 rounded-lg">${l} <div class="text-[10px] text-gray-400 font-normal mt-1">${v.plataforma}</div></td><td class="p-4 text-center"><span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full text-xs font-bold">${v.qtd}</span></td><td class="p-4 text-right font-bold">${formatMoney(v.valorVenda)}</td><td class="p-4 text-right text-gray-500">${formatMoney(v.sobra)}</td><td class="p-4 text-right text-red-500 dark:text-red-400 font-semibold">${formatMoney(v.custo)}</td><td class="p-4 text-right font-extrabold ${v.lucro >= 0 ? 'text-emerald-500' : 'text-red-500'}">${formatMoney(v.lucro)}</td><td class="p-4 text-right ${corMargem}">${v.porcentagem.toFixed(2)}%</td><td class="p-4 admin-only text-center"><button onclick="deletarLancamento('${v.originalIndex}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg hover:text-red-700 transition-colors">🗑️</button></td>`;
        if(tb) tb.appendChild(tr);
    });
    const lblP = document.getElementById('lblPaginaVendas'); if(lblP) lblP.innerText=paginaAtualVendas; 
    const lblT = document.getElementById('lblTotalPaginasVendas'); if(lblT) lblT.innerText=tp;
    const btnP = document.getElementById('btnPrevVendas'); if(btnP) btnP.disabled=paginaAtualVendas===1; 
    const btnN = document.getElementById('btnNextVendas'); if(btnN) btnN.disabled=paginaAtualVendas===tp;
}
function atualizarCardsPainel(d) { 
    let f=0, l=0; d.forEach(v=>{f+=v.valorVenda;l+=v.lucro;}); 
    const tf = document.getElementById('totalFaturamento'); if(tf) tf.innerText=formatMoney(f); 
    const tl = document.getElementById('totalLucro'); if(tl) tl.innerText=formatMoney(l); 
    const mm = document.getElementById('mediaMargem'); if(mm) mm.innerText=`${f>0?((l/f)*100).toFixed(2):0}%`; 
}
function atualizarGrafico(d) {
    const a={}; d.forEach(v=>{const l=`${v.mes.substring(0,3)} ${v.ano}`; if(!a[l])a[l]={f:0,l:0}; a[l].f+=v.valorVenda; a[l].l+=v.lucro;});
    const l=Object.keys(a); const cg = document.getElementById('faturamentoChart'); if(!cg) return;
    const c=cg.getContext('2d'); if(graficoInstance) graficoInstance.destroy();
    graficoInstance = new Chart(c, {type:'bar', data:{labels:l, datasets:[{label:'Faturamento Bruto', data:l.map(x=>a[x].f), backgroundColor:'#3b82f6', borderRadius: 4},{label:'Lucro Líquido', data:l.map(x=>a[x].l), backgroundColor:'#10b981', borderRadius: 4}]}, options:{responsive:true, maintainAspectRatio:false, plugins: { legend: { position: 'top' } } }});
}

function calcularMargemForm() { 
    const q=Number(document.getElementById('quantidade')?.value)||1, v=Number(document.getElementById('valorUnitario')?.value)||0, i=Number(document.getElementById('imposto')?.value)||0, c=Number(document.getElementById('custo')?.value)||0; 
    const t=q*v, s=t-(q*i), l=s-(q*c); 
    const ps = document.getElementById('previewSobra'); if(ps) ps.innerText=formatMoney(s); 
    const pl = document.getElementById('previewLucro'); if(pl) pl.innerText=formatMoney(l); 
    const pm = document.getElementById('previewMargem'); if(pm) pm.innerText=`${t>0?((l/t)*100).toFixed(2):0}%`; 
}
function calcularSimuladores() { 
    const c=Number(document.getElementById('calcCusto')?.value)||0, i=Number(document.getElementById('calcImposto')?.value)||0, cm=Number(document.getElementById('calcComissao')?.value)||0, f=Number(document.getElementById('calcFrete')?.value)||0, v=Number(document.getElementById('calcVenda')?.value)||0, m=Number(document.getElementById('calcMargemAlvo')?.value)||0; 
    let lr=0, mr=0, ps=0, lp=0; if(v>0){lr=v-(v*(i/100))-(v*(cm/100))-f-c;mr=(lr/v)*100;} const s=(i/100)+(cm/100)+(m/100); if(s<1) {ps=(c+f)/(1-s);lp=ps*(m/100);} 
    const sl1 = document.getElementById('simLucro1'); if(sl1) { sl1.innerText=formatMoney(lr); sl1.className = lr >= 0 ? "text-emerald-500 font-extrabold text-2xl" : "text-red-500 font-extrabold text-2xl"; }
    const sm1 = document.getElementById('simMargem1'); if(sm1) { sm1.innerText=`${mr.toFixed(2)}%`; sm1.className = mr >= 0 ? "text-purple-500 font-extrabold text-2xl" : "text-red-500 font-extrabold text-2xl"; }
    const sp2 = document.getElementById('simPreco2'); if(sp2) sp2.innerText=formatMoney(ps); 
    const sl2 = document.getElementById('simLucro2'); if(sl2) sl2.innerText=formatMoney(lp); 
}
function limparSimulador() { ['calcVenda','calcCusto','calcImposto','calcComissao','calcFrete','calcMargemAlvo'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); calcularSimuladores(); }

const vendaF = document.getElementById('vendaForm');
if(vendaF) {
    vendaF.addEventListener('submit', async function(e) {
        e.preventDefault(); mostrarLoading("Salvando...");
        const q=Number(document.getElementById('quantidade').value)||1, v=Number(document.getElementById('valorUnitario').value)||0, i=Number(document.getElementById('imposto').value)||0, c=Number(document.getElementById('custo').value)||0, pt=document.getElementById('plataforma').value, nv=document.getElementById('nVenda').value;
        const l=document.getElementById('urlPlataforma').value || (nv&&pt.includes('Mercado')?`https://www.mercadolivre.com.br/vendas/${nv}`:'');
        const t=q*v, s=t-(q*i), lu=s-(q*c);
        const p={ ano:document.getElementById('ano').value, mes:document.getElementById('mes').value, quantidade:q, descricao:document.getElementById('descricao').value, n_venda:nv, plataforma:pt, url_ml:l, valor_venda:t, sobra:s, imposto:(q*i), custo:(q*c), lucro:lu, porcentagem:(t>0?(lu/t):0), sku:document.getElementById('sku').value, status:'Concluído', estorno:0 };
        try { const { error } = await db.from('vendas').upsert(p, {onConflict:'plataforma,n_venda'}); if(error) throw error; limparRascunho(); await carregarDadosDaNuvem(); switchTab('dashboard'); showToast('Salvo!', 'success'); } catch(e){showToast("Erro", "error");} finally {esconderLoading();}
    });
}

async function deletarLancamento(id) { if(localStorage.getItem('app_auth_nivel')!=='ADMIN')return; if(!confirm("Apagar?"))return; mostrarLoading("Apagando..."); try { await db.from('vendas').delete().eq('id',id); await carregarDadosDaNuvem(); showToast("Excluído!","success"); } catch(e){} finally{esconderLoading();} }

// SKUs
function importarCsvSkus(e) {
    const f=e.target.files[0]; if(!f) return; mostrarLoading("Lendo CSV com Motor Avançado..."); const r=new FileReader();
    r.onload=async function(ev) {
        try {
            const d=new Uint8Array(ev.target.result); 
            const w=XLSX.read(d,{type:'array'}); 
            const s=w.Sheets[w.SheetNames[0]]; 
            const rawData=XLSX.utils.sheet_to_json(s,{header:1,defval:""});
            
            if(rawData.length < 2) throw new Error("Planilha vazia ou sem dados.");
            
            const h = rawData[0].map(x=>String(x).trim().toUpperCase());
            const iS=h.indexOf("SKU"), iP=h.indexOf("PRODUTO"), iC=h.findIndex(x=>String(x).includes("CUSTO"));
            if(iS===-1 && iP===-1) throw new Error("Cabeçalho inválido. Faltam colunas SKU ou PRODUTO.");
            
            const mapSkus = {}; 
            for(let i=1;i<rawData.length;i++){ 
                const row = rawData[i];
                if(row.filter(c=>String(c).trim()!=="").length === 0) continue; 
                
                let prodName = iP>-1 ? String(row[iP]).trim() : '';
                let skuCode = iS>-1 && String(row[iS]).trim() !== "" ? String(row[iS]).trim().toUpperCase() : prodName.toUpperCase();
                if(!skuCode) continue; 
                
                let valStr = iC>-1 ? row[iC] : 0;
                mapSkus[skuCode] = { sku: skuCode, produto: prodName || skuCode, custo_atual: universalNumberParse(valStr), status:'Ativo' }; 
            }
            
            const p = Object.values(mapSkus);
            if(p.length>0) { 
                const { error } = await db.from('custos_sku').upsert(p, {onConflict:'sku'}); 
                if(error) throw new Error("Erro no Supabase: " + error.message);
                await carregarDadosDaNuvem(); 
                showToast(p.length + " SKUs importados com sucesso!", "success"); 
            } else {
                throw new Error("Nenhum dado válido encontrado nas linhas.");
            }
        } catch(err){
            showToast(err.message, "error");
        } finally{
            esconderLoading(); 
            const fi = document.getElementById('fileImportSkuCsv'); if(fi) fi.value='';
        }
    }; r.readAsArrayBuffer(f);
}
function renderPaginaSkus(p) {
    const bsEl = document.getElementById('buscaSkus'); const b = bsEl ? bsEl.value.toLowerCase() : ''; 
    skusFiltradosGlobal=catalogoSkusGlobais.filter(s=>String(s.SKU).toLowerCase().includes(b)||String(s.PRODUTO).toLowerCase().includes(b));
    const tp=Math.ceil(skusFiltradosGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualSkus=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaSkus'); if(tb) tb.innerHTML='';
    skusFiltradosGlobal.slice((paginaAtualSkus-1)*ITENS_POR_PAGINA, paginaAtualSkus*ITENS_POR_PAGINA).forEach(s => {
        let isActive = String(s.STATUS).trim().toUpperCase() !== "INATIVO";
        let statusClass = isActive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";

        const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";
        tr.innerHTML=`<td class="p-4 font-mono text-sm dark:text-gray-300 font-bold">${s.SKU}</td><td class="p-4 text-gray-800 dark:text-gray-200 font-bold">${s.PRODUTO}</td><td class="p-4 text-right text-red-500 font-extrabold">${formatMoney(s.CUSTO_ATUAL)}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${statusClass}">${s.STATUS || "Ativo"}</span></td><td class="p-4 text-center admin-only"><button onclick="editarSku('${s.SKU}')" class="text-blue-500 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg hover:text-blue-700 transition-colors">✏️</button></td>`; 
        if(tb) tb.appendChild(tr);
    });
    const l1 = document.getElementById('lblPaginaSkus'); if(l1) l1.innerText=paginaAtualSkus; 
    const l2 = document.getElementById('lblTotalPaginasSkus'); if(l2) l2.innerText=tp;
    const btnP = document.getElementById('btnPrevSkus'); if(btnP) btnP.disabled=paginaAtualSkus===1; 
    const btnN = document.getElementById('btnNextSkus'); if(btnN) btnN.disabled=paginaAtualSkus===tp;
}
function mudarPaginaSkus(d) { renderPaginaSkus(paginaAtualSkus+d); }
function editarSku(c) { const p=catalogoSkusGlobais.find(s=>s.SKU===c); if(p){ document.getElementById('skuForm_sku').value=p.SKU; document.getElementById('skuForm_produto').value=p.PRODUTO; document.getElementById('skuForm_custoAtual').value=Number(p.CUSTO_ATUAL || 0); document.getElementById('skuForm_custoMedio').value=Number(p.CUSTO_MEDIO || 0); document.getElementById('skuForm_fornecedor').value=p.FORNECEDOR; document.getElementById('skuForm_status').value=p.STATUS==='INATIVO'?'Inativo':'Ativo'; window.scrollTo(0,0); } }

const formSku = document.getElementById('formCadastroSku');
if(formSku) {
    formSku.addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { await db.from('custos_sku').upsert({sku:document.getElementById('skuForm_sku').value, produto:document.getElementById('skuForm_produto').value, custo_atual:document.getElementById('skuForm_custoAtual').value, custo_medio:document.getElementById('skuForm_custoMedio').value, fornecedor:document.getElementById('skuForm_fornecedor').value, status:document.getElementById('skuForm_status').value}, {onConflict:'sku'}); document.getElementById('formCadastroSku').reset(); await carregarDadosDaNuvem(); showToast("SKU Salvo!","success"); } catch(er){} finally{esconderLoading();} });
}

// Users
function renderTabelaUsuarios() {
    const tb=document.getElementById('tabelaUsuarios'); if(!tb) return; tb.innerHTML='';
    usuariosGlobais.forEach(u => { const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"; tr.innerHTML=`<td class="p-4 font-bold text-gray-800 dark:text-gray-200 font-mono">${u.usuario}</td><td class="p-4 text-gray-700 dark:text-gray-300">${u.nome}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${u.nivel==='ADMIN'?'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300':'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}">${u.nivel}</span></td><td class="p-4 text-center"><button onclick="editarUsuario('${u.usuario}','${u.nome}','${u.nivel}')" class="text-blue-500 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg hover:text-blue-700 transition-colors mr-2">✏️</button><button onclick="deletarUsuario('${u.originalIndex}','${u.usuario}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg hover:text-red-700 transition-colors">🗑️</button></td>`; tb.appendChild(tr); });
}
function editarUsuario(u,n,l) { document.getElementById('userForm_user').value=u; document.getElementById('userForm_nome').value=n; document.getElementById('userForm_nivel').value=l; document.getElementById('userForm_senha').value=''; window.scrollTo(0,0); }

const formUser = document.getElementById('formCadastroUser');
if(formUser) {
    formUser.addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { const u=document.getElementById('userForm_user').value.toLowerCase(), s=document.getElementById('userForm_senha').value; const p={usuario:u, nome:document.getElementById('userForm_nome').value, nivel:document.getElementById('userForm_nivel').value}; const {data}=await db.from('usuarios').select('id,senha').eq('usuario',u); if(s) p.senha=await hashSHA256(s); else if(data&&data.length>0) p.senha=data[0].senha; else p.senha=await hashSHA256(u); if(data&&data.length>0) await db.from('usuarios').update(p).eq('id',data[0].id); else await db.from('usuarios').insert([p]); document.getElementById('formCadastroUser').reset(); await carregarDadosDaNuvem(); showToast("Salvo!","success"); } catch(er){} finally{esconderLoading();} });
}
async function deletarUsuario(id,u) { if(u===localStorage.getItem('app_auth_login'))return showToast("Você não pode se excluir.","error"); if(!confirm("Apagar?"))return; mostrarLoading(); try { await db.from('usuarios').delete().eq('id',id); await carregarDadosDaNuvem(); } catch(e){} finally{esconderLoading();} }

// Lote Import
function iniciarImportacao(e) {
    const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=function(ev) {
        const d=new Uint8Array(ev.target.result), w=XLSX.read(d,{type:'array'}), s=w.Sheets[w.SheetNames[0]]; rawDataGlobal=XLSX.utils.sheet_to_json(s,{header:1,defval:""});
        if(rawDataGlobal.length===0) return showToast("Vazio","error");
        let ml=0, mp=0; for(let i=0;i<Math.min(20,rawDataGlobal.length);i++){let p=rawDataGlobal[i].filter(c=>String(c).trim()!=="").length; if(p>mp){mp=p;ml=i;}}
        importHeadersGlobal=rawDataGlobal[ml].map((h,i)=>h?String(h).trim():`Vazia_${i}`); importDataGlobal=[];
        for(let i=ml+1;i<rawDataGlobal.length;i++){let o={}, hd=false; rawDataGlobal[i].forEach((v,id)=>{o[importHeadersGlobal[id]]=v; if(String(v).trim()!=="")hd=true;}); if(hd)importDataGlobal.push(o);}
        const dt=new Date(); const gA=document.getElementById('globalAno'); if(gA) gA.value=dt.getFullYear(); const gM=document.getElementById('globalMes'); if(gM) gM.value=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"][dt.getMonth()]; const gp=document.getElementById('globalPlataforma'); if(gp) gp.value=importHeadersGlobal.some(h=>h.toLowerCase().includes('tarifa'))?'Mercado Livre':'Direto';
        construirInterfaceMapeamento(); const mM = document.getElementById('modalMapeamento'); if(mM) mM.classList.remove('hidden'); const fid = document.getElementById('fileImportData'); if(fid) fid.value="";
    }; r.readAsArrayBuffer(f);
}
function fecharModalMapeamento() { const mm=document.getElementById('modalMapeamento'); if(mm) mm.classList.add('hidden'); }
function salvarEstadoImportacao() { atualizarMapeamentoDinamico(); } 
function restaurarEstadoImportacao() {} 
function extrairMesAnoDaData(d) { if(!d)return null; let p=String(d).toLowerCase().split(' de '); if(p.length>=3) return {mes:p[1].trim().toUpperCase(), ano:parseInt(p[2].trim().substring(0,4))}; return null; }

function extrairProdutosUnicos() {
    const md = document.getElementById('map_desc'); const ms = document.getElementById('map_sku');
    const cd=md?md.value:'', cs=ms?ms.value:''; const ac=document.getElementById('areaCustosDinamicos'), lc=document.getElementById('listaCustosProdutos'); if(lc) lc.innerHTML='';
    if(!cd) { if(ac) ac.classList.add('hidden'); return; } const map={}; importDataGlobal.forEach(r=>{const d=r[cd]?String(r[cd]).trim():""; if(d&&!map[d])map[d]=cs&&r[cs]?String(r[cs]).trim().toUpperCase():"";});
    produtosUnicosGlobal=Object.keys(map); window.custosMapeadosLote={}; let hp="";
    produtosUnicosGlobal.forEach((p,i) => {
        let sc=0; const rsku=map[p];
        if(rsku&&catalogoSkus[rsku]) sc=catalogoSkus[rsku].custo_atual; else { const f=Object.keys(catalogoSkus).find(k=>catalogoSkus[k].produto.toLowerCase()===p.toLowerCase()); if(f) sc=catalogoSkus[f].custo_atual; }
        window.custosMapeadosLote[p]=sc; if(sc<=0) hp+=`<div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg mb-2 shadow-sm"><span class="text-xs font-bold text-gray-700 dark:text-gray-300 w-2/3 truncate" title="${p}">${p}</span><input type="number" step="0.01" class="w-1/3 p-2 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold text-red-600 dark:bg-gray-700 dark:text-red-400 outline-none focus:ring-2 focus:ring-red-500" oninput="window.custosMapeadosLote['${p.replace(/'/g,"\\'")}']=Number(this.value)||0; renderPreviewImportacao();" placeholder="R$ Custo"></div>`;
    });
    if(hp) { if(ac) ac.classList.remove('hidden'); if(lc) lc.innerHTML=hp; } else { if(ac) ac.classList.add('hidden'); }
}

function renderPreviewImportacao() {
    const tb = document.getElementById('tabelaPreviewImportacao');
    const container = document.getElementById('areaPreviewImportacao');
    if(!tb || !container) return;
    tb.innerHTML = '';
    
    const gaEl = document.getElementById('globalAno'), gmEl = document.getElementById('globalMes'), giEl = document.getElementById('globalImposto');
    const aG = gaEl ? gaEl.value : new Date().getFullYear(), mG = gmEl ? gmEl.value : '', impG = Number(giEl ? giEl.value : 0) || 0;
    
    const cdEl=document.getElementById('map_data'), csEl=document.getElementById('map_sku'), cdeEl=document.getElementById('map_desc'), cqEl=document.getElementById('map_qtd'), cveEl=document.getElementById('map_venda'), ctoEl=document.getElementById('map_total'), cesEl=document.getElementById('map_estorno'), cstEl=document.getElementById('map_status');
    
    const cData=cdEl?cdEl.value:'', cSku=csEl?csEl.value:'', cDesc=cdeEl?cdeEl.value:'', cQtd=cqEl?cqEl.value:'', cVen=cveEl?cveEl.value:'', cTot=ctoEl?ctoEl.value:'';
    
    if(!cDesc) { container.classList.add('hidden'); return; }
    
    let count = 0;
    for(let r of importDataGlobal) {
        if(!r[cDesc]) continue;
        
        let md=mG, ad=aG; 
        if(cData&&r[cData]){ const ex=extrairMesAnoDaData(r[cData]); if(ex){md=ex.mes;ad=ex.ano;} }
        
        let rp=cVen?universalNumberParse(r[cVen]):0, to=cTot?universalNumberParse(r[cTot]):0, es=cesEl&&cesEl.value?universalNumberParse(r[cesEl.value]):0;
        let q=Number(r[cQtd])||1, sk=r[cSku]||"", ds=r[cDesc]||"N/A", st=cstEl&&cstEl.value?r[cstEl.value]||"Concluído":"Concluído";
        
        let canc=(cTot&&(es<0||to<=0))||(!cTot&&(st.toLowerCase().includes('canc')||rp<=0));
        let trep=cTot?to:rp, imp=rp*(impG/100), cst=(window.custosMapeadosLote[ds]||0)*q;
        
        if(canc){rp=0;imp=0;cst=0;}
        let sob=trep-imp, luc=sob-cst;
        
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
        tr.innerHTML = `
            <td class="p-3 text-xs font-bold text-gray-500">${md.substring(0,3)}/${ad}</td>
            <td class="p-3 font-mono text-[10px] font-bold text-gray-400">${sk || '-'}</td>
            <td class="p-3 truncate max-w-[200px] font-semibold" title="${ds}">${ds}</td>
            <td class="p-3 text-center font-bold text-indigo-600">${q}</td>
            <td class="p-3 text-right text-blue-600 dark:text-blue-400 font-bold">${formatMoney(rp)}</td>
            <td class="p-3 text-right text-orange-500 font-semibold">${formatMoney(imp)}</td>
            <td class="p-3 text-right text-red-500 font-semibold">${formatMoney(cst)}</td>
            <td class="p-3 text-right font-extrabold ${luc >= 0 ? 'text-emerald-500' : 'text-red-500'}">${formatMoney(luc)}</td>
        `;
        tb.appendChild(tr);
        
        count++;
        if(count >= 3) break;
    }
    
    if(count > 0) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

function atualizarMapeamentoDinamico() {
    extrairProdutosUnicos();
    renderPreviewImportacao();
}

function construirInterfaceMapeamento() {
    const c=document.getElementById('mapeamentoContainer'); if(!c) return; c.innerHTML='';
    [{id:'map_data',l:'Data',s:['Data']}, {id:'map_sku',l:'SKU',s:['SKU']}, {id:'map_desc',l:'Descrição',s:['Título']}, {id:'map_nven',l:'Pedido',s:['N.º']}, {id:'map_qtd',l:'Qtd',s:['Unidade']}, {id:'map_status',l:'Status',s:['Estado']}, {id:'map_venda',l:'Venda (R$)',s:['Receita por pro']}, {id:'map_rec_envio',l:'Envio (R$)',s:['Receita por env']}, {id:'map_tarifa_venda',l:'Tarifa V. (R$)',s:['Tarifa de vend']}, {id:'map_tarifa_envio',l:'Tarifa E. (R$)',s:['Tarifas de env']}, {id:'map_estorno',l:'Estorno (R$)',s:['Cancelamento']}, {id:'map_total',l:'Total (R$)',s:['Total']}].forEach(f => {
        let h=`<div class="flex flex-col bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"><label class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 ml-1">${f.l}</label><select id="${f.id}" onchange="atualizarMapeamentoDinamico()" class="p-2.5 outline-none text-xs border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"><option value="">-- Ignorar --</option>`;
        importHeadersGlobal.forEach(hd => { h+=`<option value="${hd}" ${f.s.some(x=>hd.toLowerCase().includes(x.toLowerCase()))?'selected':''}>${hd}</option>`; });
        c.innerHTML+=h+'</select></div>';
    }); 
    atualizarMapeamentoDinamico();
}

async function processarEnvioEmLote() {
    mostrarLoading("Enviando Lote...");
    const gaEl = document.getElementById('globalAno'), gmEl = document.getElementById('globalMes'), gpEl = document.getElementById('globalPlataforma'), giEl = document.getElementById('globalImposto');
    const aG=gaEl?gaEl.value:new Date().getFullYear(), mG=gmEl?gmEl.value:'', pG=gpEl?gpEl.value:'', impG=Number(giEl?giEl.value:0)||0;
    
    const cdEl=document.getElementById('map_data'), csEl=document.getElementById('map_sku'), cdeEl=document.getElementById('map_desc'), cnvEl=document.getElementById('map_nven'), cqEl=document.getElementById('map_qtd'), cstEl=document.getElementById('map_status'), cveEl=document.getElementById('map_venda'), creEl=document.getElementById('map_rec_envio'), ctvEl=document.getElementById('map_tarifa_venda'), cteEl=document.getElementById('map_tarifa_envio'), cesEl=document.getElementById('map_estorno'), ctoEl=document.getElementById('map_total');
    
    const cData=cdEl?cdEl.value:'', cSku=csEl?csEl.value:'', cDesc=cdeEl?cdeEl.value:'', cNv=cnvEl?cnvEl.value:'', cQtd=cqEl?cqEl.value:'', cSt=cstEl?cstEl.value:'', cVen=cveEl?cveEl.value:'', cRe=creEl?creEl.value:'', cTv=ctvEl?ctvEl.value:'', cTe=cteEl?cteEl.value:'', cEs=cesEl?cesEl.value:'', cTot=ctoEl?ctoEl.value:'';
    
    let b=[], log=[], qN=0, qA=0;
    for(let r of importDataGlobal) {
        if(!r[cDesc]) continue;
        let md=mG, ad=aG; if(cData&&r[cData]){const ex=extrairMesAnoDaData(r[cData]); if(ex){md=ex.mes;ad=ex.ano;}}
        let rp=cVen?universalNumberParse(r[cVen]):0, to=cTot?universalNumberParse(r[cTot]):0, es=cEs?universalNumberParse(r[cEs]):0;
        let q=Number(r[cQtd])||1, sk=r[cSku]||"", ds=r[cDesc]||"N/A", nv=r[cNv]||"-", st=cSt&&r[cSt]?r[cSt]:"Concluído";
        let canc=(cTot&&(es<0||to<=0))||(!cTot&&(st.toLowerCase().includes('canc')||rp<=0));
        let trep=cTot?to:rp, imp=rp*(impG/100), cst=(window.custosMapeadosLote[ds]||0)*q;
        if(canc){rp=0;imp=0;cst=0;}
        let sob=trep-imp, luc=sob-cst, mar=rp>0?luc/rp:0;
        let exv=vendasGlobais.some(v=>v.nVenda===nv&&v.plataforma===pG); if(exv)qA++;else qN++;
        b.push({ano:ad, mes:md, quantidade:q, descricao:ds, n_venda:nv, plataforma:pG, valor_venda:rp, sobra:sob, imposto:imp, custo:cst, lucro:luc, porcentagem:mar, sku:sk, status:st, estorno:es});
    }
    if(b.length>0) {
        try { 
            const {error} = await db.from('vendas').upsert(b, {onConflict:'plataforma,n_venda'}); if(error)throw error; 
            const rn=document.getElementById('resumoLoteNovos'); if(rn) rn.innerText=qN; 
            const ra=document.getElementById('resumoLoteAtualizados'); if(ra) ra.innerText=qA; 
            const mm=document.getElementById('modalMapeamento'); if(mm) mm.classList.add('hidden'); 
            await carregarDadosDaNuvem(); 
            const rm=document.getElementById('modalResumoLote'); if(rm) rm.classList.remove('hidden'); 
        } catch(e){}
    }
    esconderLoading();
}
