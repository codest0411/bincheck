import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} BincheckConfig
 * @property {'error' | 'warn' | 'never'} failOn Threshold for non-zero exit code
 * @property {Map<string, string>} ignore Map of rule IDs to mandatory justification reason
 */

const ALLOWED_FAIL_ON = new Set(['error', 'warn', 'never']);
const ALLOWED_CONFIG_KEYS = new Set(['failOn', 'ignore']);

/**
 * Loads and strictly validates configuration from a file or defaults.
 * Prototype-pollution safe using Set and Map.
 *
 * @param {string} [configPath] Optional explicit path to configuration file
 * @param {string} [packageDir=process.cwd()] Directory to search for .bincheckrc.json
 * @returns {BincheckConfig}
 */
export function loadConfig(configPath, packageDir = process.cwd()) {
  let targetPath = configPath;
  if (!targetPath) {
    const defaultRc = path.join(packageDir, '.bincheckrc.json');
    if (fs.existsSync(defaultRc)) {
      targetPath = defaultRc;
    }
  }

  const result = {
    failOn: /** @type {'error' | 'warn' | 'never'} */ ('error'),
    ignore: new Map()
  };

  if (!targetPath) {
    return result;
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Specified config file does not exist: ${targetPath}`);
  }

  let content;
  try {
    content = fs.readFileSync(targetPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read config file: ${err instanceof Error ? err.message : String(err)}`);
  }

  let rawJson;
  try {
    rawJson = JSON.parse(content);
  } catch (err) {
    throw new Error(`Malformed JSON in config file: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof rawJson !== 'object' || rawJson === null || Array.isArray(rawJson)) {
    throw new Error('Config file must contain a JSON object at root.');
  }

  // Strict property validation
  for (const key of Object.keys(rawJson)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`Forbidden property in config: ${key}`);
    }
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new Error(`Unknown configuration key: "${key}". Allowed keys: ${Array.from(ALLOWED_CONFIG_KEYS).join(', ')}`);
    }
  }

  if (rawJson.failOn !== undefined) {
    if (typeof rawJson.failOn !== 'string' || !ALLOWED_FAIL_ON.has(rawJson.failOn)) {
      throw new Error(`Invalid "failOn" value: "${rawJson.failOn}". Must be one of: error, warn, never.`);
    }
    result.failOn = rawJson.failOn;
  }

  if (rawJson.ignore !== undefined) {
    if (typeof rawJson.ignore !== 'object' || rawJson.ignore === null || Array.isArray(rawJson.ignore)) {
      throw new Error('"ignore" field must be an object mapping rule IDs to justification reasons.');
    }

    for (const [ruleId, reason] of Object.entries(rawJson.ignore)) {
      if (ruleId === '__proto__' || ruleId === 'constructor' || ruleId === 'prototype') {
        continue;
      }
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new Error(`Ignored rule "${ruleId}" requires a non-empty string justification reason.`);
      }
      result.ignore.set(ruleId.toUpperCase(), reason.trim());
    }
  }

  return result;
}
