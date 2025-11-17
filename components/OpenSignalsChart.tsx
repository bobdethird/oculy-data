"use client"

import { useState, useRef, useEffect, type ComponentProps } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, ReferenceArea, ReferenceLine } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface DataPoint {
  timestamp: number
  A1: number
  A2: number
  A3: number
  A4: number
  A5: number
  A6: number
}

interface LabelSegment {
  start: number
  end: number
  label: string
}

const LABEL_COLORS: Record<string, string> = {
  stare: "hsl(221 83% 65%)",
  left: "hsl(0 84% 60%)",
  up: "hsl(142 71% 45%)",
  down: "hsl(25 95% 53%)",
  right: "hsl(291 64% 42%)",
  unknown: "hsl(220 13% 69%)",
  blink: "hsl(192 85% 44%)",
}

const DEFAULT_LABEL_COLOR = "hsl(217 22% 67%)"
const SEGMENT_MATCH_EPSILON = 0.002

const chartConfig = {
  A1: {
    label: "A1",
    color: "var(--chart-1)",
  },
  A2: {
    label: "A2",
    color: "var(--chart-2)",
  },
  A3: {
    label: "A3",
    color: "var(--chart-3)",
  },
  A4: {
    label: "A4",
    color: "var(--chart-4)",
  },
  A5: {
    label: "A5",
    color: "var(--chart-5)",
  },
  A6: {
    label: "A6",
    color: "var(--chart-6)",
  },
} satisfies ChartConfig

