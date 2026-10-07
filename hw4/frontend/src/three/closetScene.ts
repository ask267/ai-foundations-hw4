// The home page's 3D story: a Yale hoodie floats in the hero, a wardrobe rises
// in behind it, the doors swing open, and the hoodie flies onto the empty
// hanger. Everything is built from three.js primitives (no model files).
//
// createClosetScene(canvas) returns update(progress, seconds), where progress is
// how far the shopper has scrolled through the pinned section (0 to 1).
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

type Kind = 'hoodie' | 'crewneck' | 'tee'
type GarmentSpec = { kind: Kind; color: string; trim?: string; text?: string; textColor?: string }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

// Timeline, in scroll progress.
const CLOSET_IN: [number, number] = [0.1, 0.42]
const SPIN: [number, number] = [0.12, 0.45]
const DOORS: [number, number] = [0.44, 0.6]
const HANGER_IN: [number, number] = [0.6, 0.7]
const FLIGHT: [number, number] = [0.62, 0.86]
const DOLLY: [number, number] = [0.86, 1]

const RAIL_Y = 1.2
const HANG_SCALE = 0.55
const HOOK_DROP = 0.52 // rail centre to hanger origin

// ---------- materials ----------

function fabric(color: string) {
  const c = new THREE.Color(color)
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.9,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.18),
  })
}

const darker = (color: string, amount = 0.25) =>
  '#' + new THREE.Color(color).lerp(new THREE.Color('#000000'), amount).getHexString()

