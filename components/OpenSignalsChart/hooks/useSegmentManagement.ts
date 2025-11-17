import { useState, useEffect, useRef } from "react"
import type { LabelSegment, DraggingEdgeState, HoveredEdgeState } from "../types"

export function useSegmentManagement(
  labelSegments: LabelSegment[],
  setLabelSegments: (segments: LabelSegment[] | ((prev: LabelSegment[]) => LabelSegment[])) => void,
  data: { timestamp: number }[],
  xDomain: [number, number] | undefined,
  chartRef: React.RefObject<HTMLDivElement | null>
) {
  const [draggingEdge, setDraggingEdge] = useState<DraggingEdgeState | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdgeState | null>(null)
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null)

  // Handle mouse move for dragging segment edges
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingEdge) return

      const chartWidth = chartRef.current?.clientWidth || 800
      const currentDomain = xDomain || (data.length > 0 ? [data[0].timestamp, data[data.length - 1].timestamp] : [0, 1])
      const currentDomainWidth = currentDomain[1] - currentDomain[0]
      const timePerPixel = currentDomainWidth / chartWidth
      const deltaX = e.clientX - draggingEdge.initialX
      const timeDelta = deltaX * timePerPixel

      const newTime = draggingEdge.initialTime + timeDelta

      // Update the segment and adjacent segments to maintain continuity
      setLabelSegments((prevSegments) => {
        const newSegments = [...prevSegments]
        const segment = newSegments[draggingEdge.segmentIndex]
        
        if (draggingEdge.edge === 'start') {
          // When dragging start edge, also update the end of the previous segment
          const prevSegmentIndex = draggingEdge.segmentIndex - 1
          
          if (prevSegmentIndex >= 0) {
            const prevSegment = newSegments[prevSegmentIndex]
            // Don't let it go past the current segment's end or before previous segment's start
            const constrainedTime = Math.max(
              prevSegment.start + 0.01,
              Math.min(newTime, segment.end - 0.01)
            )
            segment.start = constrainedTime
            prevSegment.end = constrainedTime
          } else {
            // First segment - just constrain to not go past end
            segment.start = Math.min(newTime, segment.end - 0.01)
          }
        } else {
          // When dragging end edge, also update the start of the next segment
          const nextSegmentIndex = draggingEdge.segmentIndex + 1
          
          if (nextSegmentIndex < newSegments.length) {
            const nextSegment = newSegments[nextSegmentIndex]
            // Don't let it go before the current segment's start or past next segment's end
            const constrainedTime = Math.min(
              nextSegment.end - 0.01,
              Math.max(newTime, segment.start + 0.01)
            )
            segment.end = constrainedTime
            nextSegment.start = constrainedTime
          } else {
            // Last segment - just constrain to not go before start
            segment.end = Math.max(newTime, segment.start + 0.01)
          }
        }
        
        return newSegments
      })
    }

    const handleMouseUp = () => {
      setDraggingEdge(null)
      document.body.style.cursor = ''
    }

    if (draggingEdge) {
      document.body.style.cursor = 'ew-resize'
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ''
      }
    }
  }, [draggingEdge, data, xDomain, chartRef, setLabelSegments])

  // Handle keyboard events for deleting selected segment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedSegmentIndex === null) return
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setLabelSegments((prevSegments) => {
          const newSegments = prevSegments.filter((_, idx) => idx !== selectedSegmentIndex)
          return newSegments
        })
        setSelectedSegmentIndex(null)
      }
      
      // ESC to deselect
      if (e.key === 'Escape') {
        setSelectedSegmentIndex(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSegmentIndex, setLabelSegments])

  // Helper function to get time from mouse position
  const getTimeFromMouseX = (clientX: number, currentDomain: [number, number]): number | null => {
    if (!chartRef.current) return null
    
    const rect = chartRef.current.getBoundingClientRect()
    const chartWidth = rect.width
    const margin = { left: 20, right: 30 }
    const plotWidth = chartWidth - margin.left - margin.right
    
    const relativeX = clientX - rect.left - margin.left
    if (relativeX < 0 || relativeX > plotWidth) return null
    
    const domainWidth = currentDomain[1] - currentDomain[0]
    const time = currentDomain[0] + (relativeX / plotWidth) * domainWidth
    
    return time
  }

  // Helper function to find edge near mouse position
  const findEdgeNearMouse = (clientX: number, currentDomain: [number, number]): { segmentIndex: number; edge: 'start' | 'end'; time: number } | null => {
    const time = getTimeFromMouseX(clientX, currentDomain)
    if (time === null) return null
    
    // Threshold in time units for detecting edge proximity
    const domainWidth = currentDomain[1] - currentDomain[0]
    const chartWidth = chartRef.current?.clientWidth || 800
    const margin = { left: 20, right: 30 }
    const plotWidth = chartWidth - margin.left - margin.right
    const pixelThreshold = 15 // pixels - increased for easier grabbing
    const timeThreshold = (pixelThreshold / plotWidth) * domainWidth
    
    for (let idx = 0; idx < labelSegments.length; idx++) {
      const segment = labelSegments[idx]
      
      // Check if segment is visible
      if (segment.end < currentDomain[0] || segment.start > currentDomain[1]) {
        continue
      }
      
      // Check start edge
      if (Math.abs(time - segment.start) <= timeThreshold) {
        return { segmentIndex: idx, edge: 'start', time: segment.start }
      }
      
      // Check end edge
      if (Math.abs(time - segment.end) <= timeThreshold) {
        return { segmentIndex: idx, edge: 'end', time: segment.end }
      }
    }
    
    return null
  }

  // Helper function to find segment at mouse position
  const findSegmentAtMouse = (clientX: number, currentDomain: [number, number]): number | null => {
    const time = getTimeFromMouseX(clientX, currentDomain)
    if (time === null) return null
    
    for (let idx = 0; idx < labelSegments.length; idx++) {
      const segment = labelSegments[idx]
      
      // Check if time is within segment
      if (time >= segment.start && time <= segment.end) {
        return idx
      }
    }
    
    return null
  }

  return {
    draggingEdge,
    setDraggingEdge,
    hoveredEdge,
    setHoveredEdge,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
    findEdgeNearMouse,
    findSegmentAtMouse,
  }
}

