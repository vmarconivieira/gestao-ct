var SUPABASE_URL = "https://jsoujnbaucvvwgfilnoc.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzb3VqbmJhdWN2dndnZmlsbm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDA5MzIsImV4cCI6MjEwNDcxNjkzMn0.l-dTfSmQzEsQF0AP-CPx0xZI9ox6hFyF4G8bDKSg7yw";

var db;
try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } 
catch(e) { console.error("Falha ao inicializar o Supabase:", e); }

var vendasGlobais = [], vendasFiltradasGlobal = []; 
var catalogoSkusGlobais = [], skusFiltradosGlobal = [], catalogoSkus = {}; 
var usuariosGlobais = [];
var graficoInstance = null, chartAnalise = null;
var isDarkMode = false, isFetching = false;
var paginaAtualVendas = 1, paginaAtualSkus = 1;
var ITENS_POR_PAGINA = 50;
var rawDataGlobal = [], importDataGlobal = [], importHeadersGlobal = [], produtosUnicosGlobal = [];
var skusParaImportarGlobal = [];

// CORRETOR DE ACENTOS (FixText)
function fixText(s) { 
    if(!s || typeof s !== 'string') return s; 
    try { return decodeURIComponent(escape(s)); } 
    catch(e) { return s; } 
}

// MOTOR DE LEITURA
function lerPlanilha(f, callback, errorCallback) {
    try {
        if (f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.txt')) {
            const r = new FileReader();
            r.onload = function(ev) { try { callback(XLSX.read(ev.target.result, {type: 'string'})); } catch(err) { errorCallback(err); } };
            // Força a leitura inicial em formato Windows para que o fixText possa corrigir os acentos do ML
            r.readAsText(f, 'windows-1252'); 
        } else {
            const r = new FileReader();
            r.onload = function(ev) { try { callback(XLSX.read(new Uint8Array(ev.target.result), {type: 'array'})); } catch(err) { errorCallback(err); } };
            r.readAsArrayBuffer(f);
        }
    } catch(err) { errorCallback(err); }
}

async function hashSHA256(str) {
    if (window.crypto && window.crypto.subtle) {
        try { const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)); return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join(''); } 
        catch(e) { return btoa(unescape(encodeURIComponent(str))); }
    } else { return btoa(unescape(encodeURIComponent(str))); }
}

function showToast(m, t='info') { const c = document.getElementById('toast-container'); if(!c) return; const toast = document.createElement('div'); toast.className = `toast ${t}`; toast.innerHTML = `<span>${m}</span>`; c.appendChild(toast); setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000); }
function mostrarLoading(t="Processando...") { const ot = document.getElementById('globalOverlayText'); if(ot) ot.innerText = t; const go = document.getElementById('globalOverlay'); if(go) go.classList.remove('hidden'); }
function esconderLoading() { const go = document.getElementById('globalOverlay'); if(go) go.classList.add('hidden'); }
function formatMoney(val) { const n=Number(val)||0; return (n<0?'-':'')+`R$ ${Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2})}`; }
const universalNumberParse = (val) => { 
    if(!val) return 0; if(typeof val==='number') return val; let s=String(val).trim(); const neg = s.includes('-')||(s.startsWith('(')&&s.endsWith(')')); s=s.replace(/[^0-9.,]/g,''); if(!s) return 0;
    const lc=s.lastIndexOf(','), ld=s.lastIndexOf('.'); if(lc>ld) s=s.replace(/\./g,'').replace(',','.'); else if(ld>lc && lc!==-1) s=s.replace(/,/g,'');
    return neg ? -Math.abs(parseFloat(s)||0) : Math.abs(parseFloat(s)||0);
};
