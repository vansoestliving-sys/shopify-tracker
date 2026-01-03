# Logo Setup Guide

## 📁 Where to Place Your Logo

Place your logo file in: `public/assets/images/`

**Supported file names:**
- `logo.svg` (recommended - best quality, scalable)
- `logo.png` (with transparency)
- `logo.jpg` or `logo.jpeg`

## 🎨 Logo Requirements

### Recommended: SVG
- Scalable (looks good at any size)
- Small file size
- Works on all screens
- Best for web

### PNG
- Use if you need transparency
- Higher file size
- Good quality

### JPG
- Use for photos/complex images
- No transparency
- Smaller file size than PNG

## 📏 Recommended Dimensions

- **Width**: 200-300px (or scalable SVG)
- **Height**: 50-100px (or scalable SVG)
- **Aspect Ratio**: 3:1 to 4:1 (wide format works best)

## ✅ Where Logo Appears

Your logo will automatically appear on:
- ✅ Homepage (`/`)
- ✅ Track page (`/track`)
- ✅ Login page (`/login`)
- ✅ Register page (`/register`)
- ✅ Customer dashboard (`/dashboard`)
- ✅ Admin dashboard (`/admin`)

## 🔄 How It Works

1. The app tries to load `logo.svg` first
2. If not found, tries `logo.png`
3. If not found, tries `logo.jpg`
4. If none found, shows text fallback: "Van Soest Living"

## 📝 Quick Steps

1. **Get your logo file** (SVG, PNG, or JPG)
2. **Rename it** to `logo.svg`, `logo.png`, or `logo.jpg`
3. **Place it** in `public/assets/images/`
4. **Refresh** your browser - logo should appear!

## 🎯 Example

```
public/
  assets/
    images/
      logo.svg  ← Your logo here
```

That's it! The logo will automatically appear on all pages.

