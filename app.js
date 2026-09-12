const SUPABASE_URL = "https://jsoujnbaucvvwgfilnoc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzb3VqbmJhdWN2dndnZmlsbm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDA5MzIsImV4cCI6MjEwNDcxNjkzMn0.l-dTfSmQzEsQF0AP-CPx0xZI9ox6hFyF4G8bDKSg7yw";

let supabase;
try { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } 
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
    if(nt) { nt.innerText = nivel === 'ADMIN' ? "👑 ADMIN" : "👤 OPERADOR"; nt.className = nivel === 'ADMIN' ? "text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-700" : "text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700"; }
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarTema(); configurarDataAtual();
    const token = localStorage.getItem('app_auth_token');
    const userName = localStorage.getItem('app_auth_name');
    if (token) {
        document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appContent').classList.remove('hidden');
        if(userName) document.getElementById('bemVindoText').innerText = `Olá, ${userName}`;
        aplicarPermissoes(); carregarRascunhoForm(); carregarDadosDaNuvem(); restaurarEstadoImportacao(); 
    } else {
        document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('appContent').classList.add('hidden');
        testarConexaoLogin();
    }
    document.querySelectorAll('.form-draft').forEach(el => { el.addEventListener('input', salvarRascunhoForm); el.addEventListener('change', salvarRascunhoForm); });
    document.getElementById('sku').addEventListener('blur', function() {
        const codigo = this.value.trim().toUpperCase();
        if(codigo && catalogoSkus[codigo]) {
            document.getElementById('descricao').value = catalogoSkus[codigo].produto; document.getElementById('custo').value = catalogoSkus[codigo].custo_atual;
            calcularMargemForm(); showToast('SKU Localizado!', 'success');
        }
    });
});

async function testarConexaoLogin() {
    const dot = document.getElementById('loginStatusDot'), text = document.getElementById('loginStatusText'), btn = document.getElementById('btnLogin');
    dot.className = "w-2.5 h-2.5 rounded-full bg-yellow-400 mr-2 animate-pulse"; text.innerText = "Testando conexão..."; btn.disabled = true;
    try {
        if (!window.supabase) throw new Error("Supabase não carregado.");
        const { error } = await supabase.from('usuarios').select('id').limit(1);
        if (error) throw new Error(error.message);
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2"; text.innerText = "Sistema Online"; btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } catch (e) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 mr-2"; text.innerText = "Erro: " + e.message; setTimeout(testarConexaoLogin, 6000);
    }
}

document.getElementById('formLogin').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin'), spinner = document.getElementById('loginSpinner');
    btn.classList.add('hidden'); spinner.classList.remove('hidden');
    const u = document.getElementById('loginUser').value.trim().toLowerCase(), p = document.getElementById('loginPass').value.trim();
    try {
        const hp = await hashSHA256(p);
        const { count } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
        if (count === 0 && u === 'admin' && p === 'admin') await supabase.from('usuarios').insert([{ usuario: 'admin', senha: hp, nome: 'Administrador', nivel: 'ADMIN' }]);
        const { data } = await supabase.from('usuarios').select('*').eq('usuario', u).eq('senha', hp);
        if (data && data.length > 0) {
            const ud = data[0]; localStorage.setItem('app_auth_token', ud.senha); localStorage.setItem('app_auth_name', ud.nome); localStorage.setItem('app_auth_nivel', ud.nivel); localStorage.setItem('app_auth_login', ud.usuario);
            document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appContent').classList.remove('hidden'); document.getElementById('bemVindoText').innerText = `Olá, ${ud.nome}`;
            aplicarPermissoes(); carregarRascunhoForm(); carregarDadosDaNuvem(); showToast('Login efetuado!', 'success');
        } else { alert("Acesso negado."); btn.classList.remove('hidden'); spinner.classList.add('hidden'); }
    } catch (err) { alert("Erro servidor."); btn.classList.remove('hidden'); spinner.classList.add('hidden'); }
});

function fazerLogout() { localStorage.clear(); location.reload(); }
function abrirModalSenha() { document.getElementById('modalSenha').classList.remove('hidden'); document.getElementById('formAlterarSenha').reset(); }
function fecharModalSenha() { document.getElementById('modalSenha').classList.add('hidden'); }
function abrirModalExcluirMes() { document.getElementById('modalExcluirMes').classList.remove('hidden'); document.getElementById('delMesAno').value = new Date().getFullYear(); }
function fecharModalExcluirMes() { document.getElementById('modalExcluirMes').classList.add('hidden'); }
function showToast(m, t='info') { const c = document.getElementById('toast-container'), toast = document.createElement('div'); toast.className = `toast ${t}`; toast.innerHTML = `<span>${m}</span>`; c.appendChild(toast); setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000); }
function mostrarLoading(t="Processando...") { document.getElementById('globalOverlayText').innerText = t; document.getElementById('globalOverlay').classList.remove('hidden'); }
function esconderLoading() { document.getElementById('globalOverlay').classList.add('hidden'); }
function fecharModalResumoLote() { document.getElementById('modalResumoLote').classList.add('hidden'); document.getElementById('areaLogsAuditoria').classList.add('hidden'); }

