import os
import glob
from bs4 import BeautifulSoup
import json
import csv

def parse_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    data = {}
    
    h1 = soup.find('h1')
    weapon_name = h1.get_text(strip=True) if h1 else os.path.basename(filepath)
    data['Name'] = weapon_name
    
    stats = {}
    for stat in soup.find_all(class_=lambda x: x and 'tactical-stat' in x):
        parent = stat.parent
        parts = parent.get_text(separator='|', strip=True).split('|')
        if len(parts) >= 2:
            label = parts[0].replace(':', '').strip()
            value = " ".join(parts[1:]).strip().replace('ℹ️', '').strip()
            stats[label] = value
            
    data['Damage'] = stats.get('Damage', stats.get('Projectile damage', 'N/A'))
    data['Fire Rate (RPM)'] = stats.get('Fire rate (RPM)', 'N/A')
    data['Effective Range (m)'] = stats.get('Effective Range', 'N/A').replace(' m', '')
    data['Muzzle Velocity (m/s)'] = stats.get('Muzzle velocity', 'N/A').replace(' m/s', '')
    data['Armor Penetration'] = stats.get('Armor penetration', 'N/A')
    data['Caliber'] = stats.get('Caliber', 'N/A')
    data['Weight (kg)'] = stats.get('Weight', 'N/A').replace(' kg', '')
    data['Grid Size'] = stats.get('Grid Size', 'N/A')
    data['Total Slots'] = stats.get('Total Slots', 'N/A').replace(' slots', '')
    data['Rarity'] = stats.get('Rarity', 'N/A')
    
    compat = {
        'Magazines': [],
        'Ammunition': [],
        'Sights': [],
        'Scopes': [],
        'Suppressors': [],
        'Flashlights': [],
        'Bayonets': [],
        'Rails': [],
        'Other': []
    }
    
    matrix_header = soup.find(lambda tag: tag.name == 'h2' and 'COMPATIBILITY MATRIX' in tag.get_text())
    if matrix_header:
        matrix_container = matrix_header.parent
        current_cat = 'Other'
        for element in matrix_container.descendants:
            if element.name in ['h3', 'h4']:
                text = element.get_text(strip=True).upper()
                if 'MAGAZINES' in text: current_cat = 'Magazines'
                elif 'AMMUNITION' in text: current_cat = 'Ammunition'
                elif 'FLASHLIGHT' in text: current_cat = 'Flashlights'
                elif 'SCOPE' in text: current_cat = 'Scopes'
                elif 'SIGHT' in text: current_cat = 'Sights'
                elif 'SUPPRESSOR' in text: current_cat = 'Suppressors'
                elif 'BAYONET' in text or 'MELEE' in text: current_cat = 'Bayonets'
                elif 'RAIL' in text: current_cat = 'Rails'
                elif 'GHILLIE' in text or 'CHARMS' in text or 'OTHER' in text: current_cat = 'Other'
                
            elif element.name == 'a' and element.get('href', '').startswith('/items/'):
                href = element['href']
                name_el = element.find(class_=lambda x: x and 'truncate' in x)
                name = name_el.get_text(strip=True) if name_el else element.get_text(strip=True)
                
                # Apply POSP correction
                if href == '/items/WeaponScope_Dragunov':
                    if weapon_name in ['SVD', 'AS Val', 'VSS VZ']:
                        name = 'POSP 4X24V Scope'
                    else:
                        name = 'P-223 Scope'
                
                if name not in compat[current_cat]:
                    compat[current_cat].append(name)
                    
    data.update(compat)
    return data

def run():
    files = glob.glob('weapons_data/*.html')
    all_data = []
    
    for f in files:
        all_data.append(parse_html(f))
        
    all_data.sort(key=lambda x: x['Name'])
    
    # Save to JSON
    with open('scum_weapons_data_final.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
        
    if not all_data:
        return
        
    csv_data = []
    for row in all_data:
        csv_row = {}
        for k, v in row.items():
            if isinstance(v, list):
                csv_row[k] = ', '.join(v)
            else:
                csv_row[k] = v
        csv_data.append(csv_row)
        
    keys = list(csv_data[0].keys())
    with open('scum_weapons_data_final.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(csv_data)
        
    print(f"Cleaned and saved {len(all_data)} weapons to JSON and CSV.")

if __name__ == "__main__":
    run()
