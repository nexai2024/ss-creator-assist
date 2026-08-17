(function () {
  var cfg = window.MSE_CONFIG || {};
  if (!cfg.integrationId) return;
  var origin = cfg.origin || (document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src).origin
    : window.location.origin);
  var position = cfg.position || 'bottom-right';
  var color = cfg.color || '#3b82f6';

  var bubble = document.createElement('button');
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
    position.indexOf('top') >= 0 ? 'top:20px' : 'bottom:20px'
  ].join(';');
  bubble.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var frame = document.createElement('iframe');
  frame.title = 'Support chat';
  frame.src = origin.replace(/\/$/, '') + '/widget/' + encodeURIComponent(cfg.integrationId);
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
    position.indexOf('top') >= 0 ? 'top:84px' : 'bottom:84px'
  ].join(';');

  var open = false;
  bubble.addEventListener('click', function () {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
  });

  document.body.appendChild(frame);
  document.body.appendChild(bubble);
})();
