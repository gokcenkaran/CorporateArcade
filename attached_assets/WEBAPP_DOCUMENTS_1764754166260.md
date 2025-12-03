# aiNoodle WebApp Development Guide

**Version:** 2.1.0  
**Last Updated:** 2025-11-30  
**SDK Version:** 1.0.0

---

## Quick Start - SDK Entegrasyonu

Her WebApp'a eklenecek **tek satır kod**:

```html
<script src="https://aimcp.replit.app/sdk/ainoodle-webapp.js"></script>
<script>
  aiNoodle.init({
    focusTarget: 'canvas',
    onInit: function(data) {
      console.log('Token:', data.token);
      console.log('Params:', data.params);
    },
    onActivate: function() {
      startGame();
    }
  });
</script>
```

**Bu kadar!** SDK tüm iletişimi otomatik yönetir.

---

## Table of Contents

1. [SDK Kurulumu](#1-sdk-kurulumu)
2. [Lifecycle Events](#2-lifecycle-events)
3. [API Reference](#3-api-reference)
4. [İletişim Protokolü](#4-iletişim-protokolü)
5. [Parametre Kullanımı](#5-parametre-kullanımı)
6. [Token Yönetimi](#6-token-yönetimi)
7. [Oyun/Uygulama Örneği](#7-oyunuygulama-örneği)
8. [Form/Quiz Örneği](#8-formquiz-örneği)
9. [Best Practices](#9-best-practices)
10. [Hata Yönetimi](#10-hata-yönetimi)
11. [Debug Modu](#11-debug-modu)
12. [Checklist](#12-checklist)
13. [Gelişmiş: Dual Protocol](#13-gelişmiş-dual-protocol)

---

## 1. SDK Kurulumu

### 1.1 Script Ekleme

HTML sayfanızın `<head>` veya `<body>` sonuna ekleyin:

```html
<script src="https://aimcp.replit.app/sdk/ainoodle-webapp.js"></script>
```

### 1.2 SDK Başlatma

```javascript
aiNoodle.init({
  // Opsiyonel: Focus verilecek element selector
  focusTarget: 'canvas',  // veya '#game-container', '.main-input'
  
  // Opsiyonel: Debug logları aktif et
  debug: true,
  
  // Opsiyonel: Ek izin verilen origin'ler
  allowedOrigins: ['https://my-custom-domain.com'],
  
  // Callback: Token ve parametreler alındığında
  onInit: function(data) {
    console.log('Token:', data.token);
    console.log('Params:', data.params);
    console.log('App ID:', data.appId);
    console.log('Resource ID:', data.resourceId);
  },
  
  // Callback: Uygulama aktifleştirildiğinde (focus verildiğinde)
  onActivate: function() {
    // Oyunu başlat, input'a focus ver, vs.
  },
  
  // Callback: Uygulama deaktif edildiğinde
  onDeactivate: function() {
    // Oyunu duraklat, ses kapat, vs.
  },
  
  // Callback: Parametreler güncellendiğinde
  onParamsUpdate: function(newParams) {
    // Yeni parametreleri uygula
  },
  
  // Callback: Hata oluştuğunda
  onError: function(error) {
    console.error('SDK Error:', error.code, error.message);
  }
});
```

---

## 2. Lifecycle Events

WebApp'ın yaşam döngüsü:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SDK Yüklendi                                                │
│     └── 'ainoodle_sdk_loaded' mesajı gönderilir                 │
│                                                                 │
│  2. Parent 'ainoodle_init' gönderir                            │
│     └── onInit callback çağrılır                               │
│     └── Token, params, appId alınır                            │
│     └── 'ainoodle_app_ready' mesajı gönderilir                 │
│                                                                 │
│  3. Parent 'ainoodle_activate' gönderir                        │
│     └── Focus verilir                                          │
│     └── onActivate callback çağrılır                           │
│     └── Oyun/form başlar                                       │
│                                                                 │
│  4. Kullanıcı etkileşimi                                        │
│     └── sendEvent() ile olaylar gönderilebilir                 │
│                                                                 │
│  5. Tamamlandığında                                             │
│     └── complete(data) çağrılır                                │
│     └── Parent 'ainoodle_app_complete' alır                    │
│                                                                 │
│  6. İptal edildiğinde                                           │
│     └── cancel(reason) çağrılır                                │
│     └── Parent 'ainoodle_app_cancel' alır                      │
└─────────────────────────────────────────────────────────────────┘
```

### Durum Geçişleri

```
[IDLE] ──▶ [LOADING] ──▶ [READY] ──▶ [ACTIVE] ──▶ [COMPLETED]
                │                        │              │
                ▼                        ▼              ▼
            [ERROR]                 [PAUSED]      [CLOSED]
```

---

## 3. API Reference

### 3.1 Initialization

| Method | Description |
|--------|-------------|
| `aiNoodle.init(options)` | SDK'yı başlatır, callback'leri tanımlar |
| `aiNoodle.version` | SDK versiyonu (string) |

### 3.2 State Getters

| Method | Returns | Description |
|--------|---------|-------------|
| `aiNoodle.getToken()` | `string` | JWT token |
| `aiNoodle.getParams()` | `object` | Tüm parametreler |
| `aiNoodle.getParam(key, default)` | `any` | Tek parametre değeri |
| `aiNoodle.getAppId()` | `string` | Uygulama ID |
| `aiNoodle.getResourceId()` | `string` | Resource ID |
| `aiNoodle.isReady()` | `boolean` | Init tamamlandı mı |
| `aiNoodle.isActivated()` | `boolean` | Aktif mi |
| `aiNoodle.getState()` | `object` | Tüm state bilgisi |

### 3.3 Actions

| Method | Description |
|--------|-------------|
| `aiNoodle.complete(data)` | Başarıyla tamamlandı, sonuç gönder |
| `aiNoodle.cancel(reason)` | İptal edildi |
| `aiNoodle.sendEvent(name, data)` | Custom event gönder |
| `aiNoodle.requestClose()` | Kapatılma isteği gönder |

---

## 4. İletişim Protokolü

### 4.1 Parent → WebApp Mesajları

```javascript
// Init mesajı
{ type: 'ainoodle_init', token: '...', params: {...}, appId: '...', resourceId: '...' }

// Aktivasyon mesajı
{ type: 'ainoodle_activate' }

// Deaktivasyon mesajı
{ type: 'ainoodle_deactivate' }

// Parametre güncelleme
{ type: 'ainoodle_params_update', params: {...} }
```

### 4.2 WebApp → Parent Mesajları

```javascript
// SDK yüklendi
{ type: 'ainoodle_sdk_loaded', version: '1.0.0' }

// Hazır
{ type: 'ainoodle_app_ready', appId: '...' }

// Tamamlandı
{ type: 'ainoodle_app_complete', appId: '...', data: {...} }

// İptal
{ type: 'ainoodle_app_cancel', appId: '...', reason: '...' }

// Custom event
{ type: 'ainoodle_app_event', appId: '...', event: 'score_update', data: {...} }

// Kapatma isteği
{ type: 'ainoodle_app_close_request', appId: '...' }
```

---

## 5. Parametre Kullanımı

### 5.1 Parametreleri Alma

```javascript
aiNoodle.init({
  onInit: function(data) {
    // Tüm parametreler
    var params = data.params;
    
    // Veya sonradan
    var gameType = aiNoodle.getParam('game_type', 'random');
    var difficulty = aiNoodle.getParam('difficulty', 'normal');
    var autoplay = aiNoodle.getParam('autoplay', false);
  }
});
```

### 5.2 MCP Server'da Parametre Tanımı

MCP Admin Panel'de app oluştururken tanımlanan parametreler:

```json
{
  "parameters": [
    {
      "name": "game_type",
      "type": "string",
      "required": false,
      "default": "random",
      "description": "Oyun tipi (tetris, pacman, snake)"
    },
    {
      "name": "difficulty",
      "type": "string",
      "required": false,
      "default": "normal",
      "description": "Zorluk seviyesi (easy, normal, hard)"
    },
    {
      "name": "autoplay",
      "type": "boolean",
      "required": false,
      "default": false,
      "description": "Otomatik başlat"
    }
  ]
}
```

---

## 6. Token Yönetimi

### 6.1 Token Alma

```javascript
var token = aiNoodle.getToken();
```

### 6.2 API Çağrılarında Kullanım

```javascript
fetch('https://api.example.com/data', {
  headers: {
    'Authorization': 'Bearer ' + aiNoodle.getToken(),
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### 6.3 Token Bilgisi

Token JWT formatındadır ve şu bilgileri içerir:

```json
{
  "userId": "user-123",
  "appId": "app-uuid",
  "resourceId": "resource-123",
  "customerId": "customer-uuid",
  "projectId": "project-uuid",
  "iat": 1732891234,
  "exp": 1732893034
}
```

**Token Geçerlilik Süresi:** 30 dakika

---

## 7. Oyun/Uygulama Örneği

### Tam Arcade Oyunu Örneği

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tetris Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      background: #1a1a2e;
    }
    canvas { 
      border: 2px solid #4a4a6a;
      border-radius: 8px;
    }
    #score {
      position: absolute;
      top: 20px;
      right: 20px;
      color: white;
      font-family: monospace;
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div id="score">Score: 0</div>
  <canvas id="game" width="300" height="600"></canvas>
  
  <!-- aiNoodle SDK -->
  <script src="https://aimcp.replit.app/sdk/ainoodle-webapp.js"></script>
  
  <script>
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var score = 0;
    var gameRunning = false;
    var difficulty = 'normal';
    
    // SDK Başlatma
    aiNoodle.init({
      focusTarget: 'canvas',
      debug: true,
      
      onInit: function(data) {
        console.log('Game initialized with params:', data.params);
        difficulty = data.params.difficulty || 'normal';
        setGameSpeed(difficulty);
      },
      
      onActivate: function() {
        console.log('Game activated - starting');
        startGame();
      },
      
      onDeactivate: function() {
        console.log('Game deactivated - pausing');
        pauseGame();
      },
      
      onError: function(error) {
        console.error('SDK Error:', error);
      }
    });
    
    function setGameSpeed(diff) {
      switch(diff) {
        case 'easy': window.gameSpeed = 800; break;
        case 'hard': window.gameSpeed = 200; break;
        default: window.gameSpeed = 500;
      }
    }
    
    function startGame() {
      gameRunning = true;
      score = 0;
      gameLoop();
    }
    
    function pauseGame() {
      gameRunning = false;
    }
    
    function gameLoop() {
      if (!gameRunning) return;
      // ... oyun mantığı ...
      aiNoodle.sendEvent('score_update', { score: score });
      requestAnimationFrame(gameLoop);
    }
    
    function gameOver() {
      gameRunning = false;
      aiNoodle.complete({
        score: score,
        level: getCurrentLevel(),
        duration: getGameDuration()
      });
    }
    
    // Klavye kontrolleri
    document.addEventListener('keydown', function(e) {
      if (!aiNoodle.isActivated()) return;
      
      switch(e.key) {
        case 'ArrowLeft': moveLeft(); break;
        case 'ArrowRight': moveRight(); break;
        case 'ArrowDown': moveDown(); break;
        case 'ArrowUp': rotate(); break;
        case 'Escape': 
          aiNoodle.cancel('user_escaped');
          break;
      }
    });
  </script>
</body>
</html>
```

---

## 8. Form/Quiz Örneği

### Quiz WebApp Örneği

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Quiz App</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .question { margin-bottom: 20px; font-size: 18px; }
    .options { display: flex; flex-direction: column; gap: 10px; }
    .option { 
      padding: 15px; 
      border: 2px solid #ddd; 
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .option:hover { border-color: #4a90d9; }
    .option.selected { border-color: #4a90d9; background: #e8f4fd; }
    button { 
      margin-top: 20px;
      padding: 15px 30px; 
      background: #4a90d9; 
      color: white; 
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover { background: #357abd; }
  </style>
</head>
<body>
  <div id="quiz-container">
    <div id="question-text" class="question"></div>
    <div id="options" class="options"></div>
    <button id="submit-btn" style="display:none;">Cevabı Gönder</button>
  </div>
  
  <!-- aiNoodle SDK -->
  <script src="https://aimcp.replit.app/sdk/ainoodle-webapp.js"></script>
  
  <script>
    var quizId = null;
    var currentQuestion = 0;
    var answers = [];
    var questions = [];
    
    aiNoodle.init({
      debug: true,
      
      onInit: function(data) {
        quizId = data.params.quiz_id;
        fetchQuestions(quizId, data.token);
      },
      
      onActivate: function() {
        document.getElementById('options').focus();
      },
      
      onError: function(error) {
        alert('Bir hata oluştu: ' + error.message);
      }
    });
    
    function fetchQuestions(quizId, token) {
      fetch('https://api.example.com/quizzes/' + quizId + '/questions', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        questions = data.questions;
        showQuestion(0);
      });
    }
    
    function showQuestion(index) {
      var q = questions[index];
      document.getElementById('question-text').textContent = 
        (index + 1) + '. ' + q.text;
      
      var optionsHtml = q.options.map(function(opt, i) {
        return '<div class="option" data-index="' + i + '">' + opt + '</div>';
      }).join('');
      
      document.getElementById('options').innerHTML = optionsHtml;
      document.getElementById('submit-btn').style.display = 'block';
      
      document.querySelectorAll('.option').forEach(function(el) {
        el.addEventListener('click', function() {
          document.querySelectorAll('.option').forEach(function(o) {
            o.classList.remove('selected');
          });
          el.classList.add('selected');
        });
      });
    }
    
    document.getElementById('submit-btn').addEventListener('click', function() {
      var selected = document.querySelector('.option.selected');
      if (!selected) {
        alert('Lütfen bir seçenek seçin');
        return;
      }
      
      answers.push({
        question: currentQuestion,
        answer: parseInt(selected.dataset.index)
      });
      
      aiNoodle.sendEvent('question_answered', {
        question: currentQuestion,
        total: questions.length
      });
      
      currentQuestion++;
      
      if (currentQuestion < questions.length) {
        showQuestion(currentQuestion);
      } else {
        submitQuiz();
      }
    });
    
    function submitQuiz() {
      aiNoodle.complete({
        quiz_id: quizId,
        answers: answers,
        completed_at: new Date().toISOString()
      });
    }
  </script>
</body>
</html>
```

---

## 9. Best Practices

### 9.1 Performans

```javascript
// ✅ DOĞRU: Parametreleri bir kez al, değişkende tut
var params = null;
aiNoodle.init({
  onInit: function(data) {
    params = data.params;
  }
});

// ❌ YANLIŞ: Her seferinde SDK'dan çekme
function render() {
  var gameType = aiNoodle.getParam('game_type'); // Her frame'de çağrılmamalı
}
```

### 9.2 Focus Yönetimi

```javascript
// ✅ DOĞRU: focusTarget kullan
aiNoodle.init({
  focusTarget: '#game-canvas'
});

// ❌ YANLIŞ: Manuel focus yönetimi (SDK zaten yapıyor)
```

### 9.3 Sonuç Gönderme

```javascript
// ✅ DOĞRU: Yapılandırılmış veri gönder
aiNoodle.complete({
  success: true,
  score: 1500,
  level: 5,
  duration_seconds: 180,
  achievements: ['first_win', 'high_score']
});

// ❌ YANLIŞ: String veya primitif gönderme
aiNoodle.complete('Game completed with score 1500');
```

### 9.4 Event Gönderimi

```javascript
// ✅ DOĞRU: Anlamlı event isimleri ve yapılandırılmış data
aiNoodle.sendEvent('level_complete', {
  level: 3,
  score: 500,
  time_seconds: 45
});

// ❌ YANLIŞ: Generic isimler
aiNoodle.sendEvent('update', { data: 'something' });
```

---

## 10. Hata Yönetimi

### 10.1 SDK Hata Kodları

| Code | Description | Solution |
|------|-------------|----------|
| `INIT_CALLBACK_ERROR` | onInit callback hatası | Callback içindeki kodu kontrol et |
| `ACTIVATE_CALLBACK_ERROR` | onActivate callback hatası | Callback içindeki kodu kontrol et |
| `DEACTIVATE_CALLBACK_ERROR` | onDeactivate callback hatası | Callback içindeki kodu kontrol et |
| `PARAMS_UPDATE_CALLBACK_ERROR` | onParamsUpdate callback hatası | Callback içindeki kodu kontrol et |

### 10.2 Graceful Degradation

SDK yüklenemezse standalone modda çalışma:

```javascript
// SDK yüklenemezse fallback
if (typeof aiNoodle === 'undefined') {
  console.warn('aiNoodle SDK not loaded, running in standalone mode');
  
  window.aiNoodle = {
    init: function() {},
    getParams: function() { return {}; },
    getParam: function(key, def) { return def; },
    complete: function() { console.log('App completed'); },
    cancel: function() { console.log('App cancelled'); },
    sendEvent: function() {},
    isReady: function() { return true; },
    isActivated: function() { return true; }
  };
}

// Normal SDK kullanımı
aiNoodle.init({
  onActivate: function() {
    startGame();
  }
});
```

---

## 11. Debug Modu

### 11.1 Debug Aktifleştirme

```javascript
aiNoodle.init({
  debug: true,
  onInit: function(data) {
    console.log('Full state:', aiNoodle.getState());
  }
});
```

### 11.2 Debug Çıktısı Örneği

```
✅ aiNoodle WebApp SDK v1.0.0 loaded
[aiNoodle SDK] SDK initialized with config: ['debug', 'focusTarget', 'onInit', 'onActivate']
[aiNoodle SDK] Received message: ainoodle_init
[aiNoodle SDK] Initialized with params: {game_type: 'tetris', difficulty: 'hard'}
[aiNoodle SDK] Received message: ainoodle_activate
[aiNoodle SDK] Activated, focus target: canvas
[aiNoodle SDK] Sending event: score_update
[aiNoodle SDK] Completing with data: {score: 1500, level: 5}
```

---

## 12. Checklist

WebApp'ınızı yayınlamadan önce kontrol edin:

### Temel Gereksinimler

- [ ] SDK script eklendi: `<script src="https://aimcp.replit.app/sdk/ainoodle-webapp.js"></script>`
- [ ] `aiNoodle.init()` çağrıldı
- [ ] `onInit` callback tanımlandı
- [ ] `onActivate` callback tanımlandı
- [ ] `focusTarget` doğru element'i gösteriyor

### Kullanıcı Deneyimi

- [ ] Oyun/form `onActivate` ile başlıyor
- [ ] `onDeactivate` ile duraklatılıyor (varsa)
- [ ] ESC tuşu `cancel()` çağırıyor
- [ ] Tamamlandığında `complete(data)` çağrılıyor

### Veri İletimi

- [ ] `complete()` yapılandırılmış object gönderiyor
- [ ] Önemli olaylar `sendEvent()` ile bildiriliyor
- [ ] Token API çağrılarında kullanılıyor (gerekiyorsa)

### Hata Yönetimi

- [ ] `onError` callback tanımlandı
- [ ] SDK yüklenemezse fallback var
- [ ] Network hataları handle ediliyor

### Test

- [ ] Standalone modda çalışıyor
- [ ] iframe içinde çalışıyor
- [ ] Farklı parametrelerle test edildi
- [ ] Mobile responsive

---

## 13. Gelişmiş: Dual Protocol

Bir WebApp hem aiNoodle SDK hem de standart iframe postMessage protokolünü destekleyebilir:

### 13.1 Protokol Algılama

```javascript
function detectProtocol() {
  // iframe içinde miyiz?
  if (window.self !== window.top) {
    return 'iframe';
  }
  // aiNoodle SDK yüklü mü?
  if (typeof aiNoodle !== 'undefined') {
    return 'ainoodle';
  }
  return 'standalone';
}

var protocol = detectProtocol();
console.log('Running in protocol:', protocol);
```

### 13.2 Dual Protocol Wrapper

```javascript
var AppConnector = {
  protocol: null,
  
  init: function(options) {
    this.protocol = detectProtocol();
    
    if (this.protocol === 'ainoodle') {
      aiNoodle.init(options);
    } else if (this.protocol === 'iframe') {
      this.setupPostMessage(options);
    } else {
      // Standalone - parametreleri URL'den al
      options.onInit && options.onInit({
        params: this.getUrlParams(),
        token: null
      });
      options.onActivate && options.onActivate();
    }
  },
  
  complete: function(data) {
    if (this.protocol === 'ainoodle') {
      aiNoodle.complete(data);
    } else if (this.protocol === 'iframe') {
      window.parent.postMessage({
        type: 'webapp_complete',
        data: data
      }, '*');
    }
  },
  
  getUrlParams: function() {
    var params = {};
    var search = window.location.search.substring(1);
    search.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      params[parts[0]] = decodeURIComponent(parts[1] || '');
    });
    return params;
  },
  
  setupPostMessage: function(options) {
    window.addEventListener('message', function(event) {
      if (event.data.type === 'init') {
        options.onInit && options.onInit(event.data);
      }
      if (event.data.type === 'activate') {
        options.onActivate && options.onActivate();
      }
    });
    
    // Hazır olduğunu bildir
    window.parent.postMessage({ type: 'webapp_ready' }, '*');
  }
};

// Kullanım
AppConnector.init({
  onInit: function(data) {
    console.log('Params:', data.params);
  },
  onActivate: function() {
    startGame();
  }
});
```

---

## Versiyon Geçmişi

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| 2.1.0 | 2025-11-30 | SDK entegrasyonu eklendi, döküman yeniden yazıldı |
| 2.0.0 | 2025-11-25 | Hybrid protocol desteği (ainoodle + standard) |
| 1.0.0 | 2025-01 | İlk sürüm - Layer yaklaşımı |

---

## İlgili Kaynaklar

- **SDK URL:** `https://aimcp.replit.app/sdk/ainoodle-webapp.js`
- **MCP Server API:** `https://aimcp.replit.app/api/apps/list`
- **API Documentation:** `API_DOCUMENTATION.md`

---

*Bu döküman bir YZ tarafından okunarak MCP Server uyumlu WebApp geliştirmek için yeterli bilgiyi içermektedir.*
