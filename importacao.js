function iniciarImportacao(e) {
    const f=e.target.files[0]; if(!f) return; mostrarLoading("Analisando Vendas...");
    lerPlanilha(f, (w) => {
        try {
            const s=w.Sheets[w.SheetNames[0]]; rawDataGlobal=XLSX.utils.sheet_to_json(s,{header:1,defval:""});
            if(rawDataGlobal.length===0) { esconderLoading(); return showToast("Planilha vazia","error"); }
            let ml=0, mp=0; for(let i=0;i<Math.min(20,rawDataGlobal.length);i++){let p=rawDataGlobal[i].filter(c=>String(c).trim()!=="").length; if(p>mp){mp=p;ml=i;}}
            
            let colSeen = {};
            importHeadersGlobal = rawDataGlobal[ml].map((h, i) => {
                let baseName = h ? fixText(String(h)).trim() : `Vazia_${i}`;
                if(colSeen[baseName]) { colSeen[baseName]++; return `${baseName} ${colSeen[baseName]}`; } else { colSeen[baseName] = 1; return baseName; }
            }); 
            
            importDataGlobal=[];
            for(let i=ml+1;i<rawDataGlobal.length;i++){ 
                let o={}, hd=false; 
                rawDataGlobal[i].forEach((v,id)=>{ 
                    let val = (typeof v === 'string') ? fixText(v) : v;
                    o[importHeadersGlobal[id]]=val; 
                    if(String(val).trim()!=="") hd=true; 
                }); 
                if(hd) importDataGlobal.push(o); 
            }
            const dt=new Date(); const gA=document.getElementById('globalAno'); if(gA) gA.value=dt.getFullYear(); const gM=document.getElementById('globalMes'); if(gM) gM.value=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"][dt.getMonth()]; const gp=document.getElementById('globalPlataforma'); if(gp) gp.value=importHeadersGlobal.some(h=>h.toLowerCase().includes('tarifa'))?'Mercado Livre':'Direto';
            construirInterfaceMapeamento(); const mM = document.getElementById('modalMapeamento'); if(mM) mM.classList.remove('hidden'); const fid = document.getElementById('fileImportData'); if(fid) fid.value=""; esconderLoading();
        } catch(err) { esconderLoading(); showToast("Erro: " + err.message, "error"); }
    }, (err) => { esconderLoading(); showToast("Erro leitura: " + err.message, "error"); });
}

function fecharModalMapeamento() { const mm=document.getElementById('modalMapeamento'); if(mm) mm.classList.add('hidden'); }
function salvarEstadoImportacao() { atualizarMapeamentoDinamico(); } 

function extrairMesAnoDaData(d) { 
    if(!d) return null; let str = String(d).toLowerCase().trim(); let p = str.split(' de '); 
    if(p.length >= 3) { const mapMes = {"janeiro":"JANEIRO","fevereiro":"FEVEREIRO","março":"MARÇO","abril":"ABRIL","maio":"MAIO","junho":"JUNHO","julho":"JULHO","agosto":"AGOSTO","setembro":"SETEMBRO","outubro":"OUTUBRO","novembro":"NOVEMBRO","dezembro":"DEZEMBRO"}; return { mes: mapMes[p[1].trim()] || p[1].trim().toUpperCase(), ano: parseInt(p[2].trim().substring(0,4)) }; }
    let regBr = str.match(/(\d{2})\/(\d{2})\/(\d{4})/); if(regBr) { const mArr = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]; return { mes: mArr[parseInt(regBr[2])-1], ano: parseInt(regBr[3]) }; }
    let regInt = str.match(/(\d{4})-(\d{2})-(\d{2})/); if(regInt) { const mArr = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]; return { mes: mArr[parseInt(regInt[2])-1], ano: parseInt(regInt[1]) }; }
    return null; 
}