document.getElementById('formAlterarSenha').addEventListener('submit', async function(e) {
    e.preventDefault();
    const sa = document.getElementById('senhaAtual').value.trim(), sn = document.getElementById('senhaNova').value.trim(), sc = document.getElementById('senhaNovaConfirma').value.trim();
    if (sn !== sc) return showToast("Senhas não conferem.", "error");
    if (sn.length < 4) return showToast("Mínimo 4 caracteres.", "error");
    mostrarLoading("Alterando...");
    try {
        const u = localStorage.getItem('app_auth_login'), ha = await hashSHA256(sa);
        const { data } = await supabase.from('usuarios').select('*').eq('usuario', u).eq('senha', ha);
        if (data && data.length > 0) { const hn = await hashSHA256(sn); await supabase.from('usuarios').update({ senha: hn }).eq('usuario', u); localStorage.setItem('app_auth_token', hn); showToast("Senha alterada!", 'success'); fecharModalSenha(); }
        else showToast("Senha atual incorreta.", 'error');
    } catch (err) { showToast("Erro.", "error"); } finally { esconderLoading(); }
});

document.getElementById('formExcluirMes').addEventListener('submit', async function(e) {
    e.preventDefault();
    const a = document.getElementById('delMesAno').value, m = document.getElementById('delMesNome').value, s = document.getElementById('delMesSenha').value.trim();
    if(!confirm(`⚠️ Apagar TODOS os lançamentos de ${m}/${a}?`)) return;
    mostrarLoading("Apagando...");
    try {
        const u = localStorage.getItem('app_auth_login'), hs = await hashSHA256(s);
        const { data } = await supabase.from('usuarios').select('*').eq('usuario', u).eq('senha', hs);
        if (data && data.length > 0 && data[0].nivel === 'ADMIN') { const { error } = await supabase.from('vendas').delete().eq('ano', a).ilike('mes', m); if(!error) { showToast("Excluídos!", 'success'); fecharModalExcluirMes(); await carregarDadosDaNuvem(); } else showToast("Erro DB.", 'error'); }
        else showToast("Acesso negado.", 'error');
    } catch (err) { showToast("Erro.", "error"); } finally { esconderLoading(); }
});

window.addEventListener('click', function(e){ const b = document.getElementById('exportMenuBtn'), d = document.getElementById('exportDropdown'); if (b && d && !b.contains(e.target) && !d.contains(e.target)) d.classList.add('hidden'); });
function toggleExportMenu() { document.getElementById('exportDropdown').classList.toggle('hidden'); }
function switchTab(id) {
    ['dashboard', 'novo', 'calculadora', 'skus', 'usuarios', 'analise'].forEach(t => { const el = document.getElementById('tab-'+t), bt = document.getElementById('btn-tab-'+t); if(el) el.classList.add('hidden'); if(bt) bt.className = "px-5 py-2 rounded-full font-bold text-sm text-gray-600 hover:bg-white/40 " + (['usuarios','novo','skus','analise'].includes(t)?'admin-only':''); });
    document.getElementById('tab-'+id).classList.remove('hidden'); document.getElementById('btn-tab-'+id).className = "px-5 py-2 rounded-full font-bold text-sm shadow-md text-white bg-blue-600 " + (['usuarios','novo','skus','analise'].includes(id)?'admin-only':''); aplicarPermissoes();
}
function toggleGrafico() { document.getElementById('graficoContainer').classList.toggle('hidden'); }
function salvarRascunhoForm() { const d = {}; document.querySelectorAll('.form-draft').forEach(el => d[el.id] = el.value); localStorage.setItem('vendaDraft', JSON.stringify(d)); }
function carregarRascunhoForm() { const d = localStorage.getItem('vendaDraft'); if (d) try { const o = JSON.parse(d); Object.keys(o).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = o[id]; }); calcularMargemForm(); } catch(e){} }
function limparRascunho() { localStorage.removeItem('vendaDraft'); document.getElementById('vendaForm').reset(); configurarDataAtual(); calcularMargemForm(); }
function inicializarTema() { if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) toggleDarkMode(true); }
function toggleDarkMode(f = null) { const h = document.documentElement; isDarkMode = f !== null ? f : !h.classList.contains('dark'); if (isDarkMode) { h.classList.add('dark'); localStorage.setItem('theme', 'dark'); } else { h.classList.remove('dark'); localStorage.setItem('theme', 'light'); } if(vendasGlobais.length > 0) aplicarFiltros(); }
function configurarDataAtual() { const d = new Date(); document.getElementById('ano').value = d.getFullYear(); const m = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]; document.getElementById('mes').value = m[d.getMonth()]; document.getElementById('filtroAno').value = d.getFullYear(); document.getElementById('filtroMes').value = m[d.getMonth()]; }

