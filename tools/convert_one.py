from PIL import Image

webp_path = r"e:\Mustard\SynologyDrive\Code\sucm_tools\miniprogram\assets\tiles\2\0_0.webp"
jpg_path = r"e:\Mustard\SynologyDrive\Code\sucm_tools\miniprogram\assets\tiles\2\0_0.jpg"

try:
    with Image.open(webp_path) as img:
        img = img.convert("RGB") # Convert to RGB for JPEG format
        img.save(jpg_path, "JPEG", quality=60)
    print("Success! Created 0_0.jpg")
except Exception as e:
    print(f"Error: {e}")
