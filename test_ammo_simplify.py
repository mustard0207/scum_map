import re

ammo_list = [
    ".22 Ammo", ".22 Ammunition Box", ".22 Crafted Ammo", ".22 Tracer Ammo", ".22 Tracer Ammunition Box",
    ".30-06 AP Ammo", ".30-06 AP Crafted Ammo", ".30-06 Ammo", ".30-06 Ammunition Box", ".30-06 Armor Piercing Ammunition Box",
    ".30-06 Crafted Ammo", ".30-06 Tracer Ammo", ".30-06 Tracer Ammunition Box",
    ".308 AP Ammo", ".308 AP Ammunition Box", ".308 AP Crafted Ammo", ".308 Ammo", ".308 Ammunition Box",
    ".308 Crafted Ammo", ".308 TR Ammo", ".308 TR Ammunition Box",
    ".338 AP Ammo", ".338 AP Ammunition Box", ".338 AP Crafted Ammo", ".338 Ammo", ".338 Ammunition Box",
    ".338 Crafted Ammo", ".338 TR Ammo", ".338 Tracer Ammunition Box",
    ".357 AP Ammo", ".357 AP Crafted Ammo", ".357 Ammo", ".357 Ammunition Box", ".357 Armor Piercing Ammunition Box",
    ".357 Crafted Ammo", ".357 Tracer Ammo", ".357 Tracer Ammunition Box",
    ".38 AP Ammo", ".38 AP Crafted Ammo", ".38 Ammo", ".38 Ammunition Box", ".38 Ammunition Box Armor Piercing Rounds",
    ".38 Ammunition Box Tracer Rounds", ".38 Crafted Ammo", ".38 TR Ammo",
    ".44 AP Crafted Ammo", ".44 Ammo", ".44 Ammunition Box", ".44 Armor Piercing Ammunition Box",
    ".44 Armor Piercing Bullet", ".44 Crafted Ammo", ".44 Tracer Ammo", ".44 Tracer Ammunition Box",
    ".45 ACP AP Crafted Ammo", ".45 ACP Ammo", ".45 ACP Ammunition Box", ".45 ACP Armor Piercing Ammo",
    ".45 ACP Armor Piercing Ammunition Box", ".45 ACP Crafted Ammo", ".45 ACP Tracer Ammo", ".45 ACP Tracer Ammunition Box",
    ".50 AE AP Ammo", ".50 AE AP Crafted", ".50 AE Ammo", ".50 AE Ammunition Box", ".50 AE Armor Piercing Ammunition Box",
    ".50 AE Crafted Ammo", ".50 AE Tracer Ammo", ".50 AE Tracer Ammunition Box",
    ".50 BMG AP Ammo", ".50 BMG Ammo", ".50 BMG Ammunition Box", ".50 BMG Armor Piercing Ammunition Box",
    ".50 BMG Crafted Ammo", ".50 BMG Tracer Ammo", ".50 BMG Tracer Ammunition Box",
    "12 Gauge Birdshot Cartridge", "12 Gauge Buckshot Cartridge", "12 Gauge Buckshot Improvised Cartridge",
    "12 Gauge Slug Shot Cartridge", "40x46 Grenade",
    "5.45x39mm AP Ammo", "5.45x39mm AP Crafted Ammo", "5.45x39mm Ammo", "5.45x39mm Ammunition Box",
    "5.45x39mm Armor Piercing Ammunition Box", "5.45x39mm Crafted Ammo", "5.45x39mm Tracer Ammo",
    "5.45x39mm Tracer Ammunition Box",
    "5.56x45mm AP Ammo", "5.56x45mm AP Crafted Ammo", "5.56x45mm Ammo", "5.56x45mm Ammunition Box",
    "5.56x45mm Armor Piercing Ammunition Box", "5.56x45mm Crafted Ammo", "5.56x45mm Tracer Ammo",
    "5.56x45mm Tracer Ammunition Box",
    "7.62x39mm AP Ammo", "7.62x39mm AP Crafted Ammo", "7.62x39mm Ammo", "7.62x39mm Ammunition Box",
    "7.62x39mm Armor Piercing Ammunition Box", "7.62x39mm Crafted Ammo", "7.62x39mm Tracer Ammo",
    "7.62x39mm Tracer Ammunition Box",
    "7.62x54mmR AP Ammo", "7.62x54mmR AP Crafted Ammo", "7.62x54mmR Ammo", "7.62x54mmR Ammunition Box",
    "7.62x54mmR Armor Piercing Ammunition Box", "7.62x54mmR Crafted Ammo", "7.62x54mmR Tracer Ammo",
    "7.62x54mmR Tracer Ammunition Box",
    "7.92x57mm AP Ammo", "7.92x57mm AP Crafted Ammo", "7.92x57mm Ammo", "7.92x57mm Ammunition Box",
    "7.92x57mm Armor Piercing Ammunition Box", "7.92x57mm Crafted Ammo", "7.92x57mm Tracer Ammo",
    "7.92x57mm Tracer Ammunition Box",
    "9mm AP Ammo", "9mm AP Crafted Ammo", "9mm Ammo", "9mm Ammunition Box", "9mm Armor Piercing Ammunition Box",
    "9mm Crafted Ammo", "9mm Tracer Ammo", "9mm Tracer Ammunition Box",
    "9x39mm AP Ammo", "9x39mm AP Crafted Ammo", "9x39mm Ammo", "9x39mm Ammunition Box",
    "9x39mm Armor Piercing Ammunition Box", "9x39mm Crafted Ammo", "9x39mm Tracer Ammo", "9x39mm Tracer Ammunition Box",
    "Birdshot Shotgun Ammunition Box", "Broadhead Carbon Arrow", "Broadhead Metal Arrow",
    "Buckshot Shotgun Ammunition Box", "Carbon Arrow", "Carbon Crossbow Bolt", "Dildo Wooden Arrow",
    "Dildo Wooden Crossbow Bolt", "Explosive Carbon Arrow", "Explosive Metal Arrow", "Explosive Wooden Arrow",
    "Explosive Wooden Crossbow Bolt", "Flare Cartridge", "Fletched Wooden Arrow", "Metal Arrow",
    "Metal Crossbow Bolt", "Metal Tip Crossbow Bolt", "Metal Tip Wooden Arrow", "OG-7V", "PG-7M",
    "Slugs Shotgun Ammunition Box", "Specialist Archer Arrow", "Stone Tip Crossbow Bolt",
    "Stone Tip Wooden Arrow", "Wooden Arrow", "Wooden Crossbow Bolt"
]

def simplify_ammo(ammo_name):
    match = re.match(r'^(\.\d+(?:-\d+)?(?:\s+(?:ACP|AE|BMG))?|\d+(?:\.\d+)?x\d+mm[R]?|\d+mm)', ammo_name)
    if match:
        return match.group(1).strip()
    
    if '12 Gauge' in ammo_name or 'Shotgun' in ammo_name:
        return '12 Gauge'
    
    if '40x46' in ammo_name:
        return '40x46mm'
        
    if 'Arrow' in ammo_name:
        return 'Arrow'
        
    if 'Bolt' in ammo_name:
        return 'Crossbow Bolt'
        
    if 'Flare' in ammo_name:
        return 'Flare'
        
    if ammo_name in ['OG-7V', 'PG-7M']:
        return 'RPG Rocket'
        
    return ammo_name

results = {}
for a in ammo_list:
    simplified = simplify_ammo(a)
    results[simplified] = results.get(simplified, []) + [a]

for k, v in sorted(results.items()):
    print(f"{k}: mapped from {len(v)} items (e.g. {v[0]})")
