import { SecretStore } from './secret-store.js';

/**
 * ActionValidator module for BROZER (Phase 3).
 * Validates tool actions, target fields, origin context, and placeholder authorization BEFORE secret resolution.
 * Enforces strict fail-closed authorization policies and prohibits secrets in URLs, navigation, or arbitrary scripts.
 */

export class ActionValidator {
  /**
   * Validate a tool call action and its placeholder usage BEFORE secret resolution.
   *
   * @param {Object} context
   * @param {string} context.tool - Tool action name (e.g., 'set_field', 'type_text', 'navigate')
   * @param {Object} context.args - Original tool call arguments containing placeholders
   * @param {string} [context.origin] - Current tab origin (e.g., 'https://example.com')
   * @param {Object} [context.target] - Target DOM element metadata (e.g., { fieldType: 'password', fieldName: 'pwd' })
   * @returns {Object} Validation result { valid: boolean, authorizedPlaceholders: Set<string>, error?: string }
   */
  static validate({ tool, args, origin = '', target = null }) {
    if (!tool || typeof tool !== 'string') {
      return { valid: false, authorizedPlaceholders: new Set(), error: 'Invalid tool action' };
    }

    const placeholders = ActionValidator.extractPlaceholders(args);
    if (placeholders.size === 0) {
      // No placeholders present in arguments; action is valid
      return { valid: true, authorizedPlaceholders: new Set() };
    }

    // Prohibit secret placeholders in navigation or URL actions
    if (['navigate', 'open_tab', 'switch_tab', 'fetch_url'].includes(tool)) {
      return {
        valid: false,
        authorizedPlaceholders: new Set(),
        error: `Secret resolution is strictly prohibited in navigation action: ${tool}`
      };
    }

    // Check for secret placeholders inside URL / query parameter fields
    if (ActionValidator.containsUrlOrScriptField(args)) {
      return {
        valid: false,
        authorizedPlaceholders: new Set(),
        error: 'Secret resolution is strictly prohibited in URL, query parameter, or script fields'
      };
    }

    const authorizedPlaceholders = new Set();

    for (const ph of placeholders) {
      if (!SecretStore.has(ph)) {
        return {
          valid: false,
          authorizedPlaceholders: new Set(),
          error: `Unknown or unregistered placeholder: ${ph}`
        };
      }

      const category = SecretStore.getCategory(ph);
      const isAuth = ActionValidator.checkCategoryAuthorization({
        tool,
        args,
        category,
        target,
        placeholder: ph
      });

      if (!isAuth.authorized) {
        return {
          valid: false,
          authorizedPlaceholders: new Set(),
          error: isAuth.reason || `Unauthorized placeholder usage for category: ${category}`
        };
      }

      authorizedPlaceholders.add(ph);
    }

    return {
      valid: true,
      authorizedPlaceholders
    };
  }

  /**
   * Extract all placeholder tokens (<CATEGORY_N>) from arguments object.
   *
   * @param {Object|Array|string} args
   * @returns {Set<string>} Set of placeholder strings
   */
  static extractPlaceholders(args) {
    const set = new Set();

    function recurse(val) {
      if (typeof val === 'string') {
        const matches = val.match(/<[A-Z0-9_]+_\d+>/g);
        if (matches) {
          matches.forEach(m => set.add(m));
        }
      } else if (Array.isArray(val)) {
        val.forEach(recurse);
      } else if (val && typeof val === 'object') {
        Object.values(val).forEach(recurse);
      }
    }

    recurse(args);
    return set;
  }

  /**
   * Check if any argument key or value looks like a URL, href, or script destination.
   */
  static containsUrlOrScriptField(args) {
    if (!args || typeof args !== 'object') return false;

    const urlKeys = ['url', 'href', 'targetUrl', 'navigation', 'src', 'script', 'query'];

    let found = false;
    function check(obj) {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, val] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        if (urlKeys.some(k => keyLower.includes(k))) {
          if (typeof val === 'string' && /<[A-Z0-9_]+_\d+>/.test(val)) {
            found = true;
            return;
          }
        }
        if (typeof val === 'string') {
          // Check for URL structure http(s):// or ?key=
          if (/https?:\/\//i.test(val) && /<[A-Z0-9_]+_\d+>/.test(val)) {
            found = true;
            return;
          }
        } else if (typeof val === 'object') {
          check(val);
        }
      }
    }

    check(args);
    return found;
  }

  /**
   * Verify category policy vs tool and target field context.
   */
  static checkCategoryAuthorization({ tool, args, category, target }) {
    const fieldName = (args?.fieldName || args?.field || args?.name || target?.fieldName || '').toLowerCase();
    const fieldType = (target?.fieldType || (target?.isPasswordField ? 'password' : '') || '').toLowerCase();

    if (category === 'PASSWORD') {
      if (fieldType === 'password' || fieldName.includes('password') || fieldName.includes('pwd') || fieldName.includes('pass')) {
        return { authorized: true };
      }
      return { authorized: false, reason: 'PASSWORD placeholder allowed only in password input fields' };
    }

    if (category === 'EMAIL') {
      if (fieldName.includes('email') || fieldName.includes('user') || fieldName.includes('login') || fieldName.includes('account') || fieldType === 'email') {
        return { authorized: true };
      }
      return { authorized: false, reason: 'EMAIL placeholder allowed only in email/username fields' };
    }

    if (category === 'PHONE') {
      if (fieldName.includes('phone') || fieldName.includes('mobile') || fieldName.includes('tel') || fieldType === 'tel' || fieldType === 'text') {
        return { authorized: true };
      }
      return { authorized: false, reason: 'PHONE placeholder allowed only in phone contact fields' };
    }

    if (category === 'CARD') {
      if (fieldName.includes('card') || fieldName.includes('payment') || fieldName.includes('credit') || fieldName.includes('cc')) {
        return { authorized: true };
      }
      return { authorized: false, reason: 'CARD placeholder allowed only in payment card fields' };
    }

    if (category === 'API_KEY') {
      if (fieldName.includes('key') || fieldName.includes('api') || fieldName.includes('token') || fieldName.includes('secret')) {
        return { authorized: true };
      }
      return { authorized: false, reason: 'API_KEY placeholder allowed only in authorized key/token fields' };
    }

    // Default authorization for general secrets in standard field input tools
    if (['set_field', 'type_text', 'type_ax', 'input'].includes(tool)) {
      return { authorized: true };
    }

    return { authorized: false, reason: `Unauthorized action ${tool} for category ${category}` };
  }
}
