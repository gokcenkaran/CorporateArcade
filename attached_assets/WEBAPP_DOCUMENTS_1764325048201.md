# aiNoodle WebApp Integration Reference

> **Bu döküman AI asistanları (Claude Code, Replit AI, Cursor, vb.) için hazırlanmıştır.**
> Webapp'ların @ainoodle/mcp-sdk ile entegrasyonu için gerekli tüm bilgileri içerir.

---

## HIZLI BAŞVURU

### Bu Dökümanı Ne Zaman Kullan?

| Senaryo | Git → |
|---------|-------|
| Başka bir webapp'ı çağıran app geliştiriyorum | [CALLER ENTEGRASYONU](#caller-entegrasyonu) |
| Çağrılacak bir webapp geliştiriyorum | [CALLEE ENTEGRASYONU](#callee-entegrasyonu) |
| Video player webapp yapıyorum | [VIDEO APP ÖRNEĞİ](#video-app-tam-örnek) |
| Quiz webapp yapıyorum | [QUIZ APP ÖRNEĞİ](#quiz-app-tam-örnek) |
| Slide builder webapp yapıyorum | [SLIDER APP ÖRNEĞİ](#slider-app-tam-örnek) |
| App açılmadan bilgi sorgulamak istiyorum | [PRE-LAUNCH QUERY](#pre-launch-query) |
| Backend query endpoint yazıyorum | [QUERY BACKEND](#query-backend-implementasyonu) |

---

## SDK KURULUMU

```bash
npm install @ainoodle/mcp-sdk
```

```typescript
// ES Modules
import { MCPCaller, MCPCallee } from '@ainoodle/mcp-sdk';

// CommonJS
const { MCPCaller, MCPCallee } = require('@ainoodle/mcp-sdk');
```

---

## CALLER ENTEGRASYONU

> Caller: Başka bir webapp'ı çağıran uygulamadır.

### Temel Kullanım (Token Provider - Önerilen)

```typescript
import { MCPCaller } from '@ainoodle/mcp-sdk';

// 1. SDK'yı başlat (uygulama başlangıcında bir kere)
const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: {
    type: 'token-provider',
    tokenProvider: async () => {
      // Mevcut JWT token'ı al (localStorage, cookie, state, vb.)
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        throw new Error('User not authenticated');
      }
      
      // Token expire olmuşsa refresh et
      if (isTokenExpired(token)) {
        const newToken = await refreshToken();
        localStorage.setItem('jwt_token', newToken);
        return newToken;
      }
      
      return token;
    }
  },
  customerId: 'customer-123',
  projectId: 'project-456',
  userId: 'user-789',
  debug: true  // Production'da false yap
});

// Token expire kontrolü helper
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Token refresh helper
async function refreshToken(): Promise<string> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'  // Cookie'leri gönder
  });
  const { token } = await response.json();
  return token;
}

// 2. App çağır ve sonucu bekle
async function openSlideBuilder() {
  const result = await mcp.call('slider1', {
    resourceId: 'new',  // Yeni kayıt için 'new'
    params: {
      theme: 'dark',
      defaultTemplate: 'corporate'
    }
  });
  
  if (result.success) {
    console.log('Başarılı:', result.data);
    // result.data içinde app'ın döndürdüğü veri var
  } else {
    console.error('Hata:', result.error);
    console.log('Kapanma nedeni:', result.closeReason);
    // closeReason: 'completed' | 'cancelled' | 'error' | 'timeout'
  }
}

// 3. Cleanup (sayfa kapanırken)
window.addEventListener('beforeunload', () => {
  mcp.destroy();
});
```

### API Key ile Kullanım (3rd Party Entegrasyonlar İçin)

```typescript
// Müşterinin kendi backend'i veya LMS'i gibi harici sistemler için
const mcp = new MCPCaller({
  serverUrl: 'https://mcp.ainoodle.com',
  auth: {
    type: 'api-key',
    apiKey: 'sk_live_abc123xyz...'  // aiNoodle dashboard'dan alınmış
  },
  customerId: 'customer-123',
  projectId: 'project-456'
});
```

### React ile Token Provider Örneği

```tsx
// hooks/useMCP.ts
import { useEffect, useRef } from 'react';
import { MCPCaller } from '@ainoodle/mcp-sdk';
import { useAuth } from './useAuth';  // Kendi auth hook'un

export function useMCP() {
  const mcpRef = useRef<MCPCaller | null>(null);
  const { getToken, customerId, projectId, userId } = useAuth();
  
  useEffect(() => {
    mcpRef.current = new MCPCaller({
      serverUrl: import.meta.env.VITE_MCP_SERVER_URL,
      auth: {
        type: 'token-provider',
        tokenProvider: getToken  // Auth hook'tan gelen token fonksiyonu
      },
      customerId,
      projectId,
      userId,
      debug: import.meta.env.DEV
    });
    
    return () => {
      mcpRef.current?.destroy();
    };
  }, [customerId, projectId]);
  
  return mcpRef.current;
}
```

### Vue ile Token Provider Örneği

```typescript
// composables/useMCP.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { MCPCaller } from '@ainoodle/mcp-sdk';
import { useAuthStore } from '@/stores/auth';

export function useMCP() {
  const mcp = ref<MCPCaller | null>(null);
  const authStore = useAuthStore();
  
  onMounted(() => {
    mcp.value = new MCPCaller({
      serverUrl: import.meta.env.VITE_MCP_SERVER_URL,
      auth: {
        type: 'token-provider',
        tokenProvider: async () => {
          // Pinia store'dan token al
          return authStore.accessToken;
        }
      },
      customerId: authStore.customerId,
      projectId: authStore.projectId,
      userId: authStore.userId,
      debug: import.meta.env.DEV
    });
  });
  
  onUnmounted(() => {
    mcp.value?.destroy();
  });
  
  return mcp;
}
```

### Backend'den Token Alma Örneği (Server-side)

```typescript
// Backend'de: /api/auth/mcp-token endpoint'i
// Mevcut session'dan MCP için kullanılacak token üretir

app.get('/api/auth/mcp-token', authMiddleware, async (req, res) => {
  // Mevcut user session'ından bilgileri al
  const { userId, customerId, projectId } = req.user;
  
  // MCP için kısa ömürlü token oluştur
  const token = jwt.sign(
    {
      user_id: userId,
      customer_id: customerId,
      project_id: projectId,
      type: 'mcp_session'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  res.json({ token });
});
```

### Event Dinleme

```typescript
// App ready olduğunda
mcp.on('app:ready', ({ appId }) => {
  console.log(`${appId} hazır`);
});

// Progress güncellemelerinde
mcp.on('app:progress', ({ appId, type, data }) => {
  console.log(`${appId} progress:`, type, data);
  // type: 'video_progress', 'quiz_progress', etc.
  // data: { position: 120, duration: 600, percent: 20 }
});

// App tamamlandığında
mcp.on('app:complete', ({ appId, data }) => {
  console.log(`${appId} tamamlandı:`, data);
});

// Hata oluştuğunda
mcp.on('app:error', ({ appId, error }) => {
  console.error(`${appId} hata:`, error.code, error.message);
});

// App kapandığında
mcp.on('app:close', ({ appId, reason }) => {
  console.log(`${appId} kapandı:`, reason);
});
```

### Mevcut Resource'u Açma

```typescript
// Video izlemeye devam
const result = await mcp.call('video1', {
  resourceId: 'vid-existing-123',  // Mevcut video ID
  params: {
    autoplay: true,
    startPosition: 120  // 2. dakikadan başla
  }
});

// Quiz'e devam
const result = await mcp.call('quiz1', {
  resourceId: 'quiz-existing-456',
  params: {
    resumeAttempt: true
  }
});
```

### Kontrol Komutları

```typescript
// Aktif app'a komut gönder
mcp.sendControl('pause');
mcp.sendControl('play');
mcp.sendControl('seek', { position: 300 });
mcp.sendControl('setVolume', { volume: 0.5 });
mcp.sendControl('setTheme', { mode: 'dark' });

// Aktif app'ı kapat
mcp.closeActiveApp();

// Aktif app var mı kontrol
if (mcp.isAppActive()) {
  console.log('Aktif app:', mcp.getActiveAppId());
}
```

---

## PRE-LAUNCH QUERY

> App açılmadan bilgi sorgulama

### Tek Resource Sorgulama

```typescript
// Video bilgisi sorgula (video açılmadan)
const info = await mcp.query('video1', {
  resourceId: 'vid-123',
  queryType: 'status'  // 'status' | 'metadata' | 'full'
});

console.log(info);
// {
//   resourceId: 'vid-123',
//   status: 'in_progress',  // 'not_started' | 'in_progress' | 'completed' | 'failed'
//   progress: {
//     current: 245,    // saniye
//     total: 1800,     // saniye
//     percent: 13.6
//   },
//   lastActivity: '2024-01-15T10:30:00Z'
// }

// Metadata dahil sorgula
const fullInfo = await mcp.query('video1', {
  resourceId: 'vid-123',
  queryType: 'full'
});

console.log(fullInfo.metadata);
// {
//   title: 'Introduction Video',
//   description: '...',
//   duration: 1800,
//   thumbnail: 'https://...'
// }
```

### Batch Sorgulama

```typescript
// Birden fazla video'nun durumunu tek seferde sorgula
const results = await mcp.queryBatch('video1', [
  'vid-1', 'vid-2', 'vid-3', 'vid-4', 'vid-5'
]);

results.results.forEach(item => {
  console.log(`${item.resourceId}: ${item.status} (${item.progress?.percent}%)`);
});

// Hatalı sorgular
if (results.errors) {
  results.errors.forEach(err => {
    console.error(`${err.resourceId}: ${err.error.message}`);
  });
}
```

### Query Kullanım Örnekleri

```typescript
// Eğitim dashboard'unda video listesi gösterme
async function loadVideoList(videoIds: string[]) {
  const results = await mcp.queryBatch('video1', videoIds);
  
  return results.results.map(item => ({
    id: item.resourceId,
    status: item.status,
    progress: item.progress?.percent || 0,
    canResume: item.status === 'in_progress'
  }));
}

// Quiz başlamadan önce kontrol
async function checkQuizStatus(quizId: string) {
  const info = await mcp.query('quiz1', {
    resourceId: quizId,
    queryType: 'full'
  });
  
  if (info.status === 'completed') {
    alert(`Bu quiz'i daha önce tamamladınız. Skorunuz: ${info.metadata?.score}`);
    return false;
  }
  
  if (info.status === 'in_progress') {
    const resume = confirm('Yarım kalan quiz\'e devam etmek ister misiniz?');
    return { resume };
  }
  
  return { start: true };
}
```

---

## CALLEE ENTEGRASYONU

> Callee: Çağrılan webapp'tır. Layer veya iframe içinde açılır.

### Temel Kullanım

```typescript
import { MCPCallee } from '@ainoodle/mcp-sdk';

// 1. SDK'yı başlat (uygulama başlangıcında)
const mcp = new MCPCallee({
  appId: 'video1',  // Bu app'ın ID'si
  version: '1.0.0',
  capabilities: ['play', 'pause', 'seek', 'fullscreen'],
  debug: true
});

// 2. Init callback - çağrıldığında tetiklenir
mcp.onInit((context) => {
  console.log('App başlatıldı');
  console.log('Customer:', context.customerId);
  console.log('Project:', context.projectId);
  console.log('User:', context.userId);
  console.log('Resource:', context.resourceId);
  console.log('Params:', context.params);
  console.log('Theme:', context.theme);
  console.log('Language:', context.language);
  console.log('Protocol:', context.protocol);  // 'standard' | 'ainoodle'
  
  // Resource varsa yükle
  if (context.resourceId && context.resourceId !== 'new') {
    loadResource(context.resourceId);
  }
});

// 3. Control callback - komut geldiğinde tetiklenir
mcp.onControl((action, params) => {
  switch (action) {
    case 'play':
      videoPlayer.play();
      break;
    case 'pause':
      videoPlayer.pause();
      break;
    case 'seek':
      videoPlayer.seekTo(params.position);
      break;
    case 'setTheme':
      setAppTheme(params.mode);
      break;
  }
});

// 4. Close callback - kapatılmadan önce tetiklenir
mcp.onClose((reason) => {
  console.log('Kapanıyor:', reason);
  // Cleanup, state kaydetme vs.
});

// 5. Cleanup
window.addEventListener('beforeunload', () => {
  mcp.destroy();
});
```

### Progress Bildirme

```typescript
// Generic progress
mcp.sendProgress({
  current: 5,
  total: 20,
  message: 'Slide 5/20'
});

// Video progress (type-safe)
mcp.sendVideoProgress({
  position: 120,      // saniye
  duration: 600,      // saniye
  percent: 20,
  playing: true,
  playbackRate: 1.0
});

// Quiz progress (type-safe)
mcp.sendQuizProgress({
  currentQuestion: 5,
  totalQuestions: 20,
  answeredCount: 4,
  correctCount: 3
});

// Interview progress (type-safe)
mcp.sendInterviewProgress({
  currentQuestion: 3,
  totalQuestions: 10,
  answeredCount: 2,
  recordingActive: true,
  elapsedTime: 180
});

// Slider progress (type-safe)
mcp.sendSliderProgress({
  currentSlide: 3,
  totalSlides: 10,
  completedSlides: 2
});

// Generic context (custom tipli)
mcp.sendContext({
  type: 'upload_progress',
  data: {
    file: 'document.pdf',
    uploaded: 50,
    total: 100
  }
});
```

### İşlemi Tamamlama

```typescript
// Başarılı tamamlama
mcp.complete({
  success: true,
  slideId: 'slide-123',
  title: 'My Presentation',
  slideCount: 10
});

// Video tamamlama (type-safe)
mcp.completeVideo({
  lastPosition: 600,
  watchedPercent: 100,
  completed: true,
  totalWatchTime: 620
});

// Quiz tamamlama (type-safe)
mcp.completeQuiz({
  score: 85,
  correctAnswers: 17,
  totalQuestions: 20,
  passed: true,
  timeSpent: 1200
});

// Interview tamamlama (type-safe)
mcp.completeInterview({
  completed: true,
  answeredQuestions: 10,
  totalQuestions: 10,
  totalDuration: 1800
});

// Slider tamamlama (type-safe)
mcp.completeSlider({
  slideId: 'slide-123',
  title: 'My Presentation',
  slideCount: 10,
  theme: 'corporate'
});
```

### İşlemi İptal Etme

```typescript
// Basit iptal
mcp.cancel('user_cancelled');

// Data ile iptal (yarım kalan iş bilgisi)
mcp.cancelWithData('user_cancelled', {
  lastPosition: 120,
  watchedPercent: 20,
  partialSave: true
});
```

### Hata Bildirme

```typescript
mcp.error('SAVE_FAILED', 'Database connection error');
mcp.error('INVALID_DATA', 'Quiz answers are incomplete');
mcp.error('PERMISSION_DENIED', 'User cannot access this resource');
```

### Promise-based Init

```typescript
// Async/await ile init bekle
async function initApp() {
  try {
    const context = await mcp.waitForInit();
    console.log('Context alındı:', context);
    
    await loadResource(context.resourceId);
    await setupUI(context.theme, context.language);
    
  } catch (error) {
    console.error('Init timeout veya hata:', error);
  }
}

initApp();
```

---

## VIDEO APP TAM ÖRNEK

### Frontend (React)

```tsx
// video1/src/App.tsx

import { useEffect, useRef, useState } from 'react';
import { MCPCallee, CalleeContext, VideoProgressData } from '@ainoodle/mcp-sdk';

export default function VideoApp() {
  const mcpRef = useRef<MCPCallee | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [context, setContext] = useState<CalleeContext | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // MCP SDK başlat
    mcpRef.current = new MCPCallee({
      appId: 'video1',
      version: '1.0.0',
      capabilities: ['play', 'pause', 'seek', 'fullscreen'],
      debug: process.env.NODE_ENV === 'development'
    });

    // Init callback
    mcpRef.current.onInit(async (ctx) => {
      setContext(ctx);
      
      // Video URL'ini al (backend'den veya params'dan)
      const url = ctx.params.videoUrl || await fetchVideoUrl(ctx.resourceId);
      setVideoUrl(url);
      
      // Başlangıç pozisyonu varsa ayarla
      if (ctx.params.startPosition && videoRef.current) {
        videoRef.current.currentTime = ctx.params.startPosition;
      }
      
      // Autoplay
      if (ctx.params.autoplay && videoRef.current) {
        videoRef.current.play();
      }
      
      setIsReady(true);
    });

    // Control callback
    mcpRef.current.onControl((action, params) => {
      const video = videoRef.current;
      if (!video) return;

      switch (action) {
        case 'play':
          video.play();
          break;
        case 'pause':
          video.pause();
          break;
        case 'seek':
          video.currentTime = params.position;
          break;
        case 'setVolume':
          video.volume = params.volume;
          break;
        case 'setPlaybackRate':
          video.playbackRate = params.rate;
          break;
      }
    });

    // Close callback
    mcpRef.current.onClose((reason) => {
      // Son pozisyonu kaydet
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime);
      }
    });

    return () => {
      mcpRef.current?.destroy();
    };
  }, []);

  // Video progress bildirme
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !mcpRef.current) return;

    mcpRef.current.sendVideoProgress({
      position: Math.floor(video.currentTime),
      duration: Math.floor(video.duration),
      percent: (video.currentTime / video.duration) * 100,
      playing: !video.paused,
      playbackRate: video.playbackRate
    });
  };

  // Video tamamlandığında
  const handleEnded = () => {
    if (!mcpRef.current || !videoRef.current) return;

    mcpRef.current.completeVideo({
      lastPosition: videoRef.current.duration,
      watchedPercent: 100,
      completed: true,
      totalWatchTime: videoRef.current.duration
    });
  };

  // Kullanıcı kapatma butonu tıkladığında
  const handleClose = () => {
    const video = videoRef.current;
    if (!mcpRef.current) return;

    if (video) {
      mcpRef.current.cancelWithData('user_closed', {
        lastPosition: Math.floor(video.currentTime),
        watchedPercent: (video.currentTime / video.duration) * 100,
        completed: false
      });
    } else {
      mcpRef.current.cancel('user_closed');
    }
  };

  if (!isReady) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className={`video-app ${context?.theme}`}>
      <div className="video-header">
        <h1>{context?.params.title || 'Video'}</h1>
        <button onClick={handleClose}>Kapat</button>
      </div>
      
      <video
        ref={videoRef}
        src={videoUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        controls
      />
    </div>
  );
}

