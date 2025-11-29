import os
from PIL import Image
import math

def get_file_size_mb(file_path):
    return os.path.getsize(file_path) / (1024 * 1024)

def check_images(directory):
    print(f"{'Image Path':<60} | {'Dimensions':<15} | {'MP':<5} | {'Size (MB)':<10} | {'HDPI':<5} | {'Status'}")
    print("-" * 120)
    
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
    
    for root, _, files in os.walk(directory):
        for file in files:
            if any(file.lower().endswith(ext) for ext in image_extensions):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, directory)
                
                try:
                    with Image.open(file_path) as img:
                        width, height = img.size
                        megapixels = (width * height) / 1_000_000
                        size_mb = get_file_size_mb(file_path)
                        
                        # Heuristic for "Hi-DPI Ready"
                        # Assuming > 512px in any dimension is likely intended for high density or large display
                        is_hdpi = width > 512 or height > 512
                        hdpi_str = "Yes" if is_hdpi else "No"

                        status = "OK"
                        if width < 64 or height < 64:
                            status = "LOW RES?"
                        elif width > 1024 or height > 1024:
                            status = "HI-RES"
                            
                        print(f"{rel_path:<60} | {width}x{height:<14} | {megapixels:.2f} | {size_mb:.2f}       | {hdpi_str:<5} | {status}")
                except Exception as e:
                    print(f"{rel_path:<60} | {'ERROR':<15} | {'-':<5} | {'-':<10} | {'-':<5} | {str(e)}")

if __name__ == "__main__":
    project_root = '/Users/brian/pool2d/src'
    print(f"Scanning {project_root} for images...")
    check_images(project_root)
