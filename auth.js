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

document.addEventListener('DOMContentLoaded', () => {
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
});

function fazerLogout() { localStorage.clear(); location.reload(); }
