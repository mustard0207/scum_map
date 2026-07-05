import json
import csv

# Custom translation mapping for SCUM terminology
translation_dict = {
    # Category keys
    "Name": "名称",
    "Damage": "伤害",
    "Fire Rate (RPM)": "射速 (RPM)",
    "Effective Range (m)": "有效射程 (米)",
    "Caliber": "默认口径",
    "Weight (kg)": "重量 (kg)",
    "Grid Size": "背包占格",
    "Magazines": "适配弹匣",
    "Ammunition": "适配弹药",
    "Sights": "近瞄镜 (红点/全息)",
    "Scopes": "远瞄镜 (高倍镜)",
    "Suppressors": "消音器",
    "Flashlights": "战术手电/枪灯",
    "Bayonets": "刺刀",
    "Rails": "导轨适配器",
    
    # Calibers
    ".22": ".22 口径",
    ".30-06": ".30-06 口径",
    ".308": ".308 口径",
    ".338": ".338 口径",
    ".357": ".357 口径",
    ".38": ".38 口径",
    ".44": ".44 口径",
    ".45 ACP": ".45 ACP 口径",
    ".50 AE": ".50 AE 口径",
    ".50 BMG": ".50 BMG 大口径",
    "12 Gauge": "12号口径 (霰弹)",
    "40x46mm": "40x46mm 榴弹",
    "5.45x39mm": "5.45x39mm 口径",
    "5.56x45mm": "5.56x45mm 口径",
    "7.62x39mm": "7.62x39mm 口径",
    "7.62x54mmR": "7.62x54mmR 口径",
    "7.92x57mm": "7.92x57mm 口径",
    "9mm": "9mm 口径",
    "9x39mm": "9x39mm 口径",
    "Arrow": "箭矢",
    "Crossbow Bolt": "弩箭",
    "Flare": "信号弹",
    "RPG Rocket": "RPG火箭弹",

    # Weapons
    "AK-15": "AK-15 突击步枪",
    "AK-47": "AK-47 突击步枪",
    "AKM": "AKM 突击步枪",
    "AKS-74U": "AKS-74U 冲锋枪",
    "AS Val": "AS Val 特种步枪",
    "AT4 HEAT": "AT4 反坦克火箭筒",
    "AWM": "AWM 狙击步枪",
    "AWP": "AWP 狙击步枪",
    "BlackHawk Crossbow": "黑鹰十字弩",
    "Block 21": "Block 21 手枪",
    "Carbon Hunter": "碳纤维猎手步枪",
    "Compound Bow": "复合弓",
    "DEagle .357": "荒野之鹰 .357 手枪",
    "DEagle 50": "荒野之鹰 .50 手枪",
    "DT11B": "DT11B 双管霰弹枪",
    "Flare Gun": "信号枪",
    "HS SF19": "HS SF19 手枪",
    "HS-9": "HS-9 手枪",
    "Hunter85": "猎人 85 步枪",
    "Improvised Bow 20#": "自制弓 (20磅)",
    "Scorpion 40#": "蝎式反曲弓 (40磅)",
    "Improvised Crossbow": "自制十字弩",
    "Improvised Flamethrower": "自制火焰喷射器",
    "Improvised Handgun": "自制手枪",
    "Improvised Rifle": "自制单发步枪",
    "Judge 44": "法官 .44 左轮手枪",
    "Kar98": "Kar98k 栓动步枪",
    "Krueger": "克鲁格手枪",
    "M1 Rifle": "M1 加兰德步枪",
    "M16A4": "M16A4 突击步枪",
    "M1887": "M1887 杠杆霰弹枪",
    "M1887 Sawed off": "M1887 锯短霰弹枪",
    "M1891": "莫辛纳甘 M1891 步枪",
    "M1911": "M1911 手枪",
    "M249": "M249 轻机枪",
    "M82A1": "M82A1 巴雷特狙击步枪",
    "MAC-10": "MAC-10 冲锋枪",
    "MK18": "MK18 突击步枪",
    "MP5": "MP5 冲锋枪",
    "MP5 K": "MP5 K 短款冲锋枪",
    "MP5 SD": "MP5 SD 微声冲锋枪",
    "Peacekeeper 38": "和平捍卫者 .38 左轮手枪",
    "RPG7": "RPG-7 火箭筒",
    "RPK": "RPK 轻机枪",
    "SCAR-DMR": "SCAR 精确射手步枪",
    "SCAR-L": "SCAR-L 突击步枪",
    "SDASS 12M": "SDASS 12M 泵动霰弹枪",
    "SKS": "SKS 半自动步枪",
    "SVD": "SVD 狙击步枪",
    "TEC01 490": "TEC01 490 泵动霰弹枪",
    "TEC01 M9": "TEC01 M9 手枪",
    "Takedown Bow": "反曲折叠弓",
    "Tommy Gun": "汤姆逊冲锋枪",
    "Trench Gun": "温彻斯特 M1897 战壕枪",
    "UMP-45": "UMP-45 冲锋枪",
    "VHS 2": "VHS-2 突击步枪",
    "VHS BG": "VHS-2 挂榴弹版步枪",
    "VSS VZ": "VSS 微声狙击步枪",
    "Viper M357": "毒蛇 .357 左轮手枪",
    
    # Sights & Scopes
    "AimPRO Red Dot Sight": "AimPRO 红点瞄准镜",
    "Desert Eagle Red Dot": "荒野之鹰专用红点镜",
    "MRO Red Dot Sight": "MRO 红点瞄准镜",
    "OKP Holographic Sight": "OKP 全息瞄准镜",
    "Red Dot Sight": "普通红点瞄准镜",
    "Sentry RDRS": "哨兵反射式红点镜",
    "V3 Holographic Sight": "V3 全息瞄准镜",
    "XPS Holographic Sight": "XPS 全息瞄准镜",
    "ACOG": "ACOG 瞄准镜 (4倍)",
    "Improvised Scope": "自制瞄准镜",
    "M82 Scope": "M82 巴雷特专用瞄准镜",
    "P-223 Scope": "P-223 瞄准镜",
    "POSP 4X24V Scope": "POSP 4X24V 狙击镜",
    "SpektralDR": "SpektralDR 变倍瞄准镜",
    "Vampyr Scope": "吸血鬼夜视瞄准镜",
    "Hunting Scope": "打猎瞄准镜",
    "M1 Scope": "M1 加兰德专用瞄准镜",
    "Compound Bow Sight": "复合弓专用瞄准镜",
    "M1 Experimental Sights": "M1 实验型机械瞄具",
    "M16A4 Folding Sights": "M16A4 折叠机械瞄具",

    # Suppressors
    "Improvised Bottle Suppressor": "自制塑料瓶消音器",
    "Improvised Can Suppressor": "自制易拉罐消音器",
    "Improvised Oil Can Suppressor": "自制机油滤清器消音器",
    "Bow Silencer": "弓用消音毛条",
    "Slip-on bow silencer": "套接式弓用消音器",
    "Cal .30-06 Suppressor": ".30-06 口径消音器",
    "Handgun Suppressor": "手枪通用消音器",
    "Hunter Suppressor": "猎人步枪消音器",
    "Kar98k Suppressor": "Kar98k 步枪消音器",
    "M82 QDL Suppressor": "M82 快速拆装消音器",

    # Rails
    "MP5 rail": "MP5 安装导轨",
    "Short Improvised Rail": "自制短导轨",
    "Long Improvised Rail": "自制长导轨",
    "M1911 Rail": "M1911 安装导轨",
    "Viper M357 Rail": "毒蛇左轮安装导轨",
    "Improvised Rifle Rail": "自制步枪导轨",
    "ImprovisedRail_Long": "自制长导轨",
    "ImprovisedRail_Short": "自制短导轨",
    "ImprovisedRail_Side": "自制侧导轨",
    "RIS Adapter": "RIS 导轨适配器",

    # Bayonets & Others
    "Kar98 Bayonet": "Kar98k 刺刀",
    "M1 Bayonet": "M1 刺刀",
    "M1891 Bayonet": "莫辛纳甘刺刀",
    "M70 Bayonet": "M70 刺刀",
    "N9 Bayonet": "N9 刺刀",
    "P17 Bayonet": "P17 刺刀",
    "SKS Bayonet": "SKS 刺刀",
    "Bow Stabilizer": "弓用稳定器",
    "Improvised Bow Stabilizer": "自制弓用稳定器",
    "Desert Eagle Flashlight": "荒野之鹰战术手电",
    "Improvised Flashlight": "自制手电筒",
    "M9 Flashlight": "M9 战术手电",
    "M1 Flash Hider": "M1 枪口消焰器"
}

