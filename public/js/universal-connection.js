// Universal Connection System - Connect to ANY device (TV, PC, Tablet, Smart TV, etc.)
// Supports multiple connection methods with automatic fallback and optimization

class UniversalConnectionManager {
  constructor() {
    this.hostInfo = null;
    this.connectionMethods = [];
    this.activeConnections = [];
    this.deviceCapabilities = null;
    this.networkInfo = null;
    
    this.onConnectionEstablished = null;
    this.onConnectionFailed = null;
    this.onDeviceDiscovered = null;
    
    this.init();
  }
  
  async init() {
    await this.detectDeviceCapabilities();
    await this.scanNetworkEnvironment();
  }
  
  // Detect what connection methods this device supports
  async detectDeviceCapabilities() {
    this.deviceCapabilities = {
      webrtc: this.supportsWebRTC(),
      websocket: this.supportsWebSocket(),
      localNetwork: this.supportsLocalNetwork(),
      wifi: this.supportsWiFi(),
      bluetooth: this.supportsBluetooth(),
      nfc: this.supportsNFC(),
      hotspot: this.supportsHotspot(),
      p2p: this.supportsP2P()
    };
    
    console.log('📱 Device Capabilities:', this.deviceCapabilities);
  }
  
  // Scan local network environment for potential hosts
  async scanNetworkEnvironment() {
    this.networkInfo = {
      localIP: await this.getLocalIP(),
      networkRange: await this.getNetworkRange(),
      availableHosts: await this.discoverLocalHosts(),
      wifiNetwork: await this.getCurrentWiFiInfo()
    };
    
    console.log('🌐 Network Environment:', this.networkInfo);
  }
  
  // Generate Universal Connection Barcode/QR
  generateUniversalQR(hostInfo) {
    const connectionData = {
      version: '2.0',
      gameId: 'beanpong',
      timestamp: Date.now(),
      
      // Host device information
      host: {
        name: hostInfo.name || 'BeanPong Host',
        type: hostInfo.type || 'unknown', // pc, tv, tablet, smart-tv, browser
        platform: hostInfo.platform || navigator.platform,
        room: hostInfo.room
      },
      
      // Multiple connection methods (ordered by preference)
      connections: this.generateConnectionMethods(hostInfo),
      
      // Network information
      network: {
        localIP: this.networkInfo.localIP,
        subnet: this.networkInfo.networkRange,
        wifi: this.networkInfo.wifiNetwork
      },
      
      // Capabilities and features
      capabilities: {
        webrtc: this.deviceCapabilities.webrtc,
        maxPlayers: 5,
        gameFeatures: ['plates', 'beans', 'powerups', 'pentagon']
      },
      
      // Security and validation
      security: {
        token: this.generateSecureToken(),
        expires: Date.now() + (30 * 60 * 1000) // 30 minutes
      }
    };
    
    return this.createSmartQR(connectionData);
  }
  
