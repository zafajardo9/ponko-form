import { useEffect, useRef } from 'react'
import {
  Camera,
  Color,
  Curve,
  Mesh,
  Polyline,
  Program,
  Renderer,
  Sphere,
  Transform,
  Vec3,
} from 'ogl'
import type { BuildMilestone } from '../../lib/build-progress'

/**
 * WebGL (ogl) timeline scene for the /progress page.
 *
 * Milestones sit on a gently moving 3D strand. Completed milestones glow
 * coral while future points recede into the dark.
 */

const CORAL = '#cc785c'
const DIM_LINE = '#4a4741'
const DIM_NODE = '#2c2a26'

const nodeVertex = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalMatrix * normal;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const coreFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uLight;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    float shading = max(0.28, abs(dot(normal, viewDir)));
    gl_FragColor = vec4(uColor * (0.35 + 0.65 * shading) * uLight, 1.0);
  }
`

const haloFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.6);
    float pulse = 0.7 + 0.3 * sin(uTime * uSpeed);
    gl_FragColor = vec4(uColor, fresnel * uOpacity * pulse);
  }
`

function makeCoreProgram(gl: Renderer['gl']) {
  return new Program(gl, {
    vertex: nodeVertex,
    fragment: coreFragment,
    uniforms: {
      uColor: { value: new Color(CORAL) },
      uLight: { value: 1 },
    },
  })
}

function makeHaloProgram(gl: Renderer['gl']) {
  return new Program(gl, {
    vertex: nodeVertex,
    fragment: haloFragment,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color(CORAL) },
      uTime: { value: 0 },
      uSpeed: { value: 1.2 },
      uOpacity: { value: 0.55 },
    },
  })
}

interface NodeVisuals {
  core: Mesh
  halo: Mesh
}

