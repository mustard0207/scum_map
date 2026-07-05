import json
from collections import Counter

def summarize():
    with open('scum_weapons_data_cropped.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total Weapons: {len(data)}")
    
    # Let's group by Caliber to show variety
    calibers = [item.get('Caliber', 'N/A') for item in data]
    cal_counts = Counter(calibers)
    
    print("\nBreakdown by Caliber:")
    for cal, count in cal_counts.most_common(10):
        print(f" - {cal}: {count} weapons")
    if len(cal_counts) > 10:
        print(f" - and {len(cal_counts)-10} more calibers...")
        
    # Pick a few distinct weapon types for the sample table
    samples = []
    # 1. Rifle (AK15)
    # 2. Shotgun (DT11B or SDASS)
    # 3. Bow (Compound Bow)
    # 4. Handgun (DEagle or M9)
    # 5. Sniper (AWP or M82A1)
    # 6. SMG (MP5)
    # 7. Rocket Launcher (RPG7)
    
    targets = ['AK-15', 'SDASS', 'Compound Bow', 'M9', 'AWP', 'MP5', 'RPG7']
    for t in targets:
        for item in data:
            if item['Name'] == t:
                samples.append(item)
                break
                
    print("\nSAMPLE_TABLE_DATA:")
    print(json.dumps(samples, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    summarize()