function chestPrint(text: string, color: string, width: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const size = text.length > 4 ? 170 : 220
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`
  // Letters along a gentle arch, like a varsity chest print.
  const chars = [...text]
  const spread = Math.min(0.62, 0.13 * (chars.length - 1))
  chars.forEach((ch, i) => {
    const angle = chars.length === 1 ? 0 : -spread / 2 + (i * spread) / (chars.length - 1)
    ctx.save()
    ctx.translate(512, 1300)
    ctx.rotate(angle)
    ctx.fillText(ch, 0, -900)
    ctx.restore()
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 2), material)
}

// ---------- garments ----------

// Origin at the top centre of the shoulders; the garment hangs down -y.
function makeGarment(spec: GarmentSpec): THREE.Group {
  const g = new THREE.Group()
  const body = fabric(spec.color)
  const trim = fabric(spec.trim ?? darker(spec.color, 0.18))
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    parent: THREE.Object3D = g,
  ) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(...pos)
    mesh.rotation.set(...rot)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  const tee = spec.kind === 'tee'
  const torsoH = tee ? 1.55 : 1.7
  add(new RoundedBoxGeometry(1.5, torsoH, 0.55, 4, 0.22), body, [0, -torsoH / 2, 0])
  if (!tee) add(new RoundedBoxGeometry(1.44, 0.2, 0.58, 3, 0.09), trim, [0, -torsoH + 0.05, 0])

  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.64, -0.24, 0)
    pivot.rotation.z = side * (tee ? 0.95 : 0.28)
    g.add(pivot)
    if (tee) {
      add(new THREE.CapsuleGeometry(0.25, 0.3, 6, 16), body, [0, -0.28, 0], [0, 0, 0], pivot)
    } else {
      add(new THREE.CapsuleGeometry(0.21, 1.12, 6, 16), body, [0, -0.68, 0], [0, 0, 0], pivot)
      add(new THREE.CylinderGeometry(0.19, 0.19, 0.2, 20), trim, [0, -1.36, 0], [0, 0, 0], pivot)
    }
  }

  if (spec.kind === 'hoodie') {
    // Hood down: a flattened dome lying against the back, peeking over the
    // shoulders, with a thick folded rim around the neckline.
    const hood = add(new THREE.SphereGeometry(0.5, 32, 24), body, [0, -0.08, -0.2])
    hood.scale.set(1.05, 0.78, 0.42)
    const inner = new THREE.MeshStandardMaterial({ color: darker(spec.color, 0.55), roughness: 1 })
    add(new THREE.CircleGeometry(0.27, 32), inner, [0, 0.02, 0.0], [-Math.PI / 2 + 0.35, 0, 0])
    add(new THREE.TorusGeometry(0.29, 0.085, 12, 40), body, [0, 0.0, 0.02], [Math.PI / 2 - 0.35, 0, 0])
    const cord = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.8 })
    for (const x of [-0.11, 0.11]) {
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), cord, [x, -0.32, 0.3])
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8), trim, [x, -0.66, 0.3])
    }
    add(new RoundedBoxGeometry(0.95, 0.42, 0.05, 2, 0.02), body, [0, -torsoH + 0.44, 0.285])
  } else {
    add(new THREE.TorusGeometry(0.25, 0.055, 10, 32), trim, [0, -0.03, 0.03], [Math.PI / 2, 0, 0])
  }

  if (spec.text) {
    const print = chestPrint(spec.text, spec.textColor ?? '#ffffff', 1.1)
    print.position.set(0, spec.kind === 'hoodie' ? -0.68 : -0.6, 0.282)
    g.add(print)
  }
  return g
}

const brass = () => new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 1, roughness: 0.3 })

function makeHanger(): THREE.Group {
  const g = new THREE.Group()
  const metal = brass()
  const a = new THREE.Vector3(-0.78, -0.02, 0)
  const b = new THREE.Vector3(0, 0.3, 0)
  const c = new THREE.Vector3(0.78, -0.02, 0)
  const path = new THREE.CurvePath<THREE.Vector3>()
  path.add(new THREE.LineCurve3(a, b))
  path.add(new THREE.LineCurve3(b, c))
  path.add(new THREE.LineCurve3(c, a))
  const parts = [
    new THREE.Mesh(new THREE.TubeGeometry(path, 90, 0.022, 8, true), metal),
    new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), metal),
    new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 28, Math.PI * 1.3), metal),
  ]
  parts[1].position.y = 0.34
  parts[2].position.y = 0.48
  parts[2].rotation.z = -Math.PI / 2
  for (const m of parts) {
    m.castShadow = true
    g.add(m)
  }
  return g
}

// Garment on a hanger. Origin = where the hook rests on the rail, so rotating
// `swing` around z makes the whole thing swing like a real hanger.
function makeHanging(spec: GarmentSpec) {
  const unit = new THREE.Group()
  const swing = new THREE.Group()
  unit.add(swing)
  const hanger = makeHanger()
  hanger.position.y = -HOOK_DROP
  const garment = makeGarment(spec)
  garment.position.y = -HOOK_DROP + 0.06
  swing.add(hanger, garment)
  return { unit, swing, hanger }
}

function makeFoldedStack(colors: string[]): THREE.Group {
  const g = new THREE.Group()
  colors.forEach((color, i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.13, 0.55, 2, 0.05), fabric(color))
    m.position.set((i % 2) * 0.03 - 0.015, 0.065 + i * 0.13, 0)
    m.rotation.y = (i % 2 ? 1 : -1) * 0.03
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  })
  return g
}

// ---------- the wardrobe ----------

const OUTER = '#f3efe6'
const OAK = '#d9b98f'

function makeCloset() {
  const closet = new THREE.Group()
  const lacquer = new THREE.MeshStandardMaterial({ color: OUTER, roughness: 0.45 })
  const oak = new THREE.MeshStandardMaterial({ color: OAK, roughness: 0.75 })
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.03, d / 2 - 0.001)), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    closet.add(m)
    return m
  }

  box(5.2, 4.6, 0.08, oak, 0, 0, -0.78) // back
  box(0.14, 4.72, 1.66, lacquer, -2.63, 0, 0) // sides
  box(0.14, 4.72, 1.66, lacquer, 2.63, 0, 0)
  box(5.5, 0.16, 1.8, lacquer, 0, 2.42, 0.02) // crown
  box(5.4, 0.14, 1.7, lacquer, 0, -2.36, 0) // base
  box(5.12, 0.07, 1.5, oak, 0, 1.78, -0.02) // top shelf
  box(5.12, 0.07, 1.5, oak, 0, -0.62, -0.02) // drawer top

  // Drawers.
  const metal = brass()
  for (const y of [-1.92, -1.18]) {
    box(5.06, 0.66, 0.08, lacquer, 0, y, 0.72)
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.6, 4, 12), metal)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, y, 0.8)
    closet.add(handle)
  }

  // Rail.
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.1, 16), metal)
  rail.rotation.z = Math.PI / 2
  rail.position.set(0, RAIL_Y, 0)
  closet.add(rail)

  // Folded stacks on the shelves.
  const stacks: [number, number, string[]][] = [
    [-1.6, 1.82, ['#00356b', '#9aa0a6', '#f4f1ea']],
    [-0.45, 1.82, ['#286dc0', '#00356b']],
    [1.5, 1.82, ['#efe6d2', '#c8322d', '#00356b']],
    [-1.4, -0.585, ['#9aa0a6', '#00356b']],
    [1.35, -0.585, ['#f4f1ea', '#286dc0', '#9aa0a6']],
  ]
  for (const [x, y, colors] of stacks) {
    const s = makeFoldedStack(colors)
    s.position.set(x, y, 0)
    closet.add(s)
  }

  // Garments already on the rail, with a gap in the middle for the hero hoodie.
  const racked: { x: number; spec: GarmentSpec }[] = [
    { x: -1.78, spec: { kind: 'crewneck', color: '#9aa0a6', text: 'YALE', textColor: '#00356b' } },
    { x: -0.9, spec: { kind: 'tee', color: '#f4f1ea', text: 'BOOLA', textColor: '#00356b' } },
    { x: 0.9, spec: { kind: 'hoodie', color: '#286dc0', text: 'YALE' } },
    { x: 1.78, spec: { kind: 'crewneck', color: '#efe6d2', text: '1701', textColor: '#00356b' } },
  ]
  const swings: THREE.Group[] = []
  racked.forEach(({ x, spec }, i) => {
    const { unit, swing } = makeHanging(spec)
    unit.position.set(x, RAIL_Y, i % 2 ? -0.06 : -0.14)
    unit.scale.setScalar(HANG_SCALE)
    unit.rotation.y = (i % 2 ? 1 : -1) * 0.12
    closet.add(unit)
    swings.push(swing)
  })

  // Doors, hinged on the outer edges.
  const doors: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 2.6, 0.04, 0.84)
    const panel = new THREE.Mesh(new RoundedBoxGeometry(2.6, 4.56, 0.09, 2, 0.03), lacquer)
    panel.position.x = -side * 1.3
    panel.castShadow = true
    panel.receiveShadow = true
    const inset = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 3.9, 0.03, 2, 0.012),
      new THREE.MeshStandardMaterial({ color: '#ebe5d8', roughness: 0.5 }),
    )
    inset.position.set(-side * 1.3, 0, 0.05)
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.7, 4, 12), metal)
    handle.position.set(-side * 2.45, 0.1, 0.13)
    handle.castShadow = true
    pivot.add(panel, inset, handle)
    closet.add(pivot)
    doors.push(pivot)
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.ShadowMaterial({ opacity: 0.12 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.43
  floor.receiveShadow = true
  closet.add(floor)

  return { closet, doors, swings }
}

// ---------- scene ----------

export type ClosetScene = {
  update: (progress: number, seconds: number) => number
  resize: (width: number, height: number) => void
  setPointer: (x: number, y: number) => void
  dispose: () => void
}

export function createClosetScene(canvas: HTMLCanvasElement, { reducedMotion = false } = {}): ClosetScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.4

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60)
  let baseDistance = 9.4

  const key = new THREE.DirectionalLight('#fff6e8', 2.2)
  key.position.set(-4, 7, 7)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -6
  key.shadow.camera.right = 6
  key.shadow.camera.top = 6
  key.shadow.camera.bottom = -6
  key.shadow.radius = 6
  key.shadow.bias = -0.0005
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#c9bfae', 0.7))

  const root = new THREE.Group()
  scene.add(root)

  const { closet, doors, swings } = makeCloset()
  root.add(closet)

  const hero = makeHanging({ kind: 'hoodie', color: '#00356b', text: 'YALE' })
  root.add(hero.unit)

  let smoothed = 0
  let pointerX = 0
  let pointerY = 0
  let tiltX = 0
  let tiltY = 0
  let landedAt: number | null = null

  function resize(width: number, height: number) {
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Fit the 5.5-wide wardrobe, plus room for the captions on wide screens.
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const needWidth = camera.aspect > 1.15 ? 10.4 : 7.2
    const needHeight = Math.max(6.4, needWidth / camera.aspect)
    baseDistance = needHeight / (2 * halfV)
    camera.updateProjectionMatrix()
  }

  function update(progress: number, t: number): number {
    smoothed = reducedMotion ? progress : smoothed + (progress - smoothed) * 0.1
    if (Math.abs(progress - smoothed) < 0.0005) smoothed = progress
    const p = smoothed
    const idle = reducedMotion ? 0 : t

    // Wardrobe rises in, then the doors open.
    const rise = easeOut(range(p, ...CLOSET_IN))
    closet.position.y = lerp(-8.5, 0, rise)
    closet.rotation.y = lerp(-0.35, 0, rise)
    closet.visible = rise > 0
    const open = easeInOut(range(p, ...DOORS))
    doors[0].rotation.y = -1.85 * open
    doors[1].rotation.y = 1.85 * open

    // Hero hoodie: float -> step forward and spin -> fly onto the hanger.
    const intro = easeInOut(range(p, CLOSET_IN[0], CLOSET_IN[1]))
    const fly = easeInOut(range(p, ...FLIGHT))
    // Keep the hero hoodie the same size on screen however far back the camera sits.
    const heroScale = Math.max(1.15, (1.15 * baseDistance) / 11.6)
    const ax = 0, ay = 1.3 * heroScale + Math.sin(idle * 1.2) * 0.06, az = 1.6
    const bx = 0, by = 0.95, bz = 2.6
    const fx = 0, fy = RAIL_Y, fz = -0.1
    const midX = lerp(ax, bx, intro), midY = lerp(ay, by, intro), midZ = lerp(az, bz, intro)
    hero.unit.position.set(
      lerp(midX, fx, fly),
      lerp(midY, fy, fly) + Math.sin(Math.PI * fly) * 0.7,
      lerp(midZ, fz, fly),
    )
    hero.unit.scale.setScalar(lerp(lerp(heroScale, 0.8, intro), HANG_SCALE, fly))
    const spin = easeInOut(range(p, ...SPIN)) * Math.PI * 2
    const sway = Math.sin(idle * 0.6) * 0.55
    hero.unit.rotation.y = (sway + spin) * (1 - fly)
    hero.unit.rotation.x = 0.12 * (1 - fly) * Math.sin(idle * 0.8)
    hero.hanger.scale.setScalar(Math.max(0.0001, easeOut(range(p, ...HANGER_IN))))

    // A little swing when it lands, and a gentle sway on the rack.
    if (fly >= 1 && landedAt === null) landedAt = t
    if (fly < 0.98) landedAt = null
    const since = landedAt === null ? 0 : t - landedAt
    hero.swing.rotation.z = reducedMotion || landedAt === null ? 0 : 0.16 * Math.exp(-since * 1.6) * Math.sin(since * 6)
    swings.forEach((s, i) => {
      s.rotation.z = reducedMotion ? 0 : Math.sin(idle * 0.9 + i * 1.7) * 0.012 * rise
    })

    // Camera dolly at the end, plus a soft pointer tilt.
    // On wide screens the closet slides right so the captions on the left have room.
    const dolly = easeInOut(range(p, ...DOLLY))
    const shift = camera.aspect > 1.15 ? -1.9 * rise : 0
    camera.position.set(shift, lerp(0, 0.25, dolly), baseDistance * lerp(1, 0.95, dolly))
    camera.lookAt(shift, lerp(0, 0.2, dolly), 0)
    tiltX += (pointerX - tiltX) * 0.05
    tiltY += (pointerY - tiltY) * 0.05
    root.rotation.y = reducedMotion ? 0 : tiltX * 0.12
    root.rotation.x = reducedMotion ? 0 : tiltY * 0.04

    renderer.render(scene, camera)
    return p
  }

  function dispose() {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        ;(m as THREE.MeshStandardMaterial).map?.dispose()
        m.dispose()
      }
    })
    envRT.dispose()
    pmrem.dispose()
    renderer.dispose()
  }

  return {
    update,
    resize,
    setPointer: (x, y) => {
      pointerX = x
      pointerY = y
    },
    dispose,
  }
}
