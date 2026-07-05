from playwright.sync_api import sync_playwright
import time

def test_fetch():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page = context.new_page()
        
        print("Navigating to AK15...")
        page.goto("https://scum-db.com/items/Weapon_AK15", wait_until="networkidle", timeout=60000)
        
        # Scroll to bottom to trigger any lazy loading
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(2)
        
        content = page.content()
        with open("weapons_data/Weapon_AK15_full.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        # extract all links inside the new html to see if there are magazines
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        links = soup.find_all('a')
        print(f"Total links: {len(links)}")
        for link in links:
            text = link.get_text(strip=True)
            href = link.get('href', '')
            if 'magazine' in text.lower() or 'scope' in text.lower() or 'optic' in text.lower():
                print(f"FOUND: {text} -> {href}")
                
        browser.close()

if __name__ == "__main__":
    test_fetch()
