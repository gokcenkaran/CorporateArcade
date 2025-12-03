# aiNoodle Query Protocol Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-03
**SDK Version:** 1.0.0

---

## Genel Bakis

Query Protocol, Caller ve Callee arasinda **UI acmadan** data exchange yapmak icin kullanilir. Kullanici puani sorgulamak, son olcum degerini almak veya operasyon sonuclarini kontrol etmek gibi senaryolarda idealdir.

### Query vs Call Karsilastirmasi

| Ozellik | Query | Call |
|---------|-------|------|
| **Amac** | Data exchange | UI/Interaction |
| **UI** | Acilmaz | Layer/Inline acilir |
| **Iletisim** | Request/Response | Event-based lifecycle |
| **Kullanim** | Veri sorgulama | Oyun, form, video |
| **Timeout** | 30s (default) | 5min (default) |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUERY PROTOCOL AKISI                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SENARYO 1: HTTP (App acik degilse)                           │
│   ┌─────────────┐              ┌─────────────┐                  │
│   │  MCPCaller  │    HTTP      │  WebApp     │                  │
│   │             │───POST────►  │  /api/query │                  │
│   │             │              │             │                  │
│   │             │   JSON       │             │                  │
│   │             │◄─Response──  │             │                  │
│   └─────────────┘              └─────────────┘                  │
│                                                                 │
│   SENARYO 2: postMessage (App layer mode'da aciksa)            │
│   ┌─────────────┐              ┌─────────────┐                  │
│   │  MCPCaller  │  postMessage │   iframe    │                  │
│   │             │───query────► │  MCPCallee  │                  │
│   │             │              │             │                  │
│   │             │  postMessage │             │                  │
│   │             │◄──response── │             │                  │
│   └─────────────┘              └─────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Caller Kullanimi (MCPCaller)

### Temel Query

```typescript
import { MCPCaller } from '@ainoodle/mcp-sdk';

const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: { type: 'token-provider', tokenProvider: getToken },
  customerId: 'customer-123',
  projectId: 'project-456'
});

await mcp.initialize();

// Query gonder
const result = await mcp.query('game-app', {
  type: 'user_score',
  params: { userId: '23223443' }
});

if (result.success) {
  console.log('Score:', result.data.score);
  console.log('Level:', result.data.level);
} else {
  console.error('Error:', result.error?.message);
}
```

### Type-Safe Query

```typescript
// Response tipini tanimla
interface UserScoreData {
  score: number;
  level: number;
  rank: number;
}

// Generic ile type-safe query
const result = await mcp.query<UserScoreData>('game-app', {
  type: 'user_score',
  params: { userId: '23223443' }
});

if (result.success) {
  // result.data artik UserScoreData tipinde
  console.log(result.data.score);  // TypeScript biliyor
}
```

### Cache Destekli Query

```typescript
// 5 dakika cache ile query
const result = await mcp.queryWithCache('game-app', {
  type: 'leaderboard',
  params: { limit: 10 }
}, 5 * 60 * 1000);  // 5 dakika TTL

// Cache hit kontrolu
if (result.metadata?.cached) {
  console.log('Cached response');
}

// Cache temizleme
mcp.clearQueryCache();
```

### Query Options

```typescript
const result = await mcp.query('app-id', request, {
  // Timeout override (ms)
  timeout: 10000,

  // Cache TTL (ms) - 0 = no cache
  cacheTtl: 60000,

  // User ID override
  userId: 'different-user',

  // Language override
  language: 'en'
});
```

---

## Callee Kullanimi

### Senaryo 1: REST Endpoint (Inline Apps)

```javascript
// Express.js ornegi
const express = require('express');
const { MCPCallee } = require('@ainoodle/mcp-sdk');

const app = express();
app.use(express.json());

// JWT dogrulama middleware (inline_app_guide.md'ye bakin)
const authMiddleware = require('./authMiddleware');

app.post('/api/query', authMiddleware, (req, res) => {
  // Request parse et
  const parsed = MCPCallee.parseQueryRequest(req.body);

  if (!parsed) {
    return res.status(400).json(
      MCPCallee.buildQueryError('INVALID_REQUEST', 'Invalid query format')
    );
  }

  const { request, context, requestId } = parsed;

  // Query tipine gore isle
  switch (request.type) {
    case 'user_score':
      const userId = request.params.userId;
      const score = getUserScore(userId);  // DB'den al
      return res.json(MCPCallee.buildQueryResponse({
        score: score.value,
        level: score.level,
        rank: score.rank
      }));

    case 'leaderboard':
      const limit = request.params.limit || 10;
      const leaderboard = getLeaderboard(limit);
      return res.json(MCPCallee.buildQueryResponse(leaderboard));

    case 'last_measurement':
      const location = request.params.location;
      const measurement = getMeasurement(location);
      return res.json(MCPCallee.buildQueryResponse({
        value: measurement.value,
        unit: measurement.unit,
        timestamp: measurement.timestamp
      }));

    default:
      return res.status(400).json(
        MCPCallee.buildQueryError('UNKNOWN_TYPE', `Unknown query type: ${request.type}`)
      );
  }
});

app.listen(3000);
```

### Senaryo 2: Layer Mode (iframe Apps)

```typescript
import { MCPCallee } from '@ainoodle/mcp-sdk';

const callee = new MCPCallee({
  appId: 'game-app',
  version: '1.0.0'
});

// Init bekle
callee.onInit((context) => {
  console.log('App initialized');
});

// Query handler kaydet
callee.onQuery((query, respond) => {
  console.log('Query received:', query.type);

  switch (query.type) {
    case 'user_score':
      const score = getPlayerScore(query.params.userId);
      respond({ score: 150, level: 3, rank: 12 });
      break;

    case 'game_status':
      respond({
        isPlaying: true,
        currentLevel: 5,
        lives: 3
      });
      break;

    default:
      respond(null, {
        code: 'UNKNOWN_TYPE',
        message: `Unknown query type: ${query.type}`
      });
  }
});
```

### Async Query Handler

```typescript
callee.onQuery(async (query, respond) => {
  if (query.type === 'user_data') {
    try {
      // Async islem
      const data = await fetchUserData(query.params.userId);
      respond(data);
    } catch (error) {
      respond(null, {
        code: 'FETCH_ERROR',
        message: error.message
      });
    }
  }
});
```

---

## Request Format

### QueryRequest

```typescript
interface QueryRequest {
  // Query tipi (zorunlu)
  type: string;

  // Parametreler (zorunlu, bos object olabilir)
  params: Record<string, unknown>;

  // Timeout (opsiyonel, default: 30000ms, max: 120000ms)
  timeout?: number;

  // Cache kullan (opsiyonel, default: false)
  cache?: boolean;
}
```

### Wire Format (HTTP Body / postMessage)

```typescript
interface QueryWireFormat {
  _protocol: 'ainoodle_query';
  _version: '1.0';
  request: QueryRequest;
  context: {
    customer_id: string;
    project_id: string;
    user_id?: string;
    language: string;
  };
  requestId: string;  // Correlation ID
}
```

---

## Response Format

### QueryResponse

```typescript
interface QueryResponse<T = unknown> {
  // Basarili mi
  success: boolean;

  // Veri (success: true ise)
  data?: T;

  // Hata (success: false ise)
  error?: {
    code: string;
    message: string;
  };

  // Metadata
  metadata?: {
    cached: boolean;      // Cache'den mi geldi
    timestamp: string;    // Response zamani
    duration_ms: number;  // Islem suresi (ms)
  };
}
```

---

## Hata Kodlari

| Kod | Aciklama |
|-----|----------|
| `UNKNOWN_QUERY_TYPE` | Bilinmeyen query tipi |
| `QUERY_TIMEOUT` | Timeout asildi |
| `INVALID_PARAMS` | Gecersiz parametreler |
| `APP_NOT_FOUND` | App bulunamadi |
| `APP_NOT_ACTIVE` | App acik degil (layer mode icin) |
| `COMMUNICATION_ERROR` | Iletisim hatasi |
| `SERVER_ERROR` | Sunucu hatasi |
| `UNAUTHORIZED` | Yetkisiz erisim |

---

## Kullanim Ornekleri

### Ornek 1: Kullanici Puani

```typescript
// Caller
const result = await mcp.query('game-app', {
  type: 'user_score',
  params: { userId: '23223443' }
});
// { success: true, data: { score: 150, level: 3, rank: 12 } }

// Callee (REST)
app.post('/api/query', (req, res) => {
  const parsed = MCPCallee.parseQueryRequest(req.body);
  if (parsed.request.type === 'user_score') {
    res.json(MCPCallee.buildQueryResponse({
      score: 150, level: 3, rank: 12
    }));
  }
});
```

### Ornek 2: Lokasyon Olcumu

```typescript
// Caller
const result = await mcp.query('sensor-app', {
  type: 'last_measurement',
  params: { location: 'ABC' }
});
// { success: true, data: { value: 23.5, unit: 'celsius', timestamp: '...' } }
```

### Ornek 3: Operasyon Sonuclari

```typescript
// Caller
const result = await mcp.query('ops-app', {
  type: 'operation_results',
  params: { codes: ['44334', 'kjhkjhkj'] }
});
// { success: true, data: [{ code: '44334', result: ... }, ...] }
```

### Ornek 4: Leaderboard (Cache ile)

```typescript
// 5 dakika cache
const result = await mcp.queryWithCache('game-app', {
  type: 'leaderboard',
  params: { limit: 10, period: 'weekly' }
}, 5 * 60 * 1000);

// Ikinci cagri cache'den gelir
const result2 = await mcp.queryWithCache('game-app', {
  type: 'leaderboard',
  params: { limit: 10, period: 'weekly' }
}, 5 * 60 * 1000);

console.log(result2.metadata?.cached);  // true
```

---

## Timeout & Cache

### Timeout

| Ayar | Deger |
|------|-------|
| Default | 30 saniye |
| Maximum | 120 saniye |

```typescript
// Request'te timeout
await mcp.query('app', {
  type: 'slow_query',
  params: {},
  timeout: 60000  // 60 saniye
});

// Options'da timeout
await mcp.query('app', request, {
  timeout: 60000
});
```

### Cache

Cache varsayilan olarak **kapali**. Opt-in TTL ile aktif edilir.

```typescript
// Tek seferlik cache
await mcp.query('app', { ...request, cache: true }, { cacheTtl: 60000 });

// queryWithCache convenience method
await mcp.queryWithCache('app', request, 60000);

// Cache temizle
mcp.clearQueryCache();
```

---

## Best Practices

### 1. Query Tiplerini Dokumante Edin

```typescript
// types/queries.ts
export const QueryTypes = {
  USER_SCORE: 'user_score',
  LEADERBOARD: 'leaderboard',
  GAME_STATUS: 'game_status'
} as const;

// Kullanim
await mcp.query('game', {
  type: QueryTypes.USER_SCORE,
  params: { userId }
});
```

### 2. Response Tiplerini Tanimlayin

```typescript
interface UserScoreResponse {
  score: number;
  level: number;
  rank: number;
}

interface LeaderboardResponse {
  players: Array<{
    userId: string;
    score: number;
    rank: number;
  }>;
  total: number;
}

// Type-safe query
const result = await mcp.query<UserScoreResponse>('game', {
  type: 'user_score',
  params: { userId }
});
```

### 3. Hata Yonetimi

```typescript
const result = await mcp.query('app', request);

if (!result.success) {
  switch (result.error?.code) {
    case 'UNKNOWN_QUERY_TYPE':
      console.error('Invalid query type');
      break;
    case 'QUERY_TIMEOUT':
      console.error('Query timed out, try again');
      break;
    case 'UNAUTHORIZED':
      console.error('Not authorized');
      break;
    default:
      console.error('Query failed:', result.error?.message);
  }
  return;
}

// Basarili
console.log(result.data);
```

### 4. Cache Stratejisi

```typescript
// Sik degisen veriler - cache'leme
const liveScore = await mcp.query('app', { type: 'live_score', params: {} });

// Nadir degisen veriler - uzun cache
const config = await mcp.queryWithCache('app', {
  type: 'app_config',
  params: {}
}, 30 * 60 * 1000);  // 30 dakika

// Liste verileri - kisa cache
const leaderboard = await mcp.queryWithCache('app', {
  type: 'leaderboard',
  params: { limit: 10 }
}, 60 * 1000);  // 1 dakika
```

---

## Test Etme

### cURL ile Test

```bash
# Wire format olustur
curl -X POST https://your-app.com/api/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "_protocol": "ainoodle_query",
    "_version": "1.0",
    "request": {
      "type": "user_score",
      "params": { "userId": "123" }
    },
    "context": {
      "customer_id": "cust-1",
      "project_id": "proj-1",
      "user_id": "user-1",
      "language": "tr"
    },
    "requestId": "qry_test_123"
  }'
```

### Unit Test Ornegi

```typescript
import { MCPCallee } from '@ainoodle/mcp-sdk';

describe('Query Handler', () => {
  it('should handle user_score query', () => {
    const wire = {
      _protocol: 'ainoodle_query',
      _version: '1.0',
      request: { type: 'user_score', params: { userId: '123' } },
      context: { customer_id: 'c1', project_id: 'p1', language: 'tr' },
      requestId: 'qry_test'
    };

    const parsed = MCPCallee.parseQueryRequest(wire);
    expect(parsed).not.toBeNull();
    expect(parsed.request.type).toBe('user_score');

    const response = MCPCallee.buildQueryResponse({ score: 100 });
    expect(response.success).toBe(true);
    expect(response.data.score).toBe(100);
  });
});
```

---

## Versiyon Gecmisi

| Versiyon | Tarih | Degisiklikler |
|----------|-------|---------------|
| 1.0.0 | 2025-12-03 | Ilk surum |

---

## Ilgili Kaynaklar

- **Inline App Guide:** `inline_app_guide.md`
- **Overlay App Guide:** `overlay_app_guide.md`
- **SDK Source:** `src/core/MCPCaller.ts`, `src/core/MCPCallee.ts`
- **Types:** `src/types/query.types.ts`
- **Helpers:** `src/utils/queryHelpers.ts`

---

*Bu dokuman Query Protocol kullanimi icin kapsamli bir rehber saglamaktadir.*
