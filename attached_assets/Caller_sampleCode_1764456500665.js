// Caller App - Arcade'i çağıran kod

// 1. Session Init - Uygulama başladığında bir kez çağır
async function initMCPSession() {
  const response = await fetch('https://aimcp.replit.app/mcp/v1/session/init?language=tr', {
    headers: {
      'Authorization': `Bearer ${YOUR_JWT_TOKEN}`
    }
  });
  
  const data = await response.json();
  // data.apps[] içinde arcade app'ı ve token'ı var
  return data;
}

// 2. Arcade'i Layer olarak aç
function openArcadeLayer(app, context) {
  // iframe oluştur
  const iframe = document.createElement('iframe');
  iframe.src = app.endpoint + '/arcade/index.html';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;';
  document.body.appendChild(iframe);

  // Arcade hazır olduğunda init gönder
  window.addEventListener('message', function handler(event) {
    if (event.data.type === 'mcp:ready') {
      // Init context gönder
      iframe.contentWindow.postMessage({
        type: 'mcp:init',
        context: {
          resourceId: context.resourceId,
          userId: context.userId,
          customerId: context.customerId,
          projectId: context.projectId,
          token: app.token,
          config: { theme: 'dark' }
        }
      }, '*');
    }
    
    // Progress dinle
    if (event.data.type === 'mcp:progress') {
      console.log('Oyun progress:', event.data.data);
    }
    
    // Oyun bitti
    if (event.data.type === 'mcp:complete') {
      console.log('Oyun tamamlandı:', event.data.data);
      // { finalScore, highScore, level, won, timeElapsed }
      iframe.remove();
    }
    
    // İptal edildi
    if (event.data.type === 'mcp:cancel') {
      console.log('Oyun iptal:', event.data.data);
      iframe.remove();
    }
    
    // Kapatma isteği
    if (event.data.type === 'mcp:close-request') {
      iframe.remove();
    }
  });
}

// 3. Kullanım
const session = await initMCPSession();
const arcadeApp = session.apps.find(a => a.name === 'Arcade');

openArcadeLayer(arcadeApp, {
  resourceId: 'game-session-123',
  userId: 'user-456',
  customerId: session.session.customer_id,
  projectId: session.session.project_id
});

Özet akış:

Caller                          Arcade (Callee)
  │                                  │
  │──── iframe src=arcade ──────────▶│
  │                                  │
  │◀─────── mcp:ready ───────────────│
  │                                  │
  │──────── mcp:init ───────────────▶│
  │                                  │
  │◀─────── mcp:progress ────────────│ (oyun sırasında)
  │                                  │
  │◀─────── mcp:complete ────────────│ (oyun bitince)
  │                                  │

