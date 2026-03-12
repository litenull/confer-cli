import { ConferClient } from './client.js';
import { loadProtos } from './proto.js';

async function main() {
  await loadProtos();
  
  const url = process.env.CONFER_URL || 'ws://localhost:8080/websocket';
  const token = process.env.CONFER_TOKEN || 'test-token';
  
  console.log('Connecting to', url);
  
  const client = new ConferClient(url, token);
  
  try {
    await client.connect();
    console.log('Connected!');
    
    const response = await client.request('GET', '/ping');
    console.log('Response:', new TextDecoder().decode(response));
    
    client.close();
    console.log('Done');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
