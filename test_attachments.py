from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test():
    with open('weapons_data/Weapon_AK15.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # We are looking for sections like "Compatible Ammunition", "Compatible Magazines", "Compatible Attachments"
    headings = soup.find_all('h2')
    for h2 in headings:
        heading_text = h2.get_text(strip=True)
        print("Section:", heading_text)
        
        # The content for this section is usually in the DOM after the heading.
        # Often it's a sibling div containing a list of cards or links
        # Let's find links inside the parent or next sibling
        # Usually, sections are in a container. Let's look at the parent container
        parent = h2.parent
        if parent:
            # try to find all links in this container
            links = parent.find_all('a', href=True)
            for link in links:
                # print the name of the compatible item
                print("  -", link.get_text(strip=True), "->", link['href'])

if __name__ == "__main__":
    test()
