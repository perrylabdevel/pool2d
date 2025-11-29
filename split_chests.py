from PIL import Image
import os

def split_chests():
    source_path = '/Users/brian/pool2d/src/assets/chests/chests_sprite_sheet.png'
    output_dir = '/Users/brian/pool2d/src/assets/chests'
    
    if not os.path.exists(source_path):
        print(f"Error: Source file not found at {source_path}")
        return

    try:
        img = Image.open(source_path)
        width, height = img.size
        print(f"Source image size: {width}x{height}")
        
        # Calculate dimensions for 2x2 grid
        # We know the image is 1024x559
        # So each cell is 512x279.5 (approx)
        cell_width = width // 2
        cell_height = height // 2
        
        chests = {
            'chest_bronze.png': (0, 0, cell_width, cell_height),
            'chest_gold.png': (cell_width, 0, width, cell_height),
            'chest_platinum.png': (0, cell_height, cell_width, height),
            'chest_diamond.png': (cell_width, cell_height, width, height)
        }
        
        for name, box in chests.items():
            crop = img.crop(box)
            # Trim transparency if possible? 
            # For now, let's just save the quadrant. 
            # Actually, trimming would be nice to get the "true" size, 
            # but let's stick to the grid first to be safe.
            # crop = crop.crop(crop.getbbox()) 
            
            output_path = os.path.join(output_dir, name)
            crop.save(output_path)
            print(f"Saved {name}")
            
    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    split_chests()