async function carregarDadosDaNuvem() {
    if (isFetching) return; isFetching = true;
    const ind = document.getElementById('statusConexao'), txt = document.getElementById('textoConexao');
    ind.className = "w-2.5 h-2.5 rounded-full bg-yellow-400 mr-2 animate-pulse"; txt.innerText = "Sincronizando DB...";
    try {
        const [vR, sR, uR] = await Promise.all([ supabase.from('vendas').select('*').order('created_at', { ascending: false }), supabase.from('custos_sku').select('*'), supabase.from('usuarios').select('*') ]);
        if (vR.error) throw vR.error;
        vendasGlobais = (vR.data || []).map(v => ({ originalIndex: v.id, ano: v.ano, mes: String(v.mes).toUpperCase(), qtd: v.quantidade, descricao: v.descricao, sku: v.sku, nVenda: v.n_venda, urlPlataforma: v.url_ml, plataforma: v.plataforma, valorVenda: Number(v.valor_venda), sobra: Number(v.sobra), imposto: Number(v.imposto), custo: Number(v.custo), lucro: Number(v.lucro), porcentagem: Number(v.porcentagem)*100, status: v.status }));
        aplicarFiltros();
        if (sR.data) { catalogoSkusGlobais = sR.data.map(s => ({ SKU: s.sku, PRODUTO: s.produto, CUSTO_ANTERIOR: s.custo_anterior, CUSTO_ATUAL: s.custo_atual, CUSTO_MEDIO: s.custo_medio, FORNECEDOR: s.fornecedor, DATA_ATUALIZACAO: s.data_atualizacao, STATUS: s.status })); parseSkusDictionary(); renderPaginaSkus(1); }
        if (uR.data) { usuariosGlobais = uR.data.map(u => ({ usuario: u.usuario, nome: u.nome, nivel: u.nivel, originalIndex: u.id })); renderTabelaUsuarios(); }
        carregarFiltroAnalise();
        ind.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2"; txt.innerText = `Online`; isFetching = false;
    } catch (e) { ind.className = "w-2.5 h-2.5 rounded-full bg-red-500 mr-2"; txt.innerText = "Offline"; isFetching = false; setTimeout(carregarDadosDaNuvem, 15000); }
}

function parseSkusDictionary() { catalogoSkus = {}; catalogoSkusGlobais.forEach(s => { let c = String(s.SKU||"").trim().toUpperCase(); if(c && String(s.STATUS||"").trim().toUpperCase() !== "INATIVO") catalogoSkus[c] = { produto: String(s.PRODUTO).trim(), custo_atual: Number(s.CUSTO_ATUAL) }; }); }

function carregarFiltroAnalise() {
    const s = document.getElementById('selectAnaliseSku'); if(!s) return; s.innerHTML = '<option value="">-- Produto/SKU --</option>'; const m = new Map();
    catalogoSkusGlobais.forEach(x => { let k = String(x.SKU||"").trim().toUpperCase() || String(x.PRODUTO||"").trim(); if(k && !m.has(k)) m.set(k, {sku: x.SKU, nome: x.PRODUTO}); });
    vendasGlobais.forEach(v => { let k = String(v.sku||"").trim().toUpperCase() || String(v.descricao||"").trim(); if(k && !m.has(k)) m.set(k, {sku: v.sku, nome: v.descricao}); });
    Array.from(m.keys()).sort().forEach(k => { const d = m.get(k), o = document.createElement('option'); o.value = k; o.innerText = d.sku ? `${d.sku} - ${d.nome}` : d.nome; s.appendChild(o); });
}

