import { Link } from 'react-router-dom'
import { askDan } from '../askDan'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div className="footer-about">
            <p className="footer-tag">Yale Bulldog Blue, by Campus Customs.</p>
            <p>Officially licensed gear for students, alumni, parents and the whole pack.</p>
          </div>
          <nav aria-label="Shop">
            <h4>Shop</h4>
            <Link to="/products?category=hoodie">Hoodies</Link>
            <Link to="/products?category=crewneck">Crewnecks</Link>
            <Link to="/products?category=t-shirt">Tees</Link>
            <Link to="/products?category=quarter-zip">Quarter-zips</Link>
          </nav>
          <nav aria-label="Help">
            <h4>Help</h4>
            <button type="button" onClick={() => askDan()}>
              Ask Dan
            </button>
            <Link to="/compare">Compare</Link>
            <Link to="/login">Your account</Link>
          </nav>
          <div>
            <h4>Visit</h4>
            <p>
              57 Broadway
              <br />
              New Haven, CT
            </p>
          </div>
        </div>
        <p className="footer-wordmark" aria-hidden="true">
          Campus Customs
        </p>
        <p className="footer-legal">© Campus Customs · Yale Bulldog Blue · 57 Broadway, New Haven, CT</p>
      </div>
    </footer>
  )
}
