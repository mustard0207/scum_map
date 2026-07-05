import json
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def print_mapping():
    with open('scum_weapons_data_cropped.json', 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    with open('scum_weapons_data_zh.json', 'r', encoding='utf-8') as f:
        zh_data = json.load(f)
        
    # Build maps of Eng -> Zh
    mapping = {}
    for en_item, zh_item in zip(en_data, zh_data):
        en_scopes = en_item.get('Scopes', [])
        zh_scopes = zh_item.get('远瞄镜 (高倍镜)', [])
        for e, z in zip(en_scopes, zh_scopes):
            mapping[e] = z
            
    print("Unique Scopes Mapping:")
    for e, z in sorted(mapping.items()):
        print(f" - {e}  ==>  {z}")

if __name__ == "__main__":
    print_mapping()
