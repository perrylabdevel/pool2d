import cv2
import numpy as np
import os
import glob
import math

# --- CONFIGURATION ---
# Folder containing your pool table images
IMAGE_FOLDER = "public/assets/tmp" 
# Extension of your images
IMAGE_EXT = '*.png' 
# Tolerance for color detection (Higher = catches more shadow variation)
COLOR_TOLERANCE = 40 

def find_inner_cushions(img, mask, outer_box):
    """
    Attempts to find the straight lines of the inner cushion edge within the masked area.
    Returns a new bounding box (x, y, w, h) for the inner area.
    """
    x, y, w, h = outer_box
    
    # 1. Edge Detection on the Value channel (better for shadows)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    _, _, v = cv2.split(hsv)
    
    # Crop to the approximate area to save processing, but keep coordinates relative to full image later
    pad = 0
    roi_v = v[y-pad:y+h+pad, x-pad:x+w+pad]
    roi_mask = mask[y-pad:y+h+pad, x-pad:x+w+pad]
    
    if roi_v.size == 0:
        return outer_box

    def detect_lines(canny_low, canny_high, hough_thresh, min_len):
        # Apply Canny edge detection
        blur = cv2.GaussianBlur(roi_v, (5, 5), 0)
        edges = cv2.Canny(blur, canny_low, canny_high)
        
        # Mask out edges outside the felt area
        edges = cv2.bitwise_and(edges, edges, mask=roi_mask)
        
        # Find Lines
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=hough_thresh, minLineLength=min_len, maxLineGap=20)
        return lines

    # Try strict first, then looser
    attempts = [
        (30, 100, 50, w//4),      # Strict
        (20, 80, 30, w//6),       # Looser
        (10, 50, 20, w//8)        # Very Loose
    ]
    
    final_box = outer_box # Default fallback
    
    for (c_low, c_high, h_thresh, min_l) in attempts:
        lines = detect_lines(c_low, c_high, h_thresh, min_l)
        if lines is None: continue
        
        # 3. Filter Lines into Top, Bottom, Left, Right
        inner_top = 0
        inner_bottom = h
        inner_left = 0
        inner_right = w
        
        vert_thresh_top = h * 0.25
        vert_thresh_btm = h * 0.75
        horz_thresh_left = w * 0.25
        horz_thresh_right = w * 0.75

        found_top = False
        found_bottom = False
        found_left = False
        found_right = False

        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            
            # Horizontal-ish lines
            if abs(angle) < 10 or abs(angle) > 170:
                avg_y = (y1 + y2) / 2
                if avg_y < vert_thresh_top: 
                    if avg_y > inner_top: 
                        inner_top = avg_y
                        found_top = True
                elif avg_y > vert_thresh_btm:
                    if avg_y < inner_bottom: 
                        inner_bottom = avg_y
                        found_bottom = True

            # Vertical-ish lines
            elif abs(abs(angle) - 90) < 10:
                avg_x = (x1 + x2) / 2
                if avg_x < horz_thresh_left:
                    if avg_x > inner_left:
                        inner_left = avg_x
                        found_left = True
                elif avg_x > horz_thresh_right:
                    if avg_x < inner_right:
                        inner_right = avg_x
                        found_right = True
        
        # If we found ALL 4 sides, we are confident. Return immediately.
        if found_top and found_bottom and found_left and found_right:
            final_x = x + int(inner_left)
            final_y = y + int(inner_top)
            final_w = int(inner_right - inner_left)
            final_h = int(inner_bottom - inner_top)
            return (final_x, final_y, final_w, final_h)
            
        # If we found at least some, we can tentatively keep them BUT continue trying subsequent passes
        # to see if we can find *all* sides with looser settings.
        # But for now, let's just stick to the "All 4" rule for success.
        
    return final_box

def analyze_table(filepath):
    # 1. Load Image
    img = cv2.imread(filepath)
    if img is None:
        print(f"Could not load: {filepath}")
        return

    original = img.copy()
    h, w = img.shape[:2]

    # 2. Auto-Sample the Felt Color
    # We assume the exact center of the image is the felt.
    # We take a small sample patch from the center to get the average color.
    center_y, center_x = h // 2, w // 2
    sample_size = 20
    sample_patch = img[center_y-sample_size:center_y+sample_size, 
                       center_x-sample_size:center_x+sample_size]
    
    # Convert sample to HSV for better color segmentation
    hsv_patch = cv2.cvtColor(sample_patch, cv2.COLOR_BGR2HSV)
    avg_hsv = np.mean(hsv_patch, axis=(0, 1))

    # 3. Create a Color Mask
    # Define range based on the sampled center color
    lower_bound = np.array([max(0, avg_hsv[0] - COLOR_TOLERANCE), 30, 30], dtype=np.uint8)
    upper_bound = np.array([min(180, avg_hsv[0] + COLOR_TOLERANCE), 255, 255], dtype=np.uint8)
    
    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv_img, lower_bound, upper_bound)

    # 4. Clean up the Mask (Remove noise/holes in felt)
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    # 5. Find Contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print(f"No felt detected for {os.path.basename(filepath)}")
        return

    # Find the largest contour (assuming it's the main felt area)
    largest_contour = max(contours, key=cv2.contourArea)

    # 6. Get the Bounding Box (The "Outer" box including rails)
    x, y, box_w, box_h = cv2.boundingRect(largest_contour)
    outer_box = (x, y, box_w, box_h)
    
    # 7. Refine to Inner Cushions
    ix, iy, iw, ih = find_inner_cushions(img, mask, outer_box)
    
    # Calculate Center
    center_x_calc = ix + iw // 2
    center_y_calc = iy + ih // 2

    # --- VISUALIZATION ---
    # Draw the Detected Outer Area (Blue Box)
    cv2.rectangle(img, (x, y), (x + box_w, y + box_h), (255, 0, 0), 2)
    
    # Draw the Inner Cushion Area (Green Box)
    cv2.rectangle(img, (ix, iy), (ix + iw, iy + ih), (0, 255, 0), 2)
    
    # Draw the Center Point (Red Dot)
    cv2.circle(img, (center_x_calc, center_y_calc), 5, (0, 0, 255), -1)

    # Draw the text stats
    stats_text = f"Inner W: {iw} | Inner H: {ih} | Ratio: {iw/ih:.2f}"
    cv2.putText(img, stats_text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    print(f"--- {os.path.basename(filepath)} ---")
    print(f"Outer Width: {box_w}, Height: {box_h}")
    print(f"Inner Width: {iw}, Height: {ih}")
    print(f"Center Offset: ({center_x_calc - w//2}, {center_y_calc - h//2})")
    print("-" * 30)

    # Show result window
    cv2.imshow('Analysis (Press any key for next)', img)
    cv2.waitKey(0)

# --- MAIN EXECUTION ---
images = glob.glob(os.path.join(IMAGE_FOLDER, IMAGE_EXT))
print(f"Found {len(images)} images. Press any key to cycle through them.\n")

for image_file in images:
    analyze_table(image_file)

cv2.destroyAllWindows()