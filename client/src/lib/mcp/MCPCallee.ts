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

    // Detect mode - layer mode if we have a parent window
    this.detectMode();
    this.setupMessageListener();
    this.parseUrlParams();
    
    // Signal ready to parent in layer mode
    if (this.mode === 'layer' || this.mode === 'iframe') {
      this.signalReady();
    }
  }

  private detectMode() {
    // Check if we're in an iframe or layer
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    
    if (modeParam === 'layer') {
      this.mode = 'layer';
    } else if (modeParam === 'iframe') {
      this.mode = 'iframe';
    } else if (window.parent !== window) {
      // We're in an iframe/layer
      this.mode = 'layer';
    } else {
      this.mode = 'standalone';
    }
    
    this.log('Mode detected:', this.mode);
  }

  private signalReady() {
    // Signal to parent that we're ready to receive init
    this.sendToParent('mcp:app_ready', {
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

    // In layer mode, wait for parent to send init
    // In standalone mode, auto-initialize with URL params
    if (this.mode === 'standalone') {
      setTimeout(() => {
        if (!this.initialized) {
          this.handleInit(context);
        }
      }, 100);
    } else {
      // In layer/iframe mode, wait longer for parent init, then fallback to URL params
      setTimeout(() => {
        if (!this.initialized) {
          this.log('No init from parent, using URL params');
          this.handleInit(context);
        }
      }, 2000);
    }
  }

  private handleMessage(message: { type: string; payload?: any }) {
    this.log('Received message:', message);

    switch (message.type) {
      case 'mcp:init':
        this.handleInit(message.payload);
        break;
      case 'mcp:control':
        if (this.controlCallback && message.payload) {
          this.controlCallback(message.payload.action, message.payload.params);
        }
        break;
      case 'mcp:close':
        if (this.closeCallback) {
          this.closeCallback(message.payload?.reason || 'unknown');
        }
        break;
    }
  }

  private handleInit(context: CalleeContext) {
    this.context = context;
    this.initialized = true;
    this.log('Initialized with context:', context);

    if (this.initCallback) {
      this.initCallback(context);
    }

    // Send ready message to parent
    this.sendToParent('mcp:ready', {
      appId: this.appId,
      version: this.version,
      capabilities: this.capabilities,
    });
  }

  private sendToParent(type: string, payload?: any) {
    // Always try to send to parent in layer/iframe mode
    if (this.mode === 'layer' || this.mode === 'iframe') {
      try {
        window.parent.postMessage({ type, payload }, '*');
        this.log('Sent to parent:', { type, payload });
      } catch (error) {
        this.log('Failed to send to parent:', error);
      }
    } else if (window.parent !== window) {
      try {
        window.parent.postMessage({ type, payload }, '*');
        this.log('Sent to parent:', { type, payload });
      } catch (error) {
        this.log('Failed to send to parent:', error);
      }
    }
  }

  getMode(): 'layer' | 'iframe' | 'standalone' {
    return this.mode;
  }

  requestClose() {
    this.sendToParent('mcp:request_close', {
      appId: this.appId,
    });
  }

  onInit(callback: InitCallback) {
    this.initCallback = callback;
    // If already initialized, call immediately
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

  sendProgress(data: { current: number; total: number; message?: string }) {
    this.sendToParent('mcp:progress', {
      type: 'game_progress',
      data,
    });
  }

  sendGameProgress(data: {
    score: number;
    lives: number;
    level?: number;
    status: 'playing' | 'paused' | 'gameover';
  }) {
    this.sendToParent('mcp:progress', {
      type: 'game_progress',
      data,
    });
  }

  complete(data: any) {
    this.sendToParent('mcp:complete', {
      success: true,
      ...data,
    });
  }

  completeGame(data: {
    finalScore: number;
    completed: boolean;
    playTime?: number;
  }) {
    this.sendToParent('mcp:complete', {
      success: true,
      type: 'game_complete',
      ...data,
    });
  }

  cancel(reason: string) {
    this.sendToParent('mcp:cancel', { reason });
  }

  cancelWithData(reason: string, data: any) {
    this.sendToParent('mcp:cancel', { reason, data });
  }

  error(code: string, message: string) {
    this.sendToParent('mcp:error', { code, message });
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
