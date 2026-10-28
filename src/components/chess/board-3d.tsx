'use client'

import { Canvas, invalidate as invalidateAll, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { Color, PieceType } from '@/lib/chess/types'
import { squareXY, type TrackedPiece } from '@/lib/chess/pieces'
import type { BoardProps } from './board-types'

/**
 * 3D board: procedural lathe-turned pieces (no external models, textures or
 * HDRs, so the strict CSP holds), arcing move animations, captured pieces
 * that fly to a graveyard beside the board, and orbit controls. Under
 * prefers-reduced-motion everything snaps into place.
 */

const GOLD = '#c9a45c'
const FILES = 'abcdefgh'
/** Pieces are drawn larger than the base geometry so they read well on small screens. */
const PIECE_SCALE = 1.24
const CAPTURED_SCALE = 0.62 * PIECE_SCALE
/** Seconds a move takes to glide across the board. */
const MOVE_SECONDS = 0.6

function useReduced(): boolean {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
}

function world(square: string): THREE.Vector3 {
  const { file, rank } = squareXY(square)
  return new THREE.Vector3(file - 3.5, 0, 3.5 - rank)
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const v = (x: number, y: number) => new THREE.Vector2(x, y)
const BASE = [v(0, 0), v(0.36, 0), v(0.36, 0.06), v(0.31, 0.1), v(0.27, 0.13)]
const lathe = (pts: THREE.Vector2[]) => new THREE.LatheGeometry(pts, 28)

type Part = { geo: THREE.BufferGeometry; pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number]; trim?: boolean }

function buildParts(): Record<PieceType, Part[]> {
  const sphere = (r: number) => new THREE.SphereGeometry(r, 24, 16)
  const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z)
  const trim = new THREE.TorusGeometry(0.335, 0.016, 8, 40)
  const trimPart: Part = { geo: trim, pos: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], trim: true }
  return {
    p: [{ geo: lathe([...BASE, v(0.17, 0.2), v(0.11, 0.36), v(0.17, 0.4), v(0.17, 0.43), v(0.07, 0.46), v(0, 0.46)]) }, { geo: sphere(0.14), pos: [0, 0.56, 0] }, trimPart],
    r: [
      { geo: lathe([...BASE, v(0.23, 0.2), v(0.2, 0.52), v(0.27, 0.57), v(0.28, 0.74), v(0, 0.74)]) },
      ...[0, 1, 2, 3].map((i): Part => ({ geo: box(0.13, 0.1, 0.1), pos: [Math.cos((i * Math.PI) / 2) * 0.2, 0.79, Math.sin((i * Math.PI) / 2) * 0.2], rot: [0, (-i * Math.PI) / 2, 0] })),
      trimPart,
    ],
    n: [
      { geo: lathe([...BASE, v(0.24, 0.2), v(0.22, 0.3), v(0, 0.3)]) },
      { geo: box(0.24, 0.5, 0.34), pos: [0, 0.52, 0.02], rot: [-0.32, 0, 0] },
      { geo: box(0.2, 0.18, 0.36), pos: [0, 0.7, -0.17], rot: [0.35, 0, 0] },
      { geo: box(0.05, 0.12, 0.06), pos: [0.07, 0.86, 0.05] },
      { geo: box(0.05, 0.12, 0.06), pos: [-0.07, 0.86, 0.05] },
      { geo: box(0.04, 0.42, 0.06), pos: [0, 0.58, 0.2], rot: [-0.3, 0, 0], trim: true },
      trimPart,
    ],
    b: [
      { geo: lathe([...BASE, v(0.2, 0.22), v(0.12, 0.6), v(0.19, 0.64), v(0.19, 0.67), v(0.08, 0.7), v(0, 0.7)]) },
      { geo: sphere(0.15), pos: [0, 0.82, 0], scale: [1, 1.35, 1] },
      { geo: sphere(0.045), pos: [0, 1.04, 0], trim: true },
      trimPart,
    ],
    q: [
      { geo: lathe([...BASE, v(0.22, 0.24), v(0.13, 0.72), v(0.21, 0.78), v(0.21, 0.82), v(0.12, 0.86), v(0.2, 1.0), v(0, 0.95)]) },
      ...Array.from({ length: 8 }, (_, i): Part => ({ geo: sphere(0.038), pos: [Math.cos((i * Math.PI) / 4) * 0.19, 1.01, Math.sin((i * Math.PI) / 4) * 0.19], trim: true })),
      { geo: sphere(0.07), pos: [0, 1.04, 0] },
      trimPart,
    ],
    k: [
      { geo: lathe([...BASE, v(0.23, 0.24), v(0.14, 0.76), v(0.22, 0.82), v(0.22, 0.86), v(0.15, 0.9), v(0.19, 1.02), v(0, 1.02)]) },
      { geo: box(0.07, 0.26, 0.07), pos: [0, 1.15, 0], trim: true },
      { geo: box(0.2, 0.07, 0.07), pos: [0, 1.18, 0], trim: true },
      trimPart,
    ],
  }
}

