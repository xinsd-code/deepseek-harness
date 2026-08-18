from PIL import Image, ImageFilter
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-source-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-flat-1024.png")

img = Image.open(src).convert("RGBA")

# Convert to grayscale for thresholding
gray = img.convert("L")

# Threshold: keep dark pixels (whale body), discard light pixels (shadow + plate + bg)
# Whale body is very dark (< ~80). Use 90 as threshold.
mask = gray.point(lambda p: 255 if p < 90 else 0, mode="1")

# Create output: white background
out_img = Image.new("RGBA", img.size, (255, 255, 255, 255))

# Paste original pixels only where mask is white
out_img.paste(img, (0, 0), mask.convert("L"))

# Optional: slight blur to smooth edges? No, keep crisp.
out_img.save(out, "PNG")
print(f"Saved flat whale to {out}")