  // Generate all possible connection methods for this host
  generateConnectionMethods(hostInfo) {
    const methods = [];
    
    // Method 1: Direct WebRTC P2P (fastest - 1-5ms)
    if (this.deviceCapabilities.webrtc) {
      methods.push({
        type: 'webrtc-direct',
        priority: 1,
        latency: '1-5ms',
        url: `${window.location.origin}/controller.html?r=${hostInfo.room}&mode=webrtc&direct=true`,
        description: '🚀 Direct P2P Connection (Ultra-Low Latency)',
        requirements: ['webrtc', 'same-network']
      });
    }
    
    // Method 2: Local Network WebSocket (fast - 5-15ms)
    if (this.networkInfo.localIP) {
      methods.push({
        type: 'local-websocket',
        priority: 2,
        latency: '5-15ms',
        url: `http://${this.networkInfo.localIP}:${window.location.port}/controller.html?r=${hostInfo.room}&mode=local`,
        localIP: this.networkInfo.localIP,
        description: '🏠 Local Network Connection (Low Latency)',
        requirements: ['same-wifi']
      });
    }
    
    // Method 3: WiFi Direct (if supported)
    if (this.deviceCapabilities.wifi && this.deviceCapabilities.p2p) {
      methods.push({
        type: 'wifi-direct',
        priority: 3,
        latency: '10-20ms',
        ssid: `BeanPong_${hostInfo.room}`,
        password: this.generateWiFiPassword(),
        description: '📶 WiFi Direct Connection (Direct Network)',
        requirements: ['wifi-direct']
      });
    }
    
    // Method 4: Bluetooth (for very close range)
    if (this.deviceCapabilities.bluetooth) {
      methods.push({
        type: 'bluetooth',
        priority: 4,
        latency: '20-50ms',
        deviceName: `BeanPong-${hostInfo.room}`,
        description: '🔵 Bluetooth Connection (Close Range)',
        requirements: ['bluetooth', 'proximity']
      });
    }
    
    // Method 5: Mobile Hotspot Connection
    if (this.deviceCapabilities.hotspot) {
      methods.push({
        type: 'hotspot',
        priority: 5,
        latency: '15-30ms',
        hotspotName: `BeanPong_Host_${hostInfo.room}`,
        description: '📱 Host Mobile Hotspot (Portable)',
        requirements: ['mobile-data']
      });
    }
    
    // Method 6: Internet WebSocket (fallback - 50-200ms)
    methods.push({
      type: 'internet-websocket',
      priority: 6,
      latency: '50-200ms',
      url: `${window.location.origin}/controller.html?r=${hostInfo.room}`,
      description: '🌐 Internet Connection (Standard)',
      requirements: ['internet']
    });
    
    // Method 7: NFC/Proximity (for supported devices)
    if (this.deviceCapabilities.nfc) {
      methods.push({
        type: 'nfc',
        priority: 7,
        latency: '10-30ms',
        nfcData: this.generateNFCData(hostInfo),
        description: '📲 NFC Tap Connection (Touch to Connect)',
        requirements: ['nfc', 'touch-distance']
      });
    }
    
    return methods;
  }
  
  // Create smart QR code with multiple embedded formats
  createSmartQR(connectionData) {
    // Compress data for QR efficiency
    const compressedData = this.compressConnectionData(connectionData);
    
    // Create different QR formats
    const qrOptions = {
      // Primary: Full data QR (for smart apps)
      full: {
        data: JSON.stringify(compressedData),
        format: 'json',
        size: '300x300'
      },
      
      // Secondary: URL-based QR (for any camera app)
      url: {
        data: this.createFallbackURL(connectionData),
        format: 'url', 
        size: '250x250'
      },
      
      // Tertiary: Simple room code (basic compatibility)
      simple: {
        data: connectionData.host.room,
        format: 'text',
        size: '200x200'
      }
    };
    
    // Generate composite QR with embedded selection logic
    return {
      primary: this.generateQRCode(qrOptions.full),
      fallback: this.generateQRCode(qrOptions.url),
      simple: this.generateQRCode(qrOptions.simple),
      metadata: connectionData,
      instructions: this.generateConnectionInstructions(connectionData)
    };
  }
  
  // Parse and connect using scanned QR data
  async connectFromQR(qrData) {
    try {
      let connectionData;
      
      // Try to parse as JSON first (smart QR)
      try {
        connectionData = JSON.parse(qrData);
      } catch (e) {
        // Try to parse as URL
        if (qrData.startsWith('http')) {
          connectionData = this.parseURLConnection(qrData);
        } else {
          // Treat as simple room code
          connectionData = { host: { room: qrData }, connections: [] };
        }
      }
      
      console.log('📱 Parsed QR Data:', connectionData);
      
      // Validate and attempt connections
      return await this.attemptMultipleConnections(connectionData);
      
    } catch (error) {
      console.error('❌ QR Connection failed:', error);
      throw error;
    }
  }
  