let PARTS: Record<PieceType, Part[]> | null = null
const parts = () => (PARTS ??= buildParts())

function useMaterials() {
  return useMemo(
    () => ({
      w: new THREE.MeshPhysicalMaterial({ color: '#f1e8d4', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.22, sheen: 0.3, sheenColor: new THREE.Color('#fff4dc') }),
      b: new THREE.MeshPhysicalMaterial({ color: '#1a1d26', roughness: 0.28, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
      trim: new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.95, roughness: 0.22 }),
    }),
    [],
  )
}

/** Soft procedural grain (no image files, so the CSP holds). Greyscale, so square colours tint it. */
function grainTexture(seed: number, streaks: boolean): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  let r = seed
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 2600; i++) {
    const g = 222 + Math.floor(rand() * 33)
    ctx.fillStyle = `rgba(${g},${g},${g},0.5)`
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3)
  }
  if (streaks) {
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = rand() < 0.5 ? '#000' : '#fff'
      ctx.lineWidth = 1 + rand() * 3
      ctx.beginPath()
      let x = rand() * size
      ctx.moveTo(x, 0)
      for (let y = 0; y <= size; y += 16) ctx.lineTo((x += (rand() - 0.5) * 18), y)
      ctx.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ── Pieces ───────────────────────────────────────────────────────────────────

type Mats = ReturnType<typeof useMaterials>
type HoverRef = MutableRefObject<string | null>

function graveyardSlot(piece: TrackedPiece, pieces: TrackedPiece[], orientation: Color): THREE.Vector3 {
  const fallen = pieces.filter((p) => p.color === piece.color && !p.square).sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0))
  const i = fallen.findIndex((p) => p.id === piece.id)
  // Rows fill from the end farthest from the player's camera, which stays in frame at every distance.
  const side = piece.color === 'b' ? 1 : -1
  const far = orientation === 'w' ? 1 : -1
  const col = Math.floor(i / 8)
  const row = i % 8
  return new THREE.Vector3(side * (5.05 + col * 0.66), -0.04, far * (row - 3.5) * 0.98)
}

