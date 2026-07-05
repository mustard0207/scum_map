import json

def list_names():
    with open('scum_weapons_data_cropped.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    names = set()
    for item in data:
        names.add(item['Name'])
        for cat in ['Magazines', 'Ammunition', 'Sights', 'Scopes', 'Suppressors', 'Flashlights', 'Bayonets', 'Rails']:
            for val in item.get(cat, []):
                names.add(val)
                
    print(f"Total unique names: {len(names)}")
    for name in sorted(names):
        print(name)

if __name__ == "__main__":
    list_names()
