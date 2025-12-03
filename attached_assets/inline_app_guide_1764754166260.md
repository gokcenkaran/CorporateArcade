# aiNoodle Inline App Development Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-02
**SDK Version:** 1.0.0

---

## Genel Bakış

Bu döküman, standart MCP protokolünde **inline HTML response** dönen WebApp'ların nasıl geliştirileceğini açıklar.

### Inline vs Layer Mode Karşılaştırması

| Özellik | Inline Mode | Layer Mode |
|---------|-------------|------------|
| **Görüntüleme** | Chat/UI içine gömülü | Modal/overlay açılır |
| **İletişim** | HTTP Request/Response | postMessage (iframe) |
| **SDK Gereksinimi** | Hayır (REST endpoint) | Evet (MCPCallee SDK) |
| **Kullanım Alanı** | Hızlı sonuçlar, kartlar | Oyunlar, formlar, interaktif UI |
| **Kullanıcı Etkileşimi** | Pasif (sadece görüntüleme) | Aktif (input, tıklama) |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        INLINE MODE AKIŞI                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Caller (Chat UI)              WebApp Server                   │
│   ┌─────────────┐              ┌─────────────┐                  │
│   │  MCPCaller  │    HTTP      │  /api/inline│                  │
│   │             │───POST────►  │             │                  │
│   │             │              │  • Token    │                  │
│   │             │              │    validate │                  │
│   │             │              │  • Process  │                  │
│   │             │              │    request  │                  │
│   │             │   JSON       │  • Generate │                  │
│   │             │◄─Response──  │    HTML     │                  │
│   │             │              └─────────────┘                  │
│   │  Render     │                                               │
│   │  HTML in UI │                                               │
│   └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Spesifikasyonu

### Endpoint

```
POST {your-webapp-url}/api/inline
```

### Request Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {jwt_token}` | MCP Server'dan alınan JWT token |
| `Content-Type` | `application/json` | Request body formatı |

### Request Body

```json
{
  "resource_id": "string",
  "params": {
    "key1": "value1",
    "key2": "value2"
  },
  "context": {
    "customer_id": "string",
    "project_id": "string",
    "user_id": "string",
    "language": "string"
  }
}
```

| Alan | Tip | Açıklama |
|------|-----|----------|
| `resource_id` | string | İstek yapılan kaynak ID'si |
| `params` | object | App'a gönderilen parametreler |
| `context.customer_id` | string | Müşteri ID |
| `context.project_id` | string | Proje ID |
| `context.user_id` | string | Kullanıcı ID |
| `context.language` | string | Dil kodu (tr, en, de, vb.) |

### Response Format

```json
{
  "type": "html",
  "content": "<div class='weather-card'>...</div>",
  "metadata": {
    "title": "İstanbul Hava Durumu",
    "cached_at": "2025-12-02T10:00:00Z"
  }
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `type` | string | Evet | `html`, `markdown`, `json`, `text` |
| `content` | string | Evet | Render edilecek içerik |
| `metadata` | object | Hayır | Ek bilgiler (opsiyonel) |

### Response Types

| Type | Açıklama | Kullanım |
|------|----------|----------|
| `html` | HTML markup | Zengin görsel kartlar, tablolar |
| `markdown` | Markdown text | Formatlanmış metin |
| `json` | JSON data | Yapılandırılmış veri |
| `text` | Plain text | Basit metin yanıtları |

---

## Token Doğrulama

JWT token MCP Server tarafından üretilir. WebApp bu token'ı doğrulamalıdır.

### Token Payload Yapısı

```json
{
  "userId": "user-123",
  "appId": "weather-app",
  "resourceId": "resource-456",
  "customerId": "customer-789",
  "projectId": "project-abc",
  "iat": 1732891234,
  "exp": 1732893034
}
```

### JWT Doğrulama (Node.js)

```javascript
const jwt = require('jsonwebtoken');

