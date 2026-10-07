// Handsome Dan-inspired mascot, built entirely from HTML/CSS shapes (see .bulldog in index.css).
export default function Bulldog({ small = false }: { small?: boolean }) {
  return (
    <div className={`bulldog${small ? ' bulldog-small' : ''}`} aria-hidden="true">
      <div className="bd-ear bd-ear-left" />
      <div className="bd-ear bd-ear-right" />
      <div className="bd-head">
        <div className="bd-eye bd-eye-left" />
        <div className="bd-eye bd-eye-right" />
        <div className="bd-muzzle">
          <div className="bd-nose" />
          <div className="bd-mouth" />
          <div className="bd-tooth bd-tooth-left" />
          <div className="bd-tooth bd-tooth-right" />
        </div>
        <div className="bd-cheek bd-cheek-left" />
        <div className="bd-cheek bd-cheek-right" />
      </div>
      <div className="bd-collar">
        <div className="bd-tag">Y</div>
      </div>
    </div>
  )
}
