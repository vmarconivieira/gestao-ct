// Server-Side Fetching
async function buscarVendasServidor() {
    const fA = document.getElementById('filtroAno'); const fM = document.getElementById('filtroMes');
    const ano = fA ? fA.value : new Date().getFullYear().toString(); 
    const mes = fM ? fM.value : ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"][new Date().getMonth()];
    
    mostrarLoading("Buscando dados...");
    try {
        let q = db.from('vendas').select('*').order('created_at', { ascending: false });
        if (ano !== "TODOS") q = q.eq('ano', ano);
        if (mes !== "TODOS") q = q.ilike('mes', mes);
        
        const { data, error } = await q;
        if (error) throw error;
        
        vendasGlobais = (data || []).map(v => ({ originalIndex: v.id, ano: v.ano, mes: String(v.mes).toUpperCase(), qtd: v.quantidade, descricao: v.descricao, sku: v.sku, nVenda: v.n_venda, urlPlataforma: v.url_ml, plataforma: v.plataforma, valorVenda: Number(v.valor_venda), sobra: Number(v.sobra), imposto: Number(v.imposto), custo: Number(v.custo), lucro: Number(v.lucro), porcentagem: Number(v.porcentagem)*100, status: v.status }));
        aplicarFiltrosLocais();
    } catch (e) { showToast("Erro ao buscar vendas.", "error"); } finally { esconderLoading(); }
}

async function carregarDadosIniciais() {
    mostrarLoading("Sincronizando DB...");
    try {
        const [sR, uR] = await Promise.all([ db.from('custos_sku').select('*'), db.from('usuarios').select('*') ]);
        if (sR.data) { catalogoSkusGlobais = sR.data.map(s => ({ SKU: s.sku, PRODUTO: s.produto, CUSTO_ANTERIOR: s.custo_anterior, CUSTO_ATUAL: s.custo_atual, CUSTO_MEDIO: s.custo_medio, FORNECEDOR: s.fornecedor, DATA_ATUALIZACAO: s.data_atualizacao, STATUS: s.status })); parseSkusDictionary(); renderPaginaSkus(1); }
        if (uR.data) { usuariosGlobais = uR.data.map(u => ({ usuario: u.usuario, nome: u.nome, nivel: u.nivel, originalIndex: u.id })); renderTabelaUsuarios(); }
        await buscarVendasServidor();
        const ind = document.getElementById('statusConexao'), txt = document.getElementById('textoConexao');
        if(ind) ind.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2"; if(txt) txt.innerText = `Online`; 
    } catch (e) { showToast("Falha na sincronização", "error"); } finally { esconderLoading(); }
}

function aplicarFiltrosLocais() {
    const fO = document.getElementById('ordenacao'), fB = document.getElementById('buscaVendas');
    const o = fO ? fO.value : "recentes", b = fB ? fB.value.toLowerCase() : "";
    vendasFiltradasGlobal = vendasGlobais.filter(v => b === "" || String(v.nVenda).toLowerCase().includes(b) || String(v.sku).toLowerCase().includes(b) || String(v.descricao).toLowerCase().includes(b));
    if(o==="recentes") vendasFiltradasGlobal.sort((x,y)=>x.originalIndex<y.originalIndex?-1:1); else if(o==="margem_alta") vendasFiltradasGlobal.sort((x,y)=>y.porcentagem-x.porcentagem); else vendasFiltradasGlobal.sort((x,y)=>y.lucro-x.lucro);
    atualizarCardsPainel(vendasFiltradasGlobal); atualizarGrafico(vendasFiltradasGlobal); carregarFiltroAnalise(); paginaAtualVendas=1; renderPaginaVendas(1);
}

function mudarPaginaVendas(d) { renderPaginaVendas(paginaAtualVendas+d); }

