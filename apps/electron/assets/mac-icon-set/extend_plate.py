from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-source-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-extended-1024.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

# Compute average color of non-white, non-whale pixels (the plate/shadow area)
# Heuristic: pixels with lightness between 150 and 245 are plate.
plate_colors = []
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        avg = (r + g + b) / 3
        if 150 < avg < 245:
            plate_colors.append((r, g, b, a))

if plate_colors:
    avg_r = int(sum(c[0] for c in plate_colors) / len(plate_colors))
    avg_g = int(sum(c[1] for c in plate_colors) / len(plate_colors))
    avg_b = int(sum(c[2] for c in plate_colors) / len(plate_colors))
else:
    avg_r = avg_g = avg_b = 240

print(f"Average plate color: ({avg_r}, {avg_g}, {avg_b})")

# Replace pure/very-light white pixels with the average plate color
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if r > 250 and g > 250 and b > 250:
            pixels[x, y] = (avg_r, avg_g, avg_b, 255)

img.save(out, "PNG")
print(f"Saved extended plate whale to {out}")
