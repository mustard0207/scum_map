"""
微信公众号素材库批量上传脚本

功能：将瓦片图片 webp → jpg 转换后上传到微信公众号永久素材库，收集返回的 URL
用法：python tools/upload-to-wechat.py

输出：
  - wechat_urls.json  — 所有瓦片的微信素材库 URL（供代码使用）
  - upload_report.json — 上传结果报告
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import tempfile
from pathlib import Path
from PIL import Image

# Windows 控制台 UTF-8 输出
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ============ 配置 ============
APPID = "wx3e73df893f0b2472"
APPSECRET = "3b1dade41ccddc783d95d9b4ef4de9b1"

# 要上传的瓦片级别
UPLOAD_LEVELS = [3, 4, 6]

# 瓦片目录
TILES_DIR = Path(__file__).resolve().parent.parent / "tiles"

# 上传间隔（秒）
UPLOAD_INTERVAL = 0.5

# ============ 工具函数 ============

def get_access_token():
    """获取 access_token"""
    url = (
        f"https://api.weixin.qq.com/cgi-bin/token"
        f"?grant_type=client_credential&appid={APPID}&secret={APPSECRET}"
    )
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read().decode())
    if "access_token" in data:
        print("✅ access_token 获取成功")
        return data["access_token"]
    raise Exception(f"获取 access_token 失败: {data}")


def upload_image(file_path, filename, token):
    """上传图片到微信永久素材库（multipart/form-data）"""
    url = f"https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={token}&type=image"

    boundary = "----FormBoundary" + str(int(time.time() * 1000))

    with open(file_path, "rb") as f:
        file_data = f.read()

    # 根据文件扩展名设置正确的 Content-Type
    ext = os.path.splitext(filename)[1].lower()
    content_type = "image/webp" if ext == ".webp" else "image/jpeg"

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="media"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def convert_webp_to_jpg(webp_path, output_path):
    """将 webp 转换为 jpg"""
    img = Image.open(webp_path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(output_path, "JPEG", quality=90)


# ============ 主流程 ============

def main():
    print("🚀 微信公众号素材库批量上传工具（webp→jpg）")
    print("=" * 50)

    # 1. 获取 access_token
    token = get_access_token()

    # 2. 扫描瓦片文件
    tiles = []
    for level in UPLOAD_LEVELS:
        level_dir = TILES_DIR / str(level)
        if not level_dir.exists():
            print(f"⚠️  目录不存在: {level_dir}")
            continue
        for f in sorted(level_dir.glob("*.webp")):
            match = f.stem  # e.g. "0_0"
            parts = match.split("_")
            if len(parts) != 2:
                continue
            col, row = int(parts[0]), int(parts[1])
            tiles.append({
                "level": level,
                "col": col,
                "row": row,
                "key": f"{level}_{col}_{row}",
                "webp_path": f,
                "upload_filename": f"{level}_{col}_{row}.webp",
            })

    print(f"\n📦 发现 {len(tiles)} 张瓦片待上传：")
    for level in UPLOAD_LEVELS:
        count = len([t for t in tiles if t["level"] == level])
        if count > 0:
            print(f"   Z{level}: {count} 张")

    print(f"\n⚠️  即将开始上传（webp→jpg 转换后），Ctrl+C 可取消")
    time.sleep(2)

    # 3. 创建临时目录存放转换后的 jpg
    with tempfile.TemporaryDirectory() as tmp_dir:
        results = {}
        errors = []
        success_count = 0

        for i, tile in enumerate(tiles):
            progress = f"[{i + 1}/{len(tiles)}]"

            # 转换 webp → jpg
            jpg_path = os.path.join(tmp_dir, tile["jpg_filename"])
            try:
                convert_webp_to_jpg(tile["webp_path"], jpg_path)
            except Exception as e:
                errors.append({"key": tile["key"], "error": f"转换失败: {e}"})
                print(f"{progress} {tile['key']} ❌ 转换失败: {e}")
                continue

            # 上传
            print(f"{progress} 上传 {tile['key']} ... ", end="", flush=True)
            try:
                res = upload_image(jpg_path, tile["jpg_filename"], token)

                if "url" in res:
                    results[tile["key"]] = res["url"]
                    success_count += 1
                    print(f"✅ {res['url'][:60]}...")
                elif res.get("errcode") in (45064, 45009):
                    print(f"⏳ 频率限制，等 5s 重试...")
                    time.sleep(5)
                    retry = upload_image(jpg_path, tile["jpg_filename"], token)
                    if "url" in retry:
                        results[tile["key"]] = retry["url"]
                        success_count += 1
                        print(f"   ✅ 重试成功")
                    else:
                        errors.append({"key": tile["key"], "error": retry})
                        print(f"   ❌ 重试失败: {retry}")
                else:
                    errors.append({"key": tile["key"], "error": res})
                    print(f"❌ {json.dumps(res, ensure_ascii=False)}")
            except Exception as e:
                errors.append({"key": tile["key"], "error": str(e)})
                print(f"❌ {e}")

            if i < len(tiles) - 1:
                time.sleep(UPLOAD_INTERVAL)

    # 4. 输出结果
    print("\n" + "=" * 50)
    print(f"📊 上传完成: 成功 {success_count}/{len(tiles)}, 失败 {len(errors)}")

    # 保存 URL 映射
    output_path = Path(__file__).resolve().parent.parent / "wechat_urls.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n💾 URL 映射已保存: {output_path}")

    # 保存上传报告
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(tiles),
        "success": success_count,
        "failed": len(errors),
        "urls": results,
        "errors": errors,
    }
    report_path = Path(__file__).resolve().parent.parent / "upload_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"📋 上传报告已保存: {report_path}")

    if errors:
        print("\n❌ 失败的瓦片:")
        for e in errors:
            print(f"   {e['key']}: {json.dumps(e['error'], ensure_ascii=False)[:100]}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 用户取消")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 脚本执行出错: {e}")
        sys.exit(1)
