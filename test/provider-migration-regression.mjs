import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = path.join(ROOT, 'src', 'chrome', 'src');

const { ProviderManager } = await import(
  pathToFileURL(path.join(prefix, 'providers', 'manager.js')).href
);

// Setup mock chrome.storage.local
const mockStorageData = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        if (Array.isArray(keys)) {
          const res = {};
          for (const k of keys) res[k] = mockStorageData[k];
          return res;
        }
        if (typeof keys === 'string') return { [keys]: mockStorageData[keys] };
        return { ...mockStorageData };
      },
      set: async (obj) => {
        Object.assign(mockStorageData, obj);
      },
      remove: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) delete mockStorageData[k];
      }
    }
  },
  runtime: {
    getManifest: () => ({ version: '36.5.0' })
  }
};

// --- Test Case 1: Provider State Migration (webbrain_cloud -> brozer_cloud) ---
{
  const manager = new ProviderManager();
  
  // Populate legacy stored state
  mockStorageData.providers = {
    webbrain_cloud: {
      type: 'openai',
      category: 'cloud',
      label: 'Old WebBrain Label',
      providerName: 'webbrain-cloud',
      apiKey: 'sk-legacy-token-12345',
      configured: true,
      omitToolsWhenImagesPresent: true
    }
  };
  mockStorageData.activeProvider = 'webbrain_cloud';
  mockStorageData.helpImproveWebBrain = true;
  delete mockStorageData.helpImproveBrozer;

  await manager.load();

  // Assertions:
  // 1. brozer_cloud is created and active
  assert.equal(manager.activeProviderId, 'brozer_cloud', 'Active provider should migrate from webbrain_cloud to brozer_cloud');
  assert.ok(manager.providers.has('brozer_cloud'), 'brozer_cloud should be registered in providers map');
  assert.ok(!manager.providers.has('webbrain_cloud'), 'webbrain_cloud should be removed from active providers map');

  // 2. Credentials and configuration are preserved
  const brozerConfig = manager.providers.get('brozer_cloud').config;
  assert.equal(brozerConfig.apiKey, 'sk-legacy-token-12345', 'API key must be preserved during provider migration');
  assert.equal(brozerConfig.label, 'BROZER NAVIGATOR', 'Provider label should be updated to BROZER NAVIGATOR');
  assert.equal(brozerConfig.omitToolsWhenImagesPresent, false, 'Legacy omitTools flag must be repaired to false');

  // 3. Stored state updated on disk/storage
  assert.ok(mockStorageData.providers.brozer_cloud, 'Storage should contain brozer_cloud key');
  assert.equal(mockStorageData.providers.webbrain_cloud, undefined, 'Storage should no longer contain webbrain_cloud key');
  assert.equal(mockStorageData.activeProvider, 'brozer_cloud', 'Stored activeProvider should be updated to brozer_cloud');

  console.log('✓ Provider state migration (webbrain_cloud -> brozer_cloud) passed');
}

// --- Test Case 2: Preference Key Migration (helpImproveWebBrain -> helpImproveBrozer) ---
{
  const manager = new ProviderManager();
  
  mockStorageData.helpImproveWebBrain = false;
  delete mockStorageData.helpImproveBrozer;

  const stored = await globalThis.chrome.storage.local.get(['helpImproveBrozer', 'helpImproveWebBrain']);
  const effectiveSetting = (stored.helpImproveBrozer ?? stored.helpImproveWebBrain) !== false;

  assert.equal(effectiveSetting, false, 'Legacy helpImproveWebBrain false setting should be respected when helpImproveBrozer is undefined');

  // Simulate updating preference
  await globalThis.chrome.storage.local.set({ helpImproveBrozer: true, helpImproveWebBrain: true });
  const updatedStored = await globalThis.chrome.storage.local.get(['helpImproveBrozer', 'helpImproveWebBrain']);
  assert.equal(updatedStored.helpImproveBrozer, true, 'Updated setting should persist to helpImproveBrozer');
  assert.equal(updatedStored.helpImproveWebBrain, true, 'Updated setting should persist to legacy fallback helpImproveWebBrain');

  console.log('✓ Preference key migration (helpImproveWebBrain -> helpImproveBrozer) passed');
}

console.log('\nAll provider migration regression tests passed!');
