from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/app-icon.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-source-1024.png")

img = Image.open(src).convert("RGBA")
# The icon is 1024x1024; background is white/transparent at corners.
# Find bounding box of dark pixels (whale).
pixels = img.load()
left, top, right, bottom = img.width, img.height, 0, 0
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        # Treat dark-ish pixels (whale is near black) and reasonably opaque
        if a > 30 and (r + g + b) / 3 < 100:
            if x < left: left = x
            if x > right: right = x
            if y < top: top = y
            if y > bottom: bottom = y

print(f"Whale bounding box: ({left}, {top}, {right}, {bottom})")
print(f"Whale size: {right-left+1} x {bottom-top+1}")

# Crop the whale with a small internal padding
pad = 20
crop = img.crop((left - pad, top - pad, right + pad + 1, bottom + pad + 1))

# Target: whale should occupy ~78% of canvas width, like WorkBuddy icon.
canvas_size = 1024
target_ratio = 0.78
scale = (canvas_size * target_ratio) / max(crop.width, crop.height)
new_w = int(crop.width * scale)
new_h = int(crop.height * scale)
resized = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Paste onto white canvas
canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
x = (canvas_size - new_w) // 2
y = (canvas_size - new_h) // 2
canvas.paste(resized, (x, y), resized)

# Save as PNG (white bg)
canvas.save(out, "PNG")
print(f"Saved resized whale source to: {out} ({canvas.size})")
