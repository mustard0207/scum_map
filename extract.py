import re
import json

html = open('weapons_ranged.html', encoding='utf-8').read()
links = list(set(re.findall(r'href="(/items/Weapon_[^"]+)\"', html)))
print(f"Found {len(links)} links")
with open('weapon_links.json', 'w', encoding='utf-8') as f:
    json.dump(links, f, indent=2)
