from PIL import Image, ImageDraw, ImageFont
import os

for target_dir in ['src/public/icons', 'public/icons']:
    os.makedirs(target_dir, exist_ok=True)
    for size in [16, 48, 128]:
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        margin = max(1, size // 16)
        radius = max(2, size // 4)

        # Rounded rectangle with modern blue background
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=radius,
            fill='#3B82F6'
        )

        # Add a stylized letter 'T'
        # For simplicity and crisp rendering without external font files, draw lines for 'T'
        t_color = 'white'
        t_top = size * 0.28
        t_bottom = size * 0.72
        t_left = size * 0.26
        t_right = size * 0.74
        stroke = max(1, size // 8)

        # Horizontal bar of T
        draw.rectangle([t_left, t_top, t_right, t_top + stroke], fill=t_color)
        # Vertical stem of T
        draw.rectangle([size / 2 - stroke / 2, t_top, size / 2 + stroke / 2, t_bottom], fill=t_color)

        filepath = os.path.join(target_dir, f'icon-{size}.png')
        img.save(filepath, format='PNG')
        print(f'Generated {filepath} ({size}x{size})')
