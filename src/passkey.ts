import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  signCount: number;
}

export class PasskeyAuth {
  private storage = new Map<string, PasskeyCredential>();
  
  async register(username: string): Promise<PasskeyCredential> {
    const challenge = crypto.randomBytes(32).toString('base64url');
    
    const credentialId = crypto.randomBytes(32).toString('base64url');
    const publicKey = crypto.randomBytes(65).toString('base64url');
    
    const credential: PasskeyCredential = {
      id: credentialId,
      publicKey,
      signCount: 0,
    };
    
    this.storage.set(username, credential);
    
    return credential;
  }
  
  async authenticate(username: string): Promise<string | null> {
    const credential = this.storage.get(username);
    if (!credential) return null;
    
    const challenge = crypto.randomBytes(32).toString('base64url');
    
    credential.signCount++;
    
    return crypto.randomBytes(64).toString('base64url');
  }
  
  hasCredential(username: string): boolean {
    return this.storage.has(username);
  }
  
  getCredential(username: string): PasskeyCredential | undefined {
    return this.storage.get(username);
  }
}

export async function openBrowserAuth(authUrl: string): Promise<string> {
  console.log(`Opening browser for authentication...`);
  console.log(`URL: ${authUrl}`);
  
  try {
    const platform = process.platform;
    let cmd: string;
    
    if (platform === 'darwin') {
      cmd = `open "${authUrl}"`;
    } else if (platform === 'win32') {
      cmd = `start "" "${authUrl}"`;
    } else {
      cmd = `xdg-open "${authUrl}"`;
    }
    
    await execAsync(cmd);
    console.log('Browser opened. Please complete authentication...');
    console.log('After authenticating, paste the token here.');
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  } catch (err) {
    console.error('Failed to open browser:', err);
    console.log('Please visit this URL manually:', authUrl);
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }
}