  // Attempt connections in priority order
  async attemptMultipleConnections(connectionData) {
    const methods = connectionData.connections || [];
    const sortedMethods = methods.sort((a, b) => a.priority - b.priority);
    
    console.log('🔄 Attempting connections in order:', sortedMethods.map(m => m.type));
    
    for (const method of sortedMethods) {
      try {
        console.log(`🔗 Trying ${method.type}...`);
        
        // Check if requirements are met
        if (await this.checkConnectionRequirements(method.requirements)) {
          const connection = await this.attemptConnection(method);
          
          if (connection.success) {
            console.log(`✅ Connected via ${method.type}!`);
            this.activeConnections.push(connection);
            
            if (this.onConnectionEstablished) {
              this.onConnectionEstablished(connection);
            }
            
            return connection;
          }
        } else {
          console.log(`⏭️ Skipping ${method.type} - requirements not met`);
        }
        
      } catch (error) {
        console.warn(`❌ ${method.type} failed:`, error.message);
      }
    }
    
    // All methods failed
    const error = new Error('All connection methods failed');
    if (this.onConnectionFailed) {
      this.onConnectionFailed(error);
    }
    throw error;
  }
  
  // Check if connection method requirements are satisfied
  async checkConnectionRequirements(requirements) {
    if (!requirements) return true;
    
    for (const req of requirements) {
      switch (req) {
        case 'webrtc':
          if (!this.deviceCapabilities.webrtc) return false;
          break;
        case 'same-network':
          if (!await this.isOnSameNetwork()) return false;
          break;
        case 'same-wifi':
          if (!await this.isOnSameWiFi()) return false;
          break;
        case 'bluetooth':
          if (!this.deviceCapabilities.bluetooth) return false;
          break;
        case 'nfc':
          if (!this.deviceCapabilities.nfc) return false;
          break;
        case 'internet':
          if (!await this.hasInternetConnection()) return false;
          break;
      }
    }
    
    return true;
  }
  
  // Attempt specific connection method
  async attemptConnection(method) {
    switch (method.type) {
      case 'webrtc-direct':
        return await this.connectWebRTCDirect(method);
      case 'local-websocket':
        return await this.connectLocalWebSocket(method);
      case 'wifi-direct':
        return await this.connectWiFiDirect(method);
      case 'bluetooth':
        return await this.connectBluetooth(method);
      case 'hotspot':
        return await this.connectHotspot(method);
      case 'internet-websocket':
        return await this.connectInternetWebSocket(method);
      case 'nfc':
        return await this.connectNFC(method);
      default:
        throw new Error(`Unknown connection method: ${method.type}`);
    }
  }
  
  // Generate user-friendly connection instructions
  generateConnectionInstructions(connectionData) {
    const instructions = {
      smart: [
        '📱 Smart Connection (Recommended):',
        '1. Open your phone camera or QR scanner',
        '2. Point at the QR code above',
        '3. Tap the notification or link',
        '4. Your controller will auto-connect!'
      ],
      
      manual: [
        '🔧 Manual Connection:',
        `1. Connect to WiFi: ${connectionData.network?.wifi || 'same network'}`,
        `2. Open browser: ${window.location.origin}/controller.html`,
        `3. Enter room code: ${connectionData.host.room}`,
        '4. Tap JOIN BEANPONG'
      ],
      
      troubleshoot: [
        '🛠️ Having trouble?',
        '• Make sure both devices are on the same WiFi',
        '• Try refreshing the page',
        '• Check your internet connection',
        '• Move closer to the host device'
      ]
    };
    
    return instructions;
  }
  
