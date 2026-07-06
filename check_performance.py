import json
from collections import Counter

def run():
    with open("scum_biomes_data.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    zones = data["zones"]
    counts = Counter(z["biome"] for z in zones)
    
    print("Biome counts:", counts)
    
    with open("hunting_biome_mapping.json", "r", encoding="utf-8") as f:
        mapping = json.load(f)
        
    # Find which animal requires the most biomes
    animal_biomes = {}
    for biome_name, animals in mapping.items():
        for anim in animals:
            animal_name = anim["animal"]
            if animal_name not in animal_biomes:
                animal_biomes[animal_name] = []
            animal_biomes[animal_name].append(biome_name)
            
    for anim, b_list in animal_biomes.items():
        total_circles = sum(counts[b] for b in b_list)
        print(f"Animal: {anim}, Biomes: {b_list}, Total Circles: {total_circles}")

if __name__ == "__main__":
    run()