def translate_item(name):
    if not name:
        return "N/A"
    if name in translation_dict:
        return translation_dict[name]
        
    if "Specialist Archer Bow" in name:
        return "专业猎手弓"
    if "Woodland Hunter Bow" in name:
        return "丛林猎手弓"
        
    if name.endswith(" Magazine"):
        base = name[:-9]
        translated_base = translation_dict.get(base, base).replace(" 突击步枪", "").replace(" 冲锋枪", "").replace(" 步枪", "").replace(" 手枪", "")
        return f"{translated_base} 弹匣"
        
    if name.endswith(" Suppressor"):
        base = name[:-11]
        translated_base = translation_dict.get(base, base).replace(" 突击步枪", "").replace(" 冲锋枪", "").replace(" 步枪", "").replace(" 手枪", "")
        return f"{translated_base} 消音器"
        
    if name.endswith(" Clip"):
        base = name[:-5]
        translated_base = translation_dict.get(base, base)
        return f"{translated_base} 弹夹"
        
    return name

def translate_data():
    with open('scum_weapons_data_cropped.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    translated_list = []
    for item in data:
        new_item = {}
        
        for eng_key, val in item.items():
            cn_key = translation_dict.get(eng_key, eng_key)
            
            if eng_key == 'Name':
                new_item[cn_key] = translate_item(val)
            elif eng_key == 'Caliber':
                new_item[cn_key] = translation_dict.get(val, val)
            elif isinstance(val, list):
                new_item[cn_key] = [translate_item(v) for v in val]
            else:
                new_item[cn_key] = val
                
        translated_list.append(new_item)
        
    # Save as JSON
    with open('scum_weapons_data_zh.json', 'w', encoding='utf-8') as f:
        json.dump(translated_list, f, indent=2, ensure_ascii=False)
        
    # Save as CSV
    csv_data = []
    for row in translated_list:
        csv_row = {}
        for k, v in row.items():
            if isinstance(v, list):
                csv_row[k] = ', '.join(v)
            else:
                csv_row[k] = v
        csv_data.append(csv_row)
        
    keys = list(csv_data[0].keys())
    with open('scum_weapons_data_zh.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(csv_data)
        
    print(f"Chinese translation completed for {len(translated_list)} weapons.")

if __name__ == "__main__":
    translate_data()
