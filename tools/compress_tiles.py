import os
from pathlib import Path
from PIL import Image

def compress_tiles(input_dir, output_dir, target_size=(320, 320), quality=50):
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

    print("Starting tile compression...")

    # Recursively find all webp files
    for filepath in input_path.rglob("*.webp"):
        rel_path = filepath.relative_to(input_path)
        out_filepath = output_path / rel_path
        
        # Create subdirectories if needed
        out_filepath.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Open image
            with Image.open(filepath) as img:
                # Get size before
                size_before = filepath.stat().st_size
                total_size_before += size_before
                
                # Resize and save
                resized_img = img.resize(target_size, Image.Resampling.LANCZOS)
                resized_img.save(out_filepath, "WEBP", quality=quality, method=4)
                
                # Get size after
                size_after = out_filepath.stat().st_size
                total_size_after += size_after
                file_count += 1
                
                if file_count % 50 == 0:
                    print(f"Processed {file_count} files...")
                    
        except Exception as e:
            print(f"Error processing {filepath}: {e}")

    # Copy stats.json if exists
    stats_file = input_path / "stats.json"
    if stats_file.exists():
        import shutil
        shutil.copy2(stats_file, output_path / "stats.json")

    # Print summary
    before_mb = total_size_before / (1024 * 1024)
    after_mb = total_size_after / (1024 * 1024)
    
    print("\n" + "="*40)
    print("Compression Summary")
    print("="*40)
    print(f"Total files processed: {file_count}")
    print(f"Resolution: 1280x1280 -> {target_size[0]}x{target_size[1]}")
    print(f"WEBP Quality: {quality}")
    print(f"Original Size: {before_mb:.2f} MB")
    print(f"Compressed Size: {after_mb:.2f} MB")
    if before_mb > 0:
        print(f"Reduction: {(1 - after_mb/before_mb)*100:.1f}%")
    print("="*40)

if __name__ == "__main__":
    import sys
    # Using relative paths based on project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    in_dir = project_root / "tiles"
    out_dir = project_root / "tiles_compressed_320"
    
    compress_tiles(in_dir, out_dir)
