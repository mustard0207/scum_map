from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

def check():
    with open('weapons_data/Weapon_SVD_Dragunov.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Let's find COMPATIBILITY MATRIX
    matrix_header = soup.find(lambda tag: tag.name == 'h2' and 'COMPATIBILITY MATRIX' in tag.get_text())
    if matrix_header:
        matrix_container = matrix_header.parent
        # Print all links under SCOPE or ATTACHMENTS
        print("ALL LINKS:")
        for a in matrix_container.find_all('a', href=True):
            # Print the text and href
            print(f"Text: {a.get_text(strip=True)} | Href: {a['href']}")
            
if __name__ == "__main__":
    check()