export function OpenSignalsChart() {
  const [data, setData] = useState<DataPoint[]>([])
  const [labelSegments, setLabelSegments] = useState<LabelSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined)
  const [yRange, setYRange] = useState<[number, number] | null>(null)
  const [signalFile, setSignalFile] = useState<File | null>(null)
  const [keypressFile, setKeypressFile] = useState<File | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; domain: [number, number] } | null>(null)
  const signalInputRef = useRef<HTMLInputElement>(null)
  const keypressInputRef = useRef<HTMLInputElement>(null)
  
  // State for dragging segment edges
  const [draggingEdge, setDraggingEdge] = useState<{
    segmentIndex: number
    edge: 'start' | 'end'
    initialX: number
    initialTime: number
  } | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<{
    segmentIndex: number
    edge: 'start' | 'end'
  } | null>(null)

  const isEventFromBrush = (target: EventTarget | null) => {
    return target instanceof Element && !!target.closest(".recharts-brush")
  }

  async function processFiles(signalFile: File, keypressFile: File) {
    setLoading(true)
    setError(null)
    
    try {
      const [signalText, keypressText] = await Promise.all([
        signalFile.text(),
        keypressFile.text(),
      ])

      const lines = signalText.split("\n")

      // Parse header to get sampling rate & absolute start time
      let samplingRate = 1000 // default
      let dataStartIndex = 0
      let signalStartTimestampMs: number | null = null

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("# EndOfHeader")) {
          dataStartIndex = i + 1
          break
        }
        if (lines[i].startsWith("#") && lines[i].includes("sampling rate")) {
          try {
            const jsonStr = lines[i].substring(2) // Remove "# "
            const headerData = JSON.parse(jsonStr)
            const deviceKey = Object.keys(headerData)[0]
            if (deviceKey) {
              const deviceInfo = headerData[deviceKey]
              if (deviceInfo?.["sampling rate"]) {
                samplingRate = deviceInfo["sampling rate"]
              }
              if (deviceInfo?.date && deviceInfo?.time) {
                const isoString = `${deviceInfo.date}T${deviceInfo.time}`
                const parsedDate = new Date(isoString)
                if (!isNaN(parsedDate.getTime())) {
                  signalStartTimestampMs = parsedDate.getTime()
                }
              }
            }
          } catch (e) {
            console.warn("Could not parse header JSON, using default sampling rate", e)
          }
        }
      }
      
      // Parse data rows
      const parsedData: DataPoint[] = []
      let minA4 = Number.POSITIVE_INFINITY
      let maxA4 = Number.NEGATIVE_INFINITY
      const sampleInterval = 1 / samplingRate // seconds per sample
      
      // Sample data to improve performance (take every Nth point)
      // Adjust this value to balance performance vs detail
      const sampleStep = Math.max(1, Math.floor((lines.length - dataStartIndex) / 10000))
      
      for (let i = dataStartIndex; i < lines.length; i += sampleStep) {
        const line = lines[i].trim()
        if (!line) continue
        
        const values = line.split(/\s+/)
        if (values.length < 11) continue
        
        // Columns: nSeq, I1, I2, O1, O2, A1, A2, A3, A4, A5, A6
        // A1-A6 are at indices 5-10
        const timestamp = (i - dataStartIndex) * sampleInterval
        
        const A1 = parseFloat(values[5]) || 0
        const A2 = parseFloat(values[6]) || 0
        const A3 = parseFloat(values[7]) || 0
        const A4 = parseFloat(values[8]) || 0
        const A5 = parseFloat(values[9]) || 0
        const A6 = parseFloat(values[10]) || 0

        minA4 = Math.min(minA4, A4)
        maxA4 = Math.max(maxA4, A4)

        parsedData.push({
          timestamp,
          A1,
          A2,
          A3,
          A4,
          A5,
          A6,
        })
      }
      
      setData(parsedData)

      if (parsedData.length > 0) {
        setYRange([minA4, maxA4])
      } else {
        setYRange(null)
      }
      
      const timeMin = parsedData.length > 0 ? parsedData[0].timestamp : 0
      const timeMax = parsedData.length > 0 ? parsedData[parsedData.length - 1].timestamp : 0

      // Align keypress labels with the OpenSignals timestamps
      const segments = parseKeypressLabelSegments(
        keypressText,
        signalStartTimestampMs,
        [timeMin, timeMax]
      )
      setLabelSegments(segments)

      // Set initial domain to show first portion of data
      if (parsedData.length > 0) {
        const totalDuration = Math.max(timeMax - timeMin, 0)
        const windowSize = Math.min(totalDuration, 10) // Show first 10 seconds or total if less
        setXDomain([timeMin, timeMin + windowSize])
      }
      
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
    }
  }

  const handleSignalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSignalFile(file)
      if (keypressFile) {
        processFiles(file, keypressFile)
      }
    }
  }

  const handleKeypressFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setKeypressFile(file)
      if (signalFile) {
        processFiles(signalFile, file)
      }
    }
  }

  const handleLoadFiles = () => {
    if (signalFile && keypressFile) {
      processFiles(signalFile, keypressFile)
    } else {
      setError("Please select both files")
    }
  }

  // Handle mouse move for dragging - must be before conditional returns
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

  // Handle mouse move for dragging segment edges
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingEdge) return

      const chartWidth = chartRef.current?.clientWidth || 800
      const currentDomainWidth = xDomain ? xDomain[1] - xDomain[0] : (data.length > 0 ? data[data.length - 1].timestamp - data[0].timestamp : 1)
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
  }, [draggingEdge, data, xDomain])

  if (data.length === 0 && !loading) {
    return (
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">OpenSignals Data Visualization</h2>
          <p className="text-sm text-muted-foreground">
            Upload your OpenSignals data file and keypress labels file to visualize the data.
          </p>
        </div>
        <div className="space-y-4 rounded-lg border p-6">
          <div className="space-y-2">
            <label htmlFor="signal-file" className="text-sm font-medium">
              OpenSignals Data File
            </label>
            <Input
              ref={signalInputRef}
              id="signal-file"
              type="file"
              accept=".txt"
              onChange={handleSignalFileChange}
            />
            {signalFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {signalFile.name}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="keypress-file" className="text-sm font-medium">
              Keypress Labels File
            </label>
            <Input
              ref={keypressInputRef}
              id="keypress-file"
              type="file"
              accept=".txt"
              onChange={handleKeypressFileChange}
            />
            {keypressFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {keypressFile.name}
              </p>
            )}
          </div>
          <Button
            onClick={handleLoadFiles}
            disabled={!signalFile || !keypressFile || loading}
            className="w-full"
          >
            {loading ? "Loading..." : "Load Data"}
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    )
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  const channelConfig = {
    A4: chartConfig.A4,
  } satisfies ChartConfig

  const uniqueLabelNames = Array.from(new Set(labelSegments.map((segment) => segment.label)))

  // Get min and max timestamps
  const timeMin = data.length > 0 ? data[0].timestamp : 0
  const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0
  const currentDomain = xDomain || [timeMin, timeMax]
  const domainWidth = currentDomain[1] - currentDomain[0]

  const yPadding =
    yRange !== null ? Math.max(1, (yRange[1] - yRange[0]) * 0.05) : null
  const yDomain =
    yRange !== null && yPadding !== null
      ? ([yRange[0] - yPadding, yRange[1] + yPadding] as [number, number])
      : null
  const yTicks =
    yDomain !== null
      ? [
          Number(yDomain[0].toFixed(2)),
          Number(((yDomain[0] + yDomain[1]) / 2).toFixed(2)),
          Number(yDomain[1].toFixed(2)),
        ]
      : undefined

  // Handle brush change (scrolling via brush)
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

  // Handle mouse wheel for scrolling
  const handleWheel = (e: React.WheelEvent) => {
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
    const timePerPixel = domainWidth / chartWidth
    const timeDelta = e.deltaX * timePerPixel

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

  // Helper function to get time from mouse position
  const getTimeFromMouseX = (clientX: number): number | null => {
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
  const findEdgeNearMouse = (clientX: number): { segmentIndex: number; edge: 'start' | 'end'; time: number } | null => {
    const time = getTimeFromMouseX(clientX)
    if (time === null) return null
    
    // Threshold in time units for detecting edge proximity
    const domainWidth = currentDomain[1] - currentDomain[0]
    const chartWidth = chartRef.current?.clientWidth || 800
    const pixelThreshold = 8 // pixels
    const timeThreshold = (pixelThreshold / chartWidth) * domainWidth
    
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

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isEventFromBrush(e.target)) {
      return
    }
    
    // Check if clicking near a segment edge
    const edge = findEdgeNearMouse(e.clientX)
    
    if (edge) {
      e.preventDefault()
      e.stopPropagation()
      setDraggingEdge({
        segmentIndex: edge.segmentIndex,
        edge: edge.edge,
        initialX: e.clientX,
        initialTime: edge.time
      })
      return
    }
    
    isDragging.current = true
    dragStart.current = {
      x: e.clientX,
      domain: currentDomain,
    }
    if (chartRef.current) {
      chartRef.current.style.cursor = "grabbing"
    }
  }

  // Handle mouse move over segment edges for cursor change
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingEdge || isDragging.current) return
    
    const edge = findEdgeNearMouse(e.clientX)
    
    if (edge) {
      setHoveredEdge({
        segmentIndex: edge.segmentIndex,
        edge: edge.edge
      })
    } else if (hoveredEdge) {
      setHoveredEdge(null)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">OpenSignals Data Visualization - A4</h2>
            <p className="text-sm text-muted-foreground">
              Displaying {data.length.toLocaleString()} data points
              {xDomain && (
                <span className="ml-2">
                  (Showing {currentDomain[0].toFixed(2)}s - {currentDomain[1].toFixed(2)}s)
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setData([])
              setLabelSegments([])
              setSignalFile(null)
              setKeypressFile(null)
              setXDomain(undefined)
              setYRange(null)
              setError(null)
              if (signalInputRef.current) signalInputRef.current.value = ""
              if (keypressInputRef.current) keypressInputRef.current.value = ""
            }}
          >
            Reset
          </Button>
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div
        ref={chartRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ cursor: hoveredEdge ? "ew-resize" : "grab" }}
        className="select-none"
      >
        <ChartContainer config={channelConfig} className="h-[600px] w-full">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="linear"
              domain={xDomain || ["dataMin", "dataMax"]}
              label={{ value: "Time (seconds)", position: "insideBottom", offset: -50 }}
              tickFormatter={(value) => value.toFixed(2)}
            />
            <YAxis
              label={{ value: "Value", angle: -90, position: "insideLeft" }}
              {...(yDomain ? { domain: yDomain } : {})}
              {...(yTicks ? { ticks: yTicks } : {})}
            />
            {labelSegments.map((segment, idx) => {
              // Only render if segment overlaps with current domain
              if (segment.end < currentDomain[0] || segment.start > currentDomain[1]) {
                return null
              }
              
              // Clamp segment boundaries to visible domain so background is always visible
              const visibleStart = Math.max(segment.start, currentDomain[0])
              const visibleEnd = Math.min(segment.end, currentDomain[1])
              
              const color = getLabelColor(segment.label)
              return (
                <ReferenceArea
                  key={`${segment.label}-${idx}-${segment.start.toFixed(3)}`}
                  x1={visibleStart}
                  x2={visibleEnd}
                  stroke="none"
                  fill={color}
                  fillOpacity={0.12}
                  {...(yDomain ? { y1: yDomain[0], y2: yDomain[1] } : {})}
                />
              )
            })}
            {labelSegments.map((segment, idx) => {
              // Only show edges for segments visible in current domain
              if (segment.end < currentDomain[0] || segment.start > currentDomain[1]) {
                return null
              }
              
              const color = getLabelColor(segment.label)
              const isHoveringStart = hoveredEdge?.segmentIndex === idx && hoveredEdge?.edge === 'start'
              const isHoveringEnd = hoveredEdge?.segmentIndex === idx && hoveredEdge?.edge === 'end'
              const isDraggingStart = draggingEdge?.segmentIndex === idx && draggingEdge?.edge === 'start'
              const isDraggingEnd = draggingEdge?.segmentIndex === idx && draggingEdge?.edge === 'end'
              
              return (
                <g key={`edges-${segment.label}-${idx}-${segment.start.toFixed(3)}`}>
                  <ReferenceLine
                    x={segment.start}
                    stroke={color}
                    strokeWidth={isHoveringStart || isDraggingStart ? 4 : 2}
                    strokeOpacity={isHoveringStart || isDraggingStart ? 1 : 0.6}
                  />
                  <ReferenceLine
                    x={segment.end}
                    stroke={color}
                    strokeWidth={isHoveringEnd || isDraggingEnd ? 4 : 2}
                    strokeOpacity={isHoveringEnd || isDraggingEnd ? 1 : 0.6}
                  />
                </g>
              )
            })}
            <ChartTooltip
              content={
                <HighlightAwareTooltipContent labelSegments={labelSegments} />
              }
            />
            <Line
              type="monotone"
              dataKey="A4"
              stroke="var(--color-A4)"
              strokeWidth={2}
              dot={false}
              name="A4"
              isAnimationActive={false}
            />
            <Brush
              dataKey="timestamp"
              height={30}
              stroke="var(--color-A4)"
              fill="var(--color-muted)"
              fillOpacity={0.4}
              onChange={handleBrushChange}
              startIndex={(() => {
                const idx = data.findIndex((d) => d.timestamp >= currentDomain[0])
                return idx >= 0 ? idx : 0
              })()}
              endIndex={(() => {
                const idx = data.findIndex((d) => d.timestamp >= currentDomain[1])
                return idx >= 0 ? idx : data.length - 1
              })()}
              tickFormatter={(value) => value.toFixed(1)}
            />
          </LineChart>
        </ChartContainer>
      </div>
      {labelSegments.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Keypress labels</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {uniqueLabelNames.map((label) => (
              <span key={label} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: getLabelColor(label) }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Scroll with mouse wheel or drag the brush below to navigate. Drag on the chart to pan. Drag the colored lines at segment edges to adjust label boundaries (adjacent segments will move together to maintain continuity).
      </p>
    </div>
  )
}

type TooltipContentProps = ComponentProps<typeof ChartTooltipContent>

function HighlightAwareTooltipContent({
  labelSegments,
  ...tooltipProps
}: TooltipContentProps & { labelSegments: LabelSegment[] }) {
  if (!tooltipProps.active || !tooltipProps.payload?.length) {
    return null
  }

  const payload = tooltipProps.payload!
  const hoveredTimestamp = extractTimestampFromPayload(payload)
  const activeSegment =
    hoveredTimestamp === null
      ? null
      : findSegmentAtTimestamp(labelSegments, hoveredTimestamp)

  if (!activeSegment) {
    return <ChartTooltipContent {...tooltipProps} />
  }

  return (
    <div className="flex flex-col gap-1.5">
      <ChartTooltipContent {...tooltipProps} />
      <div className="border-border/60 bg-background/95 text-[0.65rem] leading-tight rounded-lg border px-2 py-1 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: getLabelColor(activeSegment.label) }}
            />
            <span className="font-medium text-foreground">{activeSegment.label}</span>
          </div>
          <span className="font-mono text-muted-foreground tabular-nums">
            {formatSegmentRange(activeSegment)}
          </span>
        </div>
      </div>
    </div>
  )
}

function extractTimestampFromPayload(
  payload: NonNullable<TooltipContentProps["payload"]>
) {
  const rawPoint = payload?.[0]?.payload as { timestamp?: number } | undefined
  return typeof rawPoint?.timestamp === "number" ? rawPoint.timestamp : null
}

function findSegmentAtTimestamp(
  segments: LabelSegment[],
  timestamp: number
) {
  return segments.find(
    (segment) =>
      timestamp >= segment.start - SEGMENT_MATCH_EPSILON &&
      timestamp <= segment.end + SEGMENT_MATCH_EPSILON
  )
}

function formatSegmentRange(segment: LabelSegment) {
  return `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`
}

function getLabelColor(label: string) {
  return LABEL_COLORS[label] ?? DEFAULT_LABEL_COLOR
}

function parseKeypressLabelSegments(
  fileContents: string,
  signalStartTimestampMs: number | null,
  signalTimeRange: [number, number]
): LabelSegment[] {
  if (!fileContents) {
    return []
  }
  if (signalStartTimestampMs === null) {
    console.warn("Missing OpenSignals start timestamp; cannot align keypress labels.")
    return []
  }

  const lines = fileContents.split("\n")
  let dataStartIndex = 0
  let recordingStartTimestampMs: number | null = null
  let samplingRate = 1000

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue

    if (rawLine.startsWith("# Recording started:")) {
      const datePart = rawLine.replace("# Recording started:", "").trim()
      const parsedDate = new Date(datePart.replace(" ", "T"))
      if (!isNaN(parsedDate.getTime())) {
        recordingStartTimestampMs = parsedDate.getTime()
      }
    }

    if (rawLine.startsWith("# Sampling rate")) {
      const match = rawLine.match(/(\d+)\s*Hz/i)
      if (match) {
        const parsedRate = Number(match[1])
        if (!Number.isNaN(parsedRate) && parsedRate > 0) {
          samplingRate = parsedRate
        }
      }
    }

    if (rawLine.startsWith("# EndOfHeader")) {
      dataStartIndex = i + 1
      break
    }
  }

  const sampleIntervalSec = samplingRate > 0 ? 1 / samplingRate : 0.001
  const rawSegments: LabelSegment[] = []
  let currentSegment: LabelSegment | null = null

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith("#")) continue

    const parts = line.split(/\s+/)
    if (parts.length < 4) continue

    const timestampMs = Number(parts[1])
    const elapsedMs = Number(parts[2])
    const label = parts[3]
    if (!label) continue

    let absoluteTimestampMs = Number.isFinite(timestampMs) ? timestampMs : null

    if (absoluteTimestampMs === null && recordingStartTimestampMs !== null && Number.isFinite(elapsedMs)) {
      absoluteTimestampMs = recordingStartTimestampMs + elapsedMs
    }

    if (absoluteTimestampMs === null) {
      continue
    }

    const relativeSeconds = (absoluteTimestampMs - signalStartTimestampMs) / 1000

    if (!Number.isFinite(relativeSeconds)) {
      continue
    }

    if (!currentSegment) {
      currentSegment = {
        start: relativeSeconds,
        end: relativeSeconds,
        label,
      }
      continue
    }

    if (currentSegment.label === label) {
      currentSegment.end = relativeSeconds
    } else {
      if (currentSegment.end < currentSegment.start) {
        currentSegment.end = currentSegment.start
      }
      rawSegments.push(currentSegment)
      currentSegment = {
        start: relativeSeconds,
        end: relativeSeconds,
        label,
      }
    }
  }

  if (currentSegment) {
    if (currentSegment.end < currentSegment.start) {
      currentSegment.end = currentSegment.start
    }
    rawSegments.push(currentSegment)
  }

  const [rangeStart, rangeEnd] = signalTimeRange
  if (rangeEnd <= rangeStart) {
    return []
  }

  return rawSegments
    .map((segment) => {
      const minEnd = segment.start + sampleIntervalSec
      const expandedEnd = Math.max(segment.end, minEnd)
      const clampedStart = Math.max(rangeStart, segment.start)
      const clampedEnd = Math.min(rangeEnd, expandedEnd)
      return {
        label: segment.label,
        start: clampedStart,
        end: clampedEnd,
      }
    })
    .filter((segment) => segment.end > segment.start)
}

