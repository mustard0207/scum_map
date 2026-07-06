import json
import os

def run():
    print("Loading data...")
    # 1. Load Biomes
    with open("scum_biomes_data.json", "r", encoding="utf-8") as f:
        biomes_data = json.load(f)
        
    zones = biomes_data["zones"]
    # Sort by radius descending for LOD
    zones.sort(key=lambda z: z["radius"], reverse=True)
    
    clean_zones = []
    for z in zones:
        clean_zones.append({
            "b": z["biome"],
            "x": round(z["x"], 1),
            "y": round(z["y"], 1),
            "z": round(z["z"], 1),
            "r": round(z["radius"], 1)
        })
        
    # 2. Load Animals
    with open("hunting_data_final.json", "r", encoding="utf-8") as f:
        animals_data = json.load(f)
        
    animals_dict = {}
    for a in animals_data:
        animal_id = a["id"].lower()
        # Some tweaks to make it clean
        animals_dict[animal_id] = {
            "name": a["name"],
            "baits": a["attractants"]
        }
        
    # 3. Load Mapping
    with open("hunting_biome_mapping.json", "r", encoding="utf-8") as f:
        mapping_data = json.load(f)
        
    # Biome -> Animals
    biome_animals = {}
    # Animal -> Biomes
    animal_biomes = {}
    
    for biome_name, animal_list in mapping_data.items():
        if biome_name not in biome_animals:
            biome_animals[biome_name] = []
            
        for a in animal_list:
            animal_id = a["animal"].lower()
            weights = [round(w, 3) for w in a.get("spawnWeights", [])]
            
            biome_animals[biome_name].append({
                "id": animal_id,
                "w": weights
            })
            
            if animal_id not in animal_biomes:
                animal_biomes[animal_id] = []
            animal_biomes[animal_id].append({
                "b": biome_name,
                "w": weights
            })
            
    # Output JS file
    js_content = f"""/**
 * SCUM 狩猎助手数据源 (Auto-generated)
 */

// 地形颜色配置
const BIOME_COLORS = {{
    "Mediterranean": "#3F6F6B",
    "ContinentalMeadow": "#C8A347",
    "ContinentalForest": "#4E7A3F",
    "Mountain": "#E6DDD2",
    "Urban": "#8d5a44",
    "Village": "#d9b35f"
}};

// 地形圆圈数据 (b: 地形, x/y/z: 坐标, r: 半径) 
// 已按半径降序排列，用于全局视角的 LOD 截断
const ZONES = {json.dumps(clean_zones, ensure_ascii=False, separators=(',', ':'))};

// 动物图鉴及诱饵字典
const ANIMALS = {json.dumps(animals_dict, ensure_ascii=False, separators=(',', ':'))};

// 从地形反查动物 (id: 动物ID, w: 刷新权重)
const BIOME_ANIMALS = {json.dumps(biome_animals, ensure_ascii=False, separators=(',', ':'))};

// 从动物查询分布地形 (b: 地形, w: 刷新权重)
const ANIMAL_BIOMES = {json.dumps(animal_biomes, ensure_ascii=False, separators=(',', ':'))};

module.exports = {{
    BIOME_COLORS,
    ZONES,
    ANIMALS,
    BIOME_ANIMALS,
    ANIMAL_BIOMES
}};
"""
    output_path = "miniprogram/packageMap/data/hunting.js"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"Data successfully generated at {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.2f} KB")

if __name__ == "__main__":
    run()
