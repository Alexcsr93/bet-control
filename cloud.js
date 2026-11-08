// ============ Bancô · login Google + sincronização (Firebase) ============
// Os dados de cada usuário ficam em um único documento: banco/{uid}
window.Cloud = (() => {
  const V = '10.12.2', BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';
  let H, auth, db, ref, user = null, unsub = null, timer = null, pronto = false, iniciando = false;
  const DEV = localStorage.getItem('banco_dev') || (() => { const d = Math.random().toString(36).slice(2, 10); localStorage.setItem('banco_dev', d); return d; })();

  const configurado = () => { const c = window.FIREBASE_CONFIG; return !!(c && c.apiKey && !/COLE/.test(c.apiKey) && c.projectId && !/COLE/.test(c.projectId)); };
  const st = s => H && H.status(s);
  const carrega = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); });

  function msg(e) {
    const c = (e && e.code) || '';
    const M = {
      'auth/unauthorized-domain': 'Domínio não autorizado. No Firebase: Authentication > Configurações > Domínios autorizados > adicione ' + location.hostname,
      'auth/operation-not-allowed': 'Login Google não ativado. No Firebase: Authentication > Método de login > Google > Ativar.',
      'auth/configuration-not-found': 'Authentication não foi ativado no Firebase (clique em "Vamos começar").',
      'auth/invalid-api-key': 'apiKey inválida no config.js. Copie de novo pela opção "Config" do Firebase.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'apiKey inválida no config.js. Copie de novo pela opção "Config" do Firebase.',
      'auth/network-request-failed': 'Sem internet. Tente de novo quando a conexão voltar.',
      'auth/popup-closed-by-user': 'Login cancelado.',
      'permission-denied': 'Sem permissão no banco. Confira se as regras do Firestore foram PUBLICADAS.',
      'unavailable': 'Sem conexão com a nuvem. Os dados ficam salvos e sobem quando a conexão voltar.'
    };
    return M[c] || ('Erro: ' + (c || (e && e.message) || e));
  }

  async function init(hooks) {
    H = hooks || H;
    if (!configurado()) { st('local'); return; }
    if (iniciando || pronto) return; iniciando = true;
    st('conectando');
    try {
      if (!window.firebase || !firebase.auth) {
        await carrega(BASE + 'firebase-app-compat.js');
        await carrega(BASE + 'firebase-auth-compat.js');
        await carrega(BASE + 'firebase-firestore-compat.js');
      }
    } catch (e) {
      iniciando = false; st('offline');
      window.addEventListener('online', () => init(), { once: true });
      return;
    }
    firebase.apps.length || firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth(); db = firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
    pronto = true; iniciando = false;
    auth.getRedirectResult().catch(e => H.erro(msg(e)));
    auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null; }
      user = u;
      if (u) conectar(u); else { ref = null; st('local'); H.onUser(null); }
    });
    window.addEventListener('offline', () => user && st('offline'));
    window.addEventListener('online', () => user && st('ok'));
  }

  function conectar(u) {
    ref = db.collection('banco').doc(u.uid);
    H.onUser(u); st('conectando');
    let primeiro = true;
    unsub = ref.onSnapshot({ includeMetadataChanges: true }, snap => {
      if (snap.metadata.hasPendingWrites) { st('salvando'); return; }
      st(snap.metadata.fromCache && !navigator.onLine ? 'offline' : 'ok');
      const d = snap.exists ? snap.data() : null;
      let r = null;
      if (d) { try { r = { ts: d.ts || 0, dev: d.dev, dados: JSON.parse(d.dados || '{}') }; } catch (e) { r = null; } }
      if (primeiro) { if (snap.metadata.fromCache && navigator.onLine) return; primeiro = false; decidir(r, u.uid, true); return; }
      if (r) decidir(r, u.uid, false);
    }, e => { st('erro'); H.erro(msg(e)); });
  }

  // Decide quem vale: nuvem ou aparelho
  function decidir(r, uid, inicial) {
    const L = H.estado();
    const usarNuvem = () => H.aplicar(r.dados, r.ts, uid);
    const usarAparelho = () => push(true);
    if (!r) { if (L.tem || L.ts) push(true); else H.marcaSync(Date.now(), uid); return; }
    if (r.ts === L.ts && L.uid === uid) { if (L.sync !== r.ts) H.marcaSync(r.ts, uid); return; }
    if (!inicial && r.ts <= L.ts) return;               // é o eco da nossa própria gravação
    if (L.uid !== uid) {                                  // dados do aparelho não são desta conta
      if (!L.tem) return usarNuvem();
      return H.conflito(r, usarNuvem, usarAparelho);
    }
    const localMudou = L.ts > L.sync, nuvemMudou = r.ts > L.sync;
    if (nuvemMudou && !localMudou) return usarNuvem();
    if (localMudou && !nuvemMudou) return usarAparelho();
    if (localMudou && nuvemMudou) return H.conflito(r, usarNuvem, usarAparelho);
  }

  function push(agora) {
    if (!user || !ref) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const L = H.estado(), ts = L.ts || Date.now(), u = user.uid;
      const dados = JSON.stringify(H.dados());
      if (dados.length > 900000) { st('erro'); H.erro('Dados grandes demais para sincronizar (limite ~1 MB). Faça um backup.'); return; }
      st('salvando');
      ref.set({ dados, ts, dev: DEV, app: 'banco', versao: 1, atualizado: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => { H.marcaSync(ts, u); st('ok'); })
        .catch(e => { st('erro'); H.erro(msg(e)); });
    }, agora ? 0 : 800);
  }

  async function entrar() {
    if (!pronto) return;
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) return auth.signInWithRedirect(p);
      if (e.code !== 'auth/popup-closed-by-user') H.erro(msg(e));
    }
  }
  async function sair() { clearTimeout(timer); if (auth) await auth.signOut(); }

  return { init, entrar, sair, push, configurado, pronto: () => pronto, usuario: () => user };
})();
