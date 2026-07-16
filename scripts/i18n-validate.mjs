import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '../src/i18n/locales');
const pt = JSON.parse(fs.readFileSync(path.join(localesDir, 'pt-BR.json'), 'utf-8'));
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en-US.json'), 'utf-8'));
const es = JSON.parse(fs.readFileSync(path.join(localesDir, 'es-ES.json'), 'utf-8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], prefix + k + '.'));
    } else {
      keys.push(prefix + k);
    }
  }
  return keys;
}

const ptKeys = new Set(getKeys(pt));
const enKeys = new Set(getKeys(en));
const esKeys = new Set(getKeys(es));

let hasErrors = false;

function compareSets(base, target, baseName, targetName) {
  const missing = [];
  for (const k of base) {
    if (!target.has(k)) {
      missing.push(k);
    }
  }
  if (missing.length > 0) {
    console.error(`\n[!] ${missing.length} keys found in ${baseName} but missing in ${targetName}:`);
    missing.slice(0, 20).forEach(k => console.error(`  - ${k}`));
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more.`);
    hasErrors = true;
  }
}

compareSets(ptKeys, enKeys, 'pt-BR', 'en-US');
compareSets(ptKeys, esKeys, 'pt-BR', 'es-ES');
compareSets(enKeys, ptKeys, 'en-US', 'pt-BR');
compareSets(esKeys, ptKeys, 'es-ES', 'pt-BR');

if (!hasErrors) {
  console.log('Success: All locale files are perfectly synchronized in keys!');
} else {
  process.exit(1);
}