function renderizarAbaInteligencia() {
    const k = document.getElementById('selectAnaliseSku').value, v = document.getElementById('containerAnaliseVazia'), d = document.getElementById('containerAnaliseDados');
    if(!k) { v.classList.remove('hidden'); d.classList.add('hidden'); return; }
    v.classList.add('hidden'); d.classList.remove('hidden');
    const vs = vendasGlobais.filter(x => (String(x.sku||"").trim().toUpperCase() || String(x.descricao||"").trim()).toUpperCase() === k.toUpperCase()).sort((a,b) => new Date(a.ano, a.mes) - new Date(b.ano, b.mes));
    let u=0, r=0, l=0; const hP=[], hC=[], hM=[], lx=[];
    vs.forEach(x => { if(x.valorVenda<=0) return; const q=x.qtd>0?x.qtd:1; u+=q; r+=x.valorVenda; l+=x.lucro; lx.push(`${x.mes.substring(0,3)}/${x.ano}`); hP.push(x.valorVenda/q); hC.push(x.custo/q); hM.push(x.porcentagem); });
    const pm = u>0?(r/u):0, mm = r>0?(l/r)*100:0;
    document.getElementById('analiseQtdTotal').innerText = u; document.getElementById('analisePrecoMedio').innerText = `R$ ${pm.toFixed(2)}`; document.getElementById('analiseMargemMedia').innerText = `${mm.toFixed(2)}%`;
    if(chartAnalise) chartAnalise.destroy();
    chartAnalise = new Chart(document.getElementById('chartAnaliseSku').getContext('2d'), { type:'line', data:{labels:lx, datasets:[{label:'Preço', data:hP, borderColor:'#3b82f6'}, {label:'Custo', data:hC, borderColor:'#ef4444'}, {label:'Margem', data:hM, borderColor:'#10b981', yAxisID:'y1'}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{position:'left'}, y1:{position:'right'}}} });
}

