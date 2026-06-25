"""
批量转换 Z4 瓦片：webp → JPG
输入：tiles_mixed/4/{row}_{col}.webp (640x640)
输出：miniprogram/packageMap/assets/tiles/4/{row}_{col}.jpg (640x640)
"""

import os
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'tiles_mixed', '4')
DST_DIR = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'packageMap', 'assets', 'tiles', '4')
QUALITY = 75

os.makedirs(DST_DIR, exist_ok=True)

total_src = 0
total_dst = 0
count = 0

for row in range(4):
    for col in range(4):
        name = f'{row}_{col}'
        src = os.path.join(SRC_DIR, f'{name}.webp')
        dst = os.path.join(DST_DIR, f'{name}.jpg')

        if not os.path.exists(src):
            print(f'  SKIP {name} (not found)')
            continue

        with Image.open(src) as img:
            img = img.convert('RGB')
            img.save(dst, 'JPEG', quality=QUALITY)

        src_size = os.path.getsize(src)
        dst_size = os.path.getsize(dst)
        total_src += src_size
        total_dst += dst_size
        count += 1
        print(f'  {name}  {src_size//1024}KB → {dst_size//1024}KB')

print(f'\n完成：{count} 张瓦片')
print(f'源文件总大小：{total_src//1024}KB')
print(f'输出总大小：  {total_dst//1024}KB')
