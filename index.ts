// Hermes TextDecoder latin1 / binary polyfill
if (typeof TextDecoder !== 'undefined') {
  const OriginalTextDecoder = TextDecoder;
  (globalThis as any).TextDecoder = class PatchedTextDecoder {
    encoding: string;
    decoder: any;
    fatal: boolean;
    ignoreBOM: boolean;
    constructor(label: string = 'utf-8', options?: any) {
      const normalized = (label || 'utf-8').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['latin1', 'latin', 'iso88591', 'binary', 'ascii', 'windows1252'].includes(normalized)) {
        this.encoding = 'latin1';
        this.decoder = null;
      } else {
        this.encoding = label;
        try {
          this.decoder = new OriginalTextDecoder(label, options);
        } catch {
          this.decoder = new OriginalTextDecoder('utf-8', options);
        }
      }
      this.fatal = options?.fatal || false;
      this.ignoreBOM = options?.ignoreBOM || false;
    }
    decode(input?: BufferSource, options?: any): string {
      if (this.encoding === 'latin1') {
        if (!input) return '';
        const bytes = input instanceof Uint8Array ? input : new Uint8Array((input as any).buffer || input);
        let res = '';
        for (let i = 0; i < bytes.length; i++) {
          res += String.fromCharCode(bytes[i]);
        }
        return res;
      }
      return this.decoder ? this.decoder.decode(input, options) : '';
    }
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
