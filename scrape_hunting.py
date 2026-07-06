import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        print("Navigating to hunting page...")
        page.goto("https://scum-db.com/activities/hunting", wait_until="domcontentloaded")
        
        print("Waiting for cards...")
        page.wait_for_timeout(5000)
        
        
        content = page.content()
        with open("hunting_page.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        print("Scraped hunting_page.html successfully!")
        
        browser.close()

if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print("Error:", e)
