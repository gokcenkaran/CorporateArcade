# aiNoodle WebApp Integration Reference

> **Bu dokuman AI asistanlari (Claude Code, Replit AI, Cursor, vb.) icin hazirlanmistir.**
> Version: 1.2.0 | Updated: 2025-11-29

---

## HIZLI BASVURU

| Senaryo | Git |
|---------|-----|
| Baska bir webapp'i cagiran app gelistiriyorum | [CALLER ENTEGRASYONU](#caller-entegrasyonu) |
| Cagrilacak bir webapp gelistiriyorum | [CALLEE ENTEGRASYONU](#callee-entegrasyonu) |
| Chatbot entegrasyonu yapiyorum | [CHATBOT ENTEGRASYONU](#chatbot-entegrasyonu) |
| MCPChatbotHelper kullanmak istiyorum | [MCPCHATBOTHELPER](#mcpchatbothelper) |

---

## MIMARI GENEL BAKIS

SDK v1.2.0 session-based mimari kullanir:

```
┌─────────────┐    1. Session Init     ┌─────────────┐
│   Caller    │ ──────────────────────>│  MCP Server │
│   (SDK)     │<────────────────────── │(Token Broker)│
└─────────────┘    Apps + Tokens       └─────────────┘
       │
       │  2. Direct Call (with token)
       v
┌─────────────┐
│   Callee    │
│  (WebApp)   │
└─────────────┘
```

**Onemli:** MCP Server sadece token broker gorevindedir:
- Session init sirasinda app listesi ve token'lari verir
- Sonraki call'lar direkt Callee'ye gider
- MCP Server aradan cekilir

---

## SDK KURULUMU

```bash
# GitHub token ile kurulum
npm install git+https://<GITHUB_TOKEN>@github.com/gokcenkaran/ainoodle_mcp_sdk.git
```

```typescript
// ES Modules
import { MCPCaller, MCPCallee, MCPChatbotHelper } from '@gokcenkaran/mcp-sdk';

// CommonJS
const { MCPCaller, MCPCallee, MCPChatbotHelper } = require('@gokcenkaran/mcp-sdk');
```

---

## CALLER ENTEGRASYONU

> Caller: Baska bir webapp'i cagiran uygulamadir.

### Temel Kullanim

```typescript
import { MCPCaller } from '@gokcenkaran/mcp-sdk';

// 1. SDK'yi baslat
const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: {
    type: 'token-provider',
    tokenProvider: async () => {
      return localStorage.getItem('jwt_token')!;
    }
  },
  customerId: 'customer-123',
  projectId: 'project-456',
  userId: 'user-789',
  language: 'tr',
  debug: true
});

// 2. Session init - UYGULAMA BASINDA BIR KERE
await mcp.initialize();
// Bu noktada tum app'lar ve token'lar yuklendi

// 3. App cagir (direkt Callee'ye gider)
const result = await mcp.call('slider1', {
  resourceId: 'new',
  params: { theme: 'dark' }
});

if (result.success) {
  if (result.mode === 'inline') {
    console.log('HTML:', result.inlineResponse?.content);
  } else {
    console.log('Layer completed:', result.data);
  }
}

// 4. Cleanup
mcp.destroy();
```

### Session Init Response Ornegi

```json
{
  "status": "success",
  "session": {
    "id": "session-123",
    "customer_id": "customer-123",
    "project_id": "project-456",
    "expires_at": "2025-11-29T10:00:00Z"
  },
  "apps": [
    {
      "id": "arcade",
      "name": "Arcade",
      "description": "Game arcade",
      "endpoint": "https://arcade.example.com",
      "token": "eyJhbGc...",
      "token_expires_at": "2025-11-29T09:55:00Z",
      "response_type": "layer",
      "keywords": { "hints": { "tr": ["oyun", "oyna"] } },
      "parameters": []
    }
  ]
}
```

### Token Yenileme

SDK token expire kontrolu yapar ve gerektiginde yeniler:

```typescript
// Manuel token yenileme (genellikle gerekli degil, SDK otomatik yapar)
await mcp.refreshToken('appId');

// Token durumu kontrol
const app = mcp.getApp('appId');
console.log('Token expires:', app?.token_expires_at);
```

### Event Dinleme

```typescript
mcp.on('app:ready', ({ appId }) => {
  console.log(`${appId} hazir`);
});

mcp.on('app:progress', ({ appId, type, data }) => {
  console.log(`${appId} progress:`, data);
});

mcp.on('app:complete', ({ appId, data }) => {
  console.log(`${appId} tamamlandi:`, data);
});

mcp.on('app:error', ({ appId, error }) => {
  console.error(`${appId} hata:`, error);
});
```

---

## CALLEE ENTEGRASYONU

> Callee: Cagrilan webapp'tir. Layer veya iframe icinde acilir.

### Temel Kullanim

```typescript
import { MCPCallee } from '@gokcenkaran/mcp-sdk';

const mcp = new MCPCallee({
  appId: 'video1',
  version: '1.0.0',
  capabilities: ['play', 'pause', 'seek'],
  debug: true
});

// Init callback
mcp.onInit((context) => {
  console.log('Customer:', context.customerId);
  console.log('Project:', context.projectId);
  console.log('User:', context.userId);
  console.log('Resource:', context.resourceId);
  console.log('Params:', context.params);

  if (context.resourceId && context.resourceId !== 'new') {
    loadResource(context.resourceId);
  }
});

// Control callback
mcp.onControl((action, params) => {
  switch (action) {
    case 'play': videoPlayer.play(); break;
    case 'pause': videoPlayer.pause(); break;
    case 'seek': videoPlayer.seekTo(params.position); break;
  }
});

// Close callback
mcp.onClose((reason) => {
  saveProgress();
});

// Progress bildirme
mcp.sendProgress({ current: 120, total: 600 });

// Tamamlama
mcp.complete({ videoId: 'vid-123', watchedPercent: 100 });

// Iptal
mcp.cancel('user_cancelled');

// Hata
mcp.error('LOAD_FAILED', 'Video yuklenemedi');

// Cleanup
mcp.destroy();
```

---

## CHATBOT ENTEGRASYONU

### Temel Detect ve Call

```typescript
import { MCPCaller } from '@gokcenkaran/mcp-sdk';

const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: { type: 'token-provider', tokenProvider: getToken },
  customerId: 'cust-123',
  projectId: 'proj-456',
  language: 'tr',
  minDetectionConfidence: 0.5
});

await mcp.initialize();

// Mesajdan app tespit et
const detection = mcp.detectApp('yarin hava nasil olacak?');

if (detection.detected) {
  console.log('App:', detection.app?.id);           // 'weather'
  console.log('Confidence:', detection.confidence);  // 0.85
  console.log('Params:', detection.suggestedParams); // { date: 'tomorrow' }
}
```

### SmartCall

```typescript
// Detect + validate + call tek adimda
const result = await mcp.smartCall('yarin Istanbul\'da hava nasil?');

if (result.detected) {
  if (result.missingParams?.length) {
    // Eksik parametre var
    console.log('Missing:', result.missingParams.map(p => p.name));
  } else if (result.callResult) {
    // App cagridi
    if (result.callResult.mode === 'inline') {
      renderHTML(result.callResult.inlineResponse?.content);
    }
  }
} else {
  // App tespit edilemedi, LLM kullan
  const llmResponse = await sendToLLM(message);
}
```

### Inline Mode

```typescript
// Layer acmadan HTML response al
const result = await mcp.call('weather', {
  mode: 'inline',
  params: { city: 'Istanbul' }
});

if (result.success && result.mode === 'inline') {
  chatUI.appendHTML(result.inlineResponse?.content);
}
```

---

## MCPCHATBOTHELPER

> Advanced chatbot entegrasyonu icin helper class.

### Constructor

```typescript
import { MCPCaller, MCPChatbotHelper } from '@gokcenkaran/mcp-sdk';

const mcp = new MCPCaller({ /* config */ });
await mcp.initialize();

const helper = new MCPChatbotHelper({
  mcpCaller: mcp,
  frequency: {
    cooldownMessages: 5,      // Dismiss sonrasi kac mesaj bekle
    maxDismissPerSession: 2   // Session basina max dismiss
  },
  detection: {
    minConfidence: 0.6,       // Min confidence
    language: 'tr'            // Dil
  }
});
```

### Metodlar

#### detectAllApps(message)

Tum eslesen app'lari dondurur (sadece en iyisini degil):

```typescript
const detections = helper.detectAllApps('video izlemek istiyorum');
// Confidence'a gore sirali (yuksekten dusuge)

detections.forEach(d => {
  console.log(`${d.app.name}: ${d.confidence}`);
});
```

#### generateAIContext(detections)

AI system prompt'a eklenecek context olusturur:

```typescript
const context = helper.generateAIContext(detections);

// Output:
// [MCP_APPS_DETECTED]
// Kullanicinin mesajinda su uygulamalar tespit edildi:
//
// 1. Video Player (layer) - Video izleme uygulamasi
//    Confidence: 85%
//
// Yanitinda en uygun olani onerebilirsin.
// [/MCP_APPS_DETECTED]

// AI'a gonder
const systemPrompt = basePrompt + '\n' + context;
```

#### createSuggestion(detection)

Detection'dan suggestion objesi olusturur:

```typescript
const suggestion = helper.createSuggestion(detections[0]);

if (suggestion) {
  // UI'da suggestion card goster
  showSuggestionCard({
    appName: suggestion.app.name,
    confidence: suggestion.confidence,
    responseType: suggestion.responseType
  });
}
// null donerse frekans kontrolu gecemedi
```

#### acceptSuggestion(suggestion)

Suggestion'i kabul et ve app'i cagir:

```typescript
const result = await helper.acceptSuggestion(suggestion);

if (result.success) {
  if (result.responseType === 'inline') {
    renderHTML(result.html);
  } else {
    // Layer acildi
  }
} else {
  showError(result.error?.message);
}
```

#### dismissSuggestion(suggestion)

Suggestion'i reddet:

```typescript
helper.dismissSuggestion(suggestion);
// Frekans state guncellenir
```

#### shouldShowSuggestion(appId)

Frekans kontrolu:

```typescript
// Logic:
// - dismissCount === 0 -> true
// - dismissCount === 1 && cooldown gecti -> true
// - dismissCount >= maxDismissPerSession -> false

if (helper.shouldShowSuggestion('weather')) {
  // Suggestion gosterilebilir
}
```

#### resetFrequency()

Yeni session icin frekans state'ini sifirla:

```typescript
// Session baslangicinda
helper.resetFrequency();
```

#### incrementMessageCount()

Her kullanici mesajinda cagir:

```typescript
// Cooldown hesabi icin
helper.incrementMessageCount();
```

#### getLayerApps() / getInlineApps() / getAllApps()

App filtreleme:

```typescript
// Ust panel icin layer app listesi
const layerApps = helper.getLayerApps();

// Inline app'lar
const inlineApps = helper.getInlineApps();

// Tum app'lar
const allApps = helper.getAllApps();
```

### Tam Chatbot Entegrasyon Ornegi

```typescript
import { MCPCaller, MCPChatbotHelper } from '@gokcenkaran/mcp-sdk';

// 1. SDK Baslat
const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: { type: 'token-provider', tokenProvider: getToken },
  customerId: 'cust-123',
  projectId: 'proj-456',
  language: 'tr'
});

await mcp.initialize();

// 2. Helper Olustur
const helper = new MCPChatbotHelper({
  mcpCaller: mcp,
  frequency: { cooldownMessages: 5, maxDismissPerSession: 2 },
  detection: { minConfidence: 0.6, language: 'tr' }
});

// 3. Session Baslat
helper.resetFrequency();

// 4. Ust Panel - Layer App Listesi
const layerApps = helper.getLayerApps();
renderTopPanel(layerApps);

// 5. Her Mesajda
async function onUserMessage(message: string) {
  helper.incrementMessageCount();

  // Tum eslesen app'lari bul
  const detections = helper.detectAllApps(message);

  if (detections.length > 0) {
    // AI'a context ver
    const aiContext = helper.generateAIContext(detections);

    // Suggestion olustur
    const suggestion = helper.createSuggestion(detections[0]);

    if (suggestion) {
      // UI'da suggestion card goster
      showSuggestionCard(suggestion, {
        onAccept: async () => {
          const result = await helper.acceptSuggestion(suggestion);
          if (result.success && result.responseType === 'inline') {
            appendHTML(result.html);
          }
        },
        onDismiss: () => {
          helper.dismissSuggestion(suggestion);
        }
      });
    }

    // AI'a gonder (context ile)
    const response = await sendToAI(message, aiContext);
    showResponse(response);
  } else {
    // App tespit edilemedi - normal AI akisi
    const response = await sendToAI(message);
    showResponse(response);
  }
}
```

---

## INTERFACE'LER

### MCPDetectionResult

```typescript
interface MCPDetectionResult {
  app: AppInfo;
  confidence: number;
  matchedKeywords: string[];
  suggestedParams: Record<string, unknown>;
}
```

### MCPSuggestion

```typescript
interface MCPSuggestion {
  id: string;
  app: AppInfo;
  confidence: number;
  userMessage: string;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: Date;
  responseType: 'inline' | 'layer';
  suggestedParams: Record<string, unknown>;
}
```

### MCPCallResult

```typescript
interface MCPCallResult {
  success: boolean;
  responseType: 'inline' | 'layer';
  html?: string;
  appData?: unknown;
  error?: { code: string; message: string };
}
```

### AppInfo

```typescript
interface AppInfo {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  token: string;
  token_expires_at: string;
  response_type: 'layer' | 'inline';
  keywords: AppKeywords;
  parameters: ParameterDef[];
}
```

### AppKeywords

```typescript
interface AppKeywords {
  intent?: string;
  hints?: Record<string, string[]>;  // { "tr": ["video", "izle"], "en": ["video", "watch"] }
  patterns?: string[];               // Regex patterns
}
```

---

## HATA KODLARI

| Kod | Aciklama |
|-----|----------|
| `APP_NOT_FOUND` | App bulunamadi |
| `APP_ALREADY_ACTIVE` | Zaten acik bir app var |
| `TOKEN_REFRESH_FAILED` | Token yenileme hatasi |
| `CALL_FAILED` | App cagrisi basarisiz |
| `INIT_TIMEOUT` | Init event gelmedi |
| `INVALID_SUGGESTION` | Gecersiz suggestion |

---

## BEST PRACTICES

### Caller Icin

1. **Session init bir kere yap** - Uygulama basinda `initialize()` cagir
2. **Token yonetimi** - SDK otomatik token refresh yapar, mudahale etme
3. **Event listener kullan** - Progress takibi icin
4. **Error handling** - Her `call()` icin try-catch

### Callee Icin

1. **Hizli init** - `onInit` callback'inde async islemleri minimize et
2. **Progress bildir** - Uzun islemlerde duzenly `sendProgress()` cagir
3. **Clean exit** - Her zaman `complete()` veya `cancel()` ile kapat

### Chatbot Icin

1. **MCPChatbotHelper kullan** - Frekans kontrolu dahil
2. **AI context ver** - `generateAIContext()` ile
3. **Session baslangicinda resetle** - `resetFrequency()` cagir
4. **Her mesajda increment** - `incrementMessageCount()` cagir
