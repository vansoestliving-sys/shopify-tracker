# Brand Colors - Van Soest Living

## Color Palette

### Primary Color
- **Main**: `#FF914D` (Orange/Coral)
- **Hover**: `#ff7a2e` (Darker orange)
- Used for: Buttons, links, icons, CTAs

### Secondary/Accent Color
- **Main**: `#D2C6B8` (Beige/Taupe)
- Used for: Secondary buttons, borders, subtle accents

### Neutral
- **White**: `#FFFFFF`
- Used for: Backgrounds, cards

## Implementation

### Tailwind Config
Colors are defined in `tailwind.config.js`:
- `primary-400` = `#FF914D` (main brand color)
- `primary-500` = `#ff7a2e` (hover state)
- `accent-200` = `#D2C6B8` (secondary color)

### Usage Examples

**Primary Buttons:**
```tsx
className="bg-primary-400 hover:bg-primary-500 text-white"
```

**Secondary Buttons:**
```tsx
className="bg-accent-200 hover:bg-accent-300 text-gray-800"
```

**Links:**
```tsx
className="text-primary-400 hover:text-primary-500"
```

**Icons:**
```tsx
className="text-primary-400"
```

## Updated Components

All components have been updated to use the new brand colors:
- ✅ Homepage (`app/page.tsx`)
- ✅ Login page (`app/(auth)/login/page.tsx`)
- ✅ Register page (`app/(auth)/register/page.tsx`)
- ✅ Track page (`app/track/page.tsx`)
- ✅ Customer dashboard (`app/(customer)/dashboard/page.tsx`)
- ✅ Admin dashboard (`app/(admin)/admin/page.tsx`)
- ✅ Global styles (`app/globals.css`)
- ✅ Tailwind config (`tailwind.config.js`)

## Backgrounds

All pages now use clean white backgrounds (`bg-white`) to match the main website style at [vansoestliving.nl](https://vansoestliving.nl/).