export function ProgressScene({
  milestones,
  selectedId,
  onSelect,
}: {
  milestones: BuildMilestone[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const sceneRef = useRef<{ select: (id: string | null) => void } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof window === 'undefined') return

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let renderer: Renderer
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
      })
    } catch {
      return
    }
    const gl = renderer.gl
    if (!gl) return
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.display = 'block'
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    const camera = new Camera(gl, { fov: 38, near: 0.1, far: 100 })
    camera.position.set(0, 0.5, 8.4)
    const lookTarget = new Vec3(0, 0, 0)
    camera.lookAt(lookTarget)

    const group = new Transform()

    // ── Node positions along a single flowing 3D strand ────────────────────
    const count = milestones.length
    const spacing = 1.22
    const positions = milestones.map((_, index) => {
      const t = index - (count - 1) / 2
      const phase = index * 1.08
      return new Vec3(
        t * spacing,
        Math.sin(phase) * 0.72,
        Math.cos(phase) * 0.72,
      )
    })
    // ── Node meshes ─────────────────────────────────────────────────────────
    const nodeMeshes = new Map<string, NodeVisuals>()
    // Boundary index: everything before it has shipped, the rest has not.
    const nextUpIndex = milestones.findIndex((milestone) => !milestone.status)

    milestones.forEach((milestone, index) => {
      const done = milestone.status
      const core = new Mesh(gl, {
        geometry: new Sphere(gl, { radius: 0.17, widthSegments: 28, heightSegments: 20 }),
        program: makeCoreProgram(gl),
      })
      core.position.copy(positions[index])
      core.program.uniforms.uColor.value.set(done ? CORAL : DIM_NODE)
      core.program.uniforms.uLight.value = done ? 1 : 0.55

      const halo = new Mesh(gl, {
        geometry: new Sphere(gl, { radius: 0.38, widthSegments: 24, heightSegments: 16 }),
        program: makeHaloProgram(gl),
      })
      halo.position.copy(positions[index])
      halo.program.uniforms.uColor.value.set(done ? CORAL : DIM_LINE)
      halo.program.uniforms.uOpacity.value = done ? 0.5 : 0.18

      group.addChild(core)
      group.addChild(halo)
      nodeMeshes.set(milestone.id, { core, halo })
    })

    // ── Completed and upcoming segments of the strand ───────────────────────
    const primaryCurvePoints = new Curve({
      points: positions,
      divisions: count * 4,
      type: Curve.CATMULLROM,
    }).getPoints(Math.max(72, count * 14))
    const fraction = nextUpIndex >= 0 ? nextUpIndex / (count - 1) : 1
    const doneCount = Math.min(
      primaryCurvePoints.length - 1,
      Math.max(1, Math.round(primaryCurvePoints.length * fraction)),
    )

    const makePolyline = (points: Vec3[], color: string, thickness: number) => {
      if (points.length < 2) return null
      const line = new Polyline(gl, {
        points,
        uniforms: {
          uColor: { value: new Color(color) },
          uThickness: { value: thickness },
        },
      })
      line.mesh.position.z = -0.02 // sit just behind the nodes
      group.addChild(line.mesh)
      return line
    }

    const railLines = [
      makePolyline(primaryCurvePoints.slice(0, doneCount + 1), CORAL, 2.6),
      makePolyline(primaryCurvePoints.slice(doneCount), DIM_LINE, 1.5),
    ]

    // ── Sizing ──────────────────────────────────────────────────────────────
    const setSize = () => {
      const rect = container.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      renderer.setSize(width, height)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      camera.perspective({ fov: 38, aspect: width / height })
      railLines.forEach((line) => line?.resize())
      // Fit the full path inside the viewport, especially on narrow screens.
      const spanX = (count - 1) * spacing
      const visibleHeight = 2 * 8.4 * Math.tan((38 * Math.PI) / 360)
      const fit = Math.min(1.05, (visibleHeight * (width / height)) / spanX)
      // Continue fitting rather than clipping when the milestone array grows.
      // Picking keeps a 30px interaction radius even when visual nodes shrink.
      const scale = Math.max(0.2, Math.min(1.05, fit))
      group.scale.set(scale, scale, scale)
    }
    let resizePending = false
    const resizeObserver = new ResizeObserver(() => {
      if (resizePending) return
      resizePending = true
      requestAnimationFrame(() => {
        resizePending = false
        setSize()
      })
    })
    resizeObserver.observe(container)
    setSize()

    // ── Pointer interaction (parallax + picking) ────────────────────────────
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const screenPositions = new Map<string, { x: number; y: number }>()

    const updateScreenPositions = () => {
      const rect = container.getBoundingClientRect()
      group.updateMatrixWorld()
      camera.updateMatrixWorld()
      positions.forEach((position, index) => {
        const milestone = milestones[index]
        const world = new Vec3().copy(position)
        world.applyMatrix4(group.worldMatrix)
        world.applyMatrix4(camera.projectionViewMatrix)
        screenPositions.set(milestone.id, {
          x: ((world.x + 1) / 2) * rect.width,
          y: (1 - (world.y + 1) / 2) * rect.height,
        })
      })
    }

    const nearestNodeId = (clientX: number, clientY: number, radius = 30) => {
      const rect = container.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      let best: string | null = null
      let bestDistance = radius * radius
      screenPositions.forEach((position, id) => {
        const dx = position.x - px
        const dy = position.y - py
        const distance = dx * dx + dy * dy
        if (distance < bestDistance) {
          bestDistance = distance
          best = id
        }
      })
      return best
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      canvas.style.cursor = nearestNodeId(event.clientX, event.clientY) ? 'pointer' : 'default'
    }

    const handlePointerDown = (event: PointerEvent) => {
      const id = nearestNodeId(event.clientX, event.clientY)
      if (id) {
        event.stopPropagation()
        onSelectRef.current(id)
      }
    }

    canvas.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerdown', handlePointerDown)

    // ── Animation loop ──────────────────────────────────────────────────────
    let raf = 0
    let contextLost = false
    let isVisible = true
    let tabVisible = document.visibilityState !== 'hidden'
    const t0 = performance.now()
    let lastFrame = 0
    const frameInterval = 1000 / 60

    const setTimeUniforms = (time: number) => {
      nodeMeshes.forEach((visuals) => {
        visuals.halo.program.uniforms.uTime.value = time
      })
    }

    const renderFrame = (time: number, dt: number) => {
      // Smooth pointer follow for premium-feeling parallax
      pointer.x += (pointer.targetX - pointer.x) * Math.min(1, dt * 3.2)
      pointer.y += (pointer.targetY - pointer.y) * Math.min(1, dt * 3.2)

      group.rotation.x = 0.14 * Math.sin(time * 0.22) + pointer.y * 0.07
      group.rotation.y = 0.12 * Math.sin(time * 0.16 + 0.7) + pointer.x * 0.12
      group.rotation.z = 0.018 * Math.sin(time * 0.13)
      camera.position.x = pointer.x * 0.42
      camera.position.y = 0.5 + pointer.y * 0.3
      camera.lookAt(lookTarget)

      setTimeUniforms(time)
      updateScreenPositions()
      renderer.render({ scene: group, camera })
    }

    const loop = (now: number) => {
      if (contextLost || !isVisible || !tabVisible) return
      if (now - lastFrame < frameInterval) {
        raf = requestAnimationFrame(loop)
        return
      }
      const dt = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrame = now
      renderFrame((now - t0) / 1000, dt)
      raf = requestAnimationFrame(loop)
    }

    const renderStaticFrame = () => {
      group.rotation.x = 0.08
      group.rotation.y = 0.1
      camera.position.set(0, 0.5, 8.4)
      camera.lookAt(lookTarget)
      setTimeUniforms(0)
      updateScreenPositions()
      renderer.render({ scene: group, camera })
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(raf)
    }
    const handleContextRestored = () => {
      contextLost = false
      if (isVisible && tabVisible && !prefersReducedMotion) {
        cancelAnimationFrame(raf)
        lastFrame = 0
        raf = requestAnimationFrame(loop)
      }
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible
        isVisible = entry.isIntersecting
        if (isVisible && !wasVisible && !contextLost && tabVisible && !prefersReducedMotion) {
          cancelAnimationFrame(raf)
          lastFrame = 0
          raf = requestAnimationFrame(loop)
        }
      },
      { threshold: 0 },
    )
    intersectionObserver.observe(container)

    const handleVisibilityChange = () => {
      tabVisible = document.visibilityState !== 'hidden'
      if (tabVisible && isVisible && !contextLost && !prefersReducedMotion) {
        cancelAnimationFrame(raf)
        lastFrame = 0
        raf = requestAnimationFrame(loop)
      } else {
        cancelAnimationFrame(raf)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (prefersReducedMotion) {
      renderStaticFrame()
    } else {
      lastFrame = performance.now()
      raf = requestAnimationFrame(loop)
    }

    // ── Imperative selection highlight ──────────────────────────────────────
    const select = (id: string | null) => {
      nodeMeshes.forEach((visuals, nodeId) => {
        const milestone = milestones.find((item) => item.id === nodeId)
        const isSelected = nodeId === id
        visuals.core.scale.set(isSelected ? 1.32 : 1)
        visuals.core.program.uniforms.uLight.value =
          isSelected ? 1 : milestone?.status ? 1 : 0.55
        const base = milestone?.status ? 0.5 : 0.18
        visuals.halo.program.uniforms.uOpacity.value = isSelected
          ? Math.min(1.15, base + 0.45)
          : base
      })
    }
    sceneRef.current = { select }
    select(selectedId)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      try {
        container.removeChild(canvas)
      } catch {
        /* already removed */
      }
      sceneRef.current = null
    }
    // Rebuild when the milestone list changes; selection is applied imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones])

  useEffect(() => {
    sceneRef.current?.select(selectedId)
  }, [selectedId])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
  )
}
