# Confer CLI

A TypeScript CLI for the Confer API with passkey authentication via TUI.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Confer CLI                         │
├─────────────┬───────────────────┬───────────────────────┤
│    TUI      │   Passkey Auth    │   Noise Protocol      │
│  (blessed)  │   (simulated)     │   (@stablelib)        │
├─────────────┴───────────────────┴───────────────────────┤
│                  WebSocket Client (ws)                  │
├─────────────────────────────────────────────────────────┤
│                  Protobuf (protobufjs)                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Confer Proxy Server  │
              │   (Noise XX handshake) │
              └────────────────────────┘
```

## Install

```bash
cd confer-cli
npm install
```

## Usage

```bash
# Interactive chat
npm run dev chat -- --token YOUR_JWT_TOKEN

# Ping test
npm run dev ping -- --token YOUR_JWT_TOKEN

# With custom URL
npm run dev chat -- --url wss://api.confer.ai/websocket --token YOUR_TOKEN
```

## Passkey Support

Currently simulates passkey auth. For real WebAuthn in a CLI:

1. **Browser flow**: Open browser for registration/authentication, get token back
2. **Platform APIs**: Use OS-specific authenticator access
3. **Hardware keys**: Direct HID communication with YubiKey, etc.

## Noise Protocol

Uses Noise_XX_25519_ChaChaPoly_SHA256:
1. Client sends ephemeral public key
2. Server responds with ephemeral + static public keys (encrypted)
3. Client sends static public key (encrypted)
4. Both derive encryption keys via HKDF

## Development

```bash
# Build
npm run build

# Run test connection
npm run dev test
```
