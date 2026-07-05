from bs4 import BeautifulSoup
import re
import sys

# Windows console encoding fix
sys.stdout.reconfigure(encoding='utf-8')

def test():
    with open('weapons_data/Weapon_AK15.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    print("H1:", soup.find('h1').get_text(strip=True) if soup.find('h1') else 'No H1')
    
    # Just print all the tactical-stat values
    print("----- tactical-stat -----")
    for stat in soup.find_all(class_=lambda x: x and 'tactical-stat' in x):
        # The label is usually the previous sibling or somewhere nearby
        parent = stat.parent
        print(parent.get_text(separator=' | ', strip=True))

if __name__ == "__main__":
    test()
