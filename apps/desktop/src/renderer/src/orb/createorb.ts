import type { RefObject } from 'react'
import type { OrbAPI, OrbState } from './types'
import * as THREE from 'three'
import { Timer } from 'three'

export default function createOrb(
    canvas: HTMLCanvasElement,
    onStateChangeRef?: RefObject<((s: OrbState) => void) | null>
): OrbAPI {
    let destroyed = false
    const N = 64000
    let L = 0.022

    const GlobalRenderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    GlobalRenderer.setPixelRatio(window.devicePixelRatio)
    GlobalRenderer.setSize(window.innerWidth, window.innerHeight)
    GlobalRenderer.setClearColor(0x050508, 1)

    const GlobalScene = new THREE.Scene()
    const GlobalCamera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        1000
    )
    GlobalCamera.position.z = 80

    // ── Particles ──────────────────────────────────────────────────────────────
    const ParticleGeometry = new THREE.BufferGeometry()
    const ParticlePositions = new Float32Array(N * 3)
    const ParticleVelocities = new Float32Array(N * 3)
    const ParticlePhase = new Float32Array(N)

    for (let i = 0; i < N; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = Math.pow(Math.random(), 0.5) * 25
        ParticlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        ParticlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        ParticlePositions[i * 3 + 2] = r * Math.cos(phi)
        ParticlePhase[i] = Math.random() * 1000
    }

    ParticleGeometry.setAttribute('position', new THREE.BufferAttribute(ParticlePositions, 3))

    const ParticleMaterial = new THREE.PointsMaterial({
        color: 0x4ca8e8,
        size: 0.1,
        transparent: true,
        opacity: 0,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })

    const points = new THREE.Points(ParticleGeometry, ParticleMaterial)
    GlobalScene.add(points)

    // ── Connection lines ────────────────────────────────────────────────────────
    const MAX_LINES = 8000
    const LinePositions = new Float32Array(MAX_LINES * 6)
    const LineGeometry = new THREE.BufferGeometry()
    LineGeometry.setAttribute('position', new THREE.BufferAttribute(LinePositions, 3))
    LineGeometry.setDrawRange(0, 0)

    const LineMaterial = new THREE.LineBasicMaterial({
        color: 0x4ca8e8,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })

    const lines = new THREE.LineSegments(LineGeometry, LineMaterial)
    GlobalScene.add(lines)

    // ── Electrons ──────────────────────────────────────────────────────────────
    const MAX_ELECTRONS = 2000
    const ElectronGeometry = new THREE.BufferGeometry()
    const ElectronPositions = new Float32Array(MAX_ELECTRONS * 3)
    ElectronGeometry.setAttribute('position', new THREE.BufferAttribute(ElectronPositions, 3))
    ElectronGeometry.setDrawRange(0, 0)

    const ElectronMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })

    const electronPoints = new THREE.Points(ElectronGeometry, ElectronMaterial)
    GlobalScene.add(electronPoints)

    interface Electron {
        sx: number
        sy: number
        sz: number
        ex: number
        ey: number
        ez: number
        t: number
        speed: number
    }
    const activeElectrons: Electron[] = []
    let electronSpawnRate = 0
    let targetElectronRate = 0
    let lastElectronSpawn = 0

    let activeConnections: {
        x1: number
        y1: number
        z1: number
        x2: number
        y2: number
        z2: number
    }[] = []

    // ── Base state vars ────────────────────────────────────────────────────────

    let state: OrbState = 'startup'
    let startupTimer = 0
    let pulseSent = false
    let targetRadius = 28,
        currentRadius = 28
    let targetSpeed = 0.01,
        currentSpeed = 0.01
    let targetBright = 0,
        currentBright = 0
    let targetSize = 0.1,
        currentSize = 0.1
    let lineAmount = 0,
        targetLineAmount = 0
    const lineDistance = 8

    let spinX = 0,
        spinY = 0,
        spinZ = 0
    let transitionEnergy = 0
    let lastState: OrbState = 'idle'
    let cloudZ = 0,
        cloudZVel = 0

    // ── Speaking-specific vars ─────────────────────────────────────────────────
    let vortexStrength = 0,
        targetVortex = 0
    let breathAmp = 0,
        targetBreathAmp = 0
    let shockwave = 0
    let prevBass = 0
    let burstCooldown = 1.5

    // ── Camera position smoothing ──────────────────────────────────────────────
    let camPosX = 0,
        camPosY = 0
    let targetCamPosX = 0,
        targetCamPosY = 0

    // ── Audio ──────────────────────────────────────────────────────────────────
    let analyser: AnalyserNode | null = null
    let externalVolume = 0 // External volume from WebSocket
    let freqData = new Uint8Array(64)
    let bass = 0,
        mid = 0,
        treble = 0

    const timer = new Timer()
    timer.update()

    // ── Colour helpers ─────────────────────────────────────────────────────────
    const COL_BASE = new THREE.Color(0x4ca8e8)
    const COL_THINK = new THREE.Color(0x6ec4ff)
    const COL_SPEAK = new THREE.Color(0x5ab8f0)
    const COL_BRIGHT = new THREE.Color(0xb8eeff)
    const COL_FLASH = new THREE.Color(0xffffff)
    const _tmpColor = new THREE.Color()
    const _lineColorMemory = new THREE.Color(0x4ca8e8)

    // ── Animate ────────────────────────────────────────────────────────────────
    function animate() {
        if (destroyed) return
        requestAnimationFrame(animate)
        function assignTargets(
            data: {
                radius: { min: number; max: number } | number
                speed: { min: number; max: number } | number
                bright: { min: number; max: number } | number
                size: { min: number; max: number } | number
                lineAmount: { min: number; max: number } | number
                electronRate: { min: number; max: number } | number
                vortex: { min: number; max: number } | number
                breathAmp: { min: number; max: number } | number
            },
            forced: boolean = false
        ) {
            if (!window.__Params) {
                window.__Params = {
                    timer: 0,
                    interval: 6 + Math.random() * 6
                }
            }
            if (window.__Params) {
                // console.log(`Timer: ${window.__Params.timer.toFixed(2)} / ${window.__Params.interval.toFixed(2)}, State: ${state}, LastState: ${lastState}, Forced: ${forced}`);
                if (
                    window.__Params.timer >= window.__Params.interval ||
                    (lastState !== 'startup' && state != lastState) ||
                    forced
                ) {
                    window.__Params.timer = 0
                    window.__Params.interval = 6 + Math.random() * 6
                    const {
                        radius,
                        speed,
                        bright,
                        size,
                        lineAmount,
                        electronRate,
                        vortex,
                        breathAmp
                    } = data
                    targetRadius =
                        typeof radius === 'number'
                            ? radius
                            : (radius.min + radius.max) / 2 +
                              (Math.random() - 0.5) * (radius.max - radius.min)
                    targetSpeed =
                        typeof speed === 'number'
                            ? speed
                            : (speed.min + speed.max) / 2 +
                              (Math.random() - 0.5) * (speed.max - speed.min)
                    targetBright =
                        typeof bright === 'number'
                            ? bright
                            : (bright.min + bright.max) / 2 +
                              (Math.random() - 0.5) * (bright.max - bright.min)
                    targetSize =
                        typeof size === 'number'
                            ? size
                            : (size.min + size.max) / 2 +
                              (Math.random() - 0.5) * (size.max - size.min)
                    targetLineAmount =
                        typeof lineAmount === 'number'
                            ? lineAmount
                            : (lineAmount.min + lineAmount.max) / 2 +
                              (Math.random() - 0.5) * (lineAmount.max - lineAmount.min)
                    targetElectronRate =
                        typeof electronRate === 'number'
                            ? electronRate
                            : (electronRate.min + electronRate.max) / 2 +
                              (Math.random() - 0.5) * (electronRate.max - electronRate.min)
                    targetVortex =
                        typeof vortex === 'number'
                            ? vortex
                            : (vortex.min + vortex.max) / 2 +
                              (Math.random() - 0.5) * (vortex.max - vortex.min)
                    targetBreathAmp =
                        typeof breathAmp === 'number'
                            ? breathAmp
                            : (breathAmp.min + breathAmp.max) / 2 +
                              (Math.random() - 0.5) * (breathAmp.max - breathAmp.min)
                    // console.log(`New targets - Radius: ${targetRadius.toFixed(2)}, Speed: ${targetSpeed.toFixed(3)}, Bright: ${targetBright.toFixed(2)}, Size: ${targetSize.toFixed(2)}, LineAmount: ${targetLineAmount.toFixed(2)}, ElectronRate: ${targetElectronRate.toFixed(3)}, Vortex: ${targetVortex.toFixed(3)}, BreathAmp: ${targetBreathAmp.toFixed(3)}`);
                }
            }
        }

        timer.update()
        const t = timer.getElapsed()
        const dt = Math.min(timer.getDelta(), 0.05)
        window.__Params && (window.__Params.timer += dt)

        // ── Per-state targets ───────────────────────────────────────────────────
        if (state === 'startup') {
            if (startupTimer < 5)
                assignTargets(
                    {
                        radius: 28,
                        speed: 0.01,
                        bright: 0.5,
                        size: 0.1,
                        lineAmount: 0,
                        electronRate: 0,
                        vortex: 0,
                        breathAmp: 0
                    },
                    true
                )
            startupTimer += dt
            if (startupTimer >= 5 && startupTimer < 15) {
                assignTargets(
                    {
                        radius: 28,
                        speed: 0.01,
                        bright: 1,
                        size: 0.1,
                        lineAmount: 0,
                        electronRate: 0,
                        vortex: 0,
                        breathAmp: 0
                    },
                    true
                )
            }
            if (startupTimer >= 15 && !pulseSent && startupTimer < 20) {
                assignTargets(
                    {
                        radius: 28,
                        speed: 0.05,
                        bright: 0.3,
                        size: 0.1,
                        lineAmount: 1,
                        electronRate: 0,
                        vortex: 0.1,
                        breathAmp: 4
                    },
                    true
                )
                shockwave = 1.0
                pulseSent = true
            }
            if (pulseSent && startupTimer >= 20 && startupTimer < 30) {
                assignTargets(
                    {
                        radius: 26,
                        speed: { min: 0.1, max: 0.3 },
                        bright: 0.3,
                        size: 0.1,
                        lineAmount: { min: 0.2, max: 0.8 },
                        electronRate: { min: 0.1, max: 0.5 },
                        vortex: { min: 0.01, max: 0.05 },
                        breathAmp: { min: 0.01, max: 0.06 }
                    },
                    true
                )
                pulseSent = false
            }
            if (startupTimer >= 30) {
                startupTimer = 0
                state = 'idle'
                startupTimer = 0
                shockwave = 0
                const cb = onStateChangeRef?.current
                if (cb) cb('idle')
            }
        } else {
            switch (state) {
                case 'idle':
                    assignTargets({
                        radius: 24,
                        speed: { min: 0.1, max: 0.3 },
                        bright: { min: 0.24, max: 0.26 },
                        size: 0.1,
                        lineAmount: { min: 0.2, max: 0.8 },
                        electronRate: { min: 0.1, max: 0.5 },
                        vortex: { min: 0.01, max: 0.05 },
                        breathAmp: { min: 0.01, max: 0.06 }
                    })
                    break

                case 'listening':
                    assignTargets({
                        radius: 22,
                        speed: { min: 0.3, max: 0.5 },
                        bright: { min: 0.6, max: 0.7 },
                        size: 0.1,
                        lineAmount: { min: 0.8, max: 1.4 },
                        electronRate: { min: 0.3, max: 0.7 },
                        vortex: { min: 0.1, max: 0.3 },
                        breathAmp: { min: 0.4, max: 0.6 }
                    })
                    break

                case 'thinking':
                    assignTargets({
                        radius: 18,
                        speed: { min: 0.4, max: 0.6 },
                        bright: 0.7,
                        size: 0.1,
                        lineAmount: 1.0,
                        electronRate: 0.015,
                        vortex: { min: 0.5, max: 0.7 },
                        breathAmp: { min: 0.1, max: 0.2 }
                    })
                    break

                case 'speaking':
                    // Speaking: orb more compact + flatter ring silhouette
                    assignTargets({
                        radius: 10,
                        speed: 0.45,
                        bright: 0.78,
                        size: 0.1,
                        lineAmount: 0.92,
                        electronRate: 0,
                        vortex: { min: 1.2, max: 1.6 },
                        breathAmp: { min: 0.8, max: 1.2 }
                    })

                    break
            }
        }

        // ── Lerp base params ────────────────────────────────────────────────────

        if (state !== lastState) {
            switch (state) {
                case 'idle':
                    switch (lastState) {
                        case 'startup':
                            // transitionEnergy = 0;
                            L = 1
                            break
                        case 'listening':
                            // transitionEnergy = 0.5;
                            L = 1
                            break
                        case 'thinking':
                            // transitionEnergy = 0.5;
                            L = 1
                            break
                        case 'speaking':
                            // transitionEnergy = 0.5;
                            L = 1
                            break
                    }
                    break
                case 'listening':
                    switch (lastState) {
                        case 'startup':
                            break
                        case 'idle':
                            // transitionEnergy = 2;
                            L = 1
                            break
                        case 'thinking':
                            // transitionEnergy = 0.8;
                            L = 0.5
                            break
                        case 'speaking':
                            // transitionEnergy = 1.2;
                            L = 0.5
                            break
                    }
                    break
                case 'thinking':
                    switch (lastState) {
                        case 'startup':
                            break
                        case 'idle':
                            // transitionEnergy = 2.3;
                            L = 1
                            break
                        case 'listening':
                            // transitionEnergy = 0.9;
                            L = 0.5
                            break
                        case 'speaking':
                            // transitionEnergy = 1.4;
                            L = 0.5
                            break
                    }
                    break
                case 'speaking':
                    spinX = 0
                    spinY = 0
                    spinZ = 0
                    switch (lastState) {
                        case 'startup':
                            L = 1
                            break
                        case 'listening':
                            // transitionEnergy = 0.9;
                            L = 0.5
                            break
                        case 'thinking':
                            // transitionEnergy = 2;
                            L = 2
                            break
                    }
                    break
            }
            lastState = state
        }

        switch (state) {
            case 'idle':
                if (L > 0.04) {
                    L = L - 0.001
                    L = Math.max(L, 0.04)
                } else {
                    L = 0.04
                }
                break
            case 'listening':
                if (L > 0.035) {
                    L = L - 0.001
                    L = Math.max(L, 0.035)
                } else {
                    L = 0.035
                }
                break
            case 'thinking':
                if (L > 0.045) {
                    L = L - 0.01
                    L = Math.max(L, 0.045)
                } else {
                    L = 0.045
                }
                break
            case 'speaking':
                if (L > 0.06) {
                    L = L - 0.01
                    L = Math.max(L, 0.06)
                } else {
                    L = 0.06
                }
                break
            case 'startup':
                L = Math.min(startupTimer / 13000, 0.022) // Gradually increase L during startup for smooth transition
                if (startupTimer > 15) L = 0.1
                break
        }

        // ── Transition tumble ───────────────────────────────────────────────────

        currentRadius += (targetRadius - currentRadius) * L
        currentSpeed += (targetSpeed - currentSpeed) * L
        currentBright += (targetBright - currentBright) * L
        currentSize += (targetSize - currentSize) * L
        lineAmount += (targetLineAmount - lineAmount) * L
        electronSpawnRate += (targetElectronRate - electronSpawnRate) * L
        vortexStrength += (targetVortex - vortexStrength) * (startupTimer > 15 ? 0.5 : 0.025)
        breathAmp += (targetBreathAmp - breathAmp) * (startupTimer > 15 ? 0.5 : 0.025)

        // console.log(`L: ${L.toFixed(3)}, lineAmount: ${lineAmount.toFixed(3)}, shockwave: ${shockwave.toFixed(3)}, transitionEnergy: ${transitionEnergy.toFixed(3)}, CPU ms: ${lastCpuMs.toFixed(1)}`);
        transitionEnergy *= 0.985
        if (transitionEnergy > 0.05) {
            spinX += transitionEnergy * 0.012 * Math.sin(t * 1.7)
            spinY += transitionEnergy * 0.015
            spinZ += transitionEnergy * 0.008 * Math.cos(t * 1.3)
        }

        // ── Audio ────────────────────────────────────────────────────────────────
        bass = 0
        mid = 0
        treble = 0
        if (analyser) {
            analyser.getByteFrequencyData(freqData)
            let bS = 0,
                mS = 0,
                tS = 0
            for (let i = 0; i < 8; i++) bS += freqData[i]
            for (let i = 8; i < 24; i++) mS += freqData[i]
            for (let i = 24; i < 48; i++) tS += freqData[i]
            bass = bS / (8 * 255)
            mid = mS / (16 * 255)
            treble = tS / (24 * 255)
        } else if (state === 'speaking') {
            // Use external volume if no analyser (Jarvis on PC)
            bass = externalVolume * 0.6
            mid = externalVolume * 0.3
            treble = externalVolume * 0.1
        }

        // ── Shockwave — bass spike detection ────────────────────────────────────
        const bassJump = Math.max(0, bass - prevBass - 0.04) * 5.0
        shockwave = Math.max(shockwave * 0.82, bassJump)
        prevBass = bass

        // ── Periodic burst every ~1.5 s during speaking ──────────────────────
        if (state === 'speaking') {
            burstCooldown -= dt
            if (burstCooldown <= 0) {
                shockwave = Math.max(shockwave, 0.28)
                burstCooldown = 1.3 + Math.random() * 0.5
            }
        } else {
            burstCooldown = 1.5
        }

        // ── Cloud drift ──────────────────────────────────────────────────────────
        let zTarget = Math.sin(t * 0.12) * 8
        if (state === 'thinking') zTarget = Math.sin(t * 0.3) * 15 + Math.sin(t * 0.9) * 6
        else if (state === 'speaking') zTarget = Math.sin(t * 0.18) * 7 - bass * 8
        cloudZVel += (zTarget - cloudZ) * 0.008
        cloudZVel *= 0.94
        cloudZ += cloudZVel

        points.rotation.x = spinX
        points.rotation.y = spinY
        points.rotation.z = spinZ
        points.position.z = cloudZ
        lines.rotation.x = spinX
        lines.rotation.y = spinY
        lines.rotation.z = spinZ
        lines.position.z = cloudZ

        // ── Update particles ─────────────────────────────────────────────────────
        const p = ParticleGeometry.getAttribute('position') as THREE.BufferAttribute
        const a = p.array as Float32Array
        const speaking = state === 'speaking'

        for (let i = 0; i < N; i++) {
            const i3 = i * 3
            const x = a[i3],
                y = a[i3 + 1],
                z = a[i3 + 2]
            const px = ParticlePhase[i]

            // ── Noise forces ──
            ParticleVelocities[i3] += Math.sin(t * 0.05 + px) * 0.001 * currentSpeed
            ParticleVelocities[i3 + 1] += Math.cos(t * 0.06 + px * 1.3) * 0.001 * currentSpeed
            ParticleVelocities[i3 + 2] += Math.sin(t * 0.055 + px * 0.7) * 0.001 * currentSpeed
            ParticleVelocities[i3] +=
                Math.sin(t * 0.02 + px * 2.1 + y * 0.1) * 0.0008 * currentSpeed
            ParticleVelocities[i3 + 1] +=
                Math.cos(t * 0.025 + px * 1.7 + z * 0.1) * 0.0008 * currentSpeed
            ParticleVelocities[i3 + 2] +=
                Math.sin(t * 0.022 + px * 0.9 + x * 0.1) * 0.0008 * currentSpeed

            // ── Radial containment ──
            const dist = Math.sqrt(x * x + y * y + z * z) || 0.01

            const radiusTarget = speaking
                ? currentRadius * (1.0 + Math.sin(t * 3.5 + px * 0.2) * 0.15 * breathAmp)
                : currentRadius

            const pullBase = Math.max(0, dist - radiusTarget) * 0.002 + 0.0003
            ParticleVelocities[i3] -= (x / dist) * pullBase
            ParticleVelocities[i3 + 1] -= (y / dist) * pullBase
            ParticleVelocities[i3 + 2] -= (z / dist) * pullBase

            // ── Bass push ──
            if (bass > 0.05) {
                const bf = speaking ? bass * 0.032 : bass * 0.02
                ParticleVelocities[i3] += (x / dist) * bf
                ParticleVelocities[i3 + 1] += (y / dist) * bf
                ParticleVelocities[i3 + 2] += (z / dist) * bf
            }

            // ── Mid pulse ──
            if (mid > 0.1) {
                const pulse = Math.sin(t * 8 + px)
                const mf = speaking ? mid * 0.022 : mid * 0.012
                ParticleVelocities[i3] += (x / dist) * mf * pulse
                ParticleVelocities[i3 + 1] += (y / dist) * mf * pulse
                ParticleVelocities[i3 + 2] += (z / dist) * mf * pulse
            }

            // ══ SPEAKING EXCLUSIVE EFFECTS ══════════════════════════════════════════
            if (speaking) {
                // 1. VORTEX
                if (vortexStrength > 0.01) {
                    const xzLen = Math.sqrt(x * x + z * z) || 0.01
                    ParticleVelocities[i3] += (-z / xzLen) * vortexStrength * 0.0022
                    ParticleVelocities[i3 + 2] += (x / xzLen) * vortexStrength * 0.0022
                    ParticleVelocities[i3 + 1] += Math.sin(px) * vortexStrength * 0.0005
                }

                // 2. SHOCKWAVE
                if (shockwave > 0.005) {
                    ParticleVelocities[i3] += (x / dist) * shockwave * 0.1
                    ParticleVelocities[i3 + 1] += (y / dist) * shockwave * 0.05
                    ParticleVelocities[i3 + 2] += (z / dist) * shockwave * 0.1
                }

                // 3. BREATHING
                if (breathAmp > 0) {
                    const bp = Math.sin(t * 7.5 + px * 0.4) * breathAmp * 0.0018
                    ParticleVelocities[i3] += (x / dist) * bp
                    ParticleVelocities[i3 + 1] += (y / dist) * bp
                    ParticleVelocities[i3 + 2] += (z / dist) * bp
                }

                // 4. TREBLE flutter
                if (treble > 0.08) {
                    const jitter = (Math.random() - 0.5) * treble * 0.04
                    ParticleVelocities[i3] += jitter
                    ParticleVelocities[i3 + 1] += jitter * 0.5
                    ParticleVelocities[i3 + 2] += jitter
                }
            }

            // 1. HYPERVORTEX — massive swirl around Y axis
            if (vortexStrength > 0.01) {
                const xzLen = Math.sqrt(x * x + z * z) || 0.01
                ParticleVelocities[i3] += (-z / xzLen) * vortexStrength * 0.004
                ParticleVelocities[i3 + 2] += (x / xzLen) * vortexStrength * 0.004
                // Also spiral around Z axis during vortex phase
                ParticleVelocities[i3 + 1] += Math.sin(px * 2.3 + t) * vortexStrength * 0.001
            }

            // 2. SHOCKWAVE blast (stronger than speaking)
            if (shockwave > 0.005) {
                ParticleVelocities[i3] += (x / dist) * shockwave * 0.18
                ParticleVelocities[i3 + 1] += (y / dist) * shockwave * 0.18
                ParticleVelocities[i3 + 2] += (z / dist) * shockwave * 0.18
            }

            // 3. BREATHING — big sinusoidal surge
            if (breathAmp > 0) {
                const bp = Math.sin(t * 9.0 + px * 0.5) * breathAmp * 0.0035
                ParticleVelocities[i3] += (x / dist) * bp
                ParticleVelocities[i3 + 1] += (y / dist) * bp
                ParticleVelocities[i3 + 2] += (z / dist) * bp
            }

            // ── Damping + integrate ──
            const damp = 0.992
            ParticleVelocities[i3] *= damp
            ParticleVelocities[i3 + 1] *= damp
            ParticleVelocities[i3 + 2] *= damp
            a[i3] += ParticleVelocities[i3]
            a[i3 + 1] += ParticleVelocities[i3 + 1]
            a[i3 + 2] += ParticleVelocities[i3 + 2]
        }
        p.needsUpdate = true

        // ── Connection lines ──────────────────────────────────────────────────────
        if (lineAmount > 0) {
            const lp = LineGeometry.getAttribute('position') as THREE.BufferAttribute
            const la = lp.array as Float32Array
            let lineCount = 0
            const maxDist = lineDistance * (1 + bass * (speaking ? 0.8 : 0.5))
            const maxDistSq = maxDist * maxDist
            const step = Math.max(1, Math.floor(N / 600))

            for (let i = 0; i < N && lineCount < MAX_LINES; i += step) {
                const i3 = i * 3
                const x1 = a[i3],
                    y1 = a[i3 + 1],
                    z1 = a[i3 + 2]
                for (let j = i + step; j < N && lineCount < MAX_LINES; j += step) {
                    const j3 = j * 3
                    const dx = a[j3] - x1,
                        dy = a[j3 + 1] - y1,
                        dz = a[j3 + 2] - z1
                    if (dx * dx + dy * dy + dz * dz < maxDistSq) {
                        const idx = lineCount * 6
                        la[idx] = x1
                        la[idx + 1] = y1
                        la[idx + 2] = z1
                        la[idx + 3] = a[j3]
                        la[idx + 4] = a[j3 + 1]
                        la[idx + 5] = a[j3 + 2]
                        lineCount++
                    }
                }
            }
            LineGeometry.setDrawRange(0, lineCount * 2)
            lp.needsUpdate = true
            LineMaterial.opacity = 0.01 + shockwave * 0.15

            activeConnections = []
            for (let c = 0; c < Math.min(lineCount, 500); c++) {
                const ci = c * 6
                activeConnections.push({
                    x1: la[ci],
                    y1: la[ci + 1],
                    z1: la[ci + 2],
                    x2: la[ci + 3],
                    y2: la[ci + 4],
                    z2: la[ci + 5]
                })
            }
        } else {
            LineGeometry.setDrawRange(0, 0)
            activeConnections = []
        }

        // ── Electrons ─────────────────────────────────────────────────────────────
        const maxElec = speaking ? 10 : 3
        const spawnGap = speaking ? 0.18 : 1.0
        const eSpeed = speaking ? 0.009 + Math.random() * 0.009 : 0.003 + Math.random() * 0.003

        if (activeConnections.length > 0 && electronSpawnRate > 0.005) {
            if (activeElectrons.length < maxElec && t - lastElectronSpawn > spawnGap) {
                const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)]
                activeElectrons.push({
                    sx: conn.x1,
                    sy: conn.y1,
                    sz: conn.z1,
                    ex: conn.x2,
                    ey: conn.y2,
                    ez: conn.z2,
                    t: 0,
                    speed: eSpeed
                })
                lastElectronSpawn = t
            }
        }

        const ep = ElectronGeometry.getAttribute('position') as THREE.BufferAttribute
        const ea = ep.array as Float32Array
        let aliveCount = 0

        for (let e = activeElectrons.length - 1; e >= 0; e--) {
            const el = activeElectrons[e]
            el.t += el.speed
            if (el.t >= 1) {
                activeElectrons.splice(e, 1)
                continue
            }
            const ei = aliveCount * 3
            ea[ei] = el.sx + (el.ex - el.sx) * el.t
            ea[ei + 1] = el.sy + (el.ey - el.sy) * el.t
            ea[ei + 2] = el.sz + (el.ez - el.sz) * el.t
            aliveCount++
        }

        ElectronGeometry.setDrawRange(0, aliveCount)
        ep.needsUpdate = true

        electronPoints.rotation.x = spinX
        electronPoints.rotation.y = spinY
        electronPoints.rotation.z = spinZ
        electronPoints.position.z = cloudZ
        ElectronMaterial.size = 0.2
        ElectronMaterial.opacity = speaking ? 1.0 + shockwave * 0.5 : 1.0

        // ── Material update ───────────────────────────────────────────────────────
        if (speaking) {
            ParticleMaterial.opacity = Math.min(1.2, currentBright + bass * 0.18 + shockwave * 0.25)
            ParticleMaterial.size = currentSize + bass * 0.2 + shockwave * 0.3

            const pulseIntensity = bass * 0.7 + mid * 0.2 + shockwave * 0.5
            const wave = 0.5 + 0.5 * Math.sin(t * 12.0 + bass * 8.0)
            _tmpColor.lerpColors(COL_SPEAK, COL_BRIGHT, Math.min(1, pulseIntensity * wave))

            if (shockwave > 0.18) {
                _tmpColor.lerp(COL_FLASH, (shockwave - 0.18) * 3.0)
            }
            ParticleMaterial.color.lerp(_tmpColor, 0.14)
            _lineColorMemory.lerp(_tmpColor, 0.04) // transition plus douce
            LineMaterial.color.copy(_lineColorMemory)
            ElectronMaterial.color.set(0xffffff)
        } else {
            const startupShock = state === 'startup' ? shockwave : 0
            const startupFade = state === 'startup' ? Math.min(startupTimer / 20, 1) : 1
            const startupEase = startupFade * startupFade * startupFade

            const targetOpacity = currentBright + bass * 0.08 + startupShock * 0.35
            const targetSize = currentSize + bass * 0.05 + startupShock * 0.28

            if (state === 'startup') {
                ParticleMaterial.opacity = targetOpacity * startupEase
                ParticleMaterial.size = 0.01 + (targetSize - 0.01) * startupEase
            } else {
                ParticleMaterial.opacity = targetOpacity
                ParticleMaterial.size = targetSize
            }

            if (state === 'thinking') {
                ParticleMaterial.color.lerp(COL_THINK, 0.015)
                _lineColorMemory.lerp(COL_THINK, 0.008)
                LineMaterial.color.copy(_lineColorMemory)
            } else if (state === 'startup' && startupShock > 0.08) {
                _tmpColor.lerpColors(COL_BASE, COL_FLASH, Math.min(1, startupShock * 1.4))
                ParticleMaterial.color.lerp(_tmpColor, 0.2)
                _lineColorMemory.lerp(_tmpColor, 0.06)
                LineMaterial.color.copy(_lineColorMemory)
            } else {
                ParticleMaterial.color.lerp(COL_BASE, 0.015)
                _lineColorMemory.lerp(COL_BASE, 0.008)
                LineMaterial.color.copy(_lineColorMemory)
            }
            ElectronMaterial.color.set(0xffffff)
        }

        // ── Camera drift ──────────────────────────────────────────────────────────
        // In speaking state, lock camera straight on for perfect ring alignment
        // Compute target positions
        if (state === 'speaking') {
            targetCamPosX = 0
            targetCamPosY = 0
        } else {
            targetCamPosX = Math.sin(t * 0.02) * 5
            targetCamPosY = Math.cos(t * 0.03) * 3
        }

        // Smooth interpolation to target position
        const camLerpSpeed = 0.008
        camPosX += (targetCamPosX - camPosX) * camLerpSpeed
        camPosY += (targetCamPosY - camPosY) * camLerpSpeed

        GlobalCamera.position.x = camPosX
        GlobalCamera.position.y = camPosY
        GlobalCamera.position.z = 80
        GlobalCamera.lookAt(0, 0, cloudZ * 0.2)

        GlobalRenderer.render(GlobalScene, GlobalCamera)
    }

    function onResize() {
        GlobalCamera.aspect = window.innerWidth / window.innerHeight
        GlobalCamera.updateProjectionMatrix()
        GlobalRenderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', onResize)
    animate()

    return {
        setState(s: OrbState) {
            state = s
            if (s === 'startup') {
                startupTimer = 0
                currentBright = 0
                pulseSent = false
            }
            if (s !== 'speaking') externalVolume = 0
            const cb = onStateChangeRef?.current
            if (cb) cb(state)
        },
        setVolume(v: number) {
            externalVolume = v
            // Kick shockwave on sharp volume increases
            if (v > 0.4) shockwave = Math.max(shockwave, v * 0.5)
        },
        setAnalyser(a: AnalyserNode | null) {
            analyser = a
            if (a) freqData = new Uint8Array(a.frequencyBinCount)
        },
        triggerDemo() {
            // Kept for compatibility; demo mode removed.
        },
        destroy() {
            destroyed = true
            window.removeEventListener('resize', onResize)
            GlobalRenderer.dispose()
        }
    }
}
