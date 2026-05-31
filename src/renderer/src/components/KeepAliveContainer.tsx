import React, { useState } from 'react'

interface KeepAliveContainerProps {
  activeTab: string
  children: Record<string, React.ReactNode>
}

export const KeepAliveContainer: React.FC<KeepAliveContainerProps> = ({ activeTab, children }) => {
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]))
  const visibleTabs = new Set(visitedTabs)

  if (!visibleTabs.has(activeTab)) {
    visibleTabs.add(activeTab)
    setVisitedTabs(visibleTabs)
  }

  return (
    <div className="w-full h-full relative">
      {Object.entries(children).map(([key, child]) => {
        if (!visibleTabs.has(key)) return null
        const isActive = activeTab === key
        return (
          <div
            key={key}
            className={`w-full h-full ${isActive ? 'block animate-fade-in' : 'hidden'}`}
            style={{ contentVisibility: isActive ? 'auto' : 'hidden' }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
