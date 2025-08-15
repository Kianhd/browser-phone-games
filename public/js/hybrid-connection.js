// Hybrid Connection Manager - Automatically chooses best connection method
// Priority: WebRTC P2P (1-5ms) > Local Network (5-15ms) > Internet (50-200ms)

class HybridConnectionManager {
  constructor() {
    this.webrtcManager = new WebRTCGameManager();
    this.socketConnection = null;
    this.activeConnection = null;
    this.connectionAttempts = [];
    this.fallbackTimeout = 5000; // 5 seconds to establish WebRTC before fallback
    
    this.onDataReceived = null;
    this.onConnectionChange = null;
  }
  
  // Initialize connection with automatic best-method selection
  async initializeConnection(isHost = false) {
    console.log('🚀 Starting Hybrid Connection Manager...');
    
    if (isHost) {
      return await this.setupHost();
    } else {
      return await this.setupController();
    }
  }
  
  async setupHost() {
    try {
      console.log('🖥️ Setting up host connections...');
      
      // Start WebRTC connection attempt
      const webrtcPromise = this.attemptWebRTCHost();
      
      // Start socket.io as fallback
      const socketPromise = this.attemptSocketHost();
      
      // Use whichever connects first, but prefer WebRTC
      const result = await Promise.race([
        webrtcPromise,
        this.delayedFallback(socketPromise, this.fallbackTimeout)
      ]);
      
      return result;
      
    } catch (error) {
      console.error('❌ Host setup failed:', error);
      throw error;
    }
  }
  
  async setupController(connectionCode) {
    try {
      console.log('📱 Setting up controller connections...');
      
      // Try WebRTC first if we have a connection code
      if (connectionCode) {
        const webrtcPromise = this.attemptWebRTCController(connectionCode);
        
        // Fallback to socket after timeout
        const socketPromise = this.attemptSocketController();
        
        const result = await Promise.race([
          webrtcPromise,
          this.delayedFallback(socketPromise, this.fallbackTimeout)
        ]);
        
        return result;
      } else {
        // No WebRTC code, use socket
        return await this.attemptSocketController();
      }
      
    } catch (error) {
      console.error('❌ Controller setup failed:', error);
      throw error;
    }
  }
  
  async attemptWebRTCHost() {
    try {
      console.log('🔗 Attempting WebRTC host connection...');
      
      const connectionCode = await this.webrtcManager.createHostConnection();
      
      // Set up data handler
      this.webrtcManager.onDataReceived = (data) => {
        if (this.activeConnection === 'webrtc' && this.onDataReceived) {
          this.onDataReceived(data);
        }
      };
      
      // Wait for connection to be established
      await this.waitForWebRTCConnection();
      
      this.activeConnection = 'webrtc';
      this.notifyConnectionChange('webrtc', 'connected');
      
      return {
        type: 'webrtc',
        connectionCode: connectionCode,
        latency: 'ultra-low'
      };
      
    } catch (error) {
      console.error('❌ WebRTC host failed:', error);
      throw error;
    }
  }
  
  async attemptWebRTCController(connectionCode) {
    try {
      console.log('🔗 Attempting WebRTC controller connection...');
      
      await this.webrtcManager.joinWithCode(connectionCode);
      
      // Set up data handler
      this.webrtcManager.onDataReceived = (data) => {
        if (this.activeConnection === 'webrtc' && this.onDataReceived) {
          this.onDataReceived(data);
        }
      };
      
      // Wait for connection
      await this.waitForWebRTCConnection();
      
      this.activeConnection = 'webrtc';
      this.notifyConnectionChange('webrtc', 'connected');
      
      return {
        type: 'webrtc',
        latency: 'ultra-low'
      };
      
    } catch (error) {
      console.error('❌ WebRTC controller failed:', error);
      throw error;
    }
  }
  
  async attemptSocketHost() {
    try {
      console.log('🌐 Setting up Socket.IO host fallback...');
      
      // Use existing socket.io setup
      this.socketConnection = window.socket;
      this.activeConnection = 'socket';
      this.notifyConnectionChange('socket', 'connected');
      
      return {
        type: 'socket',
        latency: 'internet'
      };
      
    } catch (error) {
      console.error('❌ Socket host failed:', error);
      throw error;
    }
  }
  
