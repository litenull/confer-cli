import WebSocket from 'ws';
import { getProtos } from './proto.js';
import { NoiseClient } from './noise.js';

interface Frame {
  chunkId?: number | null;
  chunkIndex?: number | null;
  totalChunks?: number | null;
  payload?: Uint8Array | null;
}

interface PendingRequest {
  resolve: (body: Uint8Array) => void;
  reject: (err: Error) => void;
}

export class ConferClient {
  private ws: WebSocket | null = null;
  private protos: ReturnType<typeof getProtos> | null = null;
  private requestId = 0n;
  private pendingRequests = new Map<bigint, PendingRequest>();
  private frameBuffer = new Map<bigint, Frame[]>();
  private noise: NoiseClient;
  private handshakeComplete = false;
  
  constructor(
    private url: string,
    private token: string
  ) {
    this.noise = new NoiseClient();
  }
  
  async connect(): Promise<void> {
    this.protos = getProtos();
    
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.performHandshake().then(resolve).catch(reject);
      });
      
      this.ws.on('error', reject);
    });
  }
  
  private async performHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('Not connected'));
      
      const handler = (data: WebSocket.RawData) => {
        try {
          const msg = new Uint8Array(data as Buffer);
          this.noise.processServerHandshake(msg);
          this.handshakeComplete = true;
          
          this.ws!.off('message', handler);
          this.ws!.on('message', (data) => this.onMessage(new Uint8Array(data as Buffer)));
          
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      
      this.ws.on('message', handler);
      
      const ephPub = this.noise.getEphemeralPublicKey();
      this.ws.send(Buffer.from(ephPub));
    });
  }
  
  private onMessage(data: Uint8Array): void {
    if (!this.handshakeComplete) return;
    
    try {
      const decrypted = this.noise.decrypt(data);
      const frame = this.protos!.NoiseTransportFrame.decode(decrypted) as Frame;
      
      const complete = this.assembleFrame(frame);
      if (complete) {
        this.handleResponse(complete);
      }
    } catch (err) {
      console.error('Message handling error:', err);
    }
  }
  
  private assembleFrame(frame: Frame): Uint8Array | null {
    if (!frame.chunkId) {
      return frame.payload || null;
    }
    
    let chunks = this.frameBuffer.get(BigInt(frame.chunkId));
    if (!chunks) {
      chunks = [];
      this.frameBuffer.set(BigInt(frame.chunkId), chunks);
    }
    chunks.push(frame);
    
    if (frame.totalChunks && chunks.length === frame.totalChunks) {
      chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
      const total = chunks.reduce((sum, c) => sum + (c.payload?.length || 0), 0);
      const result = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        if (c.payload) {
          result.set(c.payload, offset);
          offset += c.payload.length;
        }
      }
      this.frameBuffer.delete(BigInt(frame.chunkId));
      return result;
    }
    
    return null;
  }
  
  private handleResponse(data: Uint8Array): void {
    const response = this.protos!.WebsocketResponse.decode(data);
    const id = response.id != null ? BigInt(response.id) : null;
    
    if (id !== null) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (response.status && response.status >= 400) {
          pending.reject(new Error(`HTTP ${response.status}: ${new TextDecoder().decode(response.body)}`));
        } else {
          pending.resolve(response.body || new Uint8Array());
        }
      }
    }
  }
  
  async request(verb: string, path: string, body?: Uint8Array): Promise<Uint8Array> {
    if (!this.handshakeComplete) {
      throw new Error('Handshake not complete');
    }
    
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const request = this.protos!.WebsocketRequest.create({
        id: Number(id),
        verb,
        path,
        body,
      });
      
      const encoded = this.protos!.WebsocketRequest.encode(request).finish();
      const encrypted = this.noise.encrypt(encoded);
      
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(Buffer.from(encrypted));
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  close(): void {
    this.ws?.close();
  }
}
