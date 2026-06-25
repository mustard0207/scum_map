import os
import shutil
from pathlib import Path
from PIL import Image

def compress_mixed(input_dir, output_dir):
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"Error: {input_dir} not found.")
        return

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    total_size_before = 0
    total_size_after = 0
    file_count = 0

    print("Starting mixed tile compression (Leapfrog Strategy)...")

    # Only process z2, z4, z6
    valid_zooms = ['2', '4', '6']

    for z in valid_zooms:
        z_dir = input_path / z
        if not z_dir.exists():
            continue
            
        out_z_dir = output_path / z
        out_z_dir.mkdir(parents=True, exist_ok=True)
        
        for filepath in z_dir.rglob("*.webp"):
            out_filepath = out_z_dir / filepath.name
            
            try:
                size_before = filepath.stat().st_size
                total_size_before += size_before
                
                if z == '2':
                    # Copy directly
                    shutil.copy2(filepath, out_filepath)
                elif z == '4':
                    # 640x640 q=60
                    with Image.open(filepath) as img:
                        resized = img.resize((640, 640), Image.Resampling.LANCZOS)
                        resized.save(out_filepath, "WEBP", quality=60, method=4)
                elif z == '6':
                    # 640x640 q=50
                    with Image.open(filepath) as img:
                        resized = img.resize((640, 640), Image.Resampling.LANCZOS)
                        resized.save(out_filepath, "WEBP", quality=50, method=4)
                
                size_after = out_filepath.stat().st_size
                total_size_after += size_after
                file_count += 1
                
                if file_count % 50 == 0:
                    print(f"Processed {file_count} files...")
                    
            except Exception as e:
                print(f"Error processing {filepath}: {e}")

    # Print summary
    before_mb = total_size_before / (1024 * 1024)
    after_mb = total_size_after / (1024 * 1024)
    
    print("\n" + "="*40)
    print("Mixed Compression Summary")
    print("="*40)
    print(f"Total files processed: {file_count} (Only Z2, Z4, Z6)")
    print(f"Z2 Size: 1280x1280 (Original)")
    print(f"Z4 Size: 640x640 (Q=60)")
    print(f"Z6 Size: 640x640 (Q=50)")
    print(f"Original Size (These files): {before_mb:.2f} MB")
    print(f"Final Output Size: {after_mb:.2f} MB")
    print("="*40)

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    in_dir = project_root / "tiles"
    out_dir = project_root / "tiles_mixed"
    
    compress_mixed(in_dir, out_dir)
