import json

with open('scum_weapons_data_final.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    
all_ammo = set()
for item in data:
    for ammo in item.get('Ammunition', []):
        all_ammo.add(ammo)
        
print("All unique Ammunition names:")
for a in sorted(all_ammo):
    print(" -", a)