function gerarCanvasAreaTopo() {
    return new Promise((res, rej) => {
        switchTab('dashboard'); window.scrollTo(0,0); const s = document.getElementById('secaoHistorico'), w = s.style.display !== 'none'; s.style.display = 'none';
        const a = document.getElementById('areaExport'), oW = a.style.width, oP = a.style.padding, oB = a.style.backgroundColor, cW = a.offsetWidth || window.innerWidth;
        a.style.width = cW+'px'; a.style.padding = '24px'; a.style.backgroundColor = isDarkMode?'#1f2937':'#f8fafc';
        setTimeout(() => { html2canvas(a, {scale:2, useCORS:true, width:cW, windowWidth:cW}).then(c => { a.style.width=oW; a.style.padding=oP; a.style.backgroundColor=oB; if(w) s.style.display=''; res(c); }).catch(rej); }, 500);
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
    const a=document.getElementById('filtroAno').value, m=document.getElementById('filtroMes').value, o=document.getElementById('ordenacao').value, b=document.getElementById('buscaVendas').value.toLowerCase();
    vendasFiltradasGlobal = vendasGlobais.filter(v => (a==="TODOS"||String(v.ano)===a) && (m==="TODOS"||String(v.mes)===m) && (b===""||String(v.nVenda).toLowerCase().includes(b)||String(v.sku).toLowerCase().includes(b)||String(v.descricao).toLowerCase().includes(b)));
    if(o==="recentes") vendasFiltradasGlobal.sort((x,y)=>x.originalIndex<y.originalIndex?-1:1); else if(o==="margem_alta") vendasFiltradasGlobal.sort((x,y)=>y.porcentagem-x.porcentagem); else vendasFiltradasGlobal.sort((x,y)=>y.lucro-x.lucro);
    atualizarCardsPainel(vendasFiltradasGlobal); atualizarGrafico(vendasFiltradasGlobal); paginaAtualVendas=1; renderPaginaVendas(1);
}
function mudarPaginaVendas(d) { renderPaginaVendas(paginaAtualVendas+d); }
function renderPaginaVendas(p) {
    const tp=Math.ceil(vendasFiltradasGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualVendas=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaVendas'); tb.innerHTML='';
    const i=vendasFiltradasGlobal.slice((paginaAtualVendas-1)*ITENS_POR_PAGINA, paginaAtualVendas*ITENS_POR_PAGINA);
    if(!i.length) return tb.innerHTML=`<tr><td colspan="11" class="p-4 text-center text-gray-500">Nenhum dado</td></tr>`;
    i.forEach(v => {
        const l=v.urlPlataforma?`<a href="${v.urlPlataforma}" target="_blank" class="text-blue-500">${v.nVenda}</a>`:v.nVenda;
        const tr=document.createElement('tr'); tr.innerHTML=`<td class="p-4 text-xs">${v.mes.substring(0,3)}/${v.ano}</td><td class="p-4 truncate max-w-xs">${v.descricao}</td><td class="p-4">${v.status}</td><td class="p-4 text-center">${l}</td><td class="p-4 text-center">${v.qtd}</td><td class="p-4 text-right">${formatMoney(v.valorVenda)}</td><td class="p-4 text-right">${formatMoney(v.sobra)}</td><td class="p-4 text-right">${formatMoney(v.custo)}</td><td class="p-4 text-right font-bold">${formatMoney(v.lucro)}</td><td class="p-4 text-right">${v.porcentagem.toFixed(2)}%</td><td class="p-4 admin-only"><button onclick="deletarLancamento('${v.originalIndex}')" class="text-red-500">🗑️</button></td>`;
        tb.appendChild(tr);
    });
    document.getElementById('lblPaginaVendas').innerText=paginaAtualVendas; document.getElementById('lblTotalPaginasVendas').innerText=tp;
    document.getElementById('btnPrevVendas').disabled=paginaAtualVendas===1; document.getElementById('btnNextVendas').disabled=paginaAtualVendas===tp;
}
function atualizarCardsPainel(d) { let f=0, l=0; d.forEach(v=>{f+=v.valorVenda;l+=v.lucro;}); document.getElementById('totalFaturamento').innerText=formatMoney(f); document.getElementById('totalLucro').innerText=formatMoney(l); document.getElementById('mediaMargem').innerText=`${f>0?((l/f)*100).toFixed(2):0}%`; }
function atualizarGrafico(d) {
    const a={}; d.forEach(v=>{const l=`${v.mes.substring(0,3)} ${v.ano}`; if(!a[l])a[l]={f:0,l:0}; a[l].f+=v.valorVenda; a[l].l+=v.lucro;});
    const l=Object.keys(a), c=document.getElementById('faturamentoChart').getContext('2d'); if(graficoInstance) graficoInstance.destroy();
    graficoInstance = new Chart(c, {type:'bar', data:{labels:l, datasets:[{label:'Bruto', data:l.map(x=>a[x].f), backgroundColor:'#3b82f6'},{label:'Lucro', data:l.map(x=>a[x].l), backgroundColor:'#10b981'}]}, options:{responsive:true, maintainAspectRatio:false}});
}

function calcularMargemForm() { const q=Number(document.getElementById('quantidade').value)||1, v=Number(document.getElementById('valorUnitario').value)||0, i=Number(document.getElementById('imposto').value)||0, c=Number(document.getElementById('custo').value)||0; const t=q*v, s=t-(q*i), l=s-(q*c); document.getElementById('previewSobra').innerText=formatMoney(s); document.getElementById('previewLucro').innerText=formatMoney(l); document.getElementById('previewMargem').innerText=`${t>0?((l/t)*100).toFixed(2):0}%`; }
function calcularSimuladores() { const c=Number(document.getElementById('calcCusto').value)||0, i=Number(document.getElementById('calcImposto').value)||0, cm=Number(document.getElementById('calcComissao').value)||0, f=Number(document.getElementById('calcFrete').value)||0, v=Number(document.getElementById('calcVenda').value)||0, m=Number(document.getElementById('calcMargemAlvo').value)||0; let lr=0, mr=0, ps=0, lp=0; if(v>0){lr=v-(v*(i/100))-(v*(cm/100))-f-c;mr=(lr/v)*100;} const s=(i/100)+(cm/100)+(m/100); if(s<1) {ps=(c+f)/(1-s);lp=ps*(m/100);} document.getElementById('simLucro1').innerText=formatMoney(lr); document.getElementById('simMargem1').innerText=`${mr.toFixed(2)}%`; document.getElementById('simPreco2').innerText=formatMoney(ps); document.getElementById('simLucro2').innerText=formatMoney(lp); }
function limparSimulador() { ['calcVenda','calcCusto','calcImposto','calcComissao','calcFrete','calcMargemAlvo'].forEach(id=>document.getElementById(id).value=''); calcularSimuladores(); }

document.getElementById('vendaForm').addEventListener('submit', async function(e) {
    e.preventDefault(); mostrarLoading("Salvando...");
    const q=Number(document.getElementById('quantidade').value)||1, v=Number(document.getElementById('valorUnitario').value)||0, i=Number(document.getElementById('imposto').value)||0, c=Number(document.getElementById('custo').value)||0, pt=document.getElementById('plataforma').value, nv=document.getElementById('nVenda').value;
    const l=document.getElementById('urlPlataforma').value || (nv&&pt.includes('Mercado')?`https://www.mercadolivre.com.br/vendas/${nv}`:'');
    const t=q*v, s=t-(q*i), lu=s-(q*c);
    const p={ ano:document.getElementById('ano').value, mes:document.getElementById('mes').value, quantidade:q, descricao:document.getElementById('descricao').value, n_venda:nv, plataforma:pt, url_ml:l, valor_venda:t, sobra:s, imposto:(q*i), custo:(q*c), lucro:lu, porcentagem:(t>0?(lu/t):0), sku:document.getElementById('sku').value, status:'Concluído', estorno:0 };
    try { const { error } = await supabase.from('vendas').upsert(p, {onConflict:'plataforma,n_venda'}); if(error) throw error; limparRascunho(); await carregarDadosDaNuvem(); switchTab('dashboard'); showToast('Salvo!', 'success'); } catch(e){showToast("Erro", "error");} finally {esconderLoading();}
});

async function deletarLancamento(id) { if(localStorage.getItem('app_auth_nivel')!=='ADMIN')return; if(!confirm("Apagar?"))return; mostrarLoading("Apagando..."); try { await supabase.from('vendas').delete().eq('id',id); await carregarDadosDaNuvem(); showToast("Excluído!","success"); } catch(e){} finally{esconderLoading();} }

// SKUs
function importarCsvSkus(e) {
    const f=e.target.files[0]; if(!f) return; mostrarLoading("Lendo CSV..."); const r=new FileReader();
    r.onload=async function(ev) {
        try {
            const l=ev.target.result.split(/\r?\n/), h=l[0].split(l[0].includes(';')?';':',').map(x=>x.trim().toUpperCase());
            const iS=h.indexOf("SKU"), iP=h.indexOf("PRODUTO"), iC=h.findIndex(x=>x.includes("CUSTO"));
            if(iS===-1 && iP===-1) throw new Error("Invalido");
            const p=[]; for(let i=1;i<l.length;i++){ if(!l[i].trim())continue; const c=l[i].split(l[0].includes(';')?';':','); if(c.length<2)continue; p.push({sku:iS>-1?c[iS].trim():'', produto:iP>-1?c[iP].trim():'', custo_atual:universalNumberParse(iC>-1?c[iC]:0), status:'Ativo'}); }
            if(p.length>0) { await supabase.from('custos_sku').upsert(p, {onConflict:'sku'}); await carregarDadosDaNuvem(); showToast("Importado!","success"); }
        } catch(err){} finally{esconderLoading(); document.getElementById('fileImportSkuCsv').value='';}
    }; r.readAsText(f);
}
function renderPaginaSkus(p) {
    const b=document.getElementById('buscaSkus').value.toLowerCase(); skusFiltradosGlobal=catalogoSkusGlobais.filter(s=>String(s.SKU).toLowerCase().includes(b)||String(s.PRODUTO).toLowerCase().includes(b));
    const tp=Math.ceil(skusFiltradosGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualSkus=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaSkus'); tb.innerHTML='';
    skusFiltradosGlobal.slice((paginaAtualSkus-1)*ITENS_POR_PAGINA, paginaAtualSkus*ITENS_POR_PAGINA).forEach(s => {
        const tr=document.createElement('tr'); tr.innerHTML=`<td class="p-3">${s.SKU}</td><td class="p-3">${s.PRODUTO}</td><td class="p-3 text-right">${formatMoney(s.CUSTO_ANTERIOR)}</td><td class="p-3 text-right text-red-500 font-bold">${formatMoney(s.CUSTO_ATUAL)}</td><td class="p-3 text-center">${s.STATUS}</td><td class="p-3 text-center admin-only"><button onclick="editarSku('${s.SKU}')" class="text-blue-500">✏️</button></td>`; tb.appendChild(tr);
    });
    document.getElementById('lblPaginaSkus').innerText=paginaAtualSkus; document.getElementById('lblTotalPaginasSkus').innerText=tp;
}
function mudarPaginaSkus(d) { renderPaginaSkus(paginaAtualSkus+d); }
function editarSku(c) { const p=catalogoSkusGlobais.find(s=>s.SKU===c); if(p){ document.getElementById('skuForm_sku').value=p.SKU; document.getElementById('skuForm_produto').value=p.PRODUTO; document.getElementById('skuForm_custoAtual').value=p.CUSTO_ATUAL; document.getElementById('skuForm_fornecedor').value=p.FORNECEDOR; document.getElementById('skuForm_status').value=p.STATUS==='INATIVO'?'Inativo':'Ativo'; window.scrollTo(0,0); } }
document.getElementById('formCadastroSku').addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { await supabase.from('custos_sku').upsert({sku:document.getElementById('skuForm_sku').value, produto:document.getElementById('skuForm_produto').value, custo_atual:document.getElementById('skuForm_custoAtual').value, fornecedor:document.getElementById('skuForm_fornecedor').value, status:document.getElementById('skuForm_status').value}, {onConflict:'sku'}); document.getElementById('formCadastroSku').reset(); await carregarDadosDaNuvem(); showToast("SKU Salvo!","success"); } catch(er){} finally{esconderLoading();} });

// Users
function renderTabelaUsuarios() {
    const tb=document.getElementById('tabelaUsuarios'); tb.innerHTML='';
    usuariosGlobais.forEach(u => { const tr=document.createElement('tr'); tr.innerHTML=`<td class="p-3 font-bold">${u.usuario}</td><td class="p-3">${u.nome}</td><td class="p-3">${u.nivel}</td><td class="p-3 text-center"><button onclick="editarUsuario('${u.usuario}','${u.nome}','${u.nivel}')" class="text-blue-500">✏️</button></td><td class="p-3 text-center"><button onclick="deletarUsuario('${u.originalIndex}','${u.usuario}')" class="text-red-500">🗑️</button></td>`; tb.appendChild(tr); });
}
function editarUsuario(u,n,l) { document.getElementById('userForm_user').value=u; document.getElementById('userForm_nome').value=n; document.getElementById('userForm_nivel').value=l; document.getElementById('userForm_senha').value=''; window.scrollTo(0,0); }
document.getElementById('formCadastroUser').addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { const u=document.getElementById('userForm_user').value, s=document.getElementById('userForm_senha').value; const p={usuario:u, nome:document.getElementById('userForm_nome').value, nivel:document.getElementById('userForm_nivel').value}; const {data}=await supabase.from('usuarios').select('id,senha').eq('usuario',u); if(s) p.senha=await hashSHA256(s); else if(data&&data.length>0) p.senha=data[0].senha; else p.senha=await hashSHA256(u); if(data&&data.length>0) await supabase.from('usuarios').update(p).eq('id',data[0].id); else await supabase.from('usuarios').insert([p]); document.getElementById('formCadastroUser').reset(); await carregarDadosDaNuvem(); showToast("Salvo!","success"); } catch(er){} finally{esconderLoading();} });
async function deletarUsuario(id,u) { if(u===localStorage.getItem('app_auth_login'))return; if(!confirm("Apagar?"))return; mostrarLoading(); try { await supabase.from('usuarios').delete().eq('id',id); await carregarDadosDaNuvem(); } catch(e){} finally{esconderLoading();} }

