"""Rebuild the prototype's embedded WebP photos. Requires Pillow."""
from base64 import b64encode
from io import BytesIO
import json
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
start = '// BEGIN GENERATED PHOTOS\n'
end = '// END GENERATED PHOTOS\n'
photos = {}
for path in sorted((root / 'assets').glob('*.jpg')):
    with Image.open(path) as source:
        photo = ImageOps.exif_transpose(source).convert('RGB')
        photo.thumbnail((720, 1200), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        photo.save(buffer, format='WEBP', quality=72, method=6)
        photos[path.stem] = 'data:image/webp;base64,' + b64encode(buffer.getvalue()).decode('ascii')

app = root / 'app.js'
source = app.read_text()
if start in source:
    source = source.split(start, 1)[0] + source.split(end, 1)[1]
bundle = start + 'const photos=' + json.dumps(photos, separators=(',', ':')) + ';\n' + end
app.write_text(bundle + source)
print(f'Bundled {len(photos)} photos: {len(bundle.encode()) // 1024} KB (base64 included)')
