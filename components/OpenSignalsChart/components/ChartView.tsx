"use client"

import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, ReferenceArea, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import type { DataPoint, LabelSegment, DraggingEdgeState, HoveredEdgeState } from "../types"
import { getLabelColor } from "../utils"
import { HighlightAwareTooltipContent } from "./HighlightAwareTooltip"

interface ChartViewProps {
  data: DataPoint[]
  labelSegments: LabelSegment[]
  xDomain: [number, number] | undefined
  yRange: [number, number] | null
  chartRef: React.RefObject<HTMLDivElement | null>
  showTooltips: boolean
  selectedSegmentIndex: number | null
  draggingEdge: DraggingEdgeState | null
  hoveredEdge: HoveredEdgeState | null
  hoveredQuickAdd: number | null
  cropStart: string
  cropEnd: string
  showCropPreview: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onWheel: (e: React.WheelEvent) => void
  onBrushChange: (domain: { startIndex?: number; endIndex?: number } | null) => void
  onQuickAddSegment: (startTime: number) => void
  setHoveredQuickAdd: (idx: number | null) => void
}

const channelConfig = {
  A4: {
    label: "A4",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function ChartView({
  data,
  labelSegments,
  xDomain,
  yRange,
  chartRef,
  showTooltips,
  selectedSegmentIndex,
  draggingEdge,
  hoveredEdge,
  hoveredQuickAdd,
  cropStart,
  cropEnd,
  showCropPreview,
  onMouseDown,
  onMouseMove,
  onWheel,
  onBrushChange,
  onQuickAddSegment,
  setHoveredQuickAdd,
}: ChartViewProps) {
  const timeMin = data.length > 0 ? data[0].timestamp : 0
  const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0
  const currentDomain = xDomain || [timeMin, timeMax]

  const yPadding = yRange !== null ? Math.max(1, (yRange[1] - yRange[0]) * 0.05) : null
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

  return (
    <div
      ref={chartRef}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      style={{ cursor: hoveredEdge ? "ew-resize" : "grab" }}
      className="select-none relative"
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
          {showCropPreview && (cropStart || cropEnd) && (() => {
            const startTime = cropStart ? parseFloat(cropStart) : timeMin
            const endTime = cropEnd ? parseFloat(cropEnd) : timeMax
            
            if (!isNaN(startTime) && !isNaN(endTime) && startTime < endTime) {
              return (
                <>
                  {/* Gray out area before crop start */}
                  {startTime > timeMin && (
                    <ReferenceArea
                      x1={Math.max(timeMin, currentDomain[0])}
                      x2={Math.min(startTime, currentDomain[1])}
                      fill="hsl(0 0% 50%)"
                      fillOpacity={0.3}
                      {...(yDomain ? { y1: yDomain[0], y2: yDomain[1] } : {})}
                    />
                  )}
                  {/* Gray out area after crop end */}
                  {endTime < timeMax && (
                    <ReferenceArea
                      x1={Math.max(endTime, currentDomain[0])}
                      x2={Math.min(timeMax, currentDomain[1])}
                      fill="hsl(0 0% 50%)"
                      fillOpacity={0.3}
                      {...(yDomain ? { y1: yDomain[0], y2: yDomain[1] } : {})}
                    />
                  )}
                  {/* Highlight the kept region with green border */}
                  <ReferenceArea
                    x1={Math.max(startTime, currentDomain[0])}
                    x2={Math.min(endTime, currentDomain[1])}
                    stroke="hsl(142 71% 45%)"
                    strokeWidth={2}
                    fill="transparent"
                    {...(yDomain ? { y1: yDomain[0], y2: yDomain[1] } : {})}
                  />
                </>
              )
            }
            return null
          })()}
          {labelSegments.map((segment, idx) => {
            // Only render if segment overlaps with current domain
            if (segment.end < currentDomain[0] || segment.start > currentDomain[1]) {
              return null
            }
            
            // Clamp segment boundaries to visible domain so background is always visible
            const visibleStart = Math.max(segment.start, currentDomain[0])
            const visibleEnd = Math.min(segment.end, currentDomain[1])
            
            const color = getLabelColor(segment.label)
            const isSelected = selectedSegmentIndex === idx
            
            return (
              <ReferenceArea
                key={`${segment.label}-${idx}-${segment.start.toFixed(3)}`}
                x1={visibleStart}
                x2={visibleEnd}
                stroke={isSelected ? color : "none"}
                strokeWidth={isSelected ? 2 : 0}
                fill={color}
                fillOpacity={isSelected ? 0.25 : 0.12}
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
          {showTooltips && (
            <ChartTooltip
              content={
                <HighlightAwareTooltipContent labelSegments={labelSegments} />
              }
            />
          )}
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
            onChange={onBrushChange}
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
      
      {/* SVG Overlay for draggable circles at segment boundaries */}
      <svg
        className="absolute top-0 left-0 w-full h-[600px] pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {labelSegments.map((segment, idx) => {
          // Only show circles for segments visible in current domain
          if (segment.end < currentDomain[0] || segment.start > currentDomain[1]) {
            return null
          }
          
          const color = getLabelColor(segment.label)
          const isHoveringStart = hoveredEdge?.segmentIndex === idx && hoveredEdge?.edge === 'start'
          const isHoveringEnd = hoveredEdge?.segmentIndex === idx && hoveredEdge?.edge === 'end'
          const isDraggingStart = draggingEdge?.segmentIndex === idx && draggingEdge?.edge === 'start'
          const isDraggingEnd = draggingEdge?.segmentIndex === idx && draggingEdge?.edge === 'end'
          
          // Calculate pixel positions
          const chartWidth = chartRef.current?.clientWidth || 800
          const chartHeight = 600
          const margin = { top: 5, right: 30, left: 20, bottom: 80 }
          const plotWidth = chartWidth - margin.left - margin.right
          const plotHeight = chartHeight - margin.top - margin.bottom
          const domainWidth = currentDomain[1] - currentDomain[0]
          
          const startX = margin.left + ((segment.start - currentDomain[0]) / domainWidth) * plotWidth
          const endX = margin.left + ((segment.end - currentDomain[0]) / domainWidth) * plotWidth
          
          // Position circles in the middle of the chart vertically
          const circleY = margin.top + plotHeight / 2
          
          const circleRadius = (isHoveringStart || isDraggingStart || isHoveringEnd || isDraggingEnd) ? 8 : 6
          
          const isHoveringQuickAdd = hoveredQuickAdd === idx
          
          return (
            <g key={`circles-${segment.label}-${idx}-${segment.start.toFixed(3)}`}>
              {/* Start circle */}
              <circle
                cx={startX}
                cy={circleY}
                r={circleRadius}
                fill={color}
                fillOpacity={isHoveringStart || isDraggingStart ? 0.9 : 0.7}
                stroke="white"
                strokeWidth={isHoveringStart || isDraggingStart ? 2 : 1.5}
              />
              {/* End circle */}
              <circle
                cx={endX}
                cy={circleY}
                r={circleRadius}
                fill={color}
                fillOpacity={isHoveringEnd || isDraggingEnd ? 0.9 : 0.7}
                stroke="white"
                strokeWidth={isHoveringEnd || isDraggingEnd ? 2 : 1.5}
              />
              {/* Quick-add button */}
              <g
                transform={`translate(${endX + 15}, ${circleY})`}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickAddSegment(segment.end)
                }}
                onMouseEnter={() => setHoveredQuickAdd(idx)}
                onMouseLeave={() => setHoveredQuickAdd(null)}
              >
                {/* Background circle */}
                <circle
                  cx={0}
                  cy={0}
                  r={isHoveringQuickAdd ? 11 : 10}
                  fill="hsl(142 71% 45%)"
                  fillOpacity={isHoveringQuickAdd ? 1 : 0.9}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* Plus symbol */}
                <line
                  x1={-4}
                  y1={0}
                  x2={4}
                  y2={0}
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <line
                  x1={0}
                  y1={-4}
                  x2={0}
                  y2={4}
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

