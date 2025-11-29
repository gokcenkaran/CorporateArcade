/**
 * MCPCallee - MCP SDK Protocol Compatible Implementation
 * Based on aiNoodle MCP SDK v1.2.0 specification
 */

export interface CalleeContext {
  customerId?: string;
  projectId?: string;
  userId?: string;
  resourceId?: string;
  params: Record<string, any>;
  theme?: string;
  language?: string;
  protocol?: 'standard' | 'ainoodle';
  mode?: 'layer' | 'iframe' | 'standalone';
  token?: string;
  config?: Record<string, any>;
}

type InitCallback = (context: CalleeContext) => void;
type ControlCallback = (action: string, params: any) => void;
type CloseCallback = (reason: string) => void;

class MCPCallee {
  private appId: string;
  private version: string;
  private capabilities: string[];
  private debug: boolean;
  private initialized: boolean = false;
  private context: CalleeContext | null = null;
  private initCallback: InitCallback | null = null;
  private controlCallback: ControlCallback | null = null;
  private closeCallback: CloseCallback | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private mode: 'layer' | 'iframe' | 'standalone' = 'standalone';

  constructor(options: {
    appId: string;
    version: string;
    capabilities?: string[];
    debug?: boolean;
  }) {
    this.appId = options.appId;
    this.version = options.version;
    this.capabilities = options.capabilities || [];
    this.debug = options.debug || false;

    this.detectMode();
    this.setupMessageListener();
    this.parseUrlParams();
    
    // Signal ready to parent in layer/iframe mode
    if (this.mode === 'layer' || this.mode === 'iframe') {
      this.signalReady();
    }
  }

  private detectMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    
    if (modeParam === 'layer') {
      this.mode = 'layer';
    } else if (modeParam === 'iframe') {
      this.mode = 'iframe';
    } else if (window.parent !== window) {
      this.mode = 'layer';
    } else {
      this.mode = 'standalone';
    }
    
