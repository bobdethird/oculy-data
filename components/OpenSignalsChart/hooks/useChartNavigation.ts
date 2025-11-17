import { useState, useRef, useEffect } from "react"
import type { DataPoint } from "../types"
import { isEventFromBrush } from "../utils"

export function useChartNavigation(data: DataPoint[]) {
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; domain: [number, number] } | null>(null)

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return
      
      const deltaX = dragStart.current.x - e.clientX
      const chartWidth = chartRef.current?.clientWidth || 800
      const domainWidthAtStart = dragStart.current.domain[1] - dragStart.current.domain[0]
      const timePerPixel = domainWidthAtStart / chartWidth
      const timeDelta = deltaX * timePerPixel
      
      let newStart = dragStart.current.domain[0] + timeDelta
      let newEnd = dragStart.current.domain[1] + timeDelta
      
      // Get current bounds
      const min = data.length > 0 ? data[0].timestamp : 0
      const max = data.length > 0 ? data[data.length - 1].timestamp : 0
      
      // Keep within bounds
      if (newStart < min) {
        newStart = min
        newEnd = newStart + domainWidthAtStart
      }
      if (newEnd > max) {
        newEnd = max
        newStart = newEnd - domainWidthAtStart
      }
      
      setXDomain([newStart, newEnd])
    }

    const handleMouseUp = () => {
      isDragging.current = false
      dragStart.current = null
      if (chartRef.current) {
        chartRef.current.style.cursor = "grab"
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [data])

  const handleMouseDown = (e: React.MouseEvent, currentDomain: [number, number]) => {
    if (e.button !== 0 || isEventFromBrush(e.target)) {
      return false
    }
    
    isDragging.current = true
    dragStart.current = {
      x: e.clientX,
      domain: currentDomain,
    }
    if (chartRef.current) {
      chartRef.current.style.cursor = "grabbing"
    }
    return true
  }

  const handleWheel = (e: React.WheelEvent, currentDomain: [number, number]) => {
    if (isEventFromBrush(e.target)) {
      return
    }

    const horizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY)
    if (!horizontalScroll) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    
    const chartWidth = chartRef.current?.clientWidth || 800
    const domainWidth = currentDomain[1] - currentDomain[0]
    const timePerPixel = domainWidth / chartWidth
    const timeDelta = e.deltaX * timePerPixel

    const timeMin = data.length > 0 ? data[0].timestamp : 0
    const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0

    let newStart = currentDomain[0] + timeDelta
    let newEnd = currentDomain[1] + timeDelta
    
    // Keep within bounds
    if (newStart < timeMin) {
      newStart = timeMin
      newEnd = newStart + domainWidth
    }
    if (newEnd > timeMax) {
      newEnd = timeMax
      newStart = newEnd - domainWidth
    }
    
    setXDomain([newStart, newEnd])
  }

  const handleBrushChange = (domain: { startIndex?: number; endIndex?: number } | null) => {
    if (domain && domain.startIndex !== undefined && domain.endIndex !== undefined) {
      const startIdx = Math.max(0, Math.min(domain.startIndex, data.length - 1))
      const endIdx = Math.max(startIdx, Math.min(domain.endIndex, data.length - 1))
      
      if (data[startIdx] && data[endIdx]) {
        const startTime = data[startIdx].timestamp
        const endTime = data[endIdx].timestamp
        setXDomain([startTime, endTime])
      }
    }
  }

  return {
    xDomain,
    setXDomain,
    chartRef,
    isDragging,
    handleMouseDown,
    handleWheel,
    handleBrushChange,
  }
}

