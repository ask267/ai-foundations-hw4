import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, formatPrice, type Product } from '../api'
import { askDan } from '../askDan'
import ProductCard from '../components/ProductCard'
import Reveal from '../components/Reveal'

// three.js only loads on the home page, so other pages stay light.
const ClosetStory = lazy(() => import('../components/ClosetStory'))

const categories = [
  { id: 'hoodie', label: 'Hoodies', text: 'Built for 2 a.m. study sessions in Bass.' },
  { id: 't-shirt', label: 'Tees', text: 'Loud, proud, made for shouting at Harvard.' },
  { id: 'crewneck', label: 'Crewnecks', text: 'Every college, team and tradition.' },
  { id: 'quarter-zip', label: 'Quarter-zips', text: 'For the alum who still means business.' },
]

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
  }, [])

  const featured = useMemo(() => products.filter((p) => p.total_stock > 0).slice(0, 4), [products])
  // One real catalogue photo and count per category tile.
  const tiles = useMemo(
    () =>
      categories.map((c) => {
        const inCategory = products.filter((p) => p.category === c.id)
        return { ...c, count: inCategory.length, image: inCategory.find((p) => p.total_stock > 0)?.image_url }
      }),
    [products],
  )

  return (
    <>
      <Suspense fallback={<div className="story story-loading" />}>
        <ClosetStory />
      </Suspense>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy}>
              Boola Boola <i>✦</i> Bleed Blue <i>✦</i> Beat Harvard <i>✦</i> Comfy since forever <i>✦</i> Handsome Dan
              approved <i>✦</i>&nbsp;
            </span>
          ))}
        </div>
      </div>

      <section className="section">
        <Reveal className="section-head">
          <div>
            <p className="eyebrow">Shop by category</p>
            <h2>Pick your vibe</h2>
          </div>
          <Link to="/products" className="link-arrow">
            All {products.length || ''} styles <span>→</span>
          </Link>
        </Reveal>
        <div className="category-grid">
          {tiles.map((t, i) => (
            <Reveal key={t.id} delay={i * 80}>
              <Link to={`/products?category=${encodeURIComponent(t.id)}`} className="category-tile">
                <div className="category-image">{t.image && <img src={t.image} alt="" loading="lazy" />}</div>
                <div className="category-meta">
                  <h3>{t.label}</h3>
                  <span className="mono">{t.count ? String(t.count).padStart(2, '0') : ''}</span>
                </div>
                <p>{t.text}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <Reveal className="section-head">
            <div>
              <p className="eyebrow">New on the rack</p>
              <h2>Fresh out of the kennel</h2>
            </div>
            <Link to="/products" className="link-arrow">
              See everything <span>→</span>
            </Link>
          </Reveal>
          <div className="product-grid">
            {featured.map((p, i) => (
              <Reveal key={p.product_id} delay={i * 80}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <Reveal className="dan-showcase">
          <div className="dan-copy">
            <p className="eyebrow">Your fitting-room friend</p>
            <h2>
              Meet Dan. <em>He knows the racks.</em>
            </h2>
            <ul className="dan-points">
              <li>
                <span className="mono">01</span> Real prices and stock in every size, straight from the shop.
              </li>
              <li>
                <span className="mono">02</span> Sold out in your size? He finds the closest swap that isn't.
              </li>
              <li>
                <span className="mono">03</span> Builds outfits and gift sets under your budget, with the math done
                for you.
              </li>
            </ul>
            <button type="button" className="btn btn-primary" onClick={() => askDan()}>
              Chat with Dan
            </button>
          </div>
          <div className="dan-demo" aria-hidden="true">
            <div className="demo-bubble demo-user">Hoodie + tee for my dad in L, under $120</div>
            <div className="demo-bubble demo-dan">Done! Both are in stock in L, with $20 to spare 🐾</div>
            <div className="bundle-receipt demo-receipt">
              <p className="bundle-receipt-head">
                <span>🧾 Bundle</span>
                <span>Budget {formatPrice(120)}</span>
              </p>
              <ul>
                <li>
                  <span>Yale Dad Hoodie · L</span>
                  <span>{formatPrice(68)}</span>
                </li>
                <li>
                  <span>Yale Dad T Shirt · L</span>
                  <span>{formatPrice(32)}</span>
                </li>
              </ul>
              <p className="bundle-receipt-total">
                <span>Total</span>
                <strong>{formatPrice(100)}</strong>
              </p>
              <p className="bundle-receipt-left">{formatPrice(20)} left in your budget</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal className="promise-strip">
          <div>
            <strong>{products.length || 102}</strong>
            <span>styles on the rack</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>officially licensed Yale</span>
          </div>
          <div>
            <strong>XS–XXL</strong>
            <span>live stock in every size</span>
          </div>
          <div>
            <strong>57</strong>
            <span>Broadway, New Haven</span>
          </div>
        </Reveal>
      </section>

      <Reveal as="section" className="section banner">
        <p className="eyebrow">Visit the shop</p>
        <h2>Come for a hoodie, leave with three.</h2>
        <p>
          57 Broadway, New Haven, CT. We won't judge (Handsome Dan might). Check sizes here before you swing by.
        </p>
        <Link to="/products" className="btn btn-primary">
          Browse the shop
        </Link>
      </Reveal>
    </>
  )
}
