import os
import re
import json

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {"error": str(e)}
    
    # Extract imports
    imports = re.findall(r'import\s+.*?\s+from\s+[\'"](.*?)[\'"]', content)
    
    # Extract hooks
    hooks = set(re.findall(r'\b(use[A-Z][a-zA-Z0-9_]*)\b', content))
    
    # Extract routing
    links = re.findall(r'<Link\s+[^>]*to=[\'"]([^\'"]+)[\'"]', content)
    links_dynamic = re.findall(r'<Link\s+[^>]*to=\{([^\}]+)\}', content)
    navigates = re.findall(r'navigate\([\'"]([^\'"]+)[\'"]\)', content)
    navigates_dynamic = re.findall(r'navigate\((.*?)\)', content)
    
    # Try to find component name
    component_match = re.search(r'(?:export\s+default\s+function|const)\s+([A-Z][a-zA-Z0-9_]+)', content)
    component = component_match.group(1) if component_match else "Unknown"
    
    return {
        "component": component,
        "imports": list(set(imports)),
        "hooks": list(hooks),
        "links": list(set(links + links_dynamic)),
        "navigates": list(set(navigates + [n for n in navigates_dynamic if n not in navigates])),
        "size": len(content)
    }

def main():
    base_dirs = ['src/layouts', 'src/pages']
    results = {}
    
    for base_dir in base_dirs:
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                if file.endswith('.tsx') or file.endswith('.jsx'):
                    filepath = os.path.join(root, file)
                    rel_path = os.path.relpath(filepath, 'src').replace('\\', '/')
                    results[rel_path] = analyze_file(filepath)
                    
    with open('pages_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

if __name__ == '__main__':
    main()
