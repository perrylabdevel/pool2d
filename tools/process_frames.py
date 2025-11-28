import os
from PIL import Image

# Target color to remove (Chroma Green #07752c)
# RGB: 7, 117, 44
TARGET_COLOR = (7, 117, 44)
TOLERANCE = 20 # Allow slight variation for compression artifacts

def is_green(pixel):
    r, g, b = pixel[:3]
    return (
        abs(r - TARGET_COLOR[0]) < TOLERANCE and
        abs(g - TARGET_COLOR[1]) < TOLERANCE and
        abs(b - TARGET_COLOR[2]) < TOLERANCE
    )

def process_frame(filepath):
    try:
        img = Image.open(filepath).convert("RGBA")
        pixels = img.load()
        width, height = img.size
        
        min_x, min_y = width, height
        max_x, max_y = 0, 0
        found_green = False

        # Scan pixels
        for y in range(height):
            for x in range(width):
                if is_green(pixels[x, y]):
                    pixels[x, y] = (0, 0, 0, 0) # Make transparent
                    
                    # Update bounds
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
                    found_green = True

        if found_green:
            # Calculate percentages for UI
            # Inset is distance from edge
            inset_top = min_y / height
            inset_left = min_x / width
            inner_w = (max_x - min_x) / width
            inner_h = (max_y - min_y) / height
            
            print(f"Processed {os.path.basename(filepath)}:")
            print(f"  Bounds: x={min_x}, y={min_y}, w={max_x-min_x}, h={max_y-min_y}")
            print(f"  UI Metrics: Inset Top={inset_top:.3f}, Left={inset_left:.3f}, Width={inner_w:.3f}, Height={inner_h:.3f}")
            
            img.save(filepath)
            return True
        else:
            print(f"No green screen found in {os.path.basename(filepath)}")
            return False

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    frames_dir = "/Users/brian/pool2d/src/assets/img/frames"
    files = [f for f in os.listdir(frames_dir) if f.endswith("_new.png")]
    
    print(f"Found {len(files)} frames to process...")
    
    for f in files:
        process_frame(os.path.join(frames_dir, f))

if __name__ == "__main__":
    main()
