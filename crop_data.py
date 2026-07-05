import json
import csv
import re

def simplify_ammo(ammo_name):
    match = re.match(r'^(\.\d+(?:-\d+)?(?:\s+(?:ACP|AE|BMG))?|\d+(?:\.\d+)?x\d+mm[R]?|\d+mm)', ammo_name)
    if match:
        return match.group(1).strip()
    
    if '12 Gauge' in ammo_name or 'Shotgun' in ammo_name:
        return '12 Gauge'
    
    if '40x46' in ammo_name:
        return '40x46mm'
        
    if 'Arrow' in ammo_name:
        return 'Arrow'
        
    if 'Bolt' in ammo_name:
        return 'Crossbow Bolt'
        
    if 'Flare' in ammo_name:
        return 'Flare'
        
    if ammo_name in ['OG-7V', 'PG-7M']:
        return 'RPG Rocket'
        
    return ammo_name

def is_rail(item_name):
    return "rail" in item_name.lower() or "rail" in item_name or "RIS Adapter" in item_name

def crop():
    # Read the final data
    with open('scum_weapons_data_final.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    keys_to_remove = ['Rarity', 'Muzzle Velocity (m/s)', 'Armor Penetration', 'Other', 'Total Slots']
    
    cropped_data = []
    for item in data:
        new_item = {k: v for k, v in item.items() if k not in keys_to_remove}
        
        # Simplify Ammunition list
        if 'Ammunition' in new_item and isinstance(new_item['Ammunition'], list):
            simplified = sorted(list(set(simplify_ammo(a) for a in new_item['Ammunition'])))
            new_item['Ammunition'] = simplified
            
        # Clean Sights, Scopes, and Rails (move rails to Rails category)
        sights = new_item.get('Sights', [])
        scopes = new_item.get('Scopes', [])
        rails = new_item.get('Rails', [])
        
        cleaned_sights = []
        cleaned_scopes = []
        cleaned_rails = list(rails)
        
        for s in sights:
            if is_rail(s):
                if s not in cleaned_rails:
                    cleaned_rails.append(s)
            else:
                cleaned_sights.append(s)
                
        for s in scopes:
            if is_rail(s):
                if s not in cleaned_rails:
                    cleaned_rails.append(s)
            else:
                cleaned_scopes.append(s)
                
        new_item['Sights'] = cleaned_sights
        new_item['Scopes'] = cleaned_scopes
        new_item['Rails'] = cleaned_rails
        
        cropped_data.append(new_item)
        
    # Save as cropped JSON
    with open('scum_weapons_data_cropped.json', 'w', encoding='utf-8') as f:
        json.dump(cropped_data, f, indent=2, ensure_ascii=False)
        
    # Save as cropped CSV
    if not cropped_data:
        return
        
    csv_data = []
    for row in cropped_data:
        csv_row = {}
        for k, v in row.items():
            if isinstance(v, list):
                csv_row[k] = ', '.join(v)
            else:
                csv_row[k] = v
        csv_data.append(csv_row)
        
    keys = list(csv_data[0].keys())
    with open('scum_weapons_data_cropped.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(csv_data)
        
    print(f"Cropped data updated with {len(cropped_data)} weapons (simplified Ammunition and cleaned Rails).")

if __name__ == "__main__":
    crop()
