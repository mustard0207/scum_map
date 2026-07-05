import json
from bs4 import BeautifulSoup
import re

def parse_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    data = {}
    
    # Weapon Name
    h1 = soup.find('h1')
    data['Name'] = h1.get_text(strip=True) if h1 else 'Unknown'
    
    # Base stats (already tested)
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
    
    # Attachments
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
    
    # Find COMPATIBILITY MATRIX
    matrix_header = soup.find(lambda tag: tag.name == 'h2' and 'COMPATIBILITY MATRIX' in tag.get_text())
    if matrix_header:
        matrix_container = matrix_header.parent
        # The structure is usually: h2 (COMPATIBILITY MATRIX), then maybe some sub-headers like 'MAGAZINES', 'AMMUNITION', 'ATTACHMENTS'
        # Inside ATTACHMENTS, there are smaller headers like 'FLASHLIGHT', 'SCOPE', 'SIGHT', 'SUPPRESSOR'
        # The items are usually links (<a> tags)
        
        # Let's group links by the nearest preceding text that indicates a category.
        # A simple way: find all a tags. Find the closest preceding heading-like element (e.g. h3, or a text block that is uppercase like 'SCOPE')
        # Wait, the structure is:
        # <h3 class="text-sm font-bold text-tactical-slate-300 uppercase mb-4 flex items-center gap-2">MAGAZINES <span ...></span></h3>
        # Let's find all h3s
        h3s = matrix_container.find_all('h3')
        for h3 in h3s:
            cat_name = h3.get_text(strip=True).upper()
            
            # The items are inside the h3's next sibling or parent's sibling.
            # Usually h3 is inside a div, and next to it is the grid of items
            parent_div = h3.parent
            if parent_div:
                # get all links in this section
                links = parent_div.find_all('a')
                items = [link.find('h3').get_text(strip=True) if link.find('h3') else link.get_text(strip=True) for link in links]
                
                # We need to clean up the item text, sometimes it has CAL: 7.62x39mm attached to it if we just get_text() on the link.
                # If we get link.find('h3') or link.find('span', class_='truncate'), it gets just the name.
                clean_items = []
                for link in links:
                    name_el = link.find(class_=lambda x: x and 'truncate' in x)
                    if name_el:
                        clean_items.append(name_el.get_text(strip=True))
                    else:
                        clean_items.append(link.get_text(strip=True))
                
                # Now categorize based on cat_name
                # categories: MAGAZINES, AMMUNITION, ATTACHMENTS
                # Wait, ATTACHMENTS has sub-categories like FLASHLIGHT, SCOPE, etc.
                # Let's see if those sub-categories are h4s or what
                pass
                
        # Better approach: walk through all text/links in matrix_container
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
                name_el = element.find(class_=lambda x: x and 'truncate' in x)
                name = name_el.get_text(strip=True) if name_el else element.get_text(strip=True)
                
                if name not in compat[current_cat]:
                    compat[current_cat].append(name)
                    
    data.update(compat)
    return data

print(json.dumps(parse_html("weapons_data/Weapon_AK15.html"), indent=2, ensure_ascii=False))