function renderPaginaVendas(p) {
    const tp=Math.ceil(vendasFiltradasGlobal.length/ITENS_POR_PAGINA)||1; paginaAtualVendas=p<1?1:p>tp?tp:p; const tb=document.getElementById('tabelaVendas'); if(tb) tb.innerHTML='';
    const i=vendasFiltradasGlobal.slice((paginaAtualVendas-1)*ITENS_POR_PAGINA, paginaAtualVendas*ITENS_POR_PAGINA);
    if(!i.length) { if(tb) tb.innerHTML=`<tr><td colspan="11" class="p-4 text-center text-gray-500">Nenhum dado</td></tr>`; return; }
    i.forEach(v => {
        let original_nv = v.nVenda; 
        const l=v.urlPlataforma?`<a href="${v.urlPlataforma}" target="_blank" class="text-blue-500 hover:text-blue-700 underline">${original_nv.includes('AUTO') ? 'Link' : original_nv} ↗</a>`: (original_nv.includes('AUTO') ? '-' : original_nv);
        const sLow = v.status.toLowerCase();
        let corStatus = sLow.includes('cancelad') || sLow.includes('devol') ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : (sLow.includes('caminho') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300');
        let corMargem = v.porcentagem < 10 ? "text-red-600 dark:text-red-400 font-extrabold" : (v.porcentagem <= 20 ? "text-yellow-500 dark:text-yellow-400 font-extrabold" : "text-emerald-600 dark:text-emerald-400 font-extrabold");
        
        const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";
        tr.innerHTML=`<td class="p-4 text-xs text-gray-500">${v.mes.substring(0,3)}/${v.ano}</td><td class="p-4 truncate max-w-xs font-bold text-gray-800 dark:text-gray-200" title="${v.descricao}">${v.descricao} ${v.sku ? `<div class="text-[10px] text-gray-500 font-mono font-normal mt-0.5">${v.sku}</div>` : ''}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${corStatus}">${v.status}</span></td><td class="p-4 text-center text-xs font-bold bg-gray-50 dark:bg-gray-800/50 rounded-lg">${l} <div class="text-[10px] text-gray-400 font-normal mt-1">${v.plataforma}</div></td><td class="p-4 text-center"><span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full text-xs font-bold">${v.qtd}</span></td><td class="p-4 text-right font-bold">${formatMoney(v.valorVenda)}</td><td class="p-4 text-right text-gray-500">${formatMoney(v.sobra)}</td><td class="p-4 text-right text-red-500 dark:text-red-400 font-semibold">${formatMoney(v.custo)}</td><td class="p-4 text-right font-extrabold ${v.lucro >= 0 ? 'text-emerald-500' : 'text-red-500'}">${formatMoney(v.lucro)}</td><td class="p-4 text-right ${corMargem}">${v.porcentagem.toFixed(2)}%</td><td class="p-4 admin-only text-center whitespace-nowrap"><button onclick="deletarLancamento('${v.originalIndex}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg hover:text-red-700 transition-colors">🗑️</button></td>`;
        if(tb) tb.appendChild(tr);
    });
    const lblP = document.getElementById('lblPaginaVendas'); if(lblP) lblP.innerText=paginaAtualVendas; 
    const lblT = document.getElementById('lblTotalPaginasVendas'); if(lblT) lblT.innerText=tp;
    const btnP = document.getElementById('btnPrevVendas'); if(btnP) btnP.disabled=paginaAtualVendas===1; 
    const btnN = document.getElementById('btnNextVendas'); if(btnN) btnN.disabled=paginaAtualVendas===tp;
}

const vendaF = document.getElementById('vendaForm');
if(vendaF) {
    vendaF.addEventListener('submit', async function(e) {
        e.preventDefault(); mostrarLoading("Salvando...");
        const q=Number(document.getElementById('quantidade').value)||1, v=Number(document.getElementById('valorUnitario').value)||0, i=Number(document.getElementById('imposto').value)||0, c=Number(document.getElementById('custo').value)||0, pt=document.getElementById('plataforma').value, nv=document.getElementById('nVenda').value;
        
        let original_nv = nv || `AUTO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const l=document.getElementById('urlPlataforma').value || (nv&&pt.includes('Mercado')?`https://www.mercadolivre.com.br/vendas/${original_nv}`:'');
        
        const t=q*v, s=t-(q*i), lu=s-(q*c);
        const p={ ano:document.getElementById('ano').value, mes:document.getElementById('mes').value, quantidade:q, descricao:document.getElementById('descricao').value, n_venda:original_nv, plataforma:pt, url_ml:l, valor_venda:t, sobra:s, imposto:(q*i), custo:(q*c), lucro:lu, porcentagem:(t>0?(lu/t):0), sku:document.getElementById('sku').value, status:'Concluído', estorno:0 };
        try { 
            // Mudado para INSERÇÃO DIRETA para evitar o erro de Constraint do Supabase
            const { error } = await db.from('vendas').insert([p]); 
            if(error) throw error; 
            limparRascunho(); await buscarVendasServidor(); switchTab('dashboard'); showToast('Salvo!', 'success'); 
        } catch(e){showToast("Erro: " + e.message, "error");} finally {esconderLoading();}
    });
}

async function deletarLancamento(id) { if(localStorage.getItem('app_auth_nivel')!=='ADMIN')return; if(!confirm("Apagar?"))return; mostrarLoading("Apagando..."); try { await db.from('vendas').delete().eq('id',id); await buscarVendasServidor(); showToast("Excluído!","success"); } catch(e){} finally{esconderLoading();} }

// ==========================================
// EXCLUIR MÊS (Recuperado)
// ==========================================
function abrirModalExcluirMes() { const m = document.getElementById('modalExcluirMes'); if(m) m.classList.remove('hidden'); const da = document.getElementById('delMesAno'); if(da) da.value = new Date().getFullYear(); }
function fecharModalExcluirMes() { const m = document.getElementById('modalExcluirMes'); if(m) m.classList.add('hidden'); }

const formExcMes = document.getElementById('formExcluirMes');
if(formExcMes) {
    formExcMes.addEventListener('submit', async function(e) {
        e.preventDefault();
        const a = document.getElementById('delMesAno').value, m = document.getElementById('delMesNome').value, s = document.getElementById('delMesSenha').value.trim();
        if(!confirm(`⚠️ ATENÇÃO: Apagar TODOS os lançamentos de ${m}/${a}?`)) return;
        mostrarLoading("Apagando mês...");
        try {
            const u = localStorage.getItem('app_auth_login'), hs = await hashSHA256(s);
            const { data } = await db.from('usuarios').select('*').eq('usuario', u).eq('senha', hs);
            if (data && data.length > 0 && data[0].nivel === 'ADMIN') { 
                const { error } = await db.from('vendas').delete().eq('ano', a).ilike('mes', m); 
                if(!error) { showToast("Mês excluído com sucesso!", 'success'); fecharModalExcluirMes(); await buscarVendasServidor(); } 
                else throw error;
            }
            else showToast("Senha ADMIN incorreta.", 'error');
        } catch (err) { showToast("Erro: " + err.message, "error"); } finally { esconderLoading(); }
    });
}
