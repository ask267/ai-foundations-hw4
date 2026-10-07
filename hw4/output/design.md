# Design refresh — Campus Customs (Problem 10)

Inspired by Bella Kitchenware (3D product moving into a scene), Monolith Studio
(big type, mono labels) and Everlane (clean product presentation). Only the look
changed; filters, product pages, compare, chat, bundles and login work as before.

## 1. 3D hoodie → closet scroll story (home page)

**What changed:** A 3D navy YALE hoodie floats in front of a giant "Bleed blue.
*Dress loud.*" headline and tilts with the mouse. Scrolling pins the scene:
a wardrobe rises in, the doors open, and the hoodie flies onto the empty hanger
between other Yale pieces, then swings to a stop. Three captions explain the
shop as it happens: *Pick your piece → Check the real stock → Hang it up*.
The last caption has **Shop the closet** and **Try a bundle with Dan** buttons.
Everything is built from three.js shapes in code, with no model files.
(`frontend/src/three/closetScene.ts`, `frontend/src/components/ClosetStory.tsx`)

**Why it helps:** The first screen is the one most visitors leave from. A moving
product they control by scrolling gives them a reason to keep going, and the
story ends on two buttons that lead to buying. The closet full of hoodies, crews
and tees also shows how much the shop carries before anyone opens the catalogue.

## 2. Editorial type and color

**What changed:**
- Headlines in a large serif (Instrument Serif)
- Body text in a clean sans (Inter Tight)
- Small mono labels for categories, steps and prices (JetBrains Mono)
- Warm paper background with Yale blue accents, a dark announcement bar, and a
  "CC" logo

**Why it helps:** A polished, consistent look makes a small shop feel
trustworthy, which matters before someone pays $58–$98 for a sweatshirt. Clear
hierarchy (big title, small label, price) lets shoppers scan quickly.

## 3. Product presentation

**What changed:**
- Product photos fill each card edge to edge. The catalogue photos have mixed
  black, white and gray backgrounds, so padded photos looked like boxes.
- Cards lift on hover and show a **View →** tag.
- The home page has category tiles (Hoodies, Tees, Crewnecks, Quarter-zips),
  each with a real product photo and a live count, linking to the filtered
  catalogue.

**Why it helps:** The clothes are the main thing on every card, so shoppers
compare styles by eye. The category tiles take someone from the home page to,
for example, "27 hoodies" in one tap instead of scrolling all 102 products.

## 3b. Products page ("The Closet")

**What changed:**
- **Header:** a giant serif "The Closet" title with the live count (102), and a
  minimal underlined search field instead of a boxed one.
- **Category bar:** the bulky chip toolbar became a slim sticky bar. It has
  category tabs with small counts and a sliding blue underline (Everlane style),
  plus a **Filters** button, a sort menu, and a grid-size toggle (4 or 5 across).
- **Filters panel:** color and size live in a panel that slides open. Colors are
  swatches with names; sizes are tiles. A badge on the Filters button shows how
  many are on.
- **Active filters:** each one appears as a removable pill ("Gray ×", "Size M in
  stock ×") next to "Showing 8 of 102", plus "Clear all".
- **Grid:**
  - Cards fade in as you scroll.
  - A dark-blue **Ask Dan** tile sits after the 8th product.
  - The grid is 4 columns on desktop, 3 on tablets, and 2 on phones.

**Why it helps:**
- Shoppers see products sooner: the first screen shows the clothes instead of
  three rows of controls.
- Filtering is calmer: everything is one tap away, and it's always clear what's
  on and how to undo one thing.
- The Ask Dan tile catches shoppers who are scrolling without deciding, which is
  when help turns browsing into a purchase.
- Filters still live in the URL, so filtered views stay shareable. Hoodies + Gray
  + M + price low to high still returns the same 8 products, $45–$88.

## 4. Motion with a purpose

**What changed:**
- Sections fade up as they scroll into view.
- A tilted marquee band ("Boola Boola ✦ Beat Harvard…").
- A floating "Meet Dan" demo card showing a real bundle (Yale Dad Hoodie $68 +
  Yale Dad T Shirt $32 = $100, $20 left of $120).
- A pulsing chat button.
- People who turn on "reduce motion" in their device settings get a still
  version.

**Why it helps:** Motion points attention at the next thing to do. The Dan card
shows what the assistant can do before anyone asks, which gets shoppers to try
the chat. Shoppers who chat get real stock answers and bundles, which leads to
more items per visit.

## 5. Chat feel

**What changed:**
- Frosted-glass panel with a Yale blue gradient header and a green "online" dot.
- Softer message bubbles that animate in.
- The panel opens with a smooth scale-in.

**Why it helps:** The chat looks like part of a premium store rather than a
default widget, so shoppers are more willing to ask about sizes. That's the
question that decides whether they buy.

## 6. Header, compare counter and footer

**What changed:**
- The header turns frosted and gets a shadow when you scroll.
- A **Compare (N)** counter appears in the nav once you've picked items.
- A dark footer with shop links (Hoodies, Crewnecks, Tees, Quarter-zips), Ask
  Dan, Compare, the store address, and a giant wordmark.
- On phones, the header shrinks to one line.

**Why it helps:** Shoppers can always get back to their comparison or a category
from any page, so they keep moving through the shop instead of leaving.

## Checked

- Home story tested at desktop (1440×900) and mobile (375×812) sizes:
  hero → closet rises → doors open → hoodie lands.
- The 3D code loads only on the home page; the production build passes.
- Previous features still work:
  - Filters: gray hoodies, size M, low to high = same 8 results, $45–$88
  - Product-page chat: stock answer matches the database
  - Login with the test account
