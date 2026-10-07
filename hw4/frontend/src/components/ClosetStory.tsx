import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { askDan } from '../askDan'
import { createClosetScene } from '../three/closetScene'
import Bulldog from './Bulldog'

// Scroll-driven hero: the section is several screens tall and its inner stage
// stays pinned while the 3D hoodie travels into the closet. Scroll progress is
// written to the CSS variable --p so the text layers can fade with it.
export default function ClosetStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    const section = sectionRef.current!
    const stage = stageRef.current!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let scene: ReturnType<typeof createClosetScene>
    try {
      scene = createClosetScene(canvasRef.current!, { reducedMotion })
    } catch {
      setWebgl(false)
      return
    }

    const progress = () => {
      const rect = section.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      return travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0
    }

    let raf = 0
    const frame = (ms: number) => {
      const p = scene.update(progress(), ms / 1000)
      stage.style.setProperty('--p', p.toFixed(4))
      // Which text layer is clickable right now (the others are see-through).
      const phase = p < 0.1 ? 'start' : p > 0.86 ? 'end' : 'mid'
      if (stage.dataset.phase !== phase) stage.dataset.phase = phase
      raf = requestAnimationFrame(frame)
    }
    // Only animate while the section is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf)
      if (entry.isIntersecting) raf = requestAnimationFrame(frame)
    })
    visibility.observe(section)

    const sizer = new ResizeObserver(() => scene.resize(stage.clientWidth, stage.clientHeight))
    sizer.observe(stage)

    const onPointer = (e: PointerEvent) =>
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    window.addEventListener('pointermove', onPointer)

    return () => {
      cancelAnimationFrame(raf)
      visibility.disconnect()
      sizer.disconnect()
      window.removeEventListener('pointermove', onPointer)
      scene.dispose()
    }
  }, [])

  return (
    <section ref={sectionRef} className={`story${webgl ? '' : ' story-static'}`} aria-label="Campus Customs">
      <div ref={stageRef} className="story-stage" data-phase="start">
        <div className="story-headline">
          <p className="kicker">Officially licensed · 57 Broadway, New Haven</p>
          <h1>
            <span>Bleed blue.</span>
            <em>Dress loud.</em>
          </h1>
        </div>

        {webgl ? (
          <canvas ref={canvasRef} className="story-canvas" aria-hidden="true" />
        ) : (
          <div className="story-fallback">
            <Bulldog />
          </div>
        )}

        <div className="story-intro">
          <p className="lead">
            Campus Customs is where Bulldog pride gets comfy. Hoodies, tees and jackets for students, alumni,
            parents, and anyone who's ever yelled "Boola Boola" a little too loudly.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">
              Shop the pack
            </Link>
            <Link to="/about" className="btn btn-ghost">
              Meet the kennel
            </Link>
          </div>
        </div>

        <p className="story-hint" aria-hidden="true">
          Scroll to hang it up <span>↓</span>
        </p>

        <ol className="story-steps">
          <li className="story-step step-1">
            <span className="step-num">01</span>
            <h2>Pick your piece</h2>
            <p>Over a hundred officially licensed hoodies, crews, tees and quarter-zips, all in one closet.</p>
          </li>
          <li className="story-step step-2">
            <span className="step-num">02</span>
            <h2>Check the real stock</h2>
            <p>Every size, live from the shop on Broadway. If yours is sold out, we'll say so.</p>
          </li>
          <li className="story-step step-3">
            <span className="step-num">03</span>
            <h2>Hang it up</h2>
            <p>Compare favorites side by side, or let Dan build a whole outfit under your budget.</p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary">
                Shop the closet
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => askDan('Hoodie + tee for my dad in L, under $120')}
              >
                Try a bundle with Dan
              </button>
            </div>
          </li>
        </ol>
      </div>
    </section>
  )
}
