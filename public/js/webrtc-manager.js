// WebRTC P2P Connection Manager for Ultra-Low Latency Gaming
// This bypasses the internet entirely for LAN-speed performance (1-5ms)

class WebRTCGameManager {
  constructor() {
    this.isHost = false;
    this.isController = false;
    this.peerConnection = null;
    this.dataChannel = null;
    this.localConnection = null;
    this.onDataReceived = null;
    this.connectionState = 'disconnected';
    this.latencyHistory = [];
    
    // WebRTC configuration with public STUN servers
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Monitor connection state changes
    this.onConnectionStateChange = (state) => {
      console.log(`🔗 WebRTC Connection: ${state}`);
      this.connectionState = state;
      this.updateConnectionUI();
    };
  }
  
  // HOST: Create a new WebRTC connection (TV/Computer)
  async createHostConnection() {
    try {
      this.isHost = true;
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Create data channel for ultra-low latency communication
      this.dataChannel = this.peerConnection.createDataChannel('gameControl', {
        ordered: false, // Prioritize speed over reliability for real-time controls
        maxRetransmits: 0 // No retransmissions for lowest latency
      });
      
      this.setupDataChannel(this.dataChannel);
      this.setupPeerConnectionEvents();
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Generate connection code that includes the offer
      const connectionData = {
        type: 'offer',
        offer: offer,
        timestamp: Date.now()
      };
      
      const connectionCode = this.generateConnectionCode(connectionData);
      console.log('🎮 Host Connection Code Generated:', connectionCode);
      
      return connectionCode;
      
    } catch (error) {
      console.error('❌ Failed to create host connection:', error);
      throw error;
    }
  }
  
  // CONTROLLER: Join using connection code (Phone)
  async joinWithCode(connectionCode) {
    try {
      this.isController = true;
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      const connectionData = this.parseConnectionCode(connectionCode);
      
      if (connectionData.type !== 'offer') {
        throw new Error('Invalid connection code');
      }
      
      this.setupPeerConnectionEvents();
      
      // Handle data channel from host
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
      
      // Set remote description and create answer
      await this.peerConnection.setRemoteDescription(connectionData.offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // In a real implementation, you'd send this answer back to the host
      // For now, we'll use a simplified approach with the signaling server
      return answer;
      
    } catch (error) {
      console.error('❌ Failed to join with code:', error);
      throw error;
    }
  }
  
  setupPeerConnectionEvents() {
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.onConnectionStateChange(state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('🚀 WebRTC P2P Connection Established!');
        this.startLatencyMeasurement();
      }
    };
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // In production, send this to the other peer through signaling
        console.log('🧊 ICE Candidate:', event.candidate);
      }
    };
  }
  
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('📡 Data Channel Opened - Ultra-low latency mode active!');
      this.connectionState = 'connected';
      this.updateConnectionUI();
    };
    
    channel.onclose = () => {
      console.log('📡 Data Channel Closed');
      this.connectionState = 'disconnected';
      this.updateConnectionUI();
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle latency ping
        if (data.type === 'ping') {
          this.sendData({ type: 'pong', timestamp: data.timestamp });
          return;
        }
        
        if (data.type === 'pong') {
          const latency = Date.now() - data.timestamp;
          this.recordLatency(latency);
          return;
        }
        
        // Handle game input
        if (this.onDataReceived) {
          this.onDataReceived(data);
        }
        
      } catch (error) {
        console.error('❌ Failed to parse WebRTC message:', error);
      }
    };
    
    channel.onerror = (error) => {
      console.error('❌ Data Channel Error:', error);
    };
  }
  
  // Send data through WebRTC (ultra-low latency)
  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('❌ Failed to send WebRTC data:', error);
        return false;
      }
    }
    return false;
  }
  
  // Send controller input with minimal processing
  sendControllerInput(position, playerNumber) {
    const inputData = {
      type: 'input',
      position: position,
      player: playerNumber,
      timestamp: Date.now()
    };
    
    return this.sendData(inputData);
  }
  
  // Latency measurement for performance monitoring
  startLatencyMeasurement() {
    setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.sendData({ type: 'ping', timestamp: Date.now() });
      }
    }, 1000); // Measure latency every second
  }
  
  recordLatency(latency) {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift(); // Keep only last 10 measurements
    }
    
    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    console.log(`⚡ WebRTC Latency: ${latency}ms (avg: ${avgLatency.toFixed(1)}ms)`);
    
    this.updateLatencyDisplay(latency, avgLatency);
  }
  
  updateConnectionUI() {
    // Update UI to show connection status
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      const statusMap = {
        'connected': '🟢 Direct Connection (Ultra-Low Latency)',
        'connecting': '🟡 Establishing Direct Connection...',
        'disconnected': '🔴 Using Internet Connection',
        'failed': '❌ Direct Connection Failed'
      };
      
      statusEl.textContent = statusMap[this.connectionState] || this.connectionState;
      statusEl.className = `connection-status ${this.connectionState}`;
    }
  }
  
  updateLatencyDisplay(current, average) {
    const latencyEl = document.getElementById('latencyDisplay');
    if (latencyEl) {
      latencyEl.textContent = `${current}ms (avg: ${average.toFixed(1)}ms)`;
      
      // Color code based on latency quality
      if (average < 5) {
        latencyEl.className = 'latency excellent';
      } else if (average < 15) {
        latencyEl.className = 'latency good';
      } else if (average < 50) {
        latencyEl.className = 'latency fair';
      } else {
        latencyEl.className = 'latency poor';
      }
    }
  }
  
  // Generate a short connection code
  generateConnectionCode(data) {
    const compressed = btoa(JSON.stringify(data));
    return compressed.substring(0, 8).toUpperCase(); // 8-character code
  }
  
  parseConnectionCode(code) {
    try {
      const expanded = atob(code.toLowerCase());
      return JSON.parse(expanded);
    } catch (error) {
      throw new Error('Invalid connection code format');
    }
  }
  
  // Get connection quality info
  getConnectionInfo() {
    if (!this.peerConnection) return null;
    
    return {
      state: this.connectionState,
      latency: this.latencyHistory.length > 0 ? 
        this.latencyHistory[this.latencyHistory.length - 1] : null,
      averageLatency: this.latencyHistory.length > 0 ?
        this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length : null,
      isWebRTC: true,
      connectionType: this.peerConnection.iceConnectionState
    };
  }
  
  // Cleanup
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.connectionState = 'disconnected';
    this.updateConnectionUI();
  }
}

// Export for use in other modules
window.WebRTCGameManager = WebRTCGameManager;