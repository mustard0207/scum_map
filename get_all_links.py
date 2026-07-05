from bs4 import BeautifulSoup
import json

def get_weapon_links():
    with open('weapons_ranged.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Each weapon card is an 'a' tag with class containing 'item-card'
    # Actually they look like: <a class="... group/item-card ..." href="/items/...">
    cards = soup.find_all('a', class_=lambda x: x and 'group/item-card' in x)
    
    links = []
    for card in cards:
        href = card.get('href')
        if href and href not in links:
            links.append(href)
            
    print(f"Total weapon cards found: {len(links)}")
    
    with open('weapon_links.json', 'w', encoding='utf-8') as f:
        json.dump(links, f, indent=2)

if __name__ == "__main__":
    get_weapon_links()
