"""
Convert the pool table SVG into a minimal physics JSON representation.

Outputs play-area bounds (centered at 0,0 with Y-up), rail segments with inward
normals, and pocket centers/radii sampled from the circle geometry.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple


SVG_NS = "http://www.w3.org/2000/svg"
NSMAP = {"svg": SVG_NS}


def tag_name(node: ET.Element) -> str:
    return node.tag.split("}")[-1]


def rotate_point(x: float, y: float, cx: float, cy: float, angle_rad: float) -> Tuple[float, float]:
    dx = x - cx
    dy = y - cy
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    return (
        cx + dx * cos_a - dy * sin_a,
        cy + dx * sin_a + dy * cos_a,
    )


@dataclass
class Scale:
    pixels_per_inch: float
    offset_x: float
    offset_y: float
    rotation_rad: float = 0.0
    rotation_cx: float = 0.0
    rotation_cy: float = 0.0

    def apply(self, x: float, y: float) -> dict:
        """Match the JS PathParser.transform: optional rotate -> translate -> scale -> flip Y."""
        rx, ry = x, y
        if abs(self.rotation_rad) > 1e-6:
            rx, ry = rotate_point(x, y, self.rotation_cx, self.rotation_cy, self.rotation_rad)

        local_x = rx - self.offset_x
        local_y = ry - self.offset_y
        return {"x": local_x / self.pixels_per_inch, "y": -local_y / self.pixels_per_inch}


def parse_rotate(transform: str) -> Tuple[float, float, float]:
    """
    Parse rotate(angle cx cy) returning angle in radians and pivot.
    Defaults pivot to 0,0 when absent.
    """
    match = re.search(
        r"rotate\(\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*(?:([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*)?\)",
        transform,
    )
    if not match:
        return 0.0, 0.0, 0.0
    angle_deg = float(match.group(1))
    cx = float(match.group(2)) if match.group(2) is not None else 0.0
    cy = float(match.group(3)) if match.group(3) is not None else 0.0
    return math.radians(angle_deg), cx, cy


# ---------------------------------------------------------------------------
# Path parsing / flattening (supports M/L/H/V/C and lowercase relatives)
# ---------------------------------------------------------------------------
def tokenize_path(d: str) -> List[str]:
    return re.findall(r"[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)


def parse_path_raw_points(d: str) -> List[Tuple[float, float]]:
    """Parse a path into absolute pixel points without scaling/rotation."""
    tokens = tokenize_path(d)
    idx = 0
    pts: List[Tuple[float, float]] = []
    cursor = (0.0, 0.0)
    start = (0.0, 0.0)
    last_cmd = ""

    def next_number(default: float = 0.0) -> float:
        nonlocal idx
        if idx >= len(tokens):
            return default
        val = float(tokens[idx])
        idx += 1
        return val

    while idx < len(tokens):
        cmd = tokens[idx]
        if re.fullmatch(r"[a-zA-Z]", cmd):
            idx += 1
            last_cmd = cmd
        else:
            cmd = last_cmd

        if cmd in ("M", "m"):
            dx = next_number()
            dy = next_number()
            cursor = (cursor[0] + dx, cursor[1] + dy) if cmd == "m" else (dx, dy)
            start = cursor
            pts.append(cursor)
        elif cmd in ("L", "l"):
            dx = next_number()
            dy = next_number()
            cursor = (cursor[0] + dx, cursor[1] + dy) if cmd == "l" else (dx, dy)
            pts.append(cursor)
        elif cmd in ("H", "h"):
            dx = next_number()
            cursor = (cursor[0] + dx, cursor[1]) if cmd == "h" else (dx, cursor[1])
            pts.append(cursor)
        elif cmd in ("V", "v"):
            dy = next_number()
            cursor = (cursor[0], cursor[1] + dy) if cmd == "v" else (cursor[0], dy)
            pts.append(cursor)
        elif cmd in ("Z", "z"):
            cursor = start
        else:
            while idx < len(tokens) and not re.fullmatch(r"[a-zA-Z]", tokens[idx]):
                idx += 1
    return pts


def add_cubic(points: List[dict], p0: Tuple[float, float], c1: Tuple[float, float], c2: Tuple[float, float],
              p3: Tuple[float, float], scale: Scale, segments: int = 8) -> Tuple[float, float]:
    """Sample a cubic Bezier curve into straight segments."""
    p0x, p0y = p0
    c1x, c1y = c1
    c2x, c2y = c2
    p3x, p3y = p3
    for i in range(1, segments + 1):
        t = i / segments
        mt = 1 - t
        mt2 = mt * mt
        mt3 = mt2 * mt
        t2 = t * t
        t3 = t2 * t
        x = mt3 * p0x + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t3 * p3x
        y = mt3 * p0y + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t3 * p3y
        points.append(scale.apply(x, y))
    return p3x, p3y


def parse_path(d: str, scale: Scale) -> List[dict]:
    tokens = tokenize_path(d)
    idx = 0
    points: List[dict] = []
    cursor = (0.0, 0.0)
    start = (0.0, 0.0)
    last_cmd = ""

    def next_number(default: float = 0.0) -> float:
        nonlocal idx
        if idx >= len(tokens):
            return default
        val = float(tokens[idx])
        idx += 1
        return val

    while idx < len(tokens):
        cmd = tokens[idx]
        if re.fullmatch(r"[a-zA-Z]", cmd):
            idx += 1
            last_cmd = cmd
        else:
            cmd = last_cmd

        if cmd in ("M", "m"):
            dx = next_number()
            dy = next_number()
            if cmd == "m":
                cursor = (cursor[0] + dx, cursor[1] + dy)
            else:
                cursor = (dx, dy)
            start = cursor
            points.append(scale.apply(*cursor))
        elif cmd in ("L", "l"):
            dx = next_number()
            dy = next_number()
            cursor = (cursor[0] + dx, cursor[1] + dy) if cmd == "l" else (dx, dy)
            points.append(scale.apply(*cursor))
        elif cmd in ("H", "h"):
            dx = next_number()
            cursor = (cursor[0] + dx, cursor[1]) if cmd == "h" else (dx, cursor[1])
            points.append(scale.apply(*cursor))
        elif cmd in ("V", "v"):
            dy = next_number()
            cursor = (cursor[0], cursor[1] + dy) if cmd == "v" else (cursor[0], dy)
            points.append(scale.apply(*cursor))
        elif cmd in ("C", "c"):
            # Cubic Bezier
            x1 = next_number()
            y1 = next_number()
            x2 = next_number()
            y2 = next_number()
            x = next_number()
            y = next_number()
            if cmd == "c":
                x1 += cursor[0]
                y1 += cursor[1]
                x2 += cursor[0]
                y2 += cursor[1]
                x += cursor[0]
                y += cursor[1]
            cursor = add_cubic(points, cursor, (x1, y1), (x2, y2), (x, y), scale)
        elif cmd in ("Z", "z"):
            cursor = start
        else:
            # Unsupported command: consume following numbers until next command
            while idx < len(tokens) and not re.fullmatch(r"[a-zA-Z]", tokens[idx]):
                idx += 1
    return points


# ---------------------------------------------------------------------------
# SVG extraction helpers
# ---------------------------------------------------------------------------
def find_elements_with_id(root: ET.Element, keyword: str) -> List[ET.Element]:
    return [el for el in root.iter() if keyword in el.attrib.get("id", "")]


def compute_normal(p1: dict, p2: dict) -> dict:
    dx = p2["x"] - p1["x"]
    dy = p2["y"] - p1["y"]
    length = math.hypot(dx, dy) or 1.0
    nx = -dy / length
    ny = dx / length
    midx = (p1["x"] + p2["x"]) * 0.5
    midy = (p1["y"] + p2["y"]) * 0.5
    if nx * -midx + ny * -midy < 0:
        nx *= -1
        ny *= -1
    return {"x": nx, "y": ny}


def parse_play_area(root: ET.Element) -> Tuple[Scale, dict]:
    play_area = next((el for el in root.iter() if "play_area" in el.attrib.get("id", "")), None)
    if play_area is None:
        raise RuntimeError("No element with id containing 'play_area' found.")

    # Handle <rect> or path-based play area definitions
    w_attr = play_area.attrib.get("width")
    h_attr = play_area.attrib.get("height")
    x_attr = play_area.attrib.get("x")
    y_attr = play_area.attrib.get("y")
    transform = play_area.attrib.get("transform", "")

    if w_attr and h_attr:
        w = float(w_attr)
        h = float(h_attr)
        x = float(x_attr or 0)
        y = float(y_attr or 0)
        angle_rad, pivot_x, pivot_y = parse_rotate(transform)
        cx = x + w * 0.5
        cy = y + h * 0.5
        rotated_cx, rotated_cy = rotate_point(cx, cy, pivot_x or cx, pivot_y or cy, angle_rad)
        corners_px = [
            (x, y),
            (x + w, y),
            (x + w, y + h),
            (x, y + h),
        ]
        corners_rotated = [
            rotate_point(px, py, pivot_x or cx, pivot_y or cy, angle_rad) for px, py in corners_px
        ]
        ppi = w / 100.0 if w else 1.0
    else:
        # Path fallback: derive bounds from d attribute
        d = play_area.attrib.get("d", "")
        pts_px = parse_path_raw_points(d)
        if not pts_px:
            raise RuntimeError("play_area path has no points.")
        xs = [p[0] for p in pts_px]
        ys = [p[1] for p in pts_px]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        w = max_x - min_x
        h = max_y - min_y
        cx = (min_x + max_x) * 0.5
        cy = (min_y + max_y) * 0.5
        rotated_cx, rotated_cy = cx, cy
        corners_rotated = [
            (min_x, min_y),
            (max_x, min_y),
            (max_x, max_y),
            (min_x, max_y),
        ]
        angle_rad = 0.0
        ppi = w / 100.0 if w else 1.0

    scale = Scale(
        pixels_per_inch=ppi,
        offset_x=rotated_cx,
        offset_y=rotated_cy,
        rotation_rad=0.0,
        rotation_cx=0.0,
        rotation_cy=0.0,
    )
    corners = [scale.apply(px, py) for px, py in corners_rotated]

    play_area_data = {
        "center": {"x": 0.0, "y": 0.0},
        "width": w / scale.pixels_per_inch if scale.pixels_per_inch else w,
        "height": h / scale.pixels_per_inch if scale.pixels_per_inch else h,
        "corners": corners,
        "rotationDeg": math.degrees(angle_rad),
    }
    return scale, play_area_data


def parse_cushions(root: ET.Element, scale: Scale) -> List[dict]:
    """
    Derive a rail per cushion by taking the longest edge of each cushion path.
    Also record the full outline points for debugging/visualization.
    """
    rails: List[dict] = []
    cushion_nodes = find_elements_with_id(root, "cushion")

    for node_idx, node in enumerate(cushion_nodes):
        node_id = node.attrib.get("id", f"cushion_{node_idx}")
        paths: List[ET.Element] = []
        if tag_name(node) == "path":
            paths.append(node)
        else:
            paths.extend(child for child in node.iter() if tag_name(child) == "path")

        for path_idx, path in enumerate(paths):
            d = path.attrib.get("d", "")
            raw_pts_px = parse_path_raw_points(d)
            if len(raw_pts_px) < 2:
                continue
            # Transform to inches
            pts = [scale.apply(px, py) for (px, py) in raw_pts_px]
            # Find longest edge
            best = None
            for i in range(len(pts)):
                p1 = pts[i]
                p2 = pts[(i + 1) % len(pts)]
                dist = math.hypot(p2["x"] - p1["x"], p2["y"] - p1["y"])
                if best is None or dist > best["dist"]:
                    best = {"from": p1, "to": p2, "dist": dist}
            if best:
                rails.append(
                    {
                        "id": f"{node_id}_p{path_idx}_longest",
                        "from": best["from"],
                        "to": best["to"],
                        "normal": compute_normal(best["from"], best["to"]),
                        "outline": pts,
                    }
                )
    return rails


def parse_pockets(root: ET.Element, scale: Scale, outline_segments: int = 24) -> List[dict]:
    pockets: List[dict] = []
    pocket_nodes = find_elements_with_id(root, "pocket")
    for idx, node in enumerate(pocket_nodes):
        node_id = node.attrib.get("id", f"pocket_{idx}")
        if "felt" in node_id:
            continue
        if tag_name(node) != "circle":
            continue
        cx = float(node.attrib.get("cx", "0"))
        cy = float(node.attrib.get("cy", "0"))
        r = float(node.attrib.get("r", "0"))
        center = scale.apply(cx, cy)
        radius = r / scale.pixels_per_inch if scale.pixels_per_inch else r
        outline = []
        for i in range(outline_segments):
            theta = (i / outline_segments) * math.tau
            px = cx + math.cos(theta) * r
            py = cy + math.sin(theta) * r
            outline.append(scale.apply(px, py))
        pockets.append(
            {
                "id": node_id,
                "center": center,
                "radius": radius,
                "outline": outline,
                "source": "circle",
            }
        )
    return pockets


def convert(svg_path: Path, output_path: Path, tolerance_in: float) -> dict:
    tree = ET.parse(svg_path)
    root = tree.getroot()

    scale, play_area = parse_play_area(root)
    rails = parse_cushions(root, scale)
    # Seed rails with play area edges for a clean rectangle fallback
    if play_area.get("corners"):
        pa = play_area["corners"]
        rails.extend([
            {"id": "play_area_north", "from": pa[0], "to": pa[1], "normal": compute_normal(pa[0], pa[1])},
            {"id": "play_area_east", "from": pa[1], "to": pa[2], "normal": compute_normal(pa[1], pa[2])},
            {"id": "play_area_south", "from": pa[2], "to": pa[3], "normal": compute_normal(pa[2], pa[3])},
            {"id": "play_area_west", "from": pa[3], "to": pa[0], "normal": compute_normal(pa[3], pa[0])},
        ])
    pockets = parse_pockets(root, scale)

    result = {
        "meta": {
            "source": str(svg_path),
            "pixelsPerInch": scale.pixels_per_inch,
            "offset": {"x": scale.offset_x, "y": scale.offset_y},
        },
        "playArea": play_area,
        "rails": rails,
        "pockets": pockets,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2))
    return result


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser(description="Convert pool table SVG into minimal physics JSON.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("public/assets/tmp/table.svg"),
        help="Path to the source SVG.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/geometry/table.physics.json"),
        help="Destination JSON path.",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.5,
        help="Inches to allow when selecting inner rail segments.",
    )
    args = parser.parse_args(list(argv))

    if not args.input.exists():
        print(f"[error] Input SVG not found: {args.input}", file=sys.stderr)
        return 1

    result = convert(args.input, args.output, tolerance_in=args.tolerance)
    print(f"[ok] Wrote {args.output} with {len(result['rails'])} rails and {len(result['pockets'])} pockets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