function extrairProdutosUnicos() {
    const md = document.getElementById('map_desc'), ms = document.getElementById('map_sku'), cd=md?md.value:'', cs=ms?ms.value:''; const ac=document.getElementById('areaCustosDinamicos'), lc=document.getElementById('listaCustosProdutos'); if(lc) lc.innerHTML='';
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
    const tb = document.getElementById('tabelaPreviewImportacao'), container = document.getElementById('areaPreviewImportacao'); if(!tb || !container) return; tb.innerHTML = '';
    const gaEl = document.getElementById('globalAno'), gmEl = document.getElementById('globalMes'), giEl = document.getElementById('globalImposto'), aG = gaEl ? gaEl.value : new Date().getFullYear(), mG = gmEl ? gmEl.value : '', impG = Number(giEl ? giEl.value : 0) || 0;
    const cdEl=document.getElementById('map_data'), csEl=document.getElementById('map_sku'), cdeEl=document.getElementById('map_desc'), cqEl=document.getElementById('map_qtd'), cveEl=document.getElementById('map_venda'), ctoEl=document.getElementById('map_total'), cesEl=document.getElementById('map_estorno'), cstEl=document.getElementById('map_status');
    const cData=cdEl?cdEl.value:'', cSku=csEl?csEl.value:'', cDesc=cdeEl?cdeEl.value:'', cQtd=cqEl?cqEl.value:'', cVen=cveEl?cveEl.value:'', cTot=ctoEl?ctoEl.value:'';
    if(!cDesc) { container.classList.add('hidden'); return; }
    
    let count = 0;
    for(let r of importDataGlobal) {
        if(!r[cDesc]) continue;
        let md=mG, ad=aG; if(cData&&r[cData]){ const ex=extrairMesAnoDaData(r[cData]); if(ex){md=ex.mes;ad=ex.ano;} }
        let rp=cVen?universalNumberParse(r[cVen]):0, to=cTot?universalNumberParse(r[cTot]):0, es=cesEl&&cesEl.value?universalNumberParse(r[cesEl.value]):0, q=Number(r[cQtd])||1, sk=r[cSku]||"", ds=r[cDesc]||"N/A", st=cstEl&&cstEl.value?r[cstEl.value]||"Concluído":"Concluído";
        let canc=(cTot&&(es<0||to<=0))||(!cTot&&(st.toLowerCase().includes('canc')||rp<=0)), trep=cTot?to:rp, imp=rp*(impG/100), cst=(window.custosMapeadosLote[ds]||0)*q;
        if(canc){rp=0;imp=0;cst=0;} let sob=trep-imp, luc=sob-cst;
        tb.innerHTML += `<tr class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"><td class="p-3 text-xs font-bold text-gray-500">${md.substring(0,3)}/${ad}</td><td class="p-3 font-mono text-[10px] font-bold text-gray-400">${sk || '-'}</td><td class="p-3 truncate max-w-[200px] font-semibold text-gray-800 dark:text-gray-200" title="${ds}">${ds}</td><td class="p-3 text-center font-bold text-indigo-600">${q}</td><td class="p-3 text-right text-blue-600 dark:text-blue-400 font-bold">${formatMoney(rp)}</td><td class="p-3 text-right text-orange-500 font-semibold">${formatMoney(imp)}</td><td class="p-3 text-right text-red-500 font-semibold">${formatMoney(cst)}</td><td class="p-3 text-right font-extrabold ${luc >= 0 ? 'text-emerald-500' : 'text-red-500'}">${formatMoney(luc)}</td></tr>`;
        count++; if(count >= 3) break;
    }
    if(count > 0) container.classList.remove('hidden'); else container.classList.add('hidden');
}

function atualizarMapeamentoDinamico() {
    const cdEl = document.getElementById('map_data'), gAno = document.getElementById('globalAno'), gMes = document.getElementById('globalMes'), indData = document.getElementById('indDataAutomatica');
    if(cdEl && cdEl.value) { if(gAno) gAno.disabled = true; if(gMes) gMes.disabled = true; if(indData) indData.classList.remove('hidden'); } else { if(gAno) gAno.disabled = false; if(gMes) gMes.disabled = false; if(indData) indData.classList.add('hidden'); }
    extrairProdutosUnicos(); renderPreviewImportacao();
}

