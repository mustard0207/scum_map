import os
import glob
from bs4 import BeautifulSoup

def check_p223_links():
    files = glob.glob('weapons_data/*.html')
    links = {}
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            html = f.read()
        soup = BeautifulSoup(html, 'html.parser')
        
        matrix_header = soup.find(lambda tag: tag.name == 'h2' and 'COMPATIBILITY MATRIX' in tag.get_text())
        if matrix_header:
            matrix_container = matrix_header.parent
            for a in matrix_container.find_all('a', href=True):
                # If text contains "P-223"
                text = a.get_text(strip=True)
                if "P-223" in text:
                    links[a['href']] = links.get(a['href'], []) + [os.path.basename(filepath)]
                    
    for href, weapons in links.items():
        print(f"Href: {href} is mapped to 'P-223 Scope' in {len(weapons)} weapons:")
        print("  Weapons:", weapons[:5], '...' if len(weapons) > 5 else '')

if __name__ == "__main__":
    check_p223_links()
