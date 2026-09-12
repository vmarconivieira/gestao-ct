function importarCsvSkus(e) {
    const f=e.target.files[0]; if(!f) return; mostrarLoading("Lendo CSV..."); const r=new FileReader();
    r.onload=async function(ev) {
        try {
            let text = ev.target.result.replace(/^\uFEFF/, '');
            const l=text.split(/\r?\n/);
            if(l.length < 2) throw new Error("Planilha vazia ou sem dados.");
            const separator = l[0].includes(';') ? ';' : ',';
            const h=l[0].split(separator).map(x=>x.trim().toUpperCase().replace(/"/g, ''));
            
            const iS=h.indexOf("SKU"), iP=h.indexOf("PRODUTO"), iC=h.findIndex(x=>x.includes("CUSTO"));
            if(iS===-1 && iP===-1) throw new Error("Cabeçalho inválido. Faltam colunas SKU ou PRODUTO.");
            
            const p=[]; 
            for(let i=1;i<l.length;i++){ 
                if(!l[i].trim())continue; 
                const c=l[i].split(separator); 
                if(c.length<2)continue; 
                
                let skuCode = iS>-1?c[iS].trim().replace(/"/g, ''):'';
                let prodName = iP>-1?c[iP].trim().replace(/"/g, ''):'';
                
                if(!skuCode && !prodName) continue;

                p.push({ sku: skuCode, produto: prodName, custo_atual: universalNumberParse(iC>-1?c[iC]:0), status:'Ativo' }); 
            }
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
    }; r.readAsText(f);
}
