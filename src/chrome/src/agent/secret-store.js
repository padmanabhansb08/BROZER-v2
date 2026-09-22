/**
 * Memory-only SecretStore module for WebBrain (Phase 3).
 * Manages session secret vault mappings (<PLACEHOLDER_N> -> rawSecret) strictly in memory.
 * Enforces zero persistence (no IndexedDB, chrome.storage.local, or disk serialization)
 * and omits inspection APIs (no dump, export, toJSON, entries, or console log leaks).
 */

export class SecretStore {
  /**
   * Memory-only storage map for the current session.
   * @private
   */
  static _vault = new Map();

  /**
   * Register a raw secret mapping for a placeholder.
   *
   * @param {string} placeholder - Session placeholder (e.g. "<EMAIL_1>", "<PASSWORD_1>")
   * @param {string} rawSecret - Raw sensitive secret string
   * @param {string} [category] - PII category (EMAIL, PASSWORD, CARD, API_KEY, etc.)
   * @param {Object} [metadata] - Optional session metadata
   */
  static register(placeholder, rawSecret, category = 'SECRET', metadata = {}) {
    if (!placeholder || typeof placeholder !== 'string' || !rawSecret || typeof rawSecret !== 'string') {
      return;
    }
    SecretStore._vault.set(placeholder, {
      rawSecret,
      category,
      createdAt: Date.now(),
      used: false,
      singleUse: ['PASSWORD', 'CARD', 'API_KEY'].includes(category),
      metadata
    });
  }

  /**
   * Check if a placeholder is registered in the vault.
   *
   * @param {string} placeholder
   * @returns {boolean}
   */
  static has(placeholder) {
    return SecretStore._vault.has(placeholder);
  }

  /**
   * Resolve a single placeholder to its raw secret value.
   *
   * @param {string} placeholder
   * @returns {string|null} Raw secret or null if unregistered/expired
   */
  static resolve(placeholder) {
    const entry = SecretStore._vault.get(placeholder);
    if (!entry) return null;

    if (entry.singleUse && entry.used) {
      // Single-use credential already consumed
      return null;
    }

    entry.used = true;
    return entry.rawSecret;
  }

  /**
   * Get placeholder category.
   *
   * @param {string} placeholder
   * @returns {string|null}
   */
  static getCategory(placeholder) {
    const entry = SecretStore._vault.get(placeholder);
    return entry ? entry.category : null;
  }

  /**
   * Replace authorized placeholders in tool arguments with raw secret values.
   * Creates a deep-copy object with resolved secrets for immediate local execution.
   *
   * @param {Object|Array|string} args - Tool arguments
   * @param {Set<string>|Array<string>} authorizedPlaceholders - Allowed placeholders from ActionValidator
   * @returns {Object|Array|string} Deep copy with resolved secret values
   */
  static resolvePlaceholders(args, authorizedPlaceholders = new Set()) {
    const authSet = authorizedPlaceholders instanceof Set
      ? authorizedPlaceholders
      : new Set(authorizedPlaceholders);

    return SecretStore._deepResolve(args, authSet);
  }

  static _deepResolve(target, authSet) {
    if (typeof target === 'string') {
      let resolvedText = target;
      // Match placeholder pattern <CATEGORY_N>
      resolvedText = resolvedText.replace(/(?<!\\)<[A-Z0-9_]+_\d+>/g, (match) => {
        if (authSet.has(match) && SecretStore.has(match)) {
          const raw = SecretStore.resolve(match);
          return raw !== null ? raw : match;
        }
        return match;
      });
      // Unescape literal placeholder text
      resolvedText = resolvedText.replace(/\\(<[A-Z0-9_]+_\d+>)/g, '$1');
      return resolvedText;
    }

    if (Array.isArray(target)) {
      return target.map(item => SecretStore._deepResolve(item, authSet));
    }

    if (target && typeof target === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(target)) {
        result[key] = SecretStore._deepResolve(val, authSet);
      }
      return result;
    }

    return target;
  }

  /**
   * Purge all registered session secrets from memory vault.
   */
  static clearSessionSecrets() {
    SecretStore._vault.clear();
  }

  /**
   * Override toJSON to prevent secret leaks during JSON.stringify.
   */
  static toJSON() {
    return '[SecretStore Memory-Only Vault]';
  }

  /**
   * Custom inspect to prevent console.log leaks.
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return '[SecretStore Memory-Only Vault]';
  }
}
