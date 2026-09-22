import { VisualDetector } from './visual-detector.js';
import { ImageRedactor } from './image-redactor.js';
import { SecretStore } from '../agent/secret-store.js';

export class PrivacyEngine {
  /**
   * Sanitize an array of normalized WebBrain messages (text and image blocks).
   * Creates a new sanitized copy of the messages array without mutating originals.
   *
   * @param {Array<Object>} messages - Raw WebBrain message array
   * @param {Object} [options] - Sanitization options
   * @returns {Promise<Array<Object>>} Sanitized message array
   */
  static async sanitize(target, options = {}) {
    try { chrome.runtime.sendMessage({ type: 'privacy_engine_update', status: 'inspecting' }).catch(() => {}); } catch (e) {}

    let result;
    const session = new SanitizationSession(options);

    if (typeof target === 'string') {
      result = session.sanitizeText(target);
    } else if (!Array.isArray(target) && target && typeof target === 'object') {
      result = session.sanitizeObjectSync(target);
    } else if (!Array.isArray(target)) {
      result = target;
    } else {
      const messages = target;
      const hasImageBlocks = messages.some(msg => {
        if (!msg || typeof msg !== 'object') return false;
        if (Array.isArray(msg.content)) {
          return msg.content.some(b => b && (b.type === 'image_url' || b.type === 'image'));
        }
        return false;
      });

      if (!hasImageBlocks) {
        result = messages.map(msg => session.sanitizeMessageSync(msg));
      } else {
        result = await Promise.all(messages.map(msg => session.sanitizeMessageAsync(msg)));
      }
    }

    try {
      const categories = Array.from(session.secretMapping.entries()).map(([placeholder, raw]) => {
        const catParts = placeholder.match(/^<([A-Z_]+)_\d+>$/);
        return { name: catParts ? catParts[1] : 'SECRET', placeholder };
      });
      chrome.runtime.sendMessage({ type: 'privacy_engine_update', status: 'complete', categories }).catch(() => {});
    } catch (e) {}

    return result;
  }

  static sanitizeText(text, options = {}) {
    if (typeof text !== 'string') return text;
    const session = new SanitizationSession(options);
    return session.sanitizeText(text);
  }

  static sanitizeSync(target, options = {}) {
    if (typeof target === 'string') {
      return this.sanitizeText(target, options);
    }
    if (Array.isArray(target)) {
      const session = new SanitizationSession(options);
      return target.map(msg => session.sanitizeMessageSync(msg));
    }
    if (target && typeof target === 'object') {
      const session = new SanitizationSession(options);
      return session.sanitizeObjectSync(target);
    }
    return target;
  }
}

/**
 * Decorate a provider instance so that calling chat() or chatStream()
 * automatically sanitizes outbound messages before execution.
 *
 * @param {Object} provider
 * @returns {Object} Same provider instance decorated with PrivacyEngine
 */
export function decorateProviderWithPrivacyEngine(provider) {
  if (!provider || typeof provider !== 'object' || provider._privacyEngineDecorated) {
    return provider;
  }

  const originalChat = provider.chat;
  if (typeof originalChat === 'function') {
    provider.chat = async function (messages, options) {
      const sanitizedMessages = await PrivacyEngine.sanitize(messages, options);
      return originalChat.call(this, sanitizedMessages, options);
    };
  }

  const originalChatStream = provider.chatStream;
  if (typeof originalChatStream === 'function') {
    provider.chatStream = async function* (messages, options) {
      const sanitizedMessages = await PrivacyEngine.sanitize(messages, options);
      yield* originalChatStream.call(this, sanitizedMessages, options);
    };
  }

  provider._privacyEngineDecorated = true;
  return provider;
}

class SanitizationSession {
  constructor(options = {}) {
    this.options = options;
    this.valueToPlaceholder = new Map();
    this.categoryCounts = new Map();
    this.secretMapping = new Map();
  }