async function fetchVideoUrl(resourceId: string): Promise<string> {
  const response = await fetch(`/api/videos/${resourceId}`);
  const data = await response.json();
  return data.url;
}

async function saveProgress(position: number): Promise<void> {
  await fetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ position })
  });
}
```

### Backend Query Endpoint

```typescript
// video1/api/mcp/query.ts

import { validateMCPToken } from '../middleware/auth';

interface QueryRequest {
  resource_id: string;
  query_type: 'status' | 'metadata' | 'full';
  customer_id: string;
  project_id: string;
  user_id: string;
}

app.post('/api/mcp/query', validateMCPToken, async (req, res) => {
  const { resource_id, query_type, customer_id, project_id, user_id } = req.body as QueryRequest;
  
  try {
    // Video bilgisini al
    const video = await db.videos.findUnique({
      where: {
        id: resource_id,
        customer_id,
        project_id
      }
    });
    
    if (!video) {
      return res.json({
        resourceId: resource_id,
        status: 'failed',
        error: { code: 'NOT_FOUND', message: 'Video not found' }
      });
    }
    
    // Kullanıcı progress'ini al
    const progress = await db.video_progress.findFirst({
      where: {
        video_id: resource_id,
        user_id
      }
    });
    
    // Status belirle
    let status: string;
    if (!progress) {
      status = 'not_started';
    } else if (progress.completed) {
      status = 'completed';
    } else {
      status = 'in_progress';
    }
    
    // Response oluştur
    const response: any = {
      resourceId: resource_id,
      status,
      lastActivity: progress?.updated_at?.toISOString()
    };
    
    // Progress bilgisi
    if (progress) {
      response.progress = {
        current: progress.last_position,
        total: video.duration,
        percent: Math.round((progress.last_position / video.duration) * 100)
      };
    }
    
    // Metadata (istenirse)
    if (query_type === 'metadata' || query_type === 'full') {
      response.metadata = {
        title: video.title,
        description: video.description,
        duration: video.duration,
        thumbnail: video.thumbnail_url,
        chapters: video.chapters
      };
    }
    
    res.json(response);
    
  } catch (error: any) {
    res.status(500).json({
      resourceId: resource_id,
      status: 'failed',
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});
```

---

## QUIZ APP TAM ÖRNEK

### Frontend (Vue 3)

```vue
<!-- quiz1/src/App.vue -->

<template>
  <div :class="['quiz-app', context?.theme]">
    <LoadingScreen v-if="!isReady" />
    
    <template v-else>
      <QuizHeader 
        :title="quiz?.title"
        :current="currentQuestion"
        :total="quiz?.questions.length"
        @close="handleClose"
      />
      
      <QuizQuestion
        v-if="!showResults"
        :question="currentQuestionData"
        :questionNumber="currentQuestion"
        @answer="handleAnswer"
      />
      
      <QuizResults
        v-else
        :score="score"
        :correct="correctCount"
        :total="quiz?.questions.length"
        :passed="passed"
        @retry="handleRetry"
        @close="handleComplete"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MCPCallee, CalleeContext, QuizProgressData } from '@ainoodle/mcp-sdk';

const mcp = new MCPCallee({
  appId: 'quiz1',
  version: '1.0.0',
  capabilities: ['start', 'resume', 'retry'],
  debug: import.meta.env.DEV
});

const context = ref<CalleeContext | null>(null);
const quiz = ref<any>(null);
const isReady = ref(false);
const currentQuestion = ref(1);
const answers = ref<Record<string, any>>({});
const showResults = ref(false);

const currentQuestionData = computed(() => {
  return quiz.value?.questions[currentQuestion.value - 1];
});

const correctCount = computed(() => {
  return Object.values(answers.value).filter((a: any) => a.correct).length;
});

const score = computed(() => {
  if (!quiz.value) return 0;
  return Math.round((correctCount.value / quiz.value.questions.length) * 100);
});

const passed = computed(() => {
  return score.value >= (quiz.value?.passingScore || 70);
});

onMounted(() => {
  mcp.onInit(async (ctx) => {
    context.value = ctx;
    
    // Quiz'i yükle
    quiz.value = await fetchQuiz(ctx.resourceId);
    
    // Devam eden attempt varsa
    if (ctx.params.resumeAttempt) {
      const savedState = await loadSavedState(ctx.resourceId, ctx.userId);
      if (savedState) {
        answers.value = savedState.answers;
        currentQuestion.value = savedState.currentQuestion;
      }
    }
    
    isReady.value = true;
  });
  
  mcp.onControl((action, params) => {
    if (action === 'setTheme') {
      document.body.className = params.mode;
    }
  });
});

onUnmounted(() => {
  mcp.destroy();
});

function handleAnswer(questionId: string, answer: any, correct: boolean) {
  answers.value[questionId] = { answer, correct };
  
  // Progress bildir
  mcp.sendQuizProgress({
    currentQuestion: currentQuestion.value,
    totalQuestions: quiz.value.questions.length,
    answeredCount: Object.keys(answers.value).length,
    correctCount: correctCount.value
  });
  
  // Sonraki soru veya sonuçlar
  if (currentQuestion.value < quiz.value.questions.length) {
    currentQuestion.value++;
  } else {
    showResults.value = true;
  }
}

function handleComplete() {
  mcp.completeQuiz({
    score: score.value,
    correctAnswers: correctCount.value,
    totalQuestions: quiz.value.questions.length,
    passed: passed.value,
    timeSpent: calculateTimeSpent(),
    answers: Object.entries(answers.value).map(([qId, a]: [string, any]) => ({
      questionId: qId,
      answer: a.answer,
      correct: a.correct
    }))
  });
}

function handleClose() {
  // Yarım kaldıysa kaydet ve iptal et
  if (!showResults.value) {
    saveState();
    mcp.cancelWithData('user_cancelled', {
      currentQuestion: currentQuestion.value,
      answeredCount: Object.keys(answers.value).length,
      partialScore: score.value
    });
  } else {
    handleComplete();
  }
}

function handleRetry() {
  answers.value = {};
  currentQuestion.value = 1;
  showResults.value = false;
}

async function fetchQuiz(resourceId: string) {
  const response = await fetch(`/api/quizzes/${resourceId}`);
  return response.json();
}

async function loadSavedState(quizId: string, userId: string) {
  // Saved state'i backend'den al
  return null;
}

function saveState() {
  // State'i backend'e kaydet
}

function calculateTimeSpent() {
  return 0; // Implement time tracking
}
</script>
```

### Backend Query Endpoint

```typescript
// quiz1/api/mcp/query.ts

app.post('/api/mcp/query', validateMCPToken, async (req, res) => {
  const { resource_id, query_type, customer_id, project_id, user_id } = req.body;
  
  try {
    const quiz = await db.quizzes.findUnique({
      where: { id: resource_id, customer_id, project_id }
    });
    
    if (!quiz) {
      return res.json({
        resourceId: resource_id,
        status: 'failed',
        error: { code: 'NOT_FOUND', message: 'Quiz not found' }
      });
    }
    
    // En son tamamlanmış attempt
    const completedAttempt = await db.quiz_attempts.findFirst({
      where: { quiz_id: resource_id, user_id, completed: true },
      orderBy: { created_at: 'desc' }
    });
    
    // Devam eden attempt
    const inProgressAttempt = await db.quiz_attempts.findFirst({
      where: { quiz_id: resource_id, user_id, completed: false },
      orderBy: { created_at: 'desc' }
    });
    
    let status: string;
    let progressData: any = null;
    
    if (completedAttempt) {
      status = 'completed';
    } else if (inProgressAttempt) {
      status = 'in_progress';
      progressData = {
        current: inProgressAttempt.answered_count,
        total: quiz.question_count,
        percent: Math.round((inProgressAttempt.answered_count / quiz.question_count) * 100)
      };
    } else {
      status = 'not_started';
    }
    
    const response: any = {
      resourceId: resource_id,
      status,
      progress: progressData,
      lastActivity: (completedAttempt || inProgressAttempt)?.updated_at?.toISOString()
    };
    
    if (query_type === 'metadata' || query_type === 'full') {
      response.metadata = {
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.question_count,
        passingScore: quiz.passing_score,
        timeLimit: quiz.time_limit
      };
      
      // Tamamlandıysa skor bilgisi
      if (completedAttempt) {
        response.metadata.score = completedAttempt.score;
        response.metadata.passed = completedAttempt.score >= quiz.passing_score;
        response.metadata.bestScore = await getBestScore(resource_id, user_id);
        response.metadata.attemptCount = await getAttemptCount(resource_id, user_id);
      }
    }
    
    res.json(response);
    
  } catch (error: any) {
    res.status(500).json({
      resourceId: resource_id,
      status: 'failed',
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});
```

---

## SLIDER APP TAM ÖRNEK

### Frontend (React)

```tsx
// slider1/src/App.tsx

import { useEffect, useRef, useState } from 'react';
import { MCPCallee, CalleeContext } from '@ainoodle/mcp-sdk';
import { SlideEditor, SlidePreview, ThemeSelector } from './components';

export default function SliderApp() {
  const mcpRef = useRef<MCPCallee | null>(null);
  const [context, setContext] = useState<CalleeContext | null>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [theme, setTheme] = useState('corporate');
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    mcpRef.current = new MCPCallee({
      appId: 'slider1',
      version: '1.0.0',
      capabilities: ['create', 'edit', 'export', 'themes'],
      debug: process.env.NODE_ENV === 'development'
    });

    mcpRef.current.onInit(async (ctx) => {
      setContext(ctx);
      
      // Tema params'dan gelirse ayarla
      if (ctx.params.theme) {
        setTheme(ctx.params.theme);
      }
      
      // Mevcut slide varsa yükle
      if (ctx.resourceId && ctx.resourceId !== 'new') {
        const existingSlides = await loadSlides(ctx.resourceId);
        setSlides(existingSlides);
      } else {
        // Yeni sunum - default slide
        setSlides([createDefaultSlide()]);
      }
      
      setIsReady(true);
    });

    mcpRef.current.onControl((action, params) => {
      switch (action) {
        case 'setTheme':
          setTheme(params.theme);
          break;
        case 'export':
          handleExport(params.format);
          break;
        case 'save':
          handleSave();
          break;
      }
    });

    mcpRef.current.onClose((reason) => {
      // Otomatik kaydet
      if (slides.length > 0) {
        autoSave();
      }
    });

    return () => {
      mcpRef.current?.destroy();
    };
  }, []);

  // Slide değiştiğinde progress bildir
  useEffect(() => {
    if (mcpRef.current && isReady) {
      const completedSlides = slides.filter(s => s.content && s.content.length > 0).length;
      
      mcpRef.current.sendSliderProgress({
        currentSlide: currentSlide + 1,
        totalSlides: slides.length,
        completedSlides
      });
    }
  }, [currentSlide, slides, isReady]);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const result = await saveSlides(slides, theme, context);
      
      mcpRef.current?.completeSlider({
        slideId: result.id,
        title: slides[0]?.title || 'Untitled Presentation',
        slideCount: slides.length,
        theme
      });
      
    } catch (error) {
      mcpRef.current?.error('SAVE_FAILED', 'Failed to save presentation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    mcpRef.current?.cancelWithData('user_cancelled', {
      slideCount: slides.length,
      hasUnsavedChanges: true
    });
  };

  const handleExport = async (format: 'pptx' | 'pdf') => {
    // Export işlemi
  };

  if (!isReady) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className={`slider-app theme-${theme}`}>
      <div className="toolbar">
        <ThemeSelector value={theme} onChange={setTheme} />
        <button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button onClick={handleCancel}>İptal</button>
      </div>
      
      <div className="editor-container">
        <SlideEditor
          slides={slides}
          currentSlide={currentSlide}
          onSlidesChange={setSlides}
          onSlideChange={setCurrentSlide}
        />
        
        <SlidePreview
          slide={slides[currentSlide]}
          theme={theme}
        />
      </div>
    </div>
  );
}

