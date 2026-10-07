import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCompare } from '../compare'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About Us' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const { picks } = useCompare()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="announcement">
        <span>Officially licensed Yale gear</span>
        <span className="announcement-dot">●</span>
        <span>Swing by 57 Broadway, New Haven</span>
        <span className="announcement-dot">●</span>
        <span>Ask Dan about any size 🐾</span>
      </div>
      <div className="navbar">
        <Link to="/" className="brand" aria-label="Campus Customs home">
          <span className="brand-mark">CC</span>
          <span className="brand-name">
            Campus Customs
            <small>Bulldog Blue · Est. New Haven</small>
          </span>
        </Link>
        <nav className="nav-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
              {link.label}
            </NavLink>
          ))}
          {picks.length > 0 && (
            <NavLink
              to={`/compare?ids=${picks.map((p) => p.product_id).join(',')}`}
              className="nav-link nav-compare"
            >
              Compare <span className="nav-count">{picks.length}</span>
            </NavLink>
          )}
          {user ? (
            <>
              <span className="nav-greeting">Hi, {user.first_name || user.name}</span>
              <button type="button" className="nav-link nav-cta" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">
                Login
              </NavLink>
              <NavLink to="/create-account" className="nav-link nav-cta">
                Create Account
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
