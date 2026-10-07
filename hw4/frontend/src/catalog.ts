// Display helpers shared by the catalogue filters and product cards.

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'hoodie', label: 'Hoodies' },
  { id: 'crewneck', label: 'Crewnecks' },
  { id: 't-shirt', label: 'Tees' },
  { id: 'quarter-zip', label: 'Quarter-zips' },
  { id: 'jacket', label: 'Jackets' },
  { id: 'long-sleeve shirt', label: 'Long-sleeve' },
  { id: 'sweatshirt', label: 'Sweatshirts' },
]

// Color families come from the backend (tools.color_family); this is only how
// each family is drawn as a swatch.
export const SWATCHES: Record<string, { label: string; fill: string }> = {
  navy: { label: 'Navy', fill: '#14284b' },
  blue: { label: 'Blue', fill: '#3b77c9' },
  gray: { label: 'Gray', fill: '#9aa0a6' },
  white: { label: 'White', fill: '#ffffff' },
  black: { label: 'Black', fill: '#131313' },
  red: { label: 'Red', fill: '#c8322d' },
  gold: { label: 'Gold', fill: '#e2b53e' },
  green: { label: 'Green', fill: '#2f7a4d' },
  multicolor: {
    label: 'Multicolor',
    fill: 'conic-gradient(#c8322d, #e2b53e, #2f7a4d, #3b77c9, #c8322d)',
  },
}

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const LOW_STOCK = 20 // "Only N left" badge at or below this many units
