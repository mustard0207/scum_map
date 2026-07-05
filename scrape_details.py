import json
import time
import os
from playwright.sync_api import sync_playwright

def run():
    with open('weapon_links.json', 'r', encoding='utf-8') as f:
        links = json.load(f)
        
    os.makedirs('weapons_data', exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()
        
        for i, link in enumerate(links):
            url = f"https://scum-db.com{link}"
            print(f"[{i+1}/{len(links)}] Fetching {url}...")
            
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_selector("h1", timeout=15000)
                
                # Scroll to bottom to trigger lazy loading of compatibility matrix
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.5)
                # Scroll back to top
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(1)
                
                content = page.content()
                
                filename = link.split('?')[0].split('/')[-1] + '.html'
                with open(os.path.join('weapons_data', filename), 'w', encoding='utf-8') as out:
                    out.write(content)
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                
        browser.close()

if __name__ == "__main__":
    run()
