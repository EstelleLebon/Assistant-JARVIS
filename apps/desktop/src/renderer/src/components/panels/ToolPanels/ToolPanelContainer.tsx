import type { ComponentType } from 'react'
import GenericPanel from '../GenericPanel'
import useToolPanelStore from '../../../store/toolPanelStore'
import WeatherPanelContent from './WeatherPanelContent'
import SearchResultsPanelContent from './SearchResultsPanelContent'
import CalendarPanelContent from './CalendarPanelContent'
import TasksPanelContent from './TasksPanelContent'
import ScreenshotPanelContent from './ScreenshotPanelContent'
import RoutinesPanelContent from './RoutinesPanelContent'
import MemoryPanelContent from './MemoryPanelContent'

const REGISTRY: Record<string, ComponentType<{ data: unknown }>> = {
    weather: WeatherPanelContent,
    search_results: SearchResultsPanelContent,
    calendar: CalendarPanelContent,
    tasks: TasksPanelContent,
    screenshot: ScreenshotPanelContent,
    routines: RoutinesPanelContent,
    memory_results: MemoryPanelContent
}

const PANEL_TITLES: Record<string, string> = {
    weather: '🌤 Météo',
    search_results: '🔍 Recherche',
    calendar: '📅 Agenda',
    tasks: '✅ Tâches',
    screenshot: '🖼 Capture',
    routines: '🔄 Routines',
    memory_results: '🧠 Mémoire'
}

const PANEL_SIZES: Record<string, { width: number; height: number | string }> = {
    weather: { width: 280, height: 260 },
    search_results: { width: 380, height: '70%' },
    calendar: { width: 320, height: 'auto' },
    tasks: { width: 300, height: 'auto' },
    screenshot: { width: 360, height: 'auto' },
    routines: { width: 300, height: 'auto' },
    memory_results: { width: 340, height: '60%' }
}

// Anchor indices well apart from ConversationPanel (4242)
const ANCHOR_BASE = 5000

export default function ToolPanelContainer() {
    const { toolPanels, closePanelById, showPanelById, destroyPanelById } = useToolPanelStore()

    return (
        <>
            {toolPanels.map((panel, index) => {
                const Content = REGISTRY[panel.type]
                if (!Content) return null

                const title = PANEL_TITLES[panel.type] ?? panel.toolName
                const sizes = PANEL_SIZES[panel.type] ?? { width: 320, height: 'auto' }

                return (
                    <GenericPanel
                        key={panel.id}
                        panelId={`tool-panel-${panel.id}`}
                        title={title}
                        visible={panel.visible}
                        onClose={() => closePanelById(panel.id)}
                        onDestroy={() => destroyPanelById(panel.id)}
                        onShow={() => showPanelById(panel.id)}
                        anchorIndex={ANCHOR_BASE + index}
                        width={sizes.width}
                        height={sizes.height}
                        connectionOptions={{
                            color: 'rgba(180,120,255,0.25)',
                            thickness: 0.08,
                            numLines: 10
                        }}
                        hideButtonText={title.slice(0, 2)}
                    >
                        <Content data={panel.data} />
                    </GenericPanel>
                )
            })}
        </>
    )
}
