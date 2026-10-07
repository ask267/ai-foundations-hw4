import { Link } from 'react-router-dom'
import Bulldog from '../components/Bulldog'

export default function NotFound() {
  return (
    <section className="section banner">
      <Bulldog small />
      <h1>404: this page got fetched by a dog</h1>
      <Link to="/" className="btn btn-primary">
        Take me home
      </Link>
    </section>
  )
}