    this.log('Mode detected:', this.mode);
  }

  private signalReady() {
    // Signal to parent that app is ready to receive init
    this.sendToParent('mcp:ready', {
      appId: this.appId,
      version: this.version,
      capabilities: this.capabilities,
    });
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(`[MCPCallee:${this.appId}]`, ...args);
    }
  }

  private setupMessageListener() {
    this.messageHandler = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (typeof data === 'object' && data.type) {
          this.handleMessage(data);
        }
      } catch (error) {
        this.log('Error handling message:', error);
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  private parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const context: CalleeContext = {
      customerId: urlParams.get('customerId') || undefined,
      projectId: urlParams.get('projectId') || undefined,
      userId: urlParams.get('userId') || undefined,
      resourceId: urlParams.get('resourceId') || undefined,
      theme: urlParams.get('theme') || 'dark',
      language: urlParams.get('language') || 'tr',
      protocol: (urlParams.get('protocol') as 'standard' | 'ainoodle') || 'standard',
      mode: this.mode,
      params: {},
    };

    // Parse username from URL params
    const username = urlParams.get('username');
    if (username) {
      context.params.username = decodeURIComponent(username);
    }

    // Parse any other params
    urlParams.forEach((value, key) => {
      if (!['customerId', 'projectId', 'userId', 'resourceId', 'theme', 'language', 'protocol', 'username', 'mode'].includes(key)) {
        try {
          context.params[key] = JSON.parse(value);
        } catch {
          context.params[key] = value;
        }
      }
    });

    this.log('Parsed URL params:', context);

    // In standalone mode, auto-initialize with URL params
    if (this.mode === 'standalone') {
      setTimeout(() => {
        if (!this.initialized) {
          this.handleInit(context);
        }
      }, 100);
    } else {
      // In layer/iframe mode, wait for parent init, then fallback to URL params
      setTimeout(() => {
        if (!this.initialized) {
          this.log('No init from parent, using URL params');
          this.handleInit(context);
        }
      }, 2000);
    }
  }

  private handleMessage(message: { type: string; payload?: any; context?: any; data?: any }) {
    this.log('Received message:', message);

    switch (message.type) {
      case 'mcp:init':
        // Support both payload and context formats (SDK compatibility)
        const initData = message.context || message.payload || {};
        this.handleInit(this.normalizeContext(initData));
        break;
      case 'mcp:control':
        const controlData = message.payload || message.data || {};
        if (this.controlCallback) {
          this.controlCallback(controlData.action, controlData.params || controlData);
        }
        break;
      case 'mcp:close':
        const closeData = message.payload || message.data || {};
        if (this.closeCallback) {
          this.closeCallback(closeData.reason || 'unknown');
        }
        break;
    }
  }

  private normalizeContext(data: any): CalleeContext {
    return {
      customerId: data.customerId || data.customer_id,
      projectId: data.projectId || data.project_id,
      userId: data.userId || data.user_id,
      resourceId: data.resourceId || data.resource_id,
      token: data.token,
      theme: data.theme || data.config?.theme || 'dark',
      language: data.language || 'tr',
      protocol: data.protocol || 'standard',
      mode: this.mode,
      config: data.config,
      params: data.params || {},
    };
  }

  private handleInit(context: CalleeContext) {
    this.context = context;
    this.initialized = true;
    this.log('Initialized with context:', context);

    if (this.initCallback) {
      this.initCallback(context);
    }
  }

  private sendToParent(type: string, data?: any) {
    if (this.mode === 'layer' || this.mode === 'iframe' || window.parent !== window) {
      try {
        // Send in SDK-compatible format (data directly, not wrapped in payload)
        const message = { type, ...data };
        window.parent.postMessage(message, '*');
        this.log('Sent to parent:', message);
      } catch (error) {
        this.log('Failed to send to parent:', error);
      }
    }
  }

  getMode(): 'layer' | 'iframe' | 'standalone' {
    return this.mode;
  }

  requestClose() {
    this.sendToParent('mcp:close-request', {
      appId: this.appId,
    });
  }

  onInit(callback: InitCallback) {
    this.initCallback = callback;
    if (this.initialized && this.context) {
      callback(this.context);
    }
  }

  onControl(callback: ControlCallback) {
    this.controlCallback = callback;
  }

  onClose(callback: CloseCallback) {
    this.closeCallback = callback;
  }

  async waitForInit(timeout: number = 10000): Promise<CalleeContext> {
    if (this.initialized && this.context) {
      return this.context;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Init timeout'));
      }, timeout);

      this.onInit((context) => {
        clearTimeout(timer);
        resolve(context);
      });
    });
  }

  // Progress methods - SDK compatible format
  sendProgress(data: { current: number; total: number; message?: string }) {
    this.sendToParent('mcp:progress', {
      appId: this.appId,
      data: data,
    });
  }

  sendGameProgress(data: {
    score: number;
    lives: number;
    level?: number;
    fuel?: number;
    status: 'playing' | 'paused' | 'gameover';
  }) {
    this.sendToParent('mcp:progress', {
      appId: this.appId,
      type: 'game_progress',
      data: data,
    });
  }

  // Complete methods - SDK compatible format
  complete(data: any) {
    this.sendToParent('mcp:complete', {
      appId: this.appId,
      success: true,
      data: data,
    });
  }

  completeGame(data: {
    finalScore: number;
    completed: boolean;
    playTime?: number;
    highScore?: number;
    difficulty?: number;
    level?: number;
    won?: boolean;
    timeElapsed?: number;
    [key: string]: any;
  }) {
    this.sendToParent('mcp:complete', {
      appId: this.appId,
      success: true,
      type: 'game_complete',
      data: data,
    });
  }

  // Cancel method - SDK compatible format
  cancel(reason: string) {
    this.sendToParent('mcp:cancel', {
      appId: this.appId,
      reason: reason,
    });
  }

  cancelWithData(reason: string, data: any) {
    this.sendToParent('mcp:cancel', {
      appId: this.appId,
      reason: reason,
      data: data,
    });
  }

  // Error method - SDK compatible format
  error(code: string, message: string) {
    this.sendToParent('mcp:error', {
      appId: this.appId,
      error: { code, message },
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getContext(): CalleeContext | null {
    return this.context;
  }

  getProtocol(): string {
    return this.context?.protocol || 'standard';
  }

  destroy() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    this.log('Destroyed');
  }
}

export { MCPCallee };
