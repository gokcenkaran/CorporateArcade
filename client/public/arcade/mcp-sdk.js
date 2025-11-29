/**
 * aiNoodle MCP SDK - Callee Implementation
 *
 * Bu SDK, webapp'ların MCPCaller tarafından çağrılmasını ve
 * layer modunda çalışmasını sağlar.
 *
 * İki protokol desteklenir:
 * 1. Standard Protocol - postMessage (iframe)
 * 2. aiNoodle Protocol - CustomEvent (native layer)
 */

class MCPCallee {
  constructor(config = {}) {
    this.appId = config.appId || 'corporate-arcade';
    this.version = config.version || '1.0.0';
    this.protocol = this._detectProtocol();

    this._initCallback = null;
    this._controlCallback = null;
    this._context = null;
    this._isReady = false;
    this._destroyed = false;

    this._setupListeners();
    this._announceReady();
  }

  /**
   * Protokol tespiti - iframe içinde miyiz, yoksa native layer mı?
   */
  _detectProtocol() {
    // Native layer'da çalışıyorsa aiNoodle protokolü
    if (window.__AINOODLE_LAYER__) {
      return 'ainoodle';
    }

    // iframe içinde çalışıyorsa standard protokol
    if (window.parent !== window) {
      return 'standard';
    }

    // Standalone çalışıyorsa - debug/test modu
    return 'standalone';
  }