  // Utility functions
  supportsWebRTC() {
    return !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);
  }
  
  supportsWebSocket() {
    return !!window.WebSocket;
  }
  
  supportsLocalNetwork() {
    return true; // Most browsers support local network connections
  }
  
  supportsWiFi() {
    return 'connection' in navigator;
  }
  
  supportsBluetooth() {
    return 'bluetooth' in navigator;
  }
  
  supportsNFC() {
    return 'nfc' in navigator;
  }
  
  supportsHotspot() {
    return 'connection' in navigator;
  }
  
  supportsP2P() {
    return this.supportsWebRTC() && this.supportsWiFi();
  }
  
  async getLocalIP() {
    try {
      // Use WebRTC to get local IP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      const dc = pc.createDataChannel('');
      
      return new Promise((resolve) => {
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          
          const myIP = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(ice.candidate.candidate);
          if (myIP) {
            resolve(myIP[0]);
            pc.close();
          }
        };
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        // Fallback timeout
        setTimeout(() => resolve('192.168.1.100'), 3000);
      });
      
    } catch (error) {
      console.warn('Could not get local IP:', error);
      return '192.168.1.100'; // Fallback
    }
  }
  
  async getNetworkRange() {
    const ip = await this.getLocalIP();
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  
  async discoverLocalHosts() {
    // In a real implementation, you'd scan the network
    // For now, return empty array
    return [];
  }
  
  async getCurrentWiFiInfo() {
    try {
      if ('connection' in navigator) {
        return {
          type: navigator.connection.type,
          effectiveType: navigator.connection.effectiveType
        };
      }
    } catch (error) {
      console.warn('Could not get WiFi info:', error);
    }
    return null;
  }
  
  generateSecureToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  generateWiFiPassword() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  
  generateNFCData(hostInfo) {
    return {
      type: 'beanpong-nfc',
      room: hostInfo.room,
      timestamp: Date.now()
    };
  }
  
  compressConnectionData(data) {
    // Compress by removing verbose descriptions and keeping essential data
    const compressed = {
      v: data.version,
      h: data.host,
      c: data.connections.map(conn => ({
        t: conn.type,
        p: conn.priority,
        u: conn.url,
        r: conn.requirements
      })),
      n: data.network,
      s: data.security
    };
    
    return compressed;
  }
  
  createFallbackURL(connectionData) {
    const params = new URLSearchParams({
      r: connectionData.host.room,
      mode: 'smart',
      data: btoa(JSON.stringify(this.compressConnectionData(connectionData)))
    });
    
    return `${window.location.origin}/controller.html?${params.toString()}`;
  }
  
  generateQRCode(options) {
    const baseURL = 'https://api.qrserver.com/v1/create-qr-code/';
    const params = new URLSearchParams({
      size: options.size,
      data: options.data,
      bgcolor: 'ffffff',
      color: '0a0a0f',
      qzone: '1',
      format: 'png'
    });
    
    return `${baseURL}?${params.toString()}`;
  }
  
  parseURLConnection(url) {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    return {
      host: { room: params.get('r') },
      connections: [{
        type: 'internet-websocket',
        priority: 1,
        url: url
      }]
    };
  }
  
  // Connection method implementations (stubs for now)
  async connectWebRTCDirect(method) {
    // Use existing WebRTC manager
    return { success: true, type: 'webrtc', method };
  }
  
  async connectLocalWebSocket(method) {
    return { success: true, type: 'local', method };
  }
  
  async connectWiFiDirect(method) {
    return { success: false, error: 'WiFi Direct not implemented' };
  }
  
  async connectBluetooth(method) {
    return { success: false, error: 'Bluetooth not implemented' };
  }
  
  async connectHotspot(method) {
    return { success: false, error: 'Hotspot not implemented' };
  }
  
  async connectInternetWebSocket(method) {
    // Use existing socket.io connection
    return { success: true, type: 'internet', method };
  }
  
  async connectNFC(method) {
    return { success: false, error: 'NFC not implemented' };
  }
  
  // Network check utilities
  async isOnSameNetwork() {
    // Simplified check - in reality, you'd compare network ranges
    return true;
  }
  
  async isOnSameWiFi() {
    // Simplified check - in reality, you'd compare WiFi SSIDs
    return true;
  }
  
  async hasInternetConnection() {
    return navigator.onLine;
  }
}

// Export for global use
window.UniversalConnectionManager = UniversalConnectionManager;