import json
from bs4 import BeautifulSoup

def main():
    with open("hunting_page.html", "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    cards = soup.select(".tactical-card")
    results = []
    
    for card in cards:
        title_el = card.select_one("h3")
        if not title_el:
            continue
            
        animal_name = title_el.text.strip()
        
        # Some cards might not be animals (e.g. filters or empty cards)
        # Check if there's any item links
        item_links = card.select("a[href^='/items/']")
        if not item_links:
            # We want only the animals which have attractants or are listed as hunting animals
            # The 9 animals listed before were Bear, Boar, Chicken, Deer, Donkey, Goat, Horse, Rabbit, Wolf.
            pass
            
        items = []
        for a in item_links:
            item_name = a.get("title", "").strip()
            if not item_name:
                span = a.select_one("span")
                if span:
                    item_name = span.text.strip()
            if item_name and item_name not in items:
                items.append(item_name)
                
        results.append({
            "animal": animal_name,
            "attractants": items
        })
        
    with open("hunting_data_en.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=4)
        
    print(f"Extracted {len(results)} animals.")
    for r in results:
        print(f"{r['animal']}: {', '.join(r['attractants'])}")

if __name__ == "__main__":
    main()