function createDefaultSlide() {
  return {
    id: crypto.randomUUID(),
    type: 'title',
    title: '',
    content: []
  };
}

async function loadSlides(resourceId: string) {
  const response = await fetch(`/api/slides/${resourceId}`);
  return response.json();
}

async function saveSlides(slides: any[], theme: string, context: CalleeContext | null) {
  const response = await fetch('/api/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slides,
      theme,
      customerId: context?.customerId,
      projectId: context?.projectId
    })
  });
  return response.json();
}

async function autoSave() {
  // Auto-save logic
}
```

---

## QUERY BACKEND IMPLEMENTASYONU

### Standart Query Response Formatı

```typescript
// Tüm app'lar bu formatı dönmeli

interface QueryResponse {
  // Zorunlu alanlar
  resourceId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  
  // Opsiyonel alanlar
  progress?: {
    current: number;
    total: number;
    percent: number;
  };
  
  metadata?: Record<string, any>;  // App-specific
  
  lastActivity?: string;  // ISO date
  
  error?: {
    code: string;
    message: string;
  };
}
```

### MCP Token Validation Middleware

```typescript
// middleware/validateMCPToken.ts

import jwt from 'jsonwebtoken';

const MCP_PUBLIC_KEY = process.env.MCP_PUBLIC_KEY;

