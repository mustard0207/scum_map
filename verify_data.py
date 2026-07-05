import json
from collections import Counter

def verify():
    with open('scum_weapons_data_final.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    names = [item['Name'] for item in data]
    counts = Counter(names)
    duplicates = {name: count for name, count in counts.items() if count > 1}
    
    if duplicates:
        print("FOUND DUPLICATES:")
        for k, v in duplicates.items():
            print(f" - {k}: {v} times")
    else:
        print("No duplicate weapons found.")
        
    print(f"\nTotal unique weapons: {len(set(names))}")
    
    bad_values = []
    for item in data:
        for k, v in item.items():
            if isinstance(v, str) and len(v) > 100:
                bad_values.append((item['Name'], k, v[:50] + "..."))
            elif isinstance(v, list):
                if len(v) != len(set(v)):
                    print(f"[Warning] Duplicated attachments in {item['Name']} - {k}")
                    
    if bad_values:
        print("\nFound suspiciously long values (possible parsing errors):")
        for bv in bad_values:
            print(f" - {bv[0]} -> {bv[1]}: {bv[2]}")
    else:
        print("No suspiciously long string values found.")

if __name__ == "__main__":
    verify()