function Piece({ piece, pieces, orientation, mats, selected, interactive, onSquare, hoverRef, reduced }: { piece: TrackedPiece; pieces: TrackedPiece[]; orientation: Color; mats: Mats; selected: boolean; interactive: boolean; onSquare: (sq: string) => void; hoverRef: HoverRef; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const gone = !piece.square
  const target = gone ? graveyardSlot(piece, pieces, orientation) : world(piece.square!)
  const anim = useRef({ from: target.clone(), to: target.clone(), t: 1, delay: 0, lift: 0 })
  // Position is owned by the animation after mount; a stable prop object stops re-renders snapping it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => target.clone(), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialScale = useMemo(() => (gone ? CAPTURED_SCALE : PIECE_SCALE), [])
  const { invalidate } = useThree()
  useEffect(() => invalidate(), [selected, invalidate])

  useEffect(() => {
    const a = anim.current
    const g = ref.current
    if (a.to.equals(target)) return
    a.from = g ? g.position.clone() : a.to.clone()
    a.from.y = 0
    a.to = target.clone()
    a.t = reduced ? 1 : 0
    // Captured pieces leave once the capturing piece lands.
    a.delay = gone ? MOVE_SECONDS * 0.8 : 0
    const dist = a.from.distanceTo(a.to)
    a.lift = gone ? 1.1 : piece.type === 'n' ? 0.9 : 0.22 + dist * 0.06
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x, target.z, gone])

  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    const s = gone ? CAPTURED_SCALE : PIECE_SCALE
    // The canvas renders on demand; keep frames coming only while this piece is moving.
    if (a.delay > 0 || a.t < 1 || (selected && !reduced) || Math.abs(g.scale.x - s) > 0.001) state.invalidate()
    if (a.delay > 0) {
      a.delay -= dt
      return
    }
    if (a.t < 1) {
      a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / MOVE_SECONDS)
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
      g.position.lerpVectors(a.from, a.to, e)
      g.position.y = a.to.y + Math.sin(Math.PI * e) * a.lift
    } else {
      g.position.copy(a.to)
      if (selected && !reduced) g.position.y = 0.12 + Math.sin(state.clock.elapsedTime * 4) * 0.04
    }
    if (Math.abs(g.scale.x - s) > 0.001) g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, s, 5, dt))
  })

  // Knights face their owner's left, the classic profile view.
  const facing = piece.color === 'w' ? Math.PI / 2 : -Math.PI / 2
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (interactive && piece.square) onSquare(piece.square)
  }
  return (
    <group
      ref={ref}
      position={initial}
      scale={initialScale}
      rotation={[0, facing, 0]}
      onClick={click}
      onPointerMove={(e) => {
        e.stopPropagation()
        if (hoverRef.current !== (piece.square ?? null)) {
          hoverRef.current = piece.square ?? null
          invalidate()
        }
      }}
    >
      {parts()[piece.type].map((p, i) => (
        <mesh key={i} geometry={p.geo} position={p.pos} rotation={p.rot} scale={p.scale} material={p.trim ? mats.trim : mats[piece.color]} castShadow receiveShadow />
      ))}
    </group>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

const overlayMat = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false } as const

