import fs from 'fs';
import path from 'path';

const SRC_DIR = './src';
const SUPABASE_DIR = './supabase';
const DOCS_DIR = './docs';

function getAllFiles(dir, exts, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, exts, fileList);
    } else {
      if (exts.some(ext => filePath.endsWith(ext))) {
        fileList.push(filePath.replace(/\\/g, '/'));
      }
    }
  }
  return fileList;
}

const allCodeFiles = [
  ...getAllFiles(SRC_DIR, ['.ts', '.tsx']),
  ...getAllFiles(SUPABASE_DIR, ['.ts', '.sql'])
];

function getDocumentedFiles() {
  const docFiles = getAllFiles(DOCS_DIR, ['.md']);
  const codeRefs = new Set();
  
  for (const doc of docFiles) {
    const content = fs.readFileSync(doc, 'utf-8');
    const match = content.match(/code_refs:\s*\n([\s\S]*?)(?:^[a-z_-]+:|\n---)/m);
    if (match) {
      const lines = match[1].split('\n');
      for (const line of lines) {
        const refMatch = line.match(/^\s*-\s*(.+)$/);
        if (refMatch) {
          codeRefs.add(refMatch[1].trim());
        }
      }
    }
  }
  return Array.from(codeRefs);
}

const documented = getDocumentedFiles();

const orphans = allCodeFiles.filter(file => {
  // file looks like src/pages/Index.tsx
  for (const ref of documented) {
    // ref looks like src/pages/ ou src/pages/Index.tsx
    if (file === ref || file.startsWith(ref)) return false;
  }
  return true;
});

console.log(`Total code files: ${allCodeFiles.length}`);
console.log(`Documented references: ${documented.length}`);
console.log(`Orphan files: ${orphans.length}`);

if (!fs.existsSync('./docs/_audit')) {
  fs.mkdirSync('./docs/_audit', { recursive: true });
}
fs.writeFileSync('./docs/_audit/orphans.txt', orphans.join('\n'));
console.log('Orphan list saved to docs/_audit/orphans.txt');
