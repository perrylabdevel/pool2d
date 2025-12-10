import cv2
import numpy as np
import os

# Path to the uploaded image (found in metadata)
IMG_PATH = "/Users/brian/.gemini/antigravity/brain/27e773f5-3259-403f-ac20-2712af84854d/uploaded_image_1765372432935.png"

def analyze_mask():
    if not os.path.exists(IMG_PATH):
        print(f"File not found: {IMG_PATH}")
        return

    img = cv2.imread(IMG_PATH)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Range for Magenta
    lower_magenta = np.array([140, 50, 50], dtype=np.uint8)
    upper_magenta = np.array([160, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_magenta, upper_magenta)
    
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    largest = max(contours, key=cv2.contourArea)
    
    # Trace polygon
    epsilon = 0.001 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)
    vertices = approx.reshape(-1, 2)
    
    print(f"Detected {len(vertices)} vertices for the mask.")
    
    # Create debug image
    debug = img.copy()
    cv2.drawContours(debug, [approx], -1, (0, 255, 0), 2)
    
    for i, pt in enumerate(vertices):
        cv2.circle(debug, (pt[0], pt[1]), 3, (0, 0, 255), -1)
        # Check angle at this vertex
        p_prev = vertices[i-1]
        p_curr = vertices[i]
        p_next = vertices[(i+1) % len(vertices)]
        
        v1 = p_prev - p_curr
        v2 = p_next - p_curr
        
        angle = np.degrees(np.arccos(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))))
        
        # Annotate sharp corners (likely noses or pocket backs)
        if angle < 160: 
            cv2.putText(debug, f"{int(angle)}deg", (pt[0], pt[1]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)

    output_path = "mask_analysis_debug.png"
    cv2.imwrite(output_path, debug)
    print(f"Saved analysis to {output_path}")

if __name__ == "__main__":
    analyze_mask()
