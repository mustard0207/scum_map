import re

def test():
    with open('weapons_data/Weapon_AK15.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # print context around "magazine"
    print("--- MAGAZINES ---")
    for m in re.finditer(r'.{0,40}magazine.{0,40}', html.lower()):
        print(m.group(0))
        
if __name__ == "__main__":
    test()