function validateToken(token, secretKey) {
  try {
    const decoded = jwt.verify(token, secretKey);
    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Middleware olarak kullanım
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  const result = validateToken(token, process.env.JWT_SECRET);

  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.tokenPayload = result.payload;
  next();
}
```

---

## Örnek Implementasyonlar

### 1. Express.js (Node.js)

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// JWT doğrulama middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.substring(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Inline endpoint
app.post('/api/inline', authMiddleware, async (req, res) => {
  const { resource_id, params, context } = req.body;

  try {
    // İş mantığı - örnek: hava durumu
    const weatherData = await fetchWeather(params.city || 'Istanbul');

    // HTML oluştur
    const html = `
      <div class="weather-card" style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 20px;
        color: white;
        max-width: 300px;
      ">
        <div style="font-size: 14px; opacity: 0.9;">
          ${weatherData.city}
        </div>
        <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">
          ${weatherData.temperature}°C
        </div>
        <div style="font-size: 16px;">
          ${weatherData.condition}
        </div>
        <div style="font-size: 12px; margin-top: 15px; opacity: 0.8;">
          Nem: ${weatherData.humidity}% | Rüzgar: ${weatherData.wind} km/s
        </div>
      </div>
    `;

    res.json({
      type: 'html',
      content: html,
      metadata: {
        city: weatherData.city,
        temperature: weatherData.temperature,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      type: 'html',
      content: `
        <div style="color: #e74c3c; padding: 15px; border: 1px solid #e74c3c; border-radius: 8px;">
          <strong>Hata:</strong> ${error.message}
        </div>
      `,
      metadata: { error: true }
    });
  }
});

// Mock hava durumu fonksiyonu
async function fetchWeather(city) {
  return {
    city: city,
    temperature: Math.floor(Math.random() * 30) + 5,
    condition: 'Parçalı Bulutlu',
    humidity: Math.floor(Math.random() * 50) + 30,
    wind: Math.floor(Math.random() * 30) + 5
  };
}

app.listen(3000, () => {
  console.log('Inline WebApp running on port 3000');
});
```

### 2. Vercel Edge Function (Serverless)

```javascript
// api/inline.js
import { jwtVerify } from 'jose';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Token doğrulama
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = authHeader.substring(7);
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Request body parse
  const { resource_id, params, context } = await req.json();

  // HTML response oluştur
  const html = generateProductCard(params);

  return new Response(JSON.stringify({
    type: 'html',
    content: html,
    metadata: { resource_id, generated_at: new Date().toISOString() }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function generateProductCard(params) {
  return `
    <div style="
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      max-width: 280px;
      font-family: system-ui, sans-serif;
    ">
      <img src="${params.image || 'https://via.placeholder.com/280x180'}"
           style="width: 100%; border-radius: 4px; margin-bottom: 12px;" />
      <h3 style="margin: 0 0 8px; font-size: 16px; color: #333;">
        ${params.title || 'Ürün Adı'}
      </h3>
      <p style="margin: 0 0 12px; font-size: 14px; color: #666;">
        ${params.description || 'Ürün açıklaması'}
      </p>
      <div style="font-size: 20px; font-weight: bold; color: #2ecc71;">
        ${params.price || '₺0.00'}
      </div>
    </div>
  `;
}
```

### 3. Python Flask

```python
from flask import Flask, request, jsonify
from functools import wraps
import jwt
import os

app = Flask(__name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401

        token = auth_header[7:]

        try:
            payload = jwt.decode(
                token,
                os.environ.get('JWT_SECRET'),
                algorithms=['HS256']
            )
            request.token_payload = payload
        except jwt.InvalidTokenError as e:
            return jsonify({'error': str(e)}), 401

        return f(*args, **kwargs)
    return decorated

@app.route('/api/inline', methods=['POST'])
@token_required
def inline_handler():
    data = request.get_json()

    resource_id = data.get('resource_id')
    params = data.get('params', {})
    context = data.get('context', {})

    # Dil bazlı içerik
    language = context.get('language', 'tr')

    if language == 'tr':
        greeting = 'Merhaba'
        message = 'İşleminiz tamamlandı'
    else:
        greeting = 'Hello'
        message = 'Your request has been processed'

    html = f'''
    <div style="
        background: #f8f9fa;
        border-left: 4px solid #28a745;
        padding: 15px 20px;
        border-radius: 0 8px 8px 0;
        font-family: system-ui, sans-serif;
    ">
        <div style="font-weight: bold; color: #28a745; margin-bottom: 5px;">
            {greeting}!
        </div>
        <div style="color: #333;">
            {message}
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 10px;">
            Resource: {resource_id}
        </div>
    </div>
    '''

    return jsonify({
        'type': 'html',
        'content': html,
        'metadata': {
            'language': language,
            'resource_id': resource_id
        }
    })

if __name__ == '__main__':
    app.run(port=3000, debug=True)
```

---

## HTML Response Best Practices

### 1. Inline Styles Kullanın

External CSS yüklenemeyeceği için inline styles kullanın:

```html
<!-- ✅ Doğru -->
<div style="padding: 16px; background: #fff; border-radius: 8px;">
  Content
</div>

<!-- ❌ Yanlış - CSS class'ları çalışmaz -->
<div class="card">
  Content
</div>
```

### 2. Responsive Tasarım

```html
<div style="
  max-width: 100%;
  width: 300px;
  box-sizing: border-box;
  padding: 16px;
">
  Content
</div>
```

### 3. Güvenli Fontlar

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  Content
</div>
```

### 4. Dark Mode Desteği

```html
<div style="
  background: var(--bg-color, #ffffff);
  color: var(--text-color, #333333);
  padding: 16px;
  border-radius: 8px;
">
  Content
</div>
```

### 5. Compact & Readable

```html
<!-- Uzun içerik için max-height ve scroll -->
<div style="
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
">
  Long content...
</div>
```

---

## Hata Yönetimi

### Error Response Format

```json
{
  "type": "html",
  "content": "<div class='error'>Error message</div>",
  "metadata": {
    "error": true,
    "code": "VALIDATION_ERROR",
    "message": "City parameter is required"
  }
}
```

### HTTP Status Kodları

| Kod | Açıklama | Kullanım |
|-----|----------|----------|
| `200` | Success | Normal response |
| `400` | Bad Request | Geçersiz parametreler |
| `401` | Unauthorized | Token eksik/geçersiz |
| `403` | Forbidden | Yetkisiz erişim |
| `500` | Server Error | Sunucu hatası |

### Error HTML Template

```javascript
function errorHtml(message, code) {
  return `
    <div style="
      background: #fff5f5;
      border: 1px solid #fc8181;
      border-radius: 8px;
      padding: 16px;
      font-family: system-ui, sans-serif;
    ">
      <div style="
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      ">
        <span style="color: #c53030; font-size: 20px; margin-right: 8px;">⚠</span>
        <span style="color: #c53030; font-weight: bold;">Hata</span>
      </div>
      <div style="color: #742a2a; font-size: 14px;">
        ${message}
      </div>
      ${code ? `<div style="color: #a0aec0; font-size: 12px; margin-top: 8px;">Kod: ${code}</div>` : ''}
    </div>
  `;
}
```

---

## Test Etme

### cURL ile Test

```bash
# Basit test
curl -X POST https://your-app.com/api/inline \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "test-123",
    "params": { "city": "Istanbul" },
    "context": {
      "customer_id": "cust-1",
      "project_id": "proj-1",
      "user_id": "user-1",
      "language": "tr"
    }
  }'
```

### Test Token Oluşturma (Development)

```javascript
const jwt = require('jsonwebtoken');

const testToken = jwt.sign(
  {
    userId: 'test-user',
    appId: 'test-app',
    resourceId: 'test-resource',
    customerId: 'test-customer',
    projectId: 'test-project'
  },
  'your-secret-key',
  { expiresIn: '1h' }
);

console.log('Test Token:', testToken);
```

### Response Doğrulama

Beklenen response yapısı:

```javascript
// Response JSON parse edilebilmeli
const response = JSON.parse(responseText);

// Zorunlu alanlar
assert(response.type !== undefined, 'type field required');
assert(response.content !== undefined, 'content field required');

// Type değeri geçerli olmalı
assert(['html', 'markdown', 'json', 'text'].includes(response.type));

// HTML type için content string olmalı
if (response.type === 'html') {
  assert(typeof response.content === 'string');
}
```

---

## Checklist

### Deployment Öncesi Kontrol Listesi

- [ ] `/api/inline` endpoint'i oluşturuldu
- [ ] JWT token doğrulaması implemente edildi
- [ ] Request body parse ediliyor (resource_id, params, context)
- [ ] Response doğru formatta dönüyor (type, content, metadata)
- [ ] CORS headers ayarlandı (gerekiyorsa)
- [ ] Error handling mevcut
- [ ] HTML inline styles kullanıyor
- [ ] Responsive tasarım uygulandı
- [ ] cURL ile test edildi

### Güvenlik Kontrolleri

- [ ] JWT secret güvenli bir şekilde saklanıyor (env variable)
- [ ] Token expiration kontrol ediliyor
- [ ] Input validation yapılıyor
- [ ] XSS koruması (HTML escape)
- [ ] Rate limiting (opsiyonel)

---

## Versiyon Geçmişi

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| 1.0.0 | 2025-12-02 | İlk sürüm |

---

## İlgili Kaynaklar

- **WebApp SDK Guide:** `webapp_development_guide.md` (Layer mode için)
- **MCP Server API:** `API_DOCUMENTATION.md`
- **SDK Source:** `src/core/MCPCaller.ts` (callInlineDirect metodu)

---

*Bu döküman inline mode WebApp geliştirmek için yeterli bilgiyi içermektedir.*
