/*!
 * SuperSim Pix Popup — chama /api/pix (Vercel Serverless) e exibe QR code.
 *
 * Uso:
 *   <script src="/js/pix-popup.js" defer></script>
 *   <button onclick="SuperSimPix.open(28.90)">Pagar com Pix</button>
 *
 * Ou em href:
 *   <a href="javascript:void(0)" onclick="SuperSimPix.open(28.90)">Pagar</a>
 */
(function () {
  'use strict';

  if (window.SuperSimPix) return;

  var STYLES = '\
.ssp-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);font-family:"DM Sans","Plus Jakarta Sans",system-ui,-apple-system,Arial,sans-serif}\
.ssp-overlay.ssp-show{display:flex}\
.ssp-modal{background:#fff;border-radius:16px;padding:28px 24px;max-width:420px;width:100%;position:relative;animation:sspPop .25s ease;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:95vh;overflow-y:auto}\
@keyframes sspPop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}\
.ssp-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;background:#F3F4F6;border-radius:8px;font-size:22px;line-height:1;cursor:pointer;color:#6B7280;display:flex;align-items:center;justify-content:center;padding:0}\
.ssp-close:hover{background:#E5E7EB}\
.ssp-header{text-align:center;margin-bottom:16px;padding-right:28px}\
.ssp-tag{display:inline-block;background:#32BCAD;color:#fff;padding:4px 12px;border-radius:6px;font-weight:800;font-size:13px;letter-spacing:1px;margin-bottom:8px}\
.ssp-title{font-size:1.05rem;font-weight:700;color:#111827;margin:0}\
.ssp-amount{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}\
.ssp-amount-label{font-size:.85rem;color:#6B7280}\
.ssp-amount-value{font-size:1.2rem;font-weight:800;color:#111827}\
.ssp-loading{text-align:center;padding:30px 0}\
.ssp-spin{width:36px;height:36px;border:3px solid #E5E7EB;border-top-color:#2e7d32;border-radius:50%;animation:sspSpin .8s linear infinite;margin:0 auto 12px}\
.ssp-loading p{color:#6B7280;font-size:.9rem;margin:0}\
@keyframes sspSpin{to{transform:rotate(360deg)}}\
.ssp-qr{display:flex;justify-content:center;margin-bottom:14px;padding:10px;background:#fff;border:1px solid #E5E7EB;border-radius:12px}\
.ssp-qr img{width:220px;height:220px;display:block}\
.ssp-instr{text-align:center;font-size:.85rem;color:#6B7280;margin:0 0 8px}\
.ssp-code{display:flex;gap:8px;margin-bottom:12px}\
.ssp-code input{flex:1;min-width:0;padding:10px 12px;border:1px solid #E5E7EB;border-radius:8px;font-family:monospace;font-size:.72rem;background:#F9FAFB;color:#111827}\
.ssp-copy{display:flex;align-items:center;gap:6px;padding:0 14px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:.85rem;cursor:pointer;white-space:nowrap;transition:background .2s;font-family:inherit}\
.ssp-copy:hover{background:#1b5e20}\
.ssp-copy svg{width:16px;height:16px}\
.ssp-copy.ssp-copied{background:#16A34A}\
.ssp-timer{text-align:center;font-size:.85rem;color:#6B7280;margin-bottom:10px}\
.ssp-timer strong{color:#111827}\
.ssp-status{display:flex;align-items:center;justify-content:center;gap:8px;font-size:.85rem;color:#6B7280;padding:10px;background:#F9FAFB;border-radius:8px}\
.ssp-dot{width:10px;height:10px;background:#FBBF24;border-radius:50%;animation:sspPulse 1.6s ease-in-out infinite}\
@keyframes sspPulse{0%,100%{opacity:1}50%{opacity:.35}}\
.ssp-end{text-align:center;padding:18px 0 6px}\
.ssp-icon-ok{width:64px;height:64px;background:#DCFCE7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}\
.ssp-icon-ok svg{width:32px;height:32px;color:#16A34A}\
.ssp-icon-err{width:64px;height:64px;background:#FEE2E2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#DC2626;font-size:28px;font-weight:800}\
.ssp-end h4{font-size:1.1rem;font-weight:700;color:#111827;margin:0 0 6px}\
.ssp-end p{color:#6B7280;font-size:.9rem;margin:0 0 14px}\
.ssp-retry{display:inline-block;background:#2e7d32;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.9rem}\
.ssp-retry:hover{background:#1b5e20}\
';

  var HTML = '\
<div class="ssp-overlay" id="sspOverlay">\
  <div class="ssp-modal">\
    <button type="button" class="ssp-close" id="sspClose" aria-label="Fechar">&times;</button>\
    <div class="ssp-header">\
      <div class="ssp-tag">PIX</div>\
      <h3 class="ssp-title" id="sspTitle">Pague para continuar</h3>\
    </div>\
    <div class="ssp-amount">\
      <span class="ssp-amount-label">Valor a pagar</span>\
      <span class="ssp-amount-value" id="sspAmount">R$ 0,00</span>\
    </div>\
    <div id="sspLoading" class="ssp-loading">\
      <div class="ssp-spin"></div>\
      <p>Gerando seu QR Code...</p>\
    </div>\
    <div id="sspReady" style="display:none">\
      <div class="ssp-qr"><img id="sspQr" alt="QR Code Pix"></div>\
      <p class="ssp-instr">Escaneie o QR Code ou copie o c&oacute;digo abaixo:</p>\
      <div class="ssp-code">\
        <input type="text" id="sspCode" readonly>\
        <button type="button" class="ssp-copy" id="sspCopy">\
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round"/></svg>\
          <span>Copiar</span>\
        </button>\
      </div>\
      <div class="ssp-timer">Expira em <strong id="sspTimer">15:00</strong></div>\
      <div class="ssp-status"><div class="ssp-dot"></div><span>Aguardando pagamento...</span></div>\
    </div>\
    <div id="sspPaid" class="ssp-end" style="display:none">\
      <div class="ssp-icon-ok"><svg fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>\
      <h4>Pagamento confirmado!</h4>\
      <p>Seu pagamento foi processado com sucesso.</p>\
    </div>\
    <div id="sspError" class="ssp-end" style="display:none">\
      <div class="ssp-icon-err">!</div>\
      <h4>N&atilde;o foi poss&iacute;vel gerar o Pix</h4>\
      <p id="sspErrMsg">Tente novamente em alguns instantes.</p>\
      <button type="button" class="ssp-retry" id="sspRetry">Tentar novamente</button>\
    </div>\
  </div>\
</div>';

  var state = {
    amount: 0,
    title: 'Pague para continuar',
    nextUrl: '/ga/',
    redirectDelay: 2500,
    txId: null,
    pollT: null,
    timerT: null,
    expiresAt: 0,
    mounted: false
  };

  function mount() {
    if (state.mounted) return;
    var styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap.firstElementChild);

    document.getElementById('sspClose').addEventListener('click', close);
    document.getElementById('sspOverlay').addEventListener('click', function (e) {
      if (e.target === this) close();
    });
    document.getElementById('sspCopy').addEventListener('click', copy);
    document.getElementById('sspRetry').addEventListener('click', function () { open(state.amount, state.title); });

    state.mounted = true;
  }

  function showState(name) {
    var ids = { loading: 'sspLoading', ready: 'sspReady', paid: 'sspPaid', error: 'sspError' };
    Object.keys(ids).forEach(function (k) {
      var el = document.getElementById(ids[k]);
      if (el) el.style.display = (k === name) ? '' : 'none';
    });
  }

  function clearTimers() {
    if (state.pollT)  { clearInterval(state.pollT);  state.pollT = null; }
    if (state.timerT) { clearInterval(state.timerT); state.timerT = null; }
  }

  function fmtBRL(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Lê UTMs primeiro da URL atual; cai no localStorage onde a Utmify costuma persistir.
  function getUtms() {
    var sp = new URLSearchParams(window.location.search || '');
    var ls = window.localStorage;
    function pick(key) {
      var v = sp.get(key);
      if (v) return v;
      try { return (ls && ls.getItem(key)) || ''; } catch (e) { return ''; }
    }
    return {
      utm_source:   pick('utm_source'),
      utm_campaign: pick('utm_campaign'),
      utm_medium:   pick('utm_medium'),
      utm_content:  pick('utm_content'),
      utm_term:     pick('utm_term'),
      src:          pick('src'),
      sck:          pick('sck')
    };
  }

  // Deriva um ID de produto da URL: "/up1/" → "up1", "/10/index.html" → "10".
  function getProductId() {
    var seg = (window.location.pathname || '/').split('/').filter(Boolean)[0];
    return seg || 'home';
  }

  function open(amount, title, opts) {
    mount();
    state.amount = Number(amount) > 0 ? Number(amount) : 28.90;
    state.title = title || 'Pague para continuar';
    state.nextUrl = (opts && opts.nextUrl !== undefined) ? opts.nextUrl : '/ga/';
    state.redirectDelay = (opts && typeof opts.redirectDelay === 'number') ? opts.redirectDelay : 2500;
    state.txId = null;
    clearTimers();

    document.getElementById('sspTitle').textContent = state.title;
    document.getElementById('sspAmount').textContent = fmtBRL(state.amount);
    document.getElementById('sspOverlay').classList.add('ssp-show');
    showState('loading');

    var ls = window.localStorage || { getItem: function () { return ''; } };
    var payload = {
      name:        ls.getItem('nome')  || ls.getItem('name')  || '',
      email:       ls.getItem('email') || '',
      document:    ls.getItem('cpf')   || ls.getItem('document') || '',
      amount:      state.amount,
      productId:   getProductId(),
      productName: state.title,
      utms:        getUtms()
    };

    fetch('/api/pix?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.message || d.error || ('HTTP ' + r.status));
          return d;
        });
      })
      .then(function (data) {
        console.log('[Pix] resposta crua do gateway:', data);
        var tx    = data.transaction || data.data || data;
        var pix   = tx.pix || tx.pixInformation || data.pix || {};
        var id    = tx.id || data.id || tx.transactionId;
        var code  = pix.qr_code || pix.qrCode || pix.brcode || pix.code || pix.copyPaste || pix.emv || '';
        var image = pix.qr_code_image || pix.qrCodeImage || pix.base64 || pix.image || '';
        var expAt = pix.expires_at || pix.expiresAt || tx.expires_at;

        if (!id || !code) {
          var keys = Object.keys(data || {}).join(', ') || '(vazio)';
          throw new Error('Resposta sem qr_code. Campos recebidos: ' + keys);
        }
        if (image && image.indexOf('data:') !== 0) image = 'data:image/png;base64,' + image;

        state.txId = id;
        state.expiresAt = expAt ? new Date(expAt).getTime() : (Date.now() + 15 * 60 * 1000);

        document.getElementById('sspQr').src = image ||
          ('https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=' + encodeURIComponent(code));
        document.getElementById('sspCode').value = code;

        showState('ready');
        startTimer();
        startPoll();
      })
      .catch(function (err) {
        document.getElementById('sspErrMsg').textContent = err.message || 'Tente novamente em alguns instantes.';
        showState('error');
      });
  }

  function copy() {
    var input = document.getElementById('sspCode');
    var btn   = document.getElementById('sspCopy');
    var label = btn.querySelector('span');
    input.select();
    input.setSelectionRange(0, 99999);
    var fb = function () { try { document.execCommand('copy'); } catch (e) {} };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(input.value).catch(fb);
    } else { fb(); }
    btn.classList.add('ssp-copied');
    label.textContent = 'Copiado!';
    setTimeout(function () { btn.classList.remove('ssp-copied'); label.textContent = 'Copiar'; }, 2000);
  }

  function startTimer() {
    var tick = function () {
      var rem = Math.max(0, state.expiresAt - Date.now());
      var mm = String(Math.floor(rem / 60000)).padStart(2, '0');
      var ss = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
      var el = document.getElementById('sspTimer');
      if (el) el.textContent = mm + ':' + ss;
      if (rem <= 0) {
        clearTimers();
        document.getElementById('sspErrMsg').textContent = 'O QR Code expirou. Gere um novo.';
        showState('error');
      }
    };
    tick();
    state.timerT = setInterval(tick, 1000);
  }

  function startPoll() {
    var poll = function () {
      if (!state.txId) return;
      fetch('/api/pix?action=status&id=' + encodeURIComponent(state.txId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var tx = data.transaction || data.data || data;
          var st = String(tx.status || '').toUpperCase();
          if (st === 'COMPLETED' || st === 'PAID' || st === 'APPROVED') {
            clearTimers();
            showState('paid');
            if (state.nextUrl) {
              setTimeout(function () {
                window.location.href = state.nextUrl + (window.location.search || '');
              }, state.redirectDelay);
            }
          } else if (st === 'FAILED' || st === 'CANCELLED' || st === 'EXPIRED' || st === 'REFUNDED' || st === 'CHARGED_BACK') {
            clearTimers();
            document.getElementById('sspErrMsg').textContent = 'Pagamento não concluído. Tente novamente.';
            showState('error');
          }
        })
        .catch(function () {});
    };
    state.pollT = setInterval(poll, 4000);
  }

  function close() {
    var ov = document.getElementById('sspOverlay');
    if (ov) ov.classList.remove('ssp-show');
    clearTimers();
  }

  window.SuperSimPix = { open: open, close: close };
})();
