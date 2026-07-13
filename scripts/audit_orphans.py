import os
import re

SRC_DIR = './src'
SUPABASE_DIR = './supabase'
DOCS_DIR = './docs'

def get_all_files(directory, exts):
    file_list = []
    if not os.path.exists(directory):
        return file_list
    for root, dirs, files in os.walk(directory):
        for file in files:
            if any(file.endswith(ext) for ext in exts):
                # normalize path to posix style with leading ./ removed if any, but since we start with './', let's format consistently.
                # os.walk uses backslashes on windows.
                file_path = os.path.join(root, file).replace('\\', '/')
                # remove leading './' to match the frontmatter style easily which usually starts with 'src/' or 'supabase/'
                if file_path.startswith('./'):
                    file_path = file_path[2:]
                file_list.append(file_path)
    return file_list

all_code_files = get_all_files(SRC_DIR, ['.ts', '.tsx']) + get_all_files(SUPABASE_DIR, ['.ts', '.sql'])

def get_documented_files():
    doc_files = get_all_files(DOCS_DIR, ['.md'])
    code_refs = set()
    
    for doc in doc_files:
        with open(doc, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'code_refs:\s*\n([\s\S]*?)(?:^[a-z_-]+:|\n---)', content, re.MULTILINE)
            if match:
                lines = match.group(1).split('\n')
                for line in lines:
                    ref_match = re.match(r'^\s*-\s*(.+)$', line)
                    if ref_match:
                        ref = ref_match.group(1).strip()
                        # normalize
                        if ref.startswith('./'):
                            ref = ref[2:]
                        code_refs.add(ref)
    return list(code_refs)

documented = get_documented_files()
orphans = []

for file in all_code_files:
    is_documented = False
    for ref in documented:
        if file == ref or file.startswith(ref):
            is_documented = True
            break
    if not is_documented:
        orphans.append(file)

print(f"Total code files: {len(all_code_files)}")
print(f"Documented references: {len(documented)}")
print(f"Orphan files: {len(orphans)}")

os.makedirs('./docs/_audit', exist_ok=True)
with open('./docs/_audit/orphans.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(orphans))
print("Orphan list saved to docs/_audit/orphans.txt")
