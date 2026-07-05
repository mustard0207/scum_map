from bs4 import BeautifulSoup

def parse_scopes(filepath, weapon_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    soup = BeautifulSoup(html, 'html.parser')
    
    scopes = []
    matrix_header = soup.find(lambda tag: tag.name == 'h2' and 'COMPATIBILITY MATRIX' in tag.get_text())
    if matrix_header:
        matrix_container = matrix_header.parent
        # Walk and find SCOPE links
        current_cat = 'Other'
        for element in matrix_container.descendants:
            if element.name in ['h3', 'h4']:
                text = element.get_text(strip=True).upper()
                if 'SCOPE' in text:
                    current_cat = 'Scopes'
                elif 'SIGHT' in text or 'SUPPRESSOR' in text or 'MAGAZINES' in text or 'AMMUNITION' in text:
                    current_cat = 'Other'
            elif element.name == 'a' and element.get('href', '').startswith('/items/') and current_cat == 'Scopes':
                href = element['href']
                name_el = element.find(class_=lambda x: x and 'truncate' in x)
                name = name_el.get_text(strip=True) if name_el else element.get_text(strip=True)
                
                # Apply correction:
                if href == '/items/WeaponScope_Dragunov':
                    if weapon_name in ['SVD', 'AS Val', 'VSS VZ']:
                        name = 'POSP 4X24V Scope'
                    else:
                        name = 'P-223 Scope'
                        
                if name not in scopes:
                    scopes.append(name)
    return scopes

print("SVD Scopes:", parse_scopes('weapons_data/Weapon_SVD_Dragunov.html', 'SVD'))
print("MK18 Scopes:", parse_scopes('weapons_data/Weapon_MK18.html', 'MK18'))