// Lote Import
function iniciarImportacao(e) {
    const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=function(ev) {
        const d=new Uint8Array(ev.target.result), w=XLSX.read(d,{type:'array'}), s=w.Sheets[w.SheetNames[0]]; rawDataGlobal=XLSX.utils.sheet_to_json(s,{header:1,defval:""});
        if(rawDataGlobal.length===0) return showToast("Vazio","error");
        let ml=0, mp=0; for(let i=0;i<Math.min(20,rawDataGlobal.length);i++){let p=rawDataGlobal[i].filter(c=>String(c).trim()!=="").length; if(p>mp){mp=p;ml=i;}}
        importHeadersGlobal=rawDataGlobal[ml].map((h,i)=>h?String(h).trim():`Vazia_${i}`); importDataGlobal=[];
        for(let i=ml+1;i<rawDataGlobal.length;i++){let o={}, hd=false; rawDataGlobal[i].forEach((v,id)=>{o[importHeadersGlobal[id]]=v; if(String(v).trim()!=="")hd=true;}); if(hd)importDataGlobal.push(o);}
        const dt=new Date(); document.getElementById('globalAno').value=dt.getFullYear(); document.getElementById('globalMes').value=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"][dt.getMonth()]; document.getElementById('globalPlataforma').value=importHeadersGlobal.some(h=>h.toLowerCase().includes('tarifa'))?'Mercado Livre':'Direto';
        construirInterfaceMapeamento(); document.getElementById('modalMapeamento').classList.remove('hidden'); document.getElementById('fileImportData').value="";
    }; r.readAsArrayBuffer(f);
}
function fecharModalMapeamento() { document.getElementById('modalMapeamento').classList.add('hidden'); }
function salvarEstadoImportacao() {} function restaurarEstadoImportacao() {} function extrairMesAnoDaData(d) { if(!d)return null; let p=String(d).toLowerCase().split(' de '); if(p.length>=3) return {mes:p[1].trim().toUpperCase(), ano:parseInt(p[2].trim().substring(0,4))}; return null; }
function extrairProdutosUnicos() {
    const cd=document.getElementById('map_desc').value, cs=document.getElementById('map_sku').value, ac=document.getElementById('areaCustosDinamicos'), lc=document.getElementById('listaCustosProdutos'); lc.innerHTML='';
    if(!cd) { ac.classList.add('hidden'); return; } const map={}; importDataGlobal.forEach(r=>{const d=r[cd]?String(r[cd]).trim():""; if(d&&!map[d])map[d]=cs&&r[cs]?String(r[cs]).trim().toUpperCase():"";});
    produtosUnicosGlobal=Object.keys(map); window.custosMapeadosLote={}; let hp="";
    produtosUnicosGlobal.forEach((p,i) => {
        let sc=0; const rsku=map[p];
        if(rsku&&catalogoSkus[rsku]) sc=catalogoSkus[rsku].custo_atual; else { const f=Object.keys(catalogoSkus).find(k=>catalogoSkus[k].produto.toLowerCase()===p.toLowerCase()); if(f) sc=catalogoSkus[f].custo_atual; }
        window.custosMapeadosLote[p]=sc; if(sc<=0) hp+=`<div class="flex justify-between p-2 border-b"><span class="text-xs truncate">${p}</span><input type="number" step="0.01" class="w-20 p-1 border text-xs" oninput="window.custosMapeadosLote['${p.replace(/'/g,"\\'")}']=Number(this.value)||0"></div>`;
    });
    if(hp) { ac.classList.remove('hidden'); lc.innerHTML=hp; } else ac.classList.add('hidden');
}
function construirInterfaceMapeamento() {
    const c=document.getElementById('mapeamentoContainer'); c.innerHTML='';
    [{id:'map_data',l:'Data',s:['Data']}, {id:'map_sku',l:'SKU',s:['SKU']}, {id:'map_desc',l:'Descrição',s:['Título']}, {id:'map_nven',l:'Pedido',s:['N.º']}, {id:'map_qtd',l:'Qtd',s:['Unidade']}, {id:'map_status',l:'Status',s:['Estado']}, {id:'map_venda',l:'Venda (R$)',s:['Receita por pro']}, {id:'map_rec_envio',l:'Envio (R$)',s:['Receita por env']}, {id:'map_tarifa_venda',l:'Tarifa V. (R$)',s:['Tarifa de vend']}, {id:'map_tarifa_envio',l:'Tarifa E. (R$)',s:['Tarifas de env']}, {id:'map_estorno',l:'Estorno (R$)',s:['Cancelamento']}, {id:'map_total',l:'Total (R$)',s:['Total']}].forEach(f => {
        let h=`<div class="flex flex-col bg-white p-2 rounded border"><label class="text-xs font-bold">${f.l}</label><select id="${f.id}" onchange="if(this.id==='map_desc'||this.id==='map_sku')extrairProdutosUnicos()" class="p-1 outline-none text-xs border"><option value="">-- Ignorar --</option>`;
        importHeadersGlobal.forEach(hd => { h+=`<option value="${hd}" ${f.s.some(x=>hd.toLowerCase().includes(x.toLowerCase()))?'selected':''}>${hd}</option>`; });
        c.innerHTML+=h+'</select></div>';
    }); extrairProdutosUnicos();
}
async function processarEnvioEmLote() {
    mostrarLoading("Enviando Lote...");
    const aG=document.getElementById('globalAno').value||new Date().getFullYear(), mG=document.getElementById('globalMes').value, pG=document.getElementById('globalPlataforma').value, impG=Number(document.getElementById('globalImposto').value)||0;
    const cData=document.getElementById('map_data').value, cSku=document.getElementById('map_sku').value, cDesc=document.getElementById('map_desc').value, cNv=document.getElementById('map_nven').value, cQtd=document.getElementById('map_qtd').value, cSt=document.getElementById('map_status').value, cVen=document.getElementById('map_venda').value, cRe=document.getElementById('map_rec_envio').value, cTv=document.getElementById('map_tarifa_venda').value, cTe=document.getElementById('map_tarifa_envio').value, cEs=document.getElementById('map_estorno').value, cTot=document.getElementById('map_total').value;
    let b=[], log=[], qN=0, qA=0;
    for(let r of importDataGlobal) {
        if(!r[cDesc]) continue;
        let md=mG, ad=aG; if(cData&&r[cData]){const ex=extrairMesAnoDaData(r[cData]); if(ex){md=ex.mes;ad=ex.ano;}}
        let rp=cVen?universalNumberParse(r[cVen]):0, to=cTot?universalNumberParse(r[cTot]):0, es=cEs?universalNumberParse(r[cEs]):0;
        let q=Number(r[cQtd])||1, sk=r[cSku]||"", ds=r[cDesc]||"N/A", nv=r[cNv]||"-", st=r[cSt]||"Concluído";
        let canc=(cTot&&(es<0||to<=0))||(!cTot&&(st.toLowerCase().includes('canc')||rp<=0));
        let trep=cTot?to:rp, imp=rp*(impG/100), cst=(window.custosMapeadosLote[ds]||0)*q;
        if(canc){rp=0;imp=0;cst=0;}
        let sob=trep-imp, luc=sob-cst, mar=rp>0?luc/rp:0;
        let exv=vendasGlobais.some(v=>v.nVenda===nv&&v.plataforma===pG); if(exv)qA++;else qN++;
        b.push({ano:ad, mes:md, quantidade:q, descricao:ds, n_venda:nv, plataforma:pG, valor_venda:rp, sobra:sob, imposto:imp, custo:cst, lucro:luc, porcentagem:mar, sku:sk, status:st, estorno:es});
    }
    if(b.length>0) {
        try { const {error} = await supabase.from('vendas').upsert(b, {onConflict:'plataforma,n_venda'}); if(error)throw error; document.getElementById('resumoLoteNovos').innerText=qN; document.getElementById('resumoLoteAtualizados').innerText=qA; document.getElementById('modalMapeamento').classList.add('hidden'); await carregarDadosDaNuvem(); document.getElementById('modalResumoLote').classList.remove('hidden'); } catch(e){}
    }
    esconderLoading();
}
