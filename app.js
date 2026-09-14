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
function toggleDarkMode(f = null) { const h = document.documentElement; isDarkMode = f !== null ? f : !h.classList.contains('dark'); if (isDarkMode) { h.classList.add('dark'); localStorage.setItem('theme', 'dark'); } else { h.classList.remove('dark'); localStorage.setItem('theme', 'light'); } if(vendasGlobais.length > 0) aplicarFiltrosLocais(); }
function configurarDataAtual() { const d = new Date(); const anoEl = document.getElementById('ano'); if(anoEl) anoEl.value = d.getFullYear(); const m = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]; const mesEl = document.getElementById('mes'); if(mesEl) mesEl.value = m[d.getMonth()]; const faEl = document.getElementById('filtroAno'); if(faEl) faEl.value = d.getFullYear(); const fmEl = document.getElementById('filtroMes'); if(fmEl) fmEl.value = m[d.getMonth()]; }

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
    if(cEl) { if(chartAnalise) chartAnalise.destroy(); chartAnalise = new Chart(cEl.getContext('2d'), { type:'line', data:{labels:lx, datasets:[{label:'Preço', data:hP, borderColor:'#3b82f6'}, {label:'Custo', data:hC, borderColor:'#ef4444'}, {label:'Margem', data:hM, borderColor:'#10b981', yAxisID:'y1'}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{position:'left'}, y1:{position:'right'}}} }); }
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

function renderPaginaSkus(p) {
    const bsEl = document.getElementById('buscaSkus'); const b = bsEl ? bsEl.value.toLowerCase() : ''; 
    skusFiltradosGlobal=catalogoSkusGlobais.filter(s=>String(s.SKU).toLowerCase().includes(b)||String(s.PRODUTO).toLowerCase().includes(b));
    const tp=Math.ceil(skusFiltradosGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualSkus=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaSkus'); if(tb) tb.innerHTML='';
    skusFiltradosGlobal.slice((paginaAtualSkus-1)*ITENS_POR_PAGINA, paginaAtualSkus*ITENS_POR_PAGINA).forEach(s => {
        let isActive = String(s.STATUS).trim().toUpperCase() !== "INATIVO";
        let statusClass = isActive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
        const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";
        tr.innerHTML=`<td class="p-4 font-mono text-sm dark:text-gray-300 font-bold">${s.SKU}</td><td class="p-4 text-gray-800 dark:text-gray-200 font-bold">${s.PRODUTO}</td><td class="p-4 text-right text-red-500 font-extrabold">${formatMoney(s.CUSTO_ATUAL)}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${statusClass}">${s.STATUS || "Ativo"}</span></td><td class="p-4 text-center admin-only whitespace-nowrap"><button onclick="editarSku('${s.SKU.replace(/'/g,"\\'")}')" class="text-blue-500 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg hover:text-blue-700 transition-colors mr-2">✏️</button><button onclick="deletarSku('${s.SKU.replace(/'/g,"\\'")}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg hover:text-red-700 transition-colors">🗑️</button></td>`; 
        if(tb) tb.appendChild(tr);
    });
    const l1 = document.getElementById('lblPaginaSkus'); if(l1) l1.innerText=paginaAtualSkus; 
    const l2 = document.getElementById('lblTotalPaginasSkus'); if(l2) l2.innerText=tp;
    const btnP = document.getElementById('btnPrevSkus'); if(btnP) btnP.disabled=paginaAtualSkus===1; 
    const btnN = document.getElementById('btnNextSkus'); if(btnN) btnN.disabled=paginaAtualSkus===tp;
}
function mudarPaginaSkus(d) { renderPaginaSkus(paginaAtualSkus+d); }
function editarSku(c) { const p=catalogoSkusGlobais.find(s=>s.SKU===c); if(p){ document.getElementById('skuForm_sku').value=p.SKU; document.getElementById('skuForm_produto').value=p.PRODUTO; document.getElementById('skuForm_custoAtual').value=Number(p.CUSTO_ATUAL || 0); document.getElementById('skuForm_custoMedio').value=Number(p.CUSTO_MEDIO || 0); document.getElementById('skuForm_fornecedor').value=p.FORNECEDOR; document.getElementById('skuForm_status').value=p.STATUS==='INATIVO'?'Inativo':'Ativo'; window.scrollTo(0,0); } }

async function deletarSku(skuCode) { 
    if(localStorage.getItem('app_auth_nivel')!=='ADMIN') return; 
    if(!confirm(`Tem certeza que deseja apagar o produto SKU: ${skuCode}?`)) return; 
    mostrarLoading("Apagando SKU..."); 
    try { await db.from('custos_sku').delete().eq('sku', skuCode); await carregarDadosIniciais(); showToast("SKU Excluído!","success"); } 
    catch(e) { showToast("Erro ao excluir", "error"); } finally { esconderLoading(); } 
}

const formSku = document.getElementById('formCadastroSku');
if(formSku) {
    formSku.addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { await db.from('custos_sku').upsert({sku:document.getElementById('skuForm_sku').value, produto:document.getElementById('skuForm_produto').value, custo_atual:document.getElementById('skuForm_custoAtual').value, custo_medio:document.getElementById('skuForm_custoMedio').value, fornecedor:document.getElementById('skuForm_fornecedor').value, status:document.getElementById('skuForm_status').value}, {onConflict:'sku'}); document.getElementById('formCadastroSku').reset(); await carregarDadosIniciais(); showToast("SKU Salvo!","success"); } catch(er){} finally{esconderLoading();} });
}
