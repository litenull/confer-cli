#!/usr/bin/env node

import { Command } from 'commander';
import { loadProtos } from './proto.js';
import { ConferClient } from './client.js';
import { createTUI, showLoginForm, PasskeyAuth } from './tui.js';

const program = new Command();

program
  .name('confer')
  .description('Confer CLI - Secure AI chat with passkey auth')
  .version('0.1.0');

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-u, --url <url>', 'WebSocket URL', 'wss://api.confer.ai/websocket')
  .option('-t, --token <token>', 'JWT token (optional)', '')
  .action(async (options) => {
    await loadProtos();
    
    const { screen, chatBox, inputBox } = createTUI();
    const passkeyAuth = new PasskeyAuth();
    
    chatBox.log('{yellow-fg}Welcome to Confer CLI{/yellow-fg}');
    chatBox.log('{gray-fg}Press Escape or Ctrl+C to exit | Up/Down to scroll{/gray-fg}');
    chatBox.log('');
    
    const { username, action } = await showLoginForm(screen);
    
    if (action === 'register') {
      chatBox.log(`{cyan-fg}Registering passkey for ${username}...{/cyan-fg}`);
      try {
        const credential = await passkeyAuth.register(username);
        chatBox.log(`{green-fg}Passkey registered!{/green-fg}`);
        chatBox.log(`{gray-fg}Credential ID: ${credential.id.slice(0, 16)}...{/gray-fg}`);
      } catch (err) {
        chatBox.log(`{red-fg}Registration failed: ${err}{/red-fg}`);
        return;
      }
    } else {
      chatBox.log(`{cyan-fg}Authenticating ${username}...{/cyan-fg}`);
      
      if (!passkeyAuth.hasCredential(username)) {
        chatBox.log('{red-fg}No passkey found for this user.{/red-fg}');
        chatBox.log('{yellow-fg}Please register first.{/yellow-fg}');
        return;
      }
      
      try {
        const assertion = await passkeyAuth.authenticate(username);
        chatBox.log('{green-fg}Authenticated successfully!{/green-fg}');
      } catch (err) {
        chatBox.log(`{red-fg}Authentication failed: ${err}{/red-fg}`);
        return;
      }
    }
    
    chatBox.log('');
    chatBox.log('{cyan-fg}Connecting to server...{/cyan-fg}');
    
    const client = new ConferClient(options.url, options.token || username);
    
    try {
      await client.connect();
      chatBox.log('{green-fg}Connected!{/green-fg}');
      chatBox.log('{gray-fg}Type your message and press Enter to send.{/gray-fg}');
      chatBox.log('');
      
      inputBox.focus();
      
      inputBox.on('submit', async (message: string) => {
        chatBox.log(`{cyan-fg}You:{/cyan-fg} ${message}`);
        
        try {
          const response = await client.request(
            'POST',
            '/v1/vllm/chat/completions',
            new TextEncoder().encode(JSON.stringify({
              model: 'default',
              messages: [{ role: 'user', content: message }],
            }))
          );
          
          const text = new TextDecoder().decode(response);
          const parsed = JSON.parse(text);
          const content = parsed.choices?.[0]?.message?.content || text;
          chatBox.log(`{green-fg}AI:{/green-fg} ${content}`);
        } catch (err) {
          chatBox.log(`{red-fg}Error:{/red-fg} ${err}`);
        }
      });
      
    } catch (err) {
      chatBox.log(`{red-fg}Connection failed:{/red-fg} ${err}`);
      chatBox.log('');
      chatBox.log('{gray-fg}Press Escape to exit.{/gray-fg}');
    }
  });

program
  .command('ping')
  .description('Test connection to server')
  .option('-u, --url <url>', 'WebSocket URL', 'wss://api.confer.ai/websocket')
  .option('-t, --token <token>', 'JWT token')
  .action(async (options) => {
    await loadProtos();
    
    console.log('Connecting to', options.url);
    const client = new ConferClient(options.url, options.token || 'test');
    
    try {
      await client.connect();
      console.log('Connected! Sending ping...');
      
      const response = await client.request('GET', '/ping');
      console.log('Pong:', new TextDecoder().decode(response));
      
      client.close();
      console.log('Done');
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  });

program.parse();
