function aplicarPermissoes() {
    const nivel = localStorage.getItem('app_auth_nivel') || 'OPERADOR';
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display = (nivel !== 'ADMIN') ? 'none' : ''; });
    const nt = document.getElementById('nivelText');
    if(nt) { nt.innerText = nivel === 'ADMIN' ? "👑 ADMIN" : "👤 OPERADOR"; nt.className = nivel === 'ADMIN' ? "text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"; }
}

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
        if(btn) btn.classList.add('hidden'); if(spinner) spinner.classList.remove('hidden');
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
                aplicarPermissoes(); carregarRascunhoForm(); carregarDadosIniciais(); showToast('Login efetuado!', 'success');
            } else { alert("Acesso negado."); if(btn) btn.classList.remove('hidden'); if(spinner) spinner.classList.add('hidden'); }
        } catch (err) { alert("Erro servidor."); if(btn) btn.classList.remove('hidden'); if(spinner) spinner.classList.add('hidden'); }
    });
}

function fazerLogout() { localStorage.clear(); location.reload(); }
function abrirModalSenha() { const m = document.getElementById('modalSenha'); if(m) m.classList.remove('hidden'); const f = document.getElementById('formAlterarSenha'); if(f) f.reset(); }
function fecharModalSenha() { const m = document.getElementById('modalSenha'); if(m) m.classList.add('hidden'); }

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

function renderTabelaUsuarios() {
    const tb=document.getElementById('tabelaUsuarios'); if(!tb) return; tb.innerHTML='';
    usuariosGlobais.forEach(u => { const tr=document.createElement('tr'); tr.className = "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"; tr.innerHTML=`<td class="p-4 font-bold text-gray-800 dark:text-gray-200 font-mono">${u.usuario}</td><td class="p-4 text-gray-700 dark:text-gray-300">${u.nome}</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${u.nivel==='ADMIN'?'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300':'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}">${u.nivel}</span></td><td class="p-4 text-center"><button onclick="editarUsuario('${u.usuario}','${u.nome}','${u.nivel}')" class="text-blue-500 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg hover:text-blue-700 transition-colors mr-2">✏️</button><button onclick="deletarUsuario('${u.originalIndex}','${u.usuario}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg hover:text-red-700 transition-colors">🗑️</button></td>`; tb.appendChild(tr); });
}
function editarUsuario(u,n,l) { document.getElementById('userForm_user').value=u; document.getElementById('userForm_nome').value=n; document.getElementById('userForm_nivel').value=l; document.getElementById('userForm_senha').value=''; window.scrollTo(0,0); }

const formUser = document.getElementById('formCadastroUser');
if(formUser) {
    formUser.addEventListener('submit', async function(e){ e.preventDefault(); mostrarLoading(); try { const u=document.getElementById('userForm_user').value.toLowerCase(), s=document.getElementById('userForm_senha').value; const p={usuario:u, nome:document.getElementById('userForm_nome').value, nivel:document.getElementById('userForm_nivel').value}; const {data}=await db.from('usuarios').select('id,senha').eq('usuario',u); if(s) p.senha=await hashSHA256(s); else if(data&&data.length>0) p.senha=data[0].senha; else p.senha=await hashSHA256(u); if(data&&data.length>0) await db.from('usuarios').update(p).eq('id',data[0].id); else await db.from('usuarios').insert([p]); document.getElementById('formCadastroUser').reset(); await carregarDadosIniciais(); showToast("Salvo!","success"); } catch(er){} finally{esconderLoading();} });
}
async function deletarUsuario(id,u) { if(u===localStorage.getItem('app_auth_login'))return showToast("Você não pode se excluir.","error"); if(!confirm("Apagar?"))return; mostrarLoading(); try { await db.from('usuarios').delete().eq('id',id); await carregarDadosIniciais(); } catch(e){} finally{esconderLoading();} }