  /**
   * Event listener'ları kur
   */
  _setupListeners() {
    if (this.protocol === 'standard') {
      // postMessage listener
      window.addEventListener('message', this._handleMessage.bind(this));
    } else if (this.protocol === 'ainoodle') {
      // CustomEvent listener
      window.addEventListener('mcp:init', this._handleAinoodleInit.bind(this));
      window.addEventListener('mcp:control', this._handleAinoodleControl.bind(this));
    }

    // Keyboard shortcut for close (ESC)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancel('user_cancelled');
      }
    });
  }

  /**
   * Hazır olduğumuzu duyur
   */
  _announceReady() {
    this._isReady = true;

    const readyMessage = {
      type: 'mcp:ready',
      appId: this.appId,
      version: this.version,
      capabilities: ['progress', 'complete', 'cancel']
    };

    if (this.protocol === 'standard') {
      window.parent.postMessage(readyMessage, '*');
    } else if (this.protocol === 'ainoodle') {
      window.dispatchEvent(new CustomEvent('mcp:callee-ready', {
        detail: readyMessage
      }));
    }

    console.log(`[MCPCallee] Ready - Protocol: ${this.protocol}, App: ${this.appId}`);
  }

  /**
   * postMessage handler (Standard Protocol)
   */
  _handleMessage(event) {
    // Güvenlik kontrolü - sadece güvenilir origin'lerden gelen mesajları kabul et
    // Production'da burada origin whitelist kontrolü yapılmalı

    const { data } = event;

    if (!data || !data.type) return;

    switch (data.type) {
      case 'mcp:init':
        this._handleInit(data.context || data);
        break;
      case 'mcp:control':
        this._handleControl(data.action, data.payload);
        break;
      case 'mcp:close':
        this.cancel('caller_closed');
        break;
    }
  }

  /**
   * CustomEvent handler for init (aiNoodle Protocol)
   */
  _handleAinoodleInit(event) {
    if (!event.isTrusted) {
      console.warn('[MCPCallee] Untrusted init event ignored');
      return;
    }
    this._handleInit(event.detail);
  }

  /**
   * CustomEvent handler for control (aiNoodle Protocol)
   */
  _handleAinoodleControl(event) {
    if (!event.isTrusted) {
      console.warn('[MCPCallee] Untrusted control event ignored');
      return;
    }
    this._handleControl(event.detail.action, event.detail.payload);
  }

  /**
   * Init işleyicisi
   */
  _handleInit(context) {
    this._context = {
      resourceId: context.resourceId,
      userId: context.userId,
      customerId: context.customerId,
      projectId: context.projectId,
      token: context.token,
      config: context.config || {},
      ...context
    };

    console.log('[MCPCallee] Initialized with context:', this._context);

    if (this._initCallback) {
      this._initCallback(this._context);
    }
  }

  /**
   * Control işleyicisi
   */
  _handleControl(action, payload) {
    console.log('[MCPCallee] Control received:', action, payload);

    if (this._controlCallback) {
      this._controlCallback(action, payload);
    }
  }

  /**
   * Mesaj gönder (protokole göre)
   */
  _send(type, data) {
    if (this._destroyed) return;

    const message = {
      type,
      appId: this.appId,
      timestamp: new Date().toISOString(),
      ...data
    };

    if (this.protocol === 'standard') {
      window.parent.postMessage(message, '*');
    } else if (this.protocol === 'ainoodle') {
      window.dispatchEvent(new CustomEvent(type, {
        detail: message
      }));
    }

    // Standalone modda console'a yaz (debug için)
    if (this.protocol === 'standalone') {
      console.log(`[MCPCallee] ${type}:`, message);
    }
  }

  // ==================== PUBLIC API ====================

  /**
   * Init event'ini dinle
   * @param {Function} callback - (context) => void
   */
  onInit(callback) {
    this._initCallback = callback;

    // Zaten init almışsak hemen çağır
    if (this._context) {
      callback(this._context);
    }
  }

  /**
   * Control komutlarını dinle
   * @param {Function} callback - (action, payload) => void
   */
  onControl(callback) {
    this._controlCallback = callback;
  }

  /**
   * Genel progress bildir
   * @param {Object} data - Progress verisi
   */
  sendProgress(data) {
    this._send('mcp:progress', { data });
  }

  /**
   * Video tipi progress (type-safe helper)
   * @param {Object} data - { position, duration, percent }
   */
  sendVideoProgress(data) {
    this._send('mcp:progress', {
      progressType: 'video',
      data: {
        position: data.position,
        duration: data.duration,
        percent: data.percent
      }
    });
  }

  /**
   * Quiz tipi progress (type-safe helper)
   * @param {Object} data - { currentQuestion, totalQuestions, correctAnswers }
   */
  sendQuizProgress(data) {
    this._send('mcp:progress', {
      progressType: 'quiz',
      data: {
        currentQuestion: data.currentQuestion,
        totalQuestions: data.totalQuestions,
        correctAnswers: data.correctAnswers
      }
    });
  }

  /**
   * Oyun tipi progress (type-safe helper)
   * @param {Object} data - { score, level, lives, timeElapsed }
   */
  sendGameProgress(data) {
    this._send('mcp:progress', {
      progressType: 'game',
      data: {
        score: data.score,
        level: data.level,
        lives: data.lives,
        timeElapsed: data.timeElapsed
      }
    });
  }

  /**
   * İşlemi başarıyla tamamla
   * @param {Object} data - Sonuç verisi
   */
  complete(data) {
    this._send('mcp:complete', {
      status: 'completed',
      data
    });

    // Layer'ı kapat (küçük gecikme ile UI'ın güncellenmesini bekle)
    setTimeout(() => {
      this._requestClose();
    }, 100);
  }

  /**
   * Video tamamlama (type-safe helper)
   * @param {Object} data - { lastPosition, watchedPercent, completed }
   */
  completeVideo(data) {
    this.complete({
      type: 'video',
      lastPosition: data.lastPosition,
      watchedPercent: data.watchedPercent,
      completed: data.completed
    });
  }

  /**
   * Quiz tamamlama (type-safe helper)
   * @param {Object} data - { score, passed, totalQuestions, correctAnswers }
   */
  completeQuiz(data) {
    this.complete({
      type: 'quiz',
      score: data.score,
      passed: data.passed,
      totalQuestions: data.totalQuestions,
      correctAnswers: data.correctAnswers
    });
  }

  /**
   * Oyun tamamlama (type-safe helper)
   * @param {Object} data - { finalScore, highScore, level, timeElapsed, won }
   */
  completeGame(data) {
    this.complete({
      type: 'game',
      finalScore: data.finalScore,
      highScore: data.highScore,
      level: data.level,
      timeElapsed: data.timeElapsed,
      won: data.won
    });
  }

  /**
   * İşlemi iptal et
   * @param {string} reason - İptal nedeni
   * @param {Object} data - Opsiyonel ek veri
   */
  cancel(reason = 'user_cancelled', data = null) {
    this._send('mcp:cancel', {
      status: 'cancelled',
      reason,
      data
    });

    this._requestClose();
  }

  /**
   * İptal et ama veri ile
   * @param {Object} data - Kaydedilecek veri (örn: son konum)
   */
  cancelWithData(data) {
    this._send('mcp:cancel', {
      status: 'cancelled',
      reason: 'user_cancelled_with_data',
      data
    });

    this._requestClose();
  }

  /**
   * Layer'ı kapatmak için istek gönder
   */
  _requestClose() {
    this._send('mcp:close-request', {});

    // Standalone modda kendimiz kapatabiliriz
    if (this.protocol === 'standalone') {
      console.log('[MCPCallee] Close requested (standalone mode - no action)');
    }
  }

  /**
   * Context'i al
   * @returns {Object} Mevcut context
   */
  getContext() {
    return this._context;
  }

  /**
   * Resource ID'yi al
   * @returns {string} Resource ID
   */
  getResourceId() {
    return this._context?.resourceId;
  }

  /**
   * Protokolü al
   * @returns {string} Aktif protokol
   */
  getProtocol() {
    return this.protocol;
  }

  /**
   * Cleanup
   */
  destroy() {
    this._destroyed = true;

    if (this.protocol === 'standard') {
      window.removeEventListener('message', this._handleMessage.bind(this));
    } else if (this.protocol === 'ainoodle') {
      window.removeEventListener('mcp:init', this._handleAinoodleInit.bind(this));
      window.removeEventListener('mcp:control', this._handleAinoodleControl.bind(this));
    }

    console.log('[MCPCallee] Destroyed');
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MCPCallee };
} else if (typeof window !== 'undefined') {
  window.MCPCallee = MCPCallee;
}
