import { SHA256 } from '@stablelib/sha256';
import { HKDF } from '@stablelib/hkdf';
import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305';
import * as curve25519 from '@stablelib/curve25519';

const PROTOCOL_NAME = 'Noise_XX_25519_ChaChaPoly_SHA256';

export class NoiseClient {
  private ck: Uint8Array;
  private h: Uint8Array;
  private e: Uint8Array;
  private re: Uint8Array | null = null;
  private rs: Uint8Array | null = null;
  
  private encryptCipher: ChaCha20Poly1305 | null = null;
  private decryptCipher: ChaCha20Poly1305 | null = null;
  private encryptNonce = 0n;
  private decryptNonce = 0n;
  
  constructor(ephemeralPrivateKey?: Uint8Array) {
    this.ck = new TextEncoder().encode(PROTOCOL_NAME);
    this.h = this.hash(this.ck);
    
    if (ephemeralPrivateKey) {
      this.e = ephemeralPrivateKey;
    } else {
      const pair = curve25519.generateKeyPairFromSeed(
        crypto.getRandomValues(new Uint8Array(32))
      );
      this.e = pair.privateKey;
    }
  }
  
  getEphemeralPublicKey(): Uint8Array {
    return curve25519.scalarMultBase(this.e);
  }
  
  getEncryptCipher(): ChaCha20Poly1305 | null {
    return this.encryptCipher;
  }
  
  getDecryptCipher(): ChaCha20Poly1305 | null {
    return this.decryptCipher;
  }
  
  processServerHandshake(message: Uint8Array): Uint8Array | null {
    const ephemeralPub = this.getEphemeralPublicKey();
    this.mixHash(ephemeralPub);
    
    let offset = 0;
    
    const serverE = message.slice(offset, offset + 32);
    offset += 32;
    this.re = serverE;
    this.mixHash(serverE);
    
    this.ck = this.mixKey(this.dh(this.e, serverE));
    
    const serverEncrypted = message.slice(offset);
    const k = this.deriveTempKey();
    
    const serverPayload = this.decryptWithTempKey(k, serverEncrypted);
    const serverS = serverPayload.slice(0, 32);
    const attestation = new TextDecoder().decode(serverPayload.slice(32));
    
    this.rs = serverS;
    this.ck = this.mixKey(this.dh(this.e, serverS));
    
    const clientPub = new Uint8Array(32);
    this.encryptCipher = new ChaCha20Poly1305(this.ck.slice(0, 32));
    this.decryptCipher = new ChaCha20Poly1305(this.ck.slice(0, 32));
    
    return null;
  }
  
  encrypt(plaintext: Uint8Array): Uint8Array {
    if (!this.encryptCipher) throw new Error('Handshake not complete');
    
    const nonce = new Uint8Array(12);
    const view = new DataView(nonce.buffer);
    view.setBigUint64(4, this.encryptNonce++, false);
    
    return this.encryptCipher.seal(nonce, plaintext);
  }
  
  decrypt(ciphertext: Uint8Array): Uint8Array {
    if (!this.decryptCipher) throw new Error('Handshake not complete');
    
    const nonce = new Uint8Array(12);
    const view = new DataView(nonce.buffer);
    view.setBigUint64(4, this.decryptNonce++, false);
    
    const result = this.decryptCipher.open(nonce, ciphertext);
    if (!result) throw new Error('Decryption failed');
    return result;
  }
  
  private hash(data: Uint8Array): Uint8Array {
    const hasher = new SHA256();
    hasher.update(data);
    return hasher.finish();
  }
  
  private mixHash(data: Uint8Array): void {
    const hasher = new SHA256();
    hasher.update(this.h);
    hasher.update(data);
    this.h = hasher.finish();
  }
  
  private mixKey(input: Uint8Array): Uint8Array {
    const hkdf = new HKDF(SHA256, input, this.ck);
    return hkdf.expand(32);
  }
  
  private dh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
    return curve25519.scalarMult(priv, pub);
  }
  
  private deriveTempKey(): Uint8Array {
    const hkdf = new HKDF(SHA256, new Uint8Array(0), this.ck);
    return hkdf.expand(32);
  }
  
  private decryptWithTempKey(key: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    const cipher = new ChaCha20Poly1305(key);
    const nonce = new Uint8Array(12);
    const result = cipher.open(nonce, ciphertext);
    if (!result) throw new Error('Temp decryption failed');
    return result;
  }
}