export function validateMCPToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, MCP_PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: 'mcp.ainoodle.com'
    }) as any;
    
    // Query token mı kontrol et
    if (decoded.type !== 'query' && decoded.type !== 'batch_query') {
      return res.status(403).json({
        error: { code: 'INVALID_TOKEN_TYPE', message: 'Not a query token' }
      });
    }
    
    // Context'i request'e ekle
    req.mcpContext = {
      customerId: decoded.customer_id,
      projectId: decoded.project_id,
      appId: decoded.app_id
    };
    
    next();
    
  } catch (error) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token validation failed' }
    });
  }
}
```

### Batch Query Endpoint (Opsiyonel)

```typescript
// api/mcp/query/batch.ts

app.post('/api/mcp/query/batch', validateMCPToken, async (req, res) => {
  const { resource_ids, query_type, customer_id, project_id, user_id } = req.body;
  
  try {
    // Paralel sorgula
    const results = await Promise.all(
      resource_ids.map(async (resourceId: string) => {
        try {
          // Tek resource sorgusu (query endpoint mantığı)
          return await querySingleResource(resourceId, query_type, customer_id, project_id, user_id);
        } catch (error: any) {
          return {
            resourceId,
            status: 'failed',
            error: { code: 'QUERY_ERROR', message: error.message }
          };
        }
      })
    );
    
    res.json({ results });
    
  } catch (error: any) {
    res.status(500).json({
      results: [],
      errors: [{ resourceId: '*', error: { code: 'BATCH_ERROR', message: error.message } }]
    });
  }
});
```

---

## HATA KODLARI

### Caller Tarafı

| Kod | Açıklama | Çözüm |
|-----|----------|-------|
| `APP_ALREADY_ACTIVE` | Zaten açık bir app var | `closeActiveApp()` çağır |
| `TRIGGER_FAILED` | MCP Server'a ulaşılamadı | Network/Server durumunu kontrol et |
| `TIMEOUT` | App belirlenen sürede cevap vermedi | Timeout süresini artır |
| `QUERY_FAILED` | Query isteği başarısız | Resource ID ve query_type kontrol et |

### Callee Tarafı

| Kod | Açıklama | Çözüm |
|-----|----------|-------|
| `INIT_TIMEOUT` | Init event gelmedi | Protocol detection süresini artır |
| `PROTOCOL_NOT_DETECTED` | Protokol belirlenemedi | URL'de ?protocol=ainoodle hint'i ekle |

### Query Response

| Kod | Açıklama |
|-----|----------|
| `NOT_FOUND` | Resource bulunamadı |
| `PERMISSION_DENIED` | Erişim izni yok |
| `INTERNAL_ERROR` | Sunucu hatası |
| `INVALID_QUERY_TYPE` | Geçersiz query tipi |

---

## BEST PRACTICES

### Caller İçin

1. **Tek bir MCPCaller instance kullan** - Uygulama başlangıcında oluştur, destroy() ile temizle
2. **Event listener'ları kullan** - Progress takibi için callback'ler yerine event'leri tercih et
3. **Timeout ayarla** - Uzun işlemler için timeout'u artır
4. **Error handling** - Her call() için try-catch veya result.success kontrolü

### Callee İçin

1. **Hızlı init** - onInit callback'inde async işlemleri minimize et
2. **Progress bildirimi** - Uzun işlemlerde düzenli sendProgress() çağır
3. **Clean exit** - Her zaman complete() veya cancel() ile kapat
4. **State koruma** - cancelWithData() ile yarım kalan işleri bildir

### Query İçin

1. **Cache kullan** - Sık sorgulanan veriler için Redis cache
2. **Batch tercih et** - Çok sayıda resource için queryBatch() kullan
3. **Light response** - status sorgusu için metadata dönme
4. **Index'le** - customer_id, project_id, user_id alanlarında index oluştur

---

## DEBUGGING

```typescript
// Debug mode aç
const mcp = new MCPCaller({
  // ...
  debug: true  // Console'a log yazar
});

// veya

const mcp = new MCPCallee({
  // ...
  debug: true
});
```

Debug mode'da console'a şunlar yazılır:
- Trigger request/response
- Protocol detection
- Event gönderme/alma
- Error detayları

---

## SONRAKI ADIMLAR

1. [SDK Kurulumu](#sdk-kurulumu)
2. Caller mı Callee mi karar ver
3. İlgili örneği incele
4. Backend query endpoint yaz
5. Test et
