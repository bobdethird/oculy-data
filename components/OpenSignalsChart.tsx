"use client"

import { useEffect, useState, useRef } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Brush } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface DataPoint {
  timestamp: number
  A1: number
  A2: number
  A3: number
  A4: number
  A5: number
  A6: number
}

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined)
  const [yRange, setYRange] = useState<[number, number] | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; domain: [number, number] } | null>(null)

  const isEventFromBrush = (target: EventTarget | null) => {
    return target instanceof Element && !!target.closest(".recharts-brush")
  }

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/opensignals_84BA20AEBFDA_2025-11-16_17-32-19.txt")
        if (!response.ok) {
          throw new Error("Failed to load data file")
        }
        
        const text = await response.text()
        const lines = text.split("\n")
        
        // Parse header to get sampling rate
        let samplingRate = 1000 // default
        let dataStartIndex = 0
        
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
              if (deviceKey && headerData[deviceKey]["sampling rate"]) {
                samplingRate = headerData[deviceKey]["sampling rate"]
              }
            } catch (e) {
              console.warn("Could not parse header JSON, using default sampling rate")
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
        
        // Set initial domain to show first portion of data
        if (parsedData.length > 0) {
          const totalTime = parsedData[parsedData.length - 1].timestamp
          const initialWindow = Math.min(totalTime, 10) // Show first 10 seconds or total if less
          setXDomain([0, initialWindow])
        }
        
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  const channelConfig = {
    A4: chartConfig.A4,
  } satisfies ChartConfig

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

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isEventFromBrush(e.target)) {
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

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
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
      <div
        ref={chartRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: "grab" }}
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
            <ChartTooltip content={<ChartTooltipContent />} />
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
      <p className="text-xs text-muted-foreground">
        Scroll with mouse wheel or drag the brush below to navigate. Drag on the chart to pan.
      </p>
    </div>
  )
}