  async attemptSocketController() {
    try {
      console.log('🌐 Setting up Socket.IO controller fallback...');
      
      // Use existing socket.io setup
      this.socketConnection = window.socket;
      this.activeConnection = 'socket';
      this.notifyConnectionChange('socket', 'connected');
      
      return {
        type: 'socket',
        latency: 'internet'
      };
      
    } catch (error) {
      console.error('❌ Socket controller failed:', error);
      throw error;
    }
  }
  
  async waitForWebRTCConnection(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        const state = this.webrtcManager.connectionState;
        
        if (state === 'connected' || state === 'completed') {
          resolve();
        } else if (state === 'failed' || Date.now() - startTime > timeout) {
          reject(new Error('WebRTC connection timeout'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }
  
  async delayedFallback(fallbackPromise, delay) {
    await new Promise(resolve => setTimeout(resolve, delay));
    return await fallbackPromise;
  }
  
  // Send input using the active connection
  sendInput(inputData) {
    if (this.activeConnection === 'webrtc') {
      return this.webrtcManager.sendControllerInput(
        inputData.position, 
        inputData.player
      );
    } else if (this.activeConnection === 'socket' && this.socketConnection) {
      this.socketConnection.emit('input', inputData);
      return true;
    }
    
    return false;
  }
  
  // Get comprehensive connection info
  getConnectionInfo() {
    const baseInfo = {
      activeConnection: this.activeConnection,
      timestamp: Date.now()
    };
    
    if (this.activeConnection === 'webrtc') {
      return {
        ...baseInfo,
        ...this.webrtcManager.getConnectionInfo(),
        description: 'Direct P2P connection (1-5ms latency)'
      };
    } else if (this.activeConnection === 'socket') {
      return {
        ...baseInfo,
        type: 'socket',
        latency: null,
        averageLatency: null,
        isWebRTC: false,
        description: 'Internet connection via server (50-200ms latency)'
      };
    }
    
    return {
      ...baseInfo,
      description: 'No active connection'
    };
  }
  
  // Create enhanced QR code with connection info
  generateEnhancedQR(roomCode, webrtcCode = null) {
    const baseURL = `${window.location.origin}/controller.html`;
    
    const params = new URLSearchParams({
      r: roomCode
    });
    
    if (webrtcCode) {
      params.set('rtc', webrtcCode);
      params.set('mode', 'direct');
    }
    
    return `${baseURL}?${params.toString()}`;
  }
  
  notifyConnectionChange(type, state) {
    console.log(`🔄 Connection changed: ${type} -> ${state}`);
    
    if (this.onConnectionChange) {
      this.onConnectionChange({
        type: type,
        state: state,
        info: this.getConnectionInfo()
      });
    }
    
    this.updateConnectionDisplay();
  }
  
  updateConnectionDisplay() {
    const info = this.getConnectionInfo();
    
    // Update connection status
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      let statusText = '';
      let statusClass = '';
      
      if (info.activeConnection === 'webrtc') {
        statusText = '🚀 Direct Connection (Ultra-Low Latency)';
        statusClass = 'webrtc-connected';
      } else if (info.activeConnection === 'socket') {
        statusText = '🌐 Internet Connection (Standard Latency)';
        statusClass = 'socket-connected';
      } else {
        statusText = '❌ No Connection';
        statusClass = 'disconnected';
      }
      
      statusEl.textContent = statusText;
      statusEl.className = `connection-status ${statusClass}`;
    }
    
    // Update latency display
    if (info.latency !== null) {
      const latencyEl = document.getElementById('latencyDisplay');
      if (latencyEl) {
        latencyEl.textContent = `Latency: ${info.latency}ms`;
      }
    }
  }
  
  // Cleanup all connections
  disconnect() {
    if (this.webrtcManager) {
      this.webrtcManager.disconnect();
    }
    
    this.activeConnection = null;
    this.updateConnectionDisplay();
  }
}

// Export for global use
window.HybridConnectionManager = HybridConnectionManager;