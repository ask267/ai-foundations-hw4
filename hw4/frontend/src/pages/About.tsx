import { Link } from 'react-router-dom'
import Bulldog from '../components/Bulldog'

const values = [
  {
    title: 'Legit Bulldog gear',
    text: 'Everything we sell is officially licensed Yale merch, so the pride is 100% authentic (no knockoff Handsome Dans here).',
  },
  {
    title: 'Comfy first',
    text: 'Casual comfort meets classic school spirit. If it isn’t soft enough to nap in during reading period, it doesn’t make the cut.',
  },
  {
    title: 'Something for everyone',
    text: 'Students, alumni, proud parents, little future Bulldogs, even your dog. There’s a fit for the whole pack.',
  },
  {
    title: 'Every team, every tradition',
    text: 'Whether you’re into crew, hockey, sailing, fencing, or The Game, we’ve got a shirt that cheers with you.',
  },
]

export default function About() {
  return (
    <>
      <section className="hero hero-compact">
        <div className="hero-text">
          <p className="eyebrow">About us</p>
          <h1>
            Yale Bulldog Blue, <span className="accent">by Campus Customs</span>
          </h1>
          <p className="lead">
            We're a little shop on Broadway with a big crush on New Haven. For years we've kept
            Bulldogs looking sharp, from first-years buying their first hoodie to alumni hunting for
            one to replace the one their kid "borrowed."
          </p>
        </div>
        <div className="hero-art">
          <Bulldog />
        </div>
      </section>

      <section className="section">
        <h2>What we're about</h2>
        <div className="collection-grid">
          {values.map((v) => (
            <div key={v.title} className="collection-card static">
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section banner">
        <h2>Come say hi</h2>
        <p>
          Find us at <strong>57 Broadway, New Haven, CT</strong>. Browse the whole catalogue here
          anytime, check sizes before you swing by, and ask our chat pup, who's always awake.
        </p>
        <Link to="/products" className="btn btn-primary">
          Browse the shop
        </Link>
      </section>
    </>
  )
}
