import cv2
import numpy as np
import os
import glob
import json
import math

# --- CONFIGURATION ---
IMAGE_FOLDER = 'public/assets/tmp/'
OUTPUT_JSON = 'public/assets/tmp/tables_physics.json'
COLOR_TOLERANCE = 40
SMOOTHING_FACTOR = 0.002
SYMMETRY_TOLERANCE_PX = 3.0  # Max pixels a point can be "off" before flagging

def find_inner_cushions(img, mask, outer_box):
    """
    Attempts to find the straight lines of the inner cushion edge within the masked area.
    Returns a new bounding box (x, y, w, h) for the inner area.
    """
    x, y, w, h = outer_box
    
    # 1. Edge Detection on the Value channel (better for shadows)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    _, _, v = cv2.split(hsv)
    
    # Crop to the approximate area to save processing
    pad = 0
    roi_v = v[y-pad:y+h+pad, x-pad:x+w+pad]
    roi_mask = mask[y-pad:y+h+pad, x-pad:x+w+pad]
    
    if roi_v.size == 0: return outer_box

    def detect_lines(canny_low, canny_high, hough_thresh, min_len):
        blur = cv2.GaussianBlur(roi_v, (5, 5), 0)
        edges = cv2.Canny(blur, canny_low, canny_high)
        edges = cv2.bitwise_and(edges, edges, mask=roi_mask)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=hough_thresh, minLineLength=min_len, maxLineGap=20)
        return lines

    # Try strict first, then looser
    attempts = [
        (30, 100, 50, w//4),      # Strict
        (20, 80, 30, w//6),       # Looser
        (10, 50, 20, w//8)        # Very Loose
    ]
    
    final_box = outer_box 

    for (c_low, c_high, h_thresh, min_l) in attempts:
        lines = detect_lines(c_low, c_high, h_thresh, min_l)
        if lines is None: continue
        
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

        if found_top and found_bottom and found_left and found_right:
            final_x = x + int(inner_left)
            final_y = y + int(inner_top)
            final_w = int(inner_right - inner_left)
            final_h = int(inner_bottom - inner_top)
            return (final_x, final_y, final_w, final_h)
    
    return final_box

def calculate_alignment(rect_box, img_w, img_h):
    """
    Calculates how far off-center the table is.
    rect_box: (x, y, w, h)
    Returns: (offset_x, offset_y, is_centered)
    """
    x, y, w, h = rect_box
    
    table_center_x = x + w / 2.0
    table_center_y = y + h / 2.0
    
    img_center_x = img_w / 2.0
    img_center_y = img_h / 2.0
    
    offset_x = table_center_x - img_center_x
    offset_y = table_center_y - img_center_y
    
    dist = math.sqrt(offset_x**2 + offset_y**2)
    is_centered = dist <= SYMMETRY_TOLERANCE_PX
    
    return offset_x, offset_y, is_centered

def find_pockets(img, inner_box):
    """
    Finds the 6 pockets based on the inner cushion box.
    Returns a list of dicts: [{'x':, 'y':, 'radius':}, ...]
    """
    ix, iy, iw, ih = inner_box
    pockets = []
    
    # Define search zones (Top-Left, Top-Center, Top-Right, Bottom-Left, Bottom-Center, Bottom-Right)
    # We look slightly *outside* the cushion edge for the pocket center
    offset_corner = 20
    offset_side = 25
    
    search_points = [
        ("TL", ix - offset_corner, iy - offset_corner),
        ("TC", ix + iw // 2, iy - offset_side),
        ("TR", ix + iw + offset_corner, iy - offset_corner),
        ("BL", ix - offset_corner, iy + ih + offset_corner),
        ("BC", ix + iw // 2, iy + ih + offset_side),
        ("BR", ix + iw + offset_corner, iy + ih + offset_corner)
    ]
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    for (name, px, py) in search_points:
        # Define a small ROI around the expected pocket location
        roi_size = 40
        x1 = max(0, int(px - roi_size))
        y1 = max(0, int(py - roi_size))
        x2 = min(img.shape[1], int(px + roi_size))
        y2 = min(img.shape[0], int(py + roi_size))
        
        roi = gray[y1:y2, x1:x2]
        if roi.size == 0: continue
        
        # Look for dark circles
        # Simple thresholding for very dark areas
        _, thresh = cv2.threshold(roi, 50, 255, cv2.THRESH_BINARY_INV)
        
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        found = False
        if contours:
            # Find the largest dark area in this ROI
            largest = max(contours, key=cv2.contourArea)
            (cx, cy), radius = cv2.minEnclosingCircle(largest)
            
            # Filter by reasonable size (pocket shouldn't be tiny or huge)
            if 5 < radius < 35:
                # Convert back to global coordinates
                global_cx = x1 + cx
                global_cy = y1 + cy
                pockets.append({"name": name, "x": global_cx, "y": global_cy, "radius": radius})
                found = True
        
        if not found:
            # Fallback: Just use the theoretical point
            pockets.append({"name": name, "x": px, "y": py, "radius": 15})
            
    return pockets

def chamfer_corners(vertices, chamfer_amount=12):
    """
    Cuts sharp 90-degree corners into two points (chamfer).
    vertices: list of [x, y]
    chamfer_amount: pixels to cut back from the corner
    """
    new_metrics = []
    pts = np.array(vertices)
    N = len(pts)
    
    new_poly = []
    
    for i in range(N):
        p_prev = pts[i-1]
        p_curr = pts[i]
        p_next = pts[(i+1) % N]
        
        # Calculate vectors
        v1 = p_prev - p_curr
        v2 = p_next - p_curr
        
        # Normalize
        l1 = np.linalg.norm(v1)
        l2 = np.linalg.norm(v2)
        if l1 == 0 or l2 == 0: 
            new_poly.append(p_curr.tolist())
            continue
            
        u1 = v1 / l1
        u2 = v2 / l2
        
        # Calculate angle
        # Dot product: a . b = |a||b|cos(theta)
        dot = np.dot(u1, u2)
        # Numerical stability clamp
        dot = max(-1.0, min(1.0, dot))
        angle_deg = np.degrees(np.arccos(dot))
        
        # Check if it's a sharp corner (approx 90 degrees)
        # We target angles between say 80 and 100 degrees
        if 80 < angle_deg < 100:
            # Create two new points along the edges
            # Shift length shouldn't exceed half segment length
            shift = min(chamfer_amount, l1/2.5, l2/2.5)
            
            c1 = p_curr + u1 * shift
            c2 = p_curr + u2 * shift
            
            # Add both points (this effectively cuts the corner)
            # The order depends on the winding, but generally we want to traverse p_prev -> c1 -> c2 -> p_next
            # v1 points TO p_prev, v2 points TO p_next.
            # So from p_curr, we go towards p_next (u2) and towards p_prev (u1).
            # Wait, standard polygon order (i-1) -> (i) -> (i+1).
            # We are replacing (i).
            # The incoming edge is from (i-1) to (i).
            # The outgoing edge is from (i) to (i+1).
            
            # Incoming point (on segment p_prev -> p_curr):
            # p_curr - u1_pointing_to_prev * shift ??? 
            # No, u1 = p_prev - p_curr. So p_curr + u1 * shift moves TOWARDS p_prev.
            # Yes. That is the point on the incoming edge.
            
            # Outgoing point (on segment p_curr -> p_next):
            # u2 = p_next - p_curr. So p_curr + u2 * shift moves TOWARDS p_next.
            
            # Vertex order is p_prev -> p_curr -> p_next
            # We replace p_curr with [p_on_incoming, p_on_outgoing]
            # p_on_incoming = p_curr + u1 * shift
            # p_on_outgoing = p_curr + u2 * shift
            
            # Since we iterate i, we just append these two.
            # CAREFUL: standard drawing is usually CCW or CW.
            # Python lists maintain step order.
            
            # We need to verify which one comes "first" in the traversal.
            # Vertices are P0, P1, P2...
            # At P1: We arrive from P0. We leave to P2.
            # So we hit the "incoming" cut point first, then the "outgoing" cut point.
            
            pt_incoming = p_curr + u1 * shift
            pt_outgoing = p_curr + u2 * shift
            
            new_poly.append(pt_incoming.tolist())
            new_poly.append(pt_outgoing.tolist())
            
        else:
            # Keep original
            new_poly.append(p_curr.tolist())
            
    return new_poly

def extract_from_ground_truth(img):
    """
    Extracts physics data from a color-coded ground truth mask.
    Magenta (Hue ~150) = Playing Surface EXACT BOUNDARY
    """
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 1. Detect Magenta Surface (Hue 140-160)
    # Magenta in OpenCV HSV (0-180) is typically around 150
    lower_magenta = np.array([140, 50, 50], dtype=np.uint8)
    upper_magenta = np.array([160, 255, 255], dtype=np.uint8)
    mask_magenta = cv2.inRange(hsv, lower_magenta, upper_magenta)
    
    # Clean up mask
    kernel = np.ones((3,3), np.uint8)
    mask_magenta = cv2.morphologyEx(mask_magenta, cv2.MORPH_OPEN, kernel)
    
    # Find the main cushion polygon
    contours, _ = cv2.findContours(mask_magenta, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("Error: No Magenta surface found in ground truth image.")
        return None
        
    largest = max(contours, key=cv2.contourArea)
    
    # Use approxPolyDP to get the vertices of the shape
    epsilon = 0.001 * cv2.arcLength(largest, True)
    approx_curve = cv2.approxPolyDP(largest, epsilon, True)
    vertices = approx_curve.reshape(-1, 2).tolist()
    
    # --- CHAMFER CORNERS ---
    # Fix the sharp 90-degree noses
    vertices = chamfer_corners(vertices, chamfer_amount=4)
    
    # Calculate bounding box for centering check
    x, y, w_box, h_box = cv2.boundingRect(largest)
    
    # Check alignment
    off_x, off_y, is_centered = calculate_alignment((x, y, w_box, h_box), w, h)
    
    print(f"--- Ground Truth Mask Detected ---")
    print(f"Dimensions: {w_box}x{h_box}")
    print(f"Vertices: {len(vertices)} (Chamfered)")
    
    result = {
        "centered": is_centered,
        "offset": {"x": off_x, "y": off_y},
        "vertices": vertices,
        "dimensions": { "width": w_box, "height": h_box }
    }
    
    # Visual Debug for GT
    debug_img = img.copy()
    
    # Draw new polygon
    pts = np.array(vertices, np.int32).reshape((-1, 1, 2))
    cv2.polylines(debug_img, [pts], True, (0, 255, 0), 2)
    
    # Save the generated mask for user inspection
    mask_out = np.zeros((h, w, 4), dtype=np.uint8) # Transparent background
    cv2.fillPoly(mask_out, [pts], (255, 255, 255, 255)) # White fill
    output_png = "generated_physics_mask.png"
    cv2.imwrite(output_png, mask_out)
    print(f"Saved generated mask to: {output_png}")
    
    # Draw vertices (on debug view only)
    for pt in vertices:
         cv2.circle(debug_img, (int(pt[0]), int(pt[1])), 3, (0, 0, 255), -1)

    # Use filenames like "CHECK_GT_..."
    cv2.imshow(f'Check GT', debug_img)
    cv2.waitKey(500)
    
    return result

def extract_physics_data(filepath):
    img = cv2.imread(filepath)
    if img is None: return None
    filename = os.path.basename(filepath)

    h, w = img.shape[:2]
    
    # --- CHECK FOR GROUND TRUTH MASK ---
    # Quick random sample or simple histogram check?
    # Let's check center pixel or look for Magenta presence
    hsv_check = cv2.cvtColor(img[h//2-10:h//2+10, w//2-10:w//2+10], cv2.COLOR_BGR2HSV)
    # Magenta is Hue 150 (~140-160)
    mask_magenta_check = cv2.inRange(hsv_check, np.array([140, 50, 50], dtype=np.uint8), np.array([160, 255, 255], dtype=np.uint8))
    
    if cv2.countNonZero(mask_magenta_check) > 50:
        # High likelihood of being the magenta mask
        print(f"--- Analyzing: {filename} (GROUND TRUTH MODE) ---")
        result = extract_from_ground_truth(img)
        if result:
            result['filename'] = filename
        return result
    
    # --- (Standard Detection Code) ---
    center_y, center_x = h // 2, w // 2
    # Ensure sample patch is within bounds
    sy1, sy2 = max(0, center_y-10), min(h, center_y+10)
    sx1, sx2 = max(0, center_x-10), min(w, center_x+10)
    
    sample_patch = img[sy1:sy2, sx1:sx2]
    if sample_patch.size == 0: return None
    
    hsv_patch = cv2.cvtColor(sample_patch, cv2.COLOR_BGR2HSV)
    avg_hsv = np.mean(hsv_patch, axis=(0, 1))

    lower = np.array([max(0, avg_hsv[0] - COLOR_TOLERANCE), 30, 30], dtype=np.uint8)
    upper = np.array([min(180, avg_hsv[0] + COLOR_TOLERANCE), 255, 255], dtype=np.uint8)
    
    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv_img, lower, upper)
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours: return None
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Get the Outer Box
    ox, oy, ox_w, ox_h = cv2.boundingRect(largest_contour)
    outer_box = (ox, oy, ox_w, ox_h)
    
    # Filter out tiny noise (e.g. empty layers or artifacts)
    if ox_w < 100 or ox_h < 100:
        print(f"--- Analyzing: {filename} ---")
        print(f"Skipping: Dimensions {ox_w}x{ox_h} too small to be a table.")
        print("")
        return None
    
    # --- REFINE TO CUSHION EDGE ---
    ix, iy, iw, ih = find_inner_cushions(img, mask, outer_box)
    
    # Construct Vertices from the Inner Box
    vertices = [
        [ix, iy],
        [ix + iw, iy],
        [ix + iw, iy + ih],
        [ix, iy + ih]
    ]

    # --- CHECK PROPER ALIGNMENT ---
    off_x, off_y, is_centered = calculate_alignment((ix, iy, iw, ih), w, h)
    
    # --- FIND POCKETS ---
    pockets = find_pockets(img, (ix, iy, iw, ih))

    # Console Reporting
    print(f"--- Analyzing: {filename} ---")
    print(f"Outer Box: {ox_w}x{ox_h}")
    print(f"Inner Cushion: {iw}x{ih} (Ratio: {iw/ih:.2f})")
    print(f"Pockets Detected: {len(pockets)}")
    
    if is_centered:
        print("✅  Perfectly Centered")
    else:
        print(f"⚠️  OFF-CENTER DETECTED!")
        print(f"   - X Offset: {off_x:+.2f}px")
        print(f"   - Y Offset: {off_y:+.2f}px")
    print("")

    # Visual Debugging
    debug_img = img.copy()
    # Draw Outer (Blue)
    cv2.rectangle(debug_img, (ox, oy), (ox+ox_w, oy+ox_h), (255, 0, 0), 2)
    # Draw Inner Cushion (Green)
    cv2.rectangle(debug_img, (ix, iy), (ix+iw, iy+ih), (0, 255, 0), 2)
    
    # Draw Pockets (Cyan)
    for p in pockets:
        cv2.circle(debug_img, (int(p['x']), int(p['y'])), int(p['radius']), (255, 255, 0), 2)
    
    center_text = "CENTERED" if is_centered else f"OFF: {off_x:.1f}, {off_y:.1f}"
    color = (0, 255, 0) if is_centered else (0, 0, 255)
    cv2.putText(debug_img, center_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    cv2.imshow(f'Check: {filename}', debug_img)
    cv2.waitKey(500) # Short pause

    return {
        "filename": filename,
        "centered": is_centered,
        "offset": {"x": off_x, "y": off_y},
        "vertices": vertices,
        "dimensions": { "width": iw, "height": ih },
        "pockets": pockets
    }

# --- MAIN EXECUTION ---
images = glob.glob(os.path.join(IMAGE_FOLDER, '*.png'))
results = []

for img_path in images:
    data = extract_physics_data(img_path)
    if data: results.append(data)

with open(OUTPUT_JSON, 'w') as f:
    json.dump(results, f, indent=4)
    
cv2.destroyAllWindows()