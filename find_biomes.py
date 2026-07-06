import re

def run():
    with open("davoonline_map.html", "r", encoding="utf-8") as f:
        content = f.read()
        
    # Search for json data containing biomes
    matches = re.finditer(r'(.{0,50}biome.{0,50})', content, re.IGNORECASE)
    
    count = 0
    for match in matches:
        print(match.group(1).strip())
        count += 1
        if count > 20:
            break

if __name__ == "__main__":
    run()
