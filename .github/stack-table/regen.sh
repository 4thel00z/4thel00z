#!/bin/sh
# Regenerates ../../stack.png from stack.md + stack-theme.css via pdfboss.
set -e
cd "$(dirname "$0")"
pdfboss create md stack.md --theme stack-theme.css --size a4 --landscape -o stack.pdf
pdfboss render stack.pdf --page 1 -o stack-page.png --scale 3.0
python3 - <<'EOF'
from PIL import Image, ImageChops

img = Image.open("stack-page.png").convert("RGB")
tint = Image.new("RGB", img.size, (253, 253, 254))
img = ImageChops.multiply(img, tint)
bg = Image.new("RGB", img.size, img.getpixel((5, 5)))
bbox = ImageChops.difference(img, bg).getbbox()
pad = 54
box = (
    max(0, bbox[0] - pad),
    max(0, bbox[1] - pad),
    min(img.size[0], bbox[2] + pad),
    min(img.size[1], bbox[3] + pad),
)
img.crop(box).save("../../stack.png")
EOF
rm -f stack.pdf stack-page.png
