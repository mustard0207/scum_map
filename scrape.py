from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        print("Navigating to page...")
        page.goto("https://scum-db.com/weapons/ranged", wait_until="domcontentloaded")
        
        # Wait for the "Loading weapons..." to disappear and cards to appear
        print("Waiting for cards...")
        page.wait_for_selector("a[href^='/weapons/']", timeout=30000)
        
        # Give it a bit more time to fully render everything
        time.sleep(2)
        
        content = page.content()
        with open("weapons_ranged.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        print("Scraped weapons_ranged.html successfully!")
        
        # Now let's grab all the weapon links
        links = page.locator("a[href^='/weapons/']").evaluate_all("elements => elements.map(el => el.href)")
        
        # Filter for links that are actual weapons, e.g. /weapons/ranged/..., not just /weapons/ranged
        weapon_links = list(set([link for link in links if link.startswith("https://scum-db.com/weapons/ranged/")]))
        print(f"Found {len(weapon_links)} weapons.")
        
        with open("weapon_links.txt", "w", encoding="utf-8") as f:
            for link in weapon_links:
                f.write(link + "\n")
                
        browser.close()

if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print("Error:", e)