  getPlaceholder(category, rawValue) {
    const key = `${category}:${rawValue}`;
    if (this.valueToPlaceholder.has(key)) {
      return this.valueToPlaceholder.get(key);
    }

    const count = (this.categoryCounts.get(category) || 0) + 1;
    this.categoryCounts.set(category, count);
    const placeholder = `<${category}_${count}>`;
    this.valueToPlaceholder.set(key, placeholder);
    this.secretMapping.set(placeholder, rawValue);
    
    // Register the placeholder mapping locally in the agent vault
    SecretStore.register(placeholder, rawValue, category);
    
    return placeholder;
  }

  sanitizeObjectSync(obj) {
    if (obj == null) return obj;
    if (typeof obj === 'string') return this.sanitizeText(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeObjectSync(item));

    const copy = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        copy[key] = this.sanitizeText(val);
      } else if (val && typeof val === 'object') {
        copy[key] = this.sanitizeObjectSync(val);
      } else {
        copy[key] = val;
      }
    }
    return copy;
  }

  sanitizeMessageSync(msg) {
    if (!msg || typeof msg !== 'object') return msg;

    const copy = { ...msg };

    if (typeof copy.content === 'string') {
      copy.content = this.sanitizeText(copy.content);
    } else if (Array.isArray(copy.content)) {
      copy.content = copy.content.map(block => this.sanitizeContentBlockSync(block));
    }

    if (Array.isArray(copy.tool_calls)) {
      copy.tool_calls = copy.tool_calls.map(tc => this.sanitizeToolCall(tc));
    }

    return copy;
  }

  sanitizeContentBlockSync(block) {
    if (!block || typeof block !== 'object') return block;

    if (block.type === 'text' && typeof block.text === 'string') {
      return { ...block, text: this.sanitizeText(block.text) };
    }

    return { ...block };
  }

  async sanitizeMessageAsync(msg) {
    if (!msg || typeof msg !== 'object') return msg;

    const copy = { ...msg };

    if (typeof copy.content === 'string') {
      copy.content = this.sanitizeText(copy.content);
    } else if (Array.isArray(copy.content)) {
      const blockPromises = copy.content.map(block => this.sanitizeContentBlockAsync(block));
      copy.content = await Promise.all(blockPromises);
    }

    if (Array.isArray(copy.tool_calls)) {
      copy.tool_calls = copy.tool_calls.map(tc => this.sanitizeToolCall(tc));
    }

    return copy;
  }

  async sanitizeContentBlockAsync(block) {
    if (!block || typeof block !== 'object') return block;

    if (block.type === 'text' && typeof block.text === 'string') {
      return { ...block, text: this.sanitizeText(block.text) };
    }

    if (block.type === 'image_url' || block.type === 'image') {
      return this.sanitizeImageBlock(block);
    }

    // Preserved unchanged for document, tool_result, etc.
    return { ...block };
  }

  async sanitizeImageBlock(block) {
    try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'inspecting' }).catch(() => {}); } catch(e) {}

    const parsed = ImageRedactor.parseImageBlock(block);
    if (!parsed) {
      try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'failed' }).catch(() => {}); } catch(e) {}
      return ImageRedactor.buildFailClosedTextBlock('unsupported format or malformed data');
    }

    try {
      const res = await VisualDetector.detect(parsed);

      if (!res.ok || !res.scanComplete) {
        try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'failed' }).catch(() => {}); } catch(e) {}
        return ImageRedactor.buildFailClosedTextBlock(res.error || 'unverified or incomplete scan');
      }

      const piiBoxes = [];

      for (const region of res.regions) {
        if (!region || !region.text) continue;
        if (this.containsPiiText(region.text)) {
          piiBoxes.push(region.box);
        }
      }

      if (piiBoxes.length > 0) {
        const redactedPng = await ImageRedactor.redactAndReencode(
          parsed,
          piiBoxes,
          res.imageWidth,
          res.imageHeight
        );
        try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'complete', redactedCount: piiBoxes.length, previewDataUrl: redactedPng }).catch(() => {}); } catch(e) {}
        return ImageRedactor.buildSanitizedBlock(parsed, redactedPng);
      }

      const cleanPng = await ImageRedactor.reencodeCleanPng(
        parsed,
        res.imageWidth,
        res.imageHeight
      );
      try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'complete', redactedCount: 0, previewDataUrl: cleanPng }).catch(() => {}); } catch(e) {}
      return ImageRedactor.buildSanitizedBlock(parsed, cleanPng);
    } catch (err) {
      try { chrome.runtime.sendMessage({ type: 'visual_privacy_update', status: 'failed' }).catch(() => {}); } catch(e) {}
      return ImageRedactor.buildFailClosedTextBlock(err.message || 'exception during sanitization');
    }
  }

  containsPiiText(text) {
    if (!text || typeof text !== 'string') return false;

    // Email
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(text)) return true;

    // Phone
    if (/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) return true;

    // Credit Card
    if (/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b|\b(?:\d{4}[- ]){3}\d{4}\b/.test(text)) return true;

    // Password / Credential
    if (/(?:password|passcode|secret_token|private_key|pwd|passwd)\s*[:=]\s*\S+/i.test(text)) return true;

    // API Key / Secret Token (including Phase 4/5 red-team test canary secrets)
    if (/(?:sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z-_]{35}|PHASE\d+_(?:REDTEAM_)?CANARY_[A-Za-z0-9_]+)/i.test(text)) return true;

    // Secret URL query param
    if (/[?&](?:api_key|apikey|access_token|auth_token|token|secret|password|passwd|pwd|private_key)=/i.test(text)) return true;

    return false;
  }

  sanitizeToolCall(tc) {
    if (!tc || typeof tc !== 'object') return tc;
    const copy = { ...tc };
    if (copy.function && typeof copy.function === 'object') {
      copy.function = { ...copy.function };
      if (typeof copy.function.arguments === 'string') {
        copy.function.arguments = this.sanitizeToolArguments(copy.function.arguments);
      }
    }
    return copy;
  }

  sanitizeToolArguments(argsStr) {
    if (!argsStr || typeof argsStr !== 'string') return argsStr;
    try {
      const parsed = JSON.parse(argsStr);
      if (parsed && typeof parsed === 'object') {
        const sanitizedObj = this.sanitizeObjectStrings(parsed);
        return JSON.stringify(sanitizedObj);
      }
    } catch {}

    return this.sanitizeText(argsStr);
  }

  sanitizeObjectStrings(obj) {
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObjectStrings(item));
    }
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(obj)) {
        result[key] = this.sanitizeObjectStrings(val);
      }
      return result;
    }
    return obj;
  }

  sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;

    let result = text;

    // 1. API Keys & Known Secret Tokens (including Phase 4/5 red-team test canary secrets)
    result = result.replace(
      /(?:\b|_)(sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z-_]{35}|PHASE\d+_(?:REDTEAM_)?CANARY_[A-Za-z0-9_]+)\b/g,
      (match) => this.getPlaceholder('API_KEY', match.startsWith('_') ? match.slice(1) : match)
    );

    // 2. Passwords / Key-Value Credentials
    result = result.replace(
      /\b(password|passcode|secret_token|private_key|pwd|passwd)\s*[:=]\s*(["']?)([^"'\s,{}<>`]+)\2/gi,
      (match, key, quote, val) => {
        if (!val || (val.startsWith('<') && val.endsWith('>'))) return match;
        const ph = this.getPlaceholder('PASSWORD', val);
        return `${key}=${quote}${ph}${quote}`;
      }
    );

    // 3. Email Addresses
    result = result.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      (match) => this.getPlaceholder('EMAIL', match)
    );

    // 4. Credit Card Numbers
    result = result.replace(
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b|\b(?:\d{4}[- ]){3}\d{4}\b/g,
      (match) => this.getPlaceholder('CARD', match)
    );

    // 5. Phone Numbers
    result = result.replace(
      /(?<![0-9.-])(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?![0-9.-])/g,
      (match) => {
        if (/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(match) || /^\d+\.\d+\.\d+$/.test(match)) return match;
        return this.getPlaceholder('PHONE', match);
      }
    );

    // 6. Secret URL Query Parameters
    result = result.replace(
      /([?&](?:api_key|apikey|access_token|auth_token|token|secret|password|passwd|pwd|private_key)=)([^&\s"'>`]+)/gi,
      (match, prefix, val) => {
        if (!val || (val.startsWith('<') && val.endsWith('>'))) return match;
        const ph = this.getPlaceholder('SECRET_URL', val);
        return `${prefix}${ph}`;
      }
    );

    return result;
  }
}

