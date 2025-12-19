#!/usr/bin/env python3
"""
Compute and (optionally) update table skin pixels-per-inch (PPI).

This project sizes the table skin mesh in world inches using:
  skinWidthIn  = imageWidthPx  / meta.pixelsPerInch
  skinHeightIn = imageHeightPx / meta.pixelsPerInch

For the skin to align with the table geometry, the skin image aspect ratio and
PPI must match the table's outer extents.

Examples:
  python3 tools/skin_ppi.py --physics src/geometry/table.physics.json --skin src/assets/tmp/skin.png
  python3 tools/skin_ppi.py --physics src/geometry/table.physics.json --skin my_skin.png --fit width --write
  python3 tools/skin_ppi.py --physics src/geometry/table.physics.json --target-ppi 15.36
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
from typing import Any, Dict, Tuple


def read_png_dims(path: str) -> Tuple[int, int]:
    with open(path, "rb") as f:
        sig = f.read(8)
        if sig != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"Not a PNG: {path}")
        while True:
            raw = f.read(8)
            if len(raw) < 8:
                raise ValueError(f"Missing IHDR: {path}")
            length, ctype = struct.unpack(">I4s", raw)
            data = f.read(length)
            f.read(4)  # CRC
            if ctype == b"IHDR":
                width, height = struct.unpack(">II", data[:8])
                return int(width), int(height)


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, payload: Dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def compute_outer_extents_inches(physics_json: Dict[str, Any]) -> Tuple[float, float]:
    max_x = 0.0
    max_y = 0.0

    def update(pt: Dict[str, Any]) -> None:
        nonlocal max_x, max_y
        x = float(pt.get("x", 0))
        y = float(pt.get("y", 0))
        if math.isfinite(x):
            max_x = max(max_x, abs(x))
        if math.isfinite(y):
            max_y = max(max_y, abs(y))

    for rail in physics_json.get("rails", []) or []:
        for pt in rail.get("outline", []) or []:
            update(pt)
    for pocket in physics_json.get("pockets", []) or []:
        for pt in pocket.get("outline", []) or []:
            update(pt)

    if max_x <= 0 or max_y <= 0:
        raise ValueError("Could not compute outer extents from rails/pockets outlines (max extent was 0).")

    return max_x * 2, max_y * 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--physics", default="src/geometry/table.physics.json", help="Path to table.physics.json")
    ap.add_argument("--skin", help="Path to skin PNG; if omitted, only prints table extents / pixel suggestions.")
    ap.add_argument("--fit", choices=("width", "height", "avg"), default="width", help="How to compute PPI from an image")
    ap.add_argument("--target-ppi", type=float, help="If provided, prints the ideal skin pixel dimensions for this PPI.")
    ap.add_argument("--write", action="store_true", help="Write computed PPI into physics JSON meta.pixelsPerInch")
    args = ap.parse_args()

    physics_path = args.physics
    physics_json = load_json(physics_path)
    meta = physics_json.setdefault("meta", {})

    outer_w_in, outer_h_in = compute_outer_extents_inches(physics_json)
    current_ppi = float(meta.get("pixelsPerInch", 7.68))

    print(f"physics: {physics_path}")
    print(f"table outer (in): {outer_w_in:.6f} x {outer_h_in:.6f}")
    print(f"table aspect: {outer_w_in / outer_h_in:.6f}")
    print(f"current meta.pixelsPerInch: {current_ppi:.6f}")
    print(f"ideal skin px @ current PPI: {round(outer_w_in * current_ppi)} x {round(outer_h_in * current_ppi)}")

    if args.target_ppi:
        target_ppi = float(args.target_ppi)
        print(f"ideal skin px @ target PPI {target_ppi:.6f}: {round(outer_w_in * target_ppi)} x {round(outer_h_in * target_ppi)}")

    if not args.skin:
        return 0

    skin_path = args.skin
    if not os.path.exists(skin_path):
        raise FileNotFoundError(skin_path)

    w_px, h_px = read_png_dims(skin_path)
    print(f"skin: {skin_path}")
    print(f"skin px: {w_px} x {h_px}")
    print(f"skin aspect: {w_px / h_px:.6f}")

    ppi_w = w_px / outer_w_in
    ppi_h = h_px / outer_h_in
    if args.fit == "width":
        ppi = ppi_w
    elif args.fit == "height":
        ppi = ppi_h
    else:
        ppi = (ppi_w + ppi_h) / 2

    skin_w_in = w_px / current_ppi
    skin_h_in = h_px / current_ppi
    print(f"skin size from current PPI (in): {skin_w_in:.6f} x {skin_h_in:.6f}")
    print(f"recommended PPI (fit width): {ppi_w:.6f}")
    print(f"recommended PPI (fit height): {ppi_h:.6f}")
    print(f"chosen PPI (--fit {args.fit}): {ppi:.6f}")

    # If you keep the image width, what height should it be to match table aspect exactly?
    ideal_h_px_keep_w = round(outer_h_in * ppi_w)
    ideal_w_px_keep_h = round(outer_w_in * ppi_h)
    print(f"recommended px (keep width): {w_px} x {ideal_h_px_keep_w}")
    print(f"recommended px (keep height): {ideal_w_px_keep_h} x {h_px}")

    if args.write:
        meta["pixelsPerInch"] = float(f"{ppi:.6f}")
        save_json(physics_path, physics_json)
        print(f"wrote meta.pixelsPerInch = {meta['pixelsPerInch']:.6f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

