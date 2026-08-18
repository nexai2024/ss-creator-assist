(function () {
  function scriptEl() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('mse-widget.js') !== -1) return scripts[i];
    }
    return null;
  }

  function attr(el, name) {
    return el ? el.getAttribute(name) : null;
  }

  function readConfig() {
    var el = scriptEl();
    var cfg = window.MSE_CONFIG || {};
    var origin = cfg.origin || attr(el, 'data-origin') || '';
    if (!origin && el && el.src) {
      try {
        origin = new URL(el.src).origin;
      } catch (err) {
        origin = '';
      }
    }
    if (!origin) origin = window.location.origin;
    return {
      integrationId: cfg.integrationId || attr(el, 'data-integration-id') || '',
      position: cfg.position || attr(el, 'data-position') || 'bottom-right',
      color: cfg.color || attr(el, 'data-color') || '#3b82f6',
      origin: String(origin).replace(/\/$/, ''),
    };
  }

  function mount() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
      }
      return;
    }
    if (document.getElementById('mse-widget-frame')) return;

    var cfg = readConfig();
    if (!cfg.integrationId) {
      console.error('[MSE] Widget embed is missing data-integration-id.');
      return;
    }

    var position = cfg.position;
    var color = cfg.color;

    var bubble = document.createElement('button');
    bubble.id = 'mse-widget-bubble';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.style.cssText = [
      'position:fixed',
      'z-index:2147483000',
      'width:56px',
      'height:56px',
      'border-radius:9999px',
      'border:0',
      'cursor:pointer',
      'background:' + color,
      'color:#fff',
      'box-shadow:0 8px 24px rgba(15,23,42,0.25)',
      position.indexOf('left') >= 0 ? 'left:20px' : 'right:20px',
      position.indexOf('top') >= 0 ? 'top:20px' : 'bottom:20px',
    ].join(';');
    bubble.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    var frame = document.createElement('iframe');
    frame.id = 'mse-widget-frame';
    frame.title = 'Support chat';
    frame.setAttribute('allow', 'clipboard-write');
    frame.src = cfg.origin + '/widget/' + encodeURIComponent(cfg.integrationId);
    frame.style.cssText = [
      'position:fixed',
      'z-index:2147483001',
      'width:360px',
      'height:520px',
      'max-height:calc(100vh - 120px)',
      'border:0',
      'border-radius:16px',
      'box-shadow:0 16px 48px rgba(15,23,42,0.28)',
      'display:none',
      'background:#fff',
      position.indexOf('left') >= 0 ? 'left:20px' : 'right:20px',
      position.indexOf('top') >= 0 ? 'top:84px' : 'bottom:84px',
    ].join(';');

    var open = false;
    bubble.addEventListener('click', function () {
      open = !open;
      frame.style.display = open ? 'block' : 'none';
    });

    document.body.appendChild(frame);
    document.body.appendChild(bubble);
  }

  mount();
})();
