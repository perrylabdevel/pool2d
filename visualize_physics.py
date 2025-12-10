import cv2
import json
import os
import numpy as np

# Configuration
JSON_PATH = 'public/assets/tmp/tables_physics.json'
IMAGE_FOLDER = 'public/assets/tmp/'

def visualize_physics():
    if not os.path.exists(JSON_PATH):
        print(f"Error: Could not find {JSON_PATH}")
        return

    try:
        with open(JSON_PATH, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    print(f"Loaded data for {len(data)} tables. Press any key to cycle through them.")

    for entry in data:
        filename = entry.get('filename')
        vertices = entry.get('vertices')
        
        if not filename or not vertices:
            continue
            
        filepath = os.path.join(IMAGE_FOLDER, filename)
        img = cv2.imread(filepath)
        
        if img is None:
            print(f"Could not load image: {filepath}")
            continue
            
        # Convert vertices to integer format for polylines
        pts = np.array(vertices, np.int32)
        pts = pts.reshape((-1, 1, 2))
        
        # Draw the Polygon (Green, Thicker)
        cv2.polylines(img, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
        
        # Draw each vertex as a red dot
        for i, pt in enumerate(vertices):
            cv2.circle(img, (int(pt[0]), int(pt[1])), 6, (0, 0, 255), -1)
            # Label vertex index
            cv2.putText(img, str(i), (int(pt[0])+10, int(pt[1])+10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

        # Draw Pockets (Yellow Circles)
        pockets = entry.get('pockets', [])
        for p in pockets:
            cx, cy, r = int(p['x']), int(p['y']), int(p['radius'])
            cv2.circle(img, (cx, cy), r, (0, 255, 255), 2)
            cv2.circle(img, (cx, cy), 2, (0, 255, 255), -1)

        # Draw Stats
        dims = entry.get('dimensions')
        if dims:
            stats_text = f"JSON Data: {dims['width']}x{dims['height']}"
            cv2.putText(img, stats_text, (20, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('JSON Visualization', img)
        key = cv2.waitKey(0) 
        if key == 27: # ESC to quit
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    visualize_physics()
