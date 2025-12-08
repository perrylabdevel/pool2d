import bpy
import bmesh
import math
import os
import mathutils

# --- CONFIGURATION ---
BALL_RADIUS = 0.057 / 2  
# Change path as needed
OUTPUT_PATH = "C:\\temp\\pool_balls_v2.glb" 

# Path to textures directory
TEXTURE_PATH = "/Users/brian/pool2d/textures"
# Equirectangular UVs cover twice as much distance horizontally as vertically on a sphere,
# so we double the U scale to keep circular decals round on the ball surface.
UV_ASPECT_FIX = (2.0, 1.0, 1.0)

BALL_DATA = [
    (1, "poolballTx01.jpg"), (2, "poolballTx02.jpg"), (3, "poolballTx03.jpg"), 
    (4, "poolballTx04.jpg"), (5, "poolballTx5.jpg"), (6, "poolballTx6.jpg"), 
    (7, "poolballTx7.jpg"), (8, "poolballTx8.jpg"), (9, "poolballTx9.jpg"), 
    (10, "poolballTx10.jpg"), (11, "poolballTx11.jpg"), (12, "poolballTx12.jpg"),
    (13, "poolballTx13.jpg"), (14, "poolballTx14.jpg"), (15, "poolballTx15.jpg")
]

def clean_scene():
    # Ensure we are in object mode before deleting
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
        
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.select_by_type(type='MESH')
    bpy.ops.object.delete()
    
    # Clean up unused materials to prevent clutter
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    
    # Clean up unused images
    for img in bpy.data.images:
        if img.users == 0:
            bpy.data.images.remove(img)

def ensure_mapping_scale(mat):
    """Force existing materials to use our UV aspect correction."""
    if not mat or not mat.use_nodes:
        return
    for node in mat.node_tree.nodes:
        if node.type == 'MAPPING':
            node.inputs['Scale'].default_value[0] = UV_ASPECT_FIX[0]
            node.inputs['Scale'].default_value[1] = UV_ASPECT_FIX[1]
            node.inputs['Scale'].default_value[2] = UV_ASPECT_FIX[2]

