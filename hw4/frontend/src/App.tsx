import { useEffect } from 'react'
import { Route, Routes, useLocation, useMatch } from 'react-router-dom'
import ChatResults from './components/ChatResults'
import ChatWidget from './components/ChatWidget'
import CompareTray from './components/CompareTray'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import About from './pages/About'
import Compare from './pages/Compare'
import CreateAccount from './pages/CreateAccount'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'

// Start each new page at the top instead of keeping the previous scroll position.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  // Chat results show on every page except a product's detail page, so the
  // large-image detail view stays at the top when a card is opened.
  const onDetailPage = useMatch('/products/:productId') !== null

  return (
    <div className="app">
      <ScrollToTop />
      <Navbar />
      <main className="page">
        {!onDetailPage && <ChatResults />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CompareTray />
      <ChatWidget />
    </div>
  )
}
