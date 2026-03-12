import blessed from 'blessed';
import { PasskeyAuth, PasskeyCredential, openBrowserAuth } from './passkey.js';

export { PasskeyAuth, PasskeyCredential, openBrowserAuth };

export interface TUIComponents {
  screen: blessed.Widgets.Screen;
  chatBox: blessed.Widgets.Log;
  inputBox: blessed.Widgets.TextboxElement;
}

export function createTUI(): TUIComponents {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Confer CLI',
    fullUnicode: true,
  });
  
  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: ' {bold}Confer CLI{/bold} - Secure AI Chat with Passkeys',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
      fg: 'white',
      bg: 'black',
    },
  });
  
  const chatBox = blessed.log({
    top: 3,
    left: 0,
    width: '100%',
    height: '100%-6',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      ch: ' ',
      style: { bg: 'cyan' },
      track: { bg: 'gray' },
    },
    border: { type: 'line' },
    style: {
      border: { fg: 'gray' },
    },
  });
  
  const inputBox = blessed.textbox({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    inputOnFocus: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
      focus: { border: { fg: 'green' } },
    },
  });
  
  screen.append(header);
  screen.append(chatBox);
  screen.append(inputBox);
  
  inputBox.key(['enter'], () => {
    const value = inputBox.getValue();
    inputBox.clearValue();
    screen.render();
    
    if (value.trim()) {
      inputBox.emit('submit', value);
    }
  });
  
  screen.key(['escape', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });
  
  screen.key(['up'], () => {
    chatBox.scroll(-1);
    screen.render();
  });
  
  screen.key(['down'], () => {
    chatBox.scroll(1);
    screen.render();
  });
  
  return { screen, chatBox, inputBox };
}

export async function showLoginForm(screen: blessed.Widgets.Screen): Promise<{ username: string; action: 'login' | 'register' }> {
  return new Promise((resolve) => {
    const form = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 12,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } },
      label: ' Passkey Authentication ',
    });
    
    const text = blessed.text({
      parent: form,
      top: 1,
      left: 2,
      content: 'Username:',
    });
    
    const usernameInput = blessed.textbox({
      parent: form,
      top: 1,
      left: 12,
      width: 30,
      height: 1,
      inputOnFocus: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: { bg: 'blue' },
      },
    });
    
    const loginBtn = blessed.button({
      parent: form,
      top: 4,
      left: 5,
      width: 12,
      height: 1,
      content: 'Login',
      mouse: true,
      style: { 
        fg: 'white',
        bg: 'blue',
        focus: { bg: 'cyan', fg: 'black' },
        hover: { bg: 'cyan', fg: 'black' },
      },
    });
    
    const registerBtn = blessed.button({
      parent: form,
      top: 4,
      left: 20,
      width: 12,
      height: 1,
      content: 'Register',
      mouse: true,
      style: { 
        fg: 'white',
        bg: 'green',
        focus: { bg: 'lightgreen', fg: 'black' },
        hover: { bg: 'lightgreen', fg: 'black' },
      },
    });
    
    const hint = blessed.text({
      parent: form,
      top: 7,
      left: 2,
      content: '{gray-fg}Tab to switch, Enter to submit{/gray-fg}',
      tags: true,
    });
    
    let action: 'login' | 'register' = 'login';
    
    loginBtn.on('press', () => {
      action = 'login';
      const username = usernameInput.getValue().trim();
      if (username) {
        form.destroy();
        screen.render();
        resolve({ username, action });
      }
    });
    
    registerBtn.on('press', () => {
      action = 'register';
      const username = usernameInput.getValue().trim();
      if (username) {
        form.destroy();
        screen.render();
        resolve({ username, action });
      }
    });
    
    usernameInput.key(['enter'], () => {
      loginBtn.focus();
    });
    
    usernameInput.key(['tab'], () => {
      loginBtn.focus();
    });
    
    loginBtn.key(['tab'], () => {
      registerBtn.focus();
    });
    
    registerBtn.key(['tab'], () => {
      usernameInput.focus();
    });
    
    usernameInput.focus();
    screen.render();
  });
}

export function showStatus(screen: blessed.Widgets.Screen, message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const colors = {
    info: 'cyan',
    success: 'green',
    error: 'red',
  };
  
  const box = blessed.box({
    parent: screen,
    bottom: 3,
    left: 'center',
    width: message.length + 4,
    height: 1,
    content: `{${colors[type]}-fg}${message}{/${colors[type]}-fg}`,
    tags: true,
  });
  
  screen.render();
  
  setTimeout(() => {
    box.destroy();
    screen.render();
  }, 2000);
}
