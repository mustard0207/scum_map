import json
from collections import Counter

def check():
    with open('scum_weapons_data_full.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total items: {len(data)}")
    
    # Check for empty attachment fields
    empty_mags = 0
    empty_ammo = 0
    empty_scopes = 0
    
    no_damage = 0
    
    for item in data:
        name = item['Name']
        if item.get('Damage') == 'N/A':
            no_damage += 1
            print(f"[Warning] No Damage found for: {name}")
            
        if not item.get('Magazines'):
            empty_mags += 1
        if not item.get('Ammunition'):
            empty_ammo += 1
            print(f"[Warning] No Ammunition found for: {name}")
            
    print(f"\nItems with no Damage: {no_damage}/{len(data)}")
    print(f"Items with no Magazines: {empty_mags}/{len(data)}")
    print(f"Items with no Ammunition: {empty_ammo}/{len(data)}")
    
    # Check a specific bow to see if arrows were populated
    print("\nCheck Compound Bow:")
    for item in data:
        if 'Compound Bow' in item['Name']:
            print("  Name:", item['Name'])
            print("  Ammo:", item.get('Ammunition')[:3], '...' if len(item.get('Ammunition', [])) > 3 else '')
            print("  Sights:", item.get('Sights'))
            print("  Other:", item.get('Other')[:3])
            
    # Check RPG
    print("\nCheck RPG-7:")
    for item in data:
        if 'RPG' in item['Name'] or 'RPG-7' in item['Name']:
            print("  Name:", item['Name'])
            print("  Ammo:", item.get('Ammunition'))
            
if __name__ == "__main__":
    check()