function Squares({ selected, targets, lastMove, checkSquare, hint, occupied, interactive, onSquare, hoverRef }: Pick<BoardProps, 'selected' | 'targets' | 'lastMove' | 'checkSquare' | 'hint' | 'interactive' | 'onSquare'> & { occupied: Set<string>; hoverRef: HoverRef }) {
  const invalidate = useThree((s) => s.invalidate)
  const squares = useMemo(() => {
    const out: string[] = []
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push(`${FILES[f]}${r + 1}`)
    return out
  }, [])
  const tex = useMemo(() => ({ light: grainTexture(7, true), dark: grainTexture(31, true) }), [])
  return (
    <group>
      {squares.map((sq) => {
        const { file, rank } = squareXY(sq)
        const dark = (file + rank) % 2 === 0
        const p = world(sq)
        const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq)
        const isHint = hint && (hint.from === sq || hint.to === sq)
        const color = selected === sq ? '#c99a45' : isHint ? '#4a9a70' : isLast ? (dark ? '#5a5034' : '#e2cc86') : dark ? '#2a3246' : '#ddd2b9'
        return (
          <group key={sq} position={[p.x, 0, p.z]}>
            <mesh
              position={[0, -0.05, 0]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation()
                if (interactive) onSquare(sq)
              }}
              onPointerMove={(e) => {
                e.stopPropagation()
                if (hoverRef.current !== sq) {
                  hoverRef.current = sq
                  invalidate()
                }
              }}
            >
              <boxGeometry args={[1, 0.1, 1]} />
              <meshStandardMaterial color={color} map={dark ? tex.dark : tex.light} roughness={dark ? 0.4 : 0.52} metalness={dark ? 0.12 : 0} envMapIntensity={0.6} />
            </mesh>
            {targets.includes(sq) &&
              (occupied.has(sq) ? (
                <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
                  <ringGeometry args={[0.4, 0.48, 48]} />
                  <meshBasicMaterial color={GOLD} opacity={0.9} {...overlayMat} />
                </mesh>
              ) : (
                <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
                  <circleGeometry args={[0.14, 32]} />
                  <meshBasicMaterial color={GOLD} opacity={0.85} {...overlayMat} />
                </mesh>
              ))}
            {checkSquare === sq && (
              <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
                <circleGeometry args={[0.48, 40]} />
                <meshBasicMaterial color="#d25046" opacity={0.55} {...overlayMat} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

/**
 * Hover outline. It follows the pointer through a ref and eases in and out in
 * useFrame, so hovering never re-renders the board (the old cause of flicker).
 */
function HoverMarker({ hoverRef, interactive }: { hoverRef: HoverRef; interactive: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state, dt) => {
    const m = ref.current
    if (!m || !mat.current) return
    const sq = interactive ? hoverRef.current : null
    if (sq) {
      const p = world(sq)
      if (mat.current.opacity < 0.05) m.position.set(p.x, 0.014, p.z)
      else {
        m.position.x = THREE.MathUtils.damp(m.position.x, p.x, 22, dt)
        m.position.z = THREE.MathUtils.damp(m.position.z, p.z, 22, dt)
      }
    }
    const goal = sq ? 0.95 : 0
    mat.current.opacity = THREE.MathUtils.damp(mat.current.opacity, goal, 14, dt)
    m.visible = mat.current.opacity > 0.01
    const p = sq ? world(sq) : null
    if (Math.abs(mat.current.opacity - goal) > 0.005 || (p && (Math.abs(m.position.x - p.x) > 0.002 || Math.abs(m.position.z - p.z) > 0.002))) state.invalidate()
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, Math.PI / 4]} renderOrder={3} visible={false}>
      <ringGeometry args={[0.58, 0.67, 4, 1]} />
      <meshBasicMaterial ref={mat} color="#f0d48f" opacity={0} {...overlayMat} />
    </mesh>
  )
}

/** File and rank letters printed on the frame, upright from the player's side. */
function Coordinates({ orientation }: { orientation: Color }) {
  const texture = useMemo(() => {
    const px = 1024
    const k = px / 9
    const c = document.createElement('canvas')
    c.width = c.height = px
    const ctx = c.getContext('2d')!
    ctx.font = `600 ${Math.round(k * 0.24)}px "IBM Plex Sans", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#d9bd80'
    const flip = orientation === 'b'
    const label = (text: string, x: number, z: number) => {
      ctx.save()
      ctx.translate((x + 4.5) * k, (z + 4.5) * k)
      if (flip) ctx.rotate(Math.PI)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
    const edge = 4.27
    for (let i = 0; i < 8; i++) {
      label(FILES[i]!, i - 3.5, flip ? -edge : edge)
      label(String(i + 1), flip ? edge : -edge, 3.5 - i)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [orientation])
  return (
    <mesh position={[0, -0.098, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={texture} {...overlayMat} opacity={0.85} />
    </mesh>
  )
}

function Frame({ hoverRef }: { hoverRef: HoverRef }) {
  const invalidate = useThree((s) => s.invalidate)
  const clear = () => {
    if (hoverRef.current === null) return
    hoverRef.current = null
    invalidate()
  }
  return (
    <group onPointerMove={clear}>
      <RoundedBox args={[9.0, 0.3, 9.0]} radius={0.1} smoothness={4} position={[0, -0.25, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#161a23" roughness={0.3} metalness={0.35} />
      </RoundedBox>
      <RoundedBox args={[9.5, 0.18, 9.5]} radius={0.08} smoothness={4} position={[0, -0.46, 0]} receiveShadow>
        <meshStandardMaterial color="#0f1218" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* Inlaid gold border hugging the squares */}
      {[
        [0, 4.04, 8.14, 0.05],
        [0, -4.04, 8.14, 0.05],
        [4.04, 0, 0.05, 8.14],
        [-4.04, 0, 0.05, 8.14],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x!, -0.098, z!]}>
          <boxGeometry args={[w!, 0.012, d!]} />
          <meshStandardMaterial color={GOLD} metalness={0.95} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, -0.66, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#0e1117" roughness={0.95} />
      </mesh>
    </group>
  )
}

/** Seat the camera behind the player's pieces; narrow viewports get a wider lens so the whole board fits. */
function CameraRig({ orientation }: { orientation: Color }) {
  const { get, size } = useThree()
  // Bucket the aspect ratio so tiny resizes (mobile toolbars, scrollbars) never re-seat the camera mid-game.
  const narrow = size.width / Math.max(1, size.height) < 1.1
  useEffect(() => {
    const camera = get().camera
    const side = orientation === 'w' ? 1 : -1
    camera.position.set(0, narrow ? 10.2 : 9.4, side * (narrow ? 8.9 : 8.8))
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = narrow ? 41 : 36
      camera.near = 1
      camera.far = 60
      camera.updateProjectionMatrix()
    }
  }, [orientation, get, narrow])
  return null
}

export default function Board3D(props: BoardProps & { className?: string }) {
  const reduced = useReduced()
  const mats = useMaterials()
  const hoverRef = useRef<string | null>(null)
  const occupied = useMemo(() => new Set(props.pieces.filter((p) => p.square).map((p) => p.square!)), [props.pieces])
  return (
    <Canvas
      className={props.className}
      style={{ cursor: 'pointer' }}
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [0, 9.4, 8.8], fov: 36, near: 1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop="demand"
      onPointerLeave={() => {
        hoverRef.current = null
        invalidateAll()
      }}
      aria-label="3D chess board"
    >
      <CameraRig orientation={props.orientation} />
      {/* Studio reflections built from in-scene light panels: rendered once, no HDR download. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff1d6" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffe2b0" position={[6, 3, 4]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#8fa8e8" position={[-6, 2, -4]} rotation={[0, Math.PI / 3, 0]} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} color={GOLD} position={[0, 2, 8]} scale={3} />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 11, 5]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-6.5} shadow-camera-right={6.5} shadow-camera-top={6.5} shadow-camera-bottom={-6.5} shadow-camera-near={1} shadow-camera-far={30} />
      <spotLight position={[0, 9, 0]} angle={0.7} penumbra={0.9} intensity={18} color="#ffd9a0" />
      <directionalLight position={[-6, 3, -5]} intensity={0.5} color="#6f8fd8" />
      <Frame hoverRef={hoverRef} />
      <Coordinates orientation={props.orientation} />
      <Squares {...props} occupied={occupied} hoverRef={hoverRef} />
      <HoverMarker hoverRef={hoverRef} interactive={props.interactive} />
      {props.pieces.map((p) => (
        <Piece key={p.id} piece={p} pieces={props.pieces} orientation={props.orientation} mats={mats} selected={props.selected === p.square && !!p.square} interactive={props.interactive} onSquare={props.onSquare} hoverRef={hoverRef} reduced={reduced} />
      ))}
      <ContactShadows position={[0, -0.6, 0]} opacity={0.5} scale={24} blur={2.4} far={2} resolution={512} />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={8} maxDistance={18} minPolarAngle={0.25} maxPolarAngle={1.15} target={[0, 0, props.orientation === 'w' ? 0.6 : -0.6]} />
    </Canvas>
  )
}