function construirInterfaceMapeamento() {
    const c=document.getElementById('mapeamentoContainer'); if(!c) return; c.innerHTML='';
    [{id:'map_data',l:'Data',s:['Data', 'Data da venda']}, {id:'map_sku',l:'SKU',s:['SKU']}, {id:'map_desc',l:'Descrição',s:['Título', 'Descrição']}, {id:'map_nven',l:'Pedido',s:['N.º', 'Pedido']}, {id:'map_qtd',l:'Qtd',s:['Unidade', 'Qtd']}, {id:'map_status',l:'Status',s:['Estado', 'Status']}, {id:'map_venda',l:'Venda (R$)',s:['Receita por pro', 'Venda', 'Bruto']}, {id:'map_rec_envio',l:'Envio (R$)',s:['Receita por env']}, {id:'map_tarifa_venda',l:'Tarifa V. (R$)',s:['Tarifa de vend', 'Taxa']}, {id:'map_tarifa_envio',l:'Tarifa E. (R$)',s:['Tarifas de env', 'Frete']}, {id:'map_estorno',l:'Estorno (R$)',s:['Cancelamento', 'Estorno']}, {id:'map_total',l:'Total (R$)',s:['Total']}].forEach(f => {
        let h=`<div class="flex flex-col bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"><label class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 ml-1">${f.l}</label><select id="${f.id}" onchange="atualizarMapeamentoDinamico()" class="p-2.5 outline-none text-xs border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"><option value="">-- Ignorar --</option>`;
        importHeadersGlobal.forEach(hd => { h+=`<option value="${hd}" ${f.s.some(x=>hd.toLowerCase() === x.toLowerCase())?'selected':''}>${hd}</option>`; });
        c.innerHTML+=h+'</select></div>';
    }); atualizarMapeamentoDinamico();
}

async function processarEnvioEmLote() {
    mostrarLoading("Sincronizando Lote...");
    const gaEl = document.getElementById('globalAno'), gmEl = document.getElementById('globalMes'), gpEl = document.getElementById('globalPlataforma'), giEl = document.getElementById('globalImposto');
    const aG=gaEl?gaEl.value:new Date().getFullYear(), mG=gmEl?gmEl.value:'', pG=gpEl?gpEl.value:'', impG=Number(giEl?giEl.value:0)||0;
    const cdEl=document.getElementById('map_data'), csEl=document.getElementById('map_sku'), cdeEl=document.getElementById('map_desc'), cnvEl=document.getElementById('map_nven'), cqEl=document.getElementById('map_qtd'), cstEl=document.getElementById('map_status'), cveEl=document.getElementById('map_venda'), creEl=document.getElementById('map_rec_envio'), ctvEl=document.getElementById('map_tarifa_venda'), cteEl=document.getElementById('map_tarifa_envio'), cesEl=document.getElementById('map_estorno'), ctoEl=document.getElementById('map_total');
    const cData=cdEl?cdEl.value:'', cSku=csEl?csEl.value:'', cDesc=cdeEl?cdeEl.value:'', cNv=cnvEl?cnvEl.value:'', cQtd=cqEl?cqEl.value:'', cSt=cstEl?cstEl.value:'', cVen=cveEl?cveEl.value:'', cRe=creEl?creEl.value:'', cTv=ctvEl?ctvEl.value:'', cTe=cteEl?cteEl.value:'', cEs=cesEl?cesEl.value:'', cTot=ctoEl?ctoEl.value:'';
    
    let b = [], qN = 0;
    for(let r of importDataGlobal) {
        if(!r[cDesc]) continue;
        let md=mG, ad=aG; if(cData&&r[cData]){const ex=extrairMesAnoDaData(r[cData]); if(ex){md=ex.mes;ad=ex.ano;}}
        let rp=cVen?universalNumberParse(r[cVen]):0, to=cTot?universalNumberParse(r[cTot]):0, es=cesEl&&cesEl.value?universalNumberParse(r[cesEl.value]):0;
        
        let q=Number(r[cQtd])||1, sk=r[cSku]||"", ds=r[cDesc]||"N/A", st=cSt&&r[cSt]?r[cSt]:"Concluído";
        
        // Se o usuário ignorar Nº do Pedido, gera um automático e evita travar no Supabase
        let original_nv = r[cNv] || `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        
        let canc=(cTot&&(es<0||to<=0))||(!cTot&&(st.toLowerCase().includes('canc')||rp<=0));
        let trep=cTot?to:rp, imp=rp*(impG/100), cst=(window.custosMapeadosLote[ds]||0)*q;
        if(canc){rp=0;imp=0;cst=0;} let sob=trep-imp, luc=sob-cst, mar=rp>0?luc/rp:0;
        
        let urlML = (pG === 'Mercado Livre' && r[cNv]) ? `https://www.mercadolivre.com.br/vendas/${original_nv}` : '';
        
        b.push({ ano: ad, mes: md, quantidade: q, descricao: ds, n_venda: original_nv, plataforma: pG, url_ml: urlML, valor_venda: rp, sobra: sob, imposto: imp, custo: cst, lucro: luc, porcentagem: mar, sku: sk, status: st, estorno: es });
        qN++;
    }
    
    if(b.length>0) {
        try { 
            // INSERÇÃO DIRETA para abolir a restrição do Supabase de chaves únicas
            const {error} = await db.from('vendas').insert(b); 
            if(error) throw error; 
            
            let fTotal = 0, lTotal = 0;
            b.forEach(x => { fTotal += x.valor_venda; lTotal += x.lucro; });
            
            const rn=document.getElementById('resumoLoteNovos'); if(rn) rn.innerText=qN; 
            const ra=document.getElementById('resumoLoteAtualizados'); if(ra) ra.innerText="0 (Inserção Direta)"; 
            const rf=document.getElementById('resumoLoteFat'); if(rf) rf.innerText=formatMoney(fTotal); 
            const rl=document.getElementById('resumoLoteLucro'); if(rl) rl.innerText=formatMoney(lTotal); 
            
            const mm=document.getElementById('modalMapeamento'); if(mm) mm.classList.add('hidden'); 
            await buscarVendasServidor(); 
            const rm=document.getElementById('modalResumoLote'); if(rm) rm.classList.remove('hidden'); 
        } catch(e) { showToast("Erro na importação: " + (e.message || "Falha ao enviar."), "error"); }
    } else { showToast("Nenhuma linha válida.", "error"); }
    esconderLoading();
}

