import React, { useRef, useState, useEffect } from 'react'
import { orbController } from '../../orb/OrbController'

interface PanelConnectionOptions {
    numLines?: number
    color?: string
    thickness?: number
    [key: string]: any
}

interface GenericPanelProps {
    panelId: string
    title?: string
    children: React.ReactNode
    width?: number | string
    height?: number | string
    visible: boolean
    onClose: () => void
    onShow: () => void
    anchorIndex: number // index du point d'ancrage sur l'orbe
    style?: React.CSSProperties
    connectionOptions?: PanelConnectionOptions
    hideButtonText?: string
}

// Utilitaire pour persister la position par panelId
function getPanelPosition(panelId: string) {
    const raw = localStorage.getItem(`panel-pos-${panelId}`)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}
function setPanelPosition(panelId: string, pos: { x: number; y: number }) {
    localStorage.setItem(`panel-pos-${panelId}`, JSON.stringify(pos))
}

const GenericPanel: React.FC<GenericPanelProps> = ({
    panelId,
    title,
    children,
    width = 400,
    height = 300,
    visible,
    onClose,
    onShow,
    anchorIndex,
    style = {},
    connectionOptions = { numLines: 8 },
    hideButtonText = '▢'
}) => {
    // Clamp la position pour rester dans la fenêtre
    function clampPosition(x: number, y: number, w: number, h: number) {
        const maxX = Math.max(0, window.innerWidth - w)
        const maxY = Math.max(0, window.innerHeight - h)
        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY)
        }
    }

    // Taille réelle du panel (pixels)
    const [realSize, setRealSize] = useState<{ w: number; h: number }>({
        w: typeof width === 'number' ? width : 400,
        h: typeof height === 'number' ? height : 300
    })

    // Position du panel (persistée, clampée)
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const pos = getPanelPosition(panelId) || { x: 100, y: 100 }
        return clampPosition(
            pos.x,
            pos.y,
            typeof width === 'number' ? width : 400,
            typeof height === 'number' ? height : 300
        )
    })
    const [dragging, setDragging] = useState(false)
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const panelRef = useRef<HTMLDivElement>(null)

    // Persistance de la position
    useEffect(() => {
        setPanelPosition(panelId, position)
    }, [position, panelId])

    // Met à jour la taille réelle après chaque render
    useEffect(() => {
        const updateSize = () => {
            if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect()
                setRealSize((s) => {
                    if (s.w !== rect.width || s.h !== rect.height) {
                        return { w: rect.width, h: rect.height }
                    }
                    return s
                })
            }
        }
        updateSize()
    })

    // Drag & drop — uniquement depuis la barre de titre
    const onHandleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return
        e.preventDefault()
        setDragging(true)
        const rect = panelRef.current?.getBoundingClientRect()
        setOffset({
            x: e.clientX - (rect?.left ?? 0),
            y: e.clientY - (rect?.top ?? 0)
        })
        document.body.style.userSelect = 'none'
    }
    useEffect(() => {
        if (!dragging) return
        const onMove = (e: MouseEvent) => {
            const next = clampPosition(
                e.clientX - offset.x,
                e.clientY - offset.y,
                realSize.w,
                realSize.h
            )
            setPosition(next)
        }
        const onUp = () => {
            setDragging(false)
            document.body.style.userSelect = ''
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [dragging, offset, realSize.w, realSize.h])

    // Position du point d'ancrage sur l'orbe (mise à jour à chaque render)
    const [anchorPos, setAnchorPos] = useState(() =>
        orbController.getParticleScreenPosition(anchorIndex)
    )
    useEffect(() => {
        const update = () => setAnchorPos(orbController.getParticleScreenPosition(anchorIndex))
        update()
        window.addEventListener('resize', update)
        const id = setInterval(update, 50) // suit l'animation orb
        return () => {
            window.removeEventListener('resize', update)
            clearInterval(id)
        }
    }, [anchorIndex])

    // Clamp la position lors d'un resize de la fenêtre ou d'un changement de taille réelle
    useEffect(() => {
        const handleResize = () => {
            setTimeout(() => {
                setRealSize((s) => {
                    if (panelRef.current) {
                        const rect = panelRef.current.getBoundingClientRect()
                        return { w: rect.width, h: rect.height }
                    }
                    return s
                })
            }, 0)
        }
        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    // Reclamp automatique désactivé pour éviter les warnings React.
    // Le reclamp se fait à l'init et lors du drag & drop.

    // Génère N points sur le pourtour du panel (bord arrondi ou non)
    const w = realSize.w
    const h = realSize.h
    let r = 16
    if (typeof style.borderRadius === 'number') {
        r = style.borderRadius
    } else if (typeof style.borderRadius === 'string' && style.borderRadius.endsWith('px')) {
        r = parseInt(style.borderRadius)
    }
    const styleLeft = typeof style.left === 'number' ? style.left : 0
    const styleTop = typeof style.top === 'number' ? style.top : 0

    // Génère les points uniquement sur les coins arrondis (numLines par coin arrondi, 1 par coin sinon)
    function getPanelPerimeterPoints(num: number) {
        const baseX = position.x + styleLeft
        const baseY = position.y + styleTop
        const points: { x: number; y: number }[] = []
        if (r > 0) {
            // 4 coins arrondis, num lignes par coin
            const corners = [
                { cx: baseX + w - r, cy: baseY + r, theta0: -Math.PI / 2 }, // top-right
                { cx: baseX + w - r, cy: baseY + h - r, theta0: 0 }, // bottom-right
                { cx: baseX + r, cy: baseY + h - r, theta0: Math.PI / 2 }, // bottom-left
                { cx: baseX + r, cy: baseY + r, theta0: Math.PI } // top-left
            ]
            for (const { cx, cy, theta0 } of corners) {
                for (let i = 0; i < num; i++) {
                    const theta = theta0 + (i / (num - 1)) * (Math.PI / 2)
                    points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) })
                }
            }
        } else {
            // Pas d'arrondi, 1 point par coin
            points.push({ x: baseX, y: baseY }) // top-left
            points.push({ x: baseX + w, y: baseY }) // top-right
            points.push({ x: baseX + w, y: baseY + h }) // bottom-right
            points.push({ x: baseX, y: baseY + h }) // bottom-left
        }
        return points
    }

    // Callback pour orb : nombre de points = numLines par coin arrondi, ou 1 par coin sinon
    const getPanelCorners = () => {
        const n =
            connectionOptions &&
            typeof connectionOptions.numLines === 'number' &&
            connectionOptions.numLines > 0
                ? connectionOptions.numLines
                : 1
        return getPanelPerimeterPoints(n)
    }

    // Enregistrement/désenregistrement auprès de l'orbe pour les lignes
    useEffect(() => {
        const opts = { ...connectionOptions, anchorIndex }
        orbController.registerPanelConnection(panelId, getPanelCorners, opts)
        return () => {
            orbController.unregisterPanelConnection(panelId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        panelId,
        position.x,
        position.y,
        realSize.w,
        realSize.h,
        anchorIndex,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        JSON.stringify(connectionOptions),
        visible // pour trigger lors du retour à visible
    ])

    // Affichage du bouton flottant pour réafficher le panel
    if (!visible) {
        // On désenregistre aussi si le panel est masqué
        orbController.unregisterPanelConnection(panelId)
        return (
            <button
                style={{
                    position: 'absolute',
                    left: anchorPos.x - 20,
                    top: anchorPos.y - 20,
                    zIndex: 1000,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                }}
                onClick={onShow}
                title={title || 'Afficher le panel'}
            >
                {hideButtonText}
            </button>
        )
    }

    return (
        <div
            ref={panelRef}
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                margin: 0,
                padding: 0,
                width,
                height,
                background: 'rgba(0,0,0,0.05)',
                border: '1.5px solid #4ca8e8',
                borderRadius: 16,
                boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)',
                zIndex: 1001,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                ...style
            }}
        >
            {/* Barre de titre — zone de drag */}
            <div
                onMouseDown={onHandleMouseDown}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 40,
                    cursor: dragging ? 'grabbing' : 'grab',
                    zIndex: 1001,
                    borderRadius: '16px 16px 0 0'
                }}
            />
            {/* Bouton croix bleu en haut à droite */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: 'rgba(76,168,232,0.10)',
                    border: 'none',
                    color: '#4ca8e8',
                    fontSize: 18,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1002,
                    boxShadow: '0 1px 4px 0 rgba(76,168,232,0.08)'
                }}
                title="Fermer"
                tabIndex={0}
                aria-label="Fermer"
            >
                <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>×</span>
            </button>
            <>{children}</>
        </div>
    )
}

export default GenericPanel
