import re
import json

html = open('weapons_ranged.html', encoding='utf-8').read()

# Let's find all links starting with /items/
links = list(set(re.findall(r'href="(/items/[^"?]+)', html)))

print(f"Total /items/ links found: {len(links)}")

# Let's see what they start with if not Weapon_
non_weapon = [l for l in links if not l.startswith('/items/Weapon_')]
print("Non-Weapon links:", len(non_weapon))
for l in non_weapon:
    print(l)
    
# Let's specifically look for Bows or Explosives by searching their names
print("Snippets containing Bow:")
for m in re.finditer(r'.{0,40}bow.{0,40}', html.lower()):
    print(m.group(0))

