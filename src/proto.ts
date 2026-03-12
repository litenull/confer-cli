import protobuf from 'protobufjs';

let root: protobuf.Root | null = null;

export async function loadProtos() {
  root = await protobuf.load(new URL('../proto/noise_transport.proto', import.meta.url));
  return root;
}

export function getProtos() {
  if (!root) throw new Error('Protos not loaded');
  
  return {
    NoiseTransportFrame: root.lookupType('con.NoiseTransportFrame'),
    StreamChunk: root.lookupType('confer.StreamChunk'),
    WebsocketRequest: root.lookupType('confer.WebsocketRequest'),
    WebsocketResponse: root.lookupType('confer.WebsocketResponse'),
  };
}