def create_material_with_texture(name, texture_filename, brightness_factor=1.0):
    """Create a material with an image texture"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    # Clear default nodes
    nodes.clear()
    
    # Create nodes
    node_tex_coord = nodes.new(type='ShaderNodeTexCoord')
    node_mapping = nodes.new(type='ShaderNodeMapping')
    node_tex_image = nodes.new(type='ShaderNodeTexImage')
    # Use default FLAT projection which respects UVs
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    
    # Load image texture
    texture_path = os.path.join(TEXTURE_PATH, texture_filename)
    if os.path.exists(texture_path):
        img = bpy.data.images.load(texture_path)
        node_tex_image.image = img
    else:
        print(f"Warning: Texture not found: {texture_path}")
    
    # Set up material properties for glossy pool ball look
    node_bsdf.inputs['Roughness'].default_value = 0.1 
    node_bsdf.inputs['Specular IOR Level'].default_value = 0.7
    
    # Reset mapping scale to fix squashed look - scale X by 2.0 to squeeze width
    node_mapping.inputs['Scale'].default_value = UV_ASPECT_FIX
    
    # Add brightness adjustment if needed
    if brightness_factor != 1.0:
        node_rgb_curves = nodes.new(type='ShaderNodeRGBCurve')
        node_rgb_curves.location = (0, -200)
        # Adjust the master curve to darken
        node_rgb_curves.mapping.curves[3].points[1].location = (1.0, brightness_factor)
        
        # Use UV coordinates with Mapping
        links.new(node_tex_coord.outputs['UV'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_tex_image.inputs['Vector'])
        links.new(node_tex_image.outputs['Color'], node_rgb_curves.inputs['Color'])
        links.new(node_rgb_curves.outputs['Color'], node_bsdf.inputs['Base Color'])
    else:
        # Use UV coordinates with Mapping
        links.new(node_tex_coord.outputs['UV'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_tex_image.inputs['Vector'])
        links.new(node_tex_image.outputs['Color'], node_bsdf.inputs['Base Color'])
    
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    
    # Position nodes for better organization
    node_tex_coord.location = (-800, 0)
    node_mapping.location = (-600, 0)
    node_tex_image.location = (-300, 0)
    node_bsdf.location = (200, 0)
    node_output.location = (500, 0)
    
    return mat

def create_white_material():
    """Create a simple white material for the cue ball"""
    mat = bpy.data.materials.new(name="Mat_CueBall")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs['Base Color'].default_value = (0.92, 0.92, 0.92, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.1 
    bsdf.inputs['Specular IOR Level'].default_value = 0.7
    return mat

def create_ball(number, texture_filename, location):
    """Create a pool ball with texture applied"""
    # Create UV sphere
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48, ring_count=24, radius=BALL_RADIUS, location=location
    )
    ball = bpy.context.active_object
    ball.name = f"Ball_{number}" 
    bpy.ops.object.shade_smooth()

    # Get or create material
    if number == 0:
        # Cue ball - simple white
        mat = bpy.data.materials.get("Mat_CueBall") or create_white_material()
    else:
        # Numbered ball - use texture
        mat_name = f"Mat_Ball_{number}"
        # Darken balls 1, 2, and 9 which tend to look washed out
        brightness = 0.75 if number in [1, 2, 9] else 1.0
        mat = bpy.data.materials.get(mat_name)
        if mat:
            ensure_mapping_scale(mat)
        else:
            mat = create_material_with_texture(mat_name, texture_filename, brightness)
    
    # Assign material
    ball.data.materials.append(mat)

def arrange_rack():
    """Arrange balls in a standard pool rack formation"""
    # Slightly tighter spacing
    spacing = BALL_RADIUS * 2.005 
    row_offset_x = spacing * math.sin(math.radians(60))
    row_offset_y = spacing * 0.5
    positions = []
    
    start_x = 0
    for row in range(5):
        row_x = start_x + (row * row_offset_x)
        start_y = -(row * row_offset_y)
        for col in range(row + 1):
            pos = (row_x, start_y + (col * spacing), BALL_RADIUS)
            positions.append(pos)
    
    balls_to_place = BALL_DATA[:] 
    
    # Randomize placement except 1 and 8
    import random
    random.shuffle(balls_to_place)

    final_placement = [None] * 15

    # Find and place 1 and 8 specifically
    ball_1 = next(b for b in balls_to_place if b[0] == 1)
    ball_8 = next(b for b in balls_to_place if b[0] == 8)
    balls_to_place.remove(ball_1)
    balls_to_place.remove(ball_8)

    final_placement[0] = ball_1 # Apex
    final_placement[4] = ball_8 # Center

    # Fill rest
    current_idx = 0
    for i in range(15):
        if final_placement[i] is None:
            final_placement[i] = balls_to_place[current_idx]
            current_idx += 1
            
    for i, pos in enumerate(positions):
        b_data = final_placement[i]
        create_ball(b_data[0], b_data[1], pos)

    # Cue Ball
    create_ball(0, None, (-0.5, 0, BALL_RADIUS))

def setup_lighting():
    """Create a professional three-point lighting setup for pool balls"""
    
    # Key Light - Main light source from upper front-right
    bpy.ops.object.light_add(type='AREA', location=(0.3, -0.4, 0.5))
    key_light = bpy.context.active_object
    key_light.name = "Key_Light"
    key_light.data.energy = 25  # Reduced from 150
    key_light.data.size = 0.3
    key_light.rotation_euler = (math.radians(45), 0, math.radians(-30))
    key_light.data.color = (1.0, 0.98, 0.95)  # Slightly warm
    
    # Fill Light - Softer light from the left to fill shadows
    bpy.ops.object.light_add(type='AREA', location=(-0.4, -0.2, 0.3))
    fill_light = bpy.context.active_object
    fill_light.name = "Fill_Light"
    fill_light.data.energy = 12  # Reduced from 60
    fill_light.data.size = 0.4
    fill_light.rotation_euler = (math.radians(50), 0, math.radians(45))
    fill_light.data.color = (0.95, 0.97, 1.0)  # Slightly cool
    
    # Rim Light - Backlight to create edge highlights
    bpy.ops.object.light_add(type='SPOT', location=(0.0, 0.5, 0.4))
    rim_light = bpy.context.active_object
    rim_light.name = "Rim_Light"
    rim_light.data.energy = 20  # Reduced from 100
    rim_light.rotation_euler = (math.radians(130), 0, 0)
    rim_light.data.spot_size = math.radians(60)
    rim_light.data.spot_blend = 0.3
    
    # Top Area Light - Broad overhead lighting for overall illumination
    bpy.ops.object.light_add(type='AREA', location=(0.0, 0.0, 0.6))
    top_light = bpy.context.active_object
    top_light.name = "Top_Light"
    top_light.data.energy = 15  # Reduced from 80
    top_light.data.size = 0.8
    top_light.rotation_euler = (0, 0, 0)
    top_light.data.color = (1.0, 1.0, 1.0)
    
    # Set up world lighting for ambient light
    world = bpy.context.scene.world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get('Background')
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.01, 0.01, 0.01, 1.0)  # Darker background
        bg_node.inputs['Strength'].default_value = 0.05  # Much lower ambient
    
    print("Lighting setup complete")

# --- EXECUTION ---
clean_scene()
setup_lighting()
arrange_rack()

# Export settings optimized for small file size
OUTPUT_PATH = "/Users/brian/pool2d/public/poolballs.glb"

output_dir = os.path.dirname(OUTPUT_PATH)
if not os.path.exists(output_dir) and output_dir != "":
    os.makedirs(output_dir)

print(f"Exporting to {OUTPUT_PATH}...")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    use_selection=False,
    export_lights=False,  # Don't export lights to keep file small
    export_cameras=False,  # Don't export cameras
    export_materials='EXPORT',  # Export materials with textures
    export_attributes=False,  # Skip custom attributes
    use_mesh_edges=False,
    use_mesh_vertices=False,
    export_texcoords=True,  # Need UVs for textures
    export_normals=True,
    export_draco_mesh_compression_enable=True,  # Enable Draco compression
    export_draco_mesh_compression_level=6,  # Maximum compression
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_texture_dir='',  # Embed textures in GLB
    export_image_format='JPEG',  # Use JPEG for smaller size
    export_jpeg_quality=85  # Good quality, smaller than PNG
)
print("Export complete!")

# Print file size
if os.path.exists(OUTPUT_PATH):
    file_size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"File size: {file_size_mb:.2f} MB")