function importarCsvSkus(e) {
    const f=e.target.files[0]; if(!f) return; mostrarLoading("Lendo Arquivo de SKUs..."); 
    lerPlanilha(f, (w) => {
        try {
            const s=w.Sheets[w.SheetNames[0]]; const rawData=XLSX.utils.sheet_to_json(s,{header:1,defval:""});
            if(rawData.length < 2) throw new Error("Planilha vazia ou sem dados.");
            const h = rawData[0].map(x=>fixText(String(x)).trim().toUpperCase()); 
            const iS=h.indexOf("SKU"), iP=h.indexOf("PRODUTO"), iC=h.findIndex(x=>fixText(String(x)).includes("CUSTO"));
            if(iS===-1 && iP===-1) throw new Error("Cabeçalho inválido.");
            const mapSkus = {}; 
            for(let i=1;i<rawData.length;i++){ 
                const row = rawData[i]; if(row.filter(c=>String(c).trim()!=="").length === 0) continue; 
                let prodName = iP>-1 ? fixText(String(row[iP])).trim() : '';
                let skuCode = iS>-1 && fixText(String(row[iS])).trim() !== "" ? fixText(String(row[iS])).trim().toUpperCase() : prodName.toUpperCase();
                if(!skuCode) continue; 
                let valStr = iC>-1 ? row[iC] : 0; mapSkus[skuCode] = { sku: skuCode, produto: prodName || skuCode, custo_atual: universalNumberParse(valStr), status:'Ativo' }; 
            }
            skusParaImportarGlobal = Object.values(mapSkus);
            if(skusParaImportarGlobal.length>0) { 
                const tb = document.getElementById('tabelaPreviewSkuData');
                if(tb) { tb.innerHTML = ''; let limit = Math.min(3, skusParaImportarGlobal.length); for(let i=0; i<limit; i++) { let item = skusParaImportarGlobal[i]; tb.innerHTML += `<tr class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50"><td class="p-4 font-mono text-[10px] font-bold text-gray-500">${item.sku}</td><td class="p-4 truncate max-w-[200px] font-semibold text-gray-800 dark:text-gray-200" title="${item.produto}">${item.produto}</td><td class="p-4 text-right font-extrabold text-red-500">${formatMoney(item.custo_atual)}</td></tr>`; } }
                esconderLoading(); const modPreview = document.getElementById('modalPreviewSku'); if(modPreview) modPreview.classList.remove('hidden');
            } else { throw new Error("Nenhum dado válido."); }
        } catch(err){ esconderLoading(); showToast(err.message, "error"); } finally{ const fi = document.getElementById('fileImportSkuCsv'); if(fi) fi.value=''; }
    }, (err) => { esconderLoading(); showToast("Erro ao ler arquivo: " + err.message, "error"); });
}

async function confirmarImportacaoSkus() {
    const modPreview = document.getElementById('modalPreviewSku'); if(modPreview) modPreview.classList.add('hidden'); mostrarLoading("Sincronizando no Supabase...");
    try { const { error } = await db.from('custos_sku').upsert(skusParaImportarGlobal, {onConflict:'sku'}); if(error) throw new Error(error.message); await carregarDadosIniciais(); showToast(skusParaImportarGlobal.length + " SKUs importados com sucesso!", "success"); skusParaImportarGlobal = []; } 
    catch(e) { showToast(e.message, "error"); } finally { esconderLoading(); }
}
