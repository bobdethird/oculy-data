"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { LabelSegment } from "./types"
import { useChartData } from "./hooks/useChartData"
import { useChartNavigation } from "./hooks/useChartNavigation"
import { useSegmentManagement } from "./hooks/useSegmentManagement"
import { FileUpload } from "./components/FileUpload"
import { ChartControls } from "./components/ChartControls"
import { SegmentForm } from "./components/SegmentForm"
import { ChartView } from "./components/ChartView"
import { getLabelColor } from "./utils"

const padNumber = (value: number, length = 2) => value.toString().padStart(length, "0")

const formatLocalDate = (date: Date) => {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

const formatLocalTimeWithMs = (date: Date) => {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}.${padNumber(date.getMilliseconds(), 3)}`
}

export function OpenSignalsChart() {
  const {
    data,
    rawData,
    labelSegments,
    loading,
    error,
    yRange,
    signalFile,
    keypressFile,
    signalInputRef,
    keypressInputRef,
    signalStartTimestampMs,
    keypressStartTimestampMs,
    keypressSamplingRate,
    signalSamplingRate,
    signalDeviceId,
    setData,
    setRawData,
    setLabelSegments,
    setError,
    setYRange,
    setSignalStartTimestampMs,
    setKeypressStartTimestampMs,
    processFiles,
    handleSignalFileChange,
    handleKeypressFileChange,
    resetAll,
  } = useChartData()

  const {
    xDomain,
    setXDomain,
    chartRef,
    isDragging,
    handleMouseDown: navHandleMouseDown,
    handleWheel,
    handleBrushChange,
  } = useChartNavigation(data)

  const {
    draggingEdge,
    setDraggingEdge,
    hoveredEdge,
    setHoveredEdge,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
    findEdgeNearMouse,
    findSegmentAtMouse,
  } = useSegmentManagement(labelSegments, setLabelSegments, data, xDomain, chartRef)

  const [showTooltips, setShowTooltips] = useState(true)
  const [hoveredQuickAdd, setHoveredQuickAdd] = useState<number | null>(null)
  const [cropStart, setCropStart] = useState<string>("")
  const [cropEnd, setCropEnd] = useState<string>("")
  const [showCropPreview, setShowCropPreview] = useState(false)
  const [newSegmentStart, setNewSegmentStart] = useState<string>("")
  const [newSegmentEnd, setNewSegmentEnd] = useState<string>("")
  const [newSegmentLabel, setNewSegmentLabel] = useState<string>("")
  const [isCustomLabel, setIsCustomLabel] = useState(false)

  const handleLoadFiles = async () => {
    if (signalFile && keypressFile) {
      const result = await processFiles(signalFile, keypressFile)
      if (result) {
        const { timeMin, timeMax } = result
        const totalDuration = Math.max(timeMax - timeMin, 0)
        const windowSize = Math.min(totalDuration, 10)
        setXDomain([timeMin, timeMin + windowSize])
      }
    } else {
      setError("Please select both files")
    }
  }

  const handleExportSignals = () => {
    if (rawData.length === 0) {
      setError("No signal data to export")
      return
    }
    
    if (signalStartTimestampMs === null) {
      setError("Missing timestamp metadata for export")
      return
    }
    
    const lines: string[] = []
    const exportDate = new Date(signalStartTimestampMs)
    const dateOnly = formatLocalDate(exportDate)
    const timeOnly = formatLocalTimeWithMs(exportDate)
    
    const deviceIdStr = signalDeviceId || "DEVICE_UNKNOWN"
    const headerObj = {
      [deviceIdStr]: {
        "sampling rate": signalSamplingRate,
        "date": dateOnly,
        "time": timeOnly,
        "resolution": [16, 16, 16, 16, 16, 16],
        "channels": 6,
        "column": "A1-A6"
      }
    }
    
    lines.push(`# ${JSON.stringify(headerObj)}`)
    lines.push("# EndOfHeader")
    
    for (let i = 0; i < rawData.length; i++) {
      const point = rawData[i]
      const row = `${i}\t0\t0\t0\t0\t${point.A1.toFixed(6)}\t${point.A2.toFixed(6)}\t${point.A3.toFixed(6)}\t${point.A4.toFixed(6)}\t${point.A5.toFixed(6)}\t${point.A6.toFixed(6)}`
      lines.push(row)
    }
    
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19)
    a.download = `opensignals_${deviceIdStr}_${timestamp}.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportLabels = () => {
    if (rawData.length === 0) {
      setError("No signal data loaded for export")
      return
    }
    
    if (labelSegments.length === 0) {
      setError("No label segments to export")
      return
    }
    
    if (signalStartTimestampMs === null || keypressStartTimestampMs === null) {
      setError("Missing timestamp metadata for export")
      return
    }
    
    const dataStart = rawData[0]?.timestamp ?? 0
    const dataEnd = rawData[rawData.length - 1]?.timestamp ?? dataStart
    
    const segmentsForExport = labelSegments
      .map((segment) => ({
        label: segment.label,
        start: Math.max(segment.start, dataStart),
        end: Math.min(segment.end, dataEnd),
      }))
      .filter((segment) => segment.end > segment.start)
    
    if (segmentsForExport.length === 0) {
      setError("No label segments within the cropped range to export")
      return
    }
    
    const lines: string[] = []
    const recordingDate = new Date(keypressStartTimestampMs)
    const dateStr = `${formatLocalDate(recordingDate)} ${formatLocalTimeWithMs(recordingDate)}`
    
    lines.push("# Eye Tracking Keypress Labels")
    lines.push(`# Recording started: ${dateStr}`)
    lines.push(`# Sampling rate: ${keypressSamplingRate} Hz (${1000/keypressSamplingRate} ms per sample)`)
    lines.push("# Columns: sample_number, timestamp_ms, elapsed_ms, label")
    lines.push("# Labels: " + Array.from(new Set(segmentsForExport.map(s => s.label))).join(", "))
    lines.push("# Exported with modifications")
    lines.push("# EndOfHeader")
    
    let sampleNumber = 0
    const sampleIntervalMs = 1000 / keypressSamplingRate
    
    for (const segment of segmentsForExport) {
      const segmentStartMs = signalStartTimestampMs + (segment.start * 1000)
      const segmentEndMs = signalStartTimestampMs + (segment.end * 1000)
      const segmentDurationMs = segmentEndMs - segmentStartMs
      
      const numSamples = Math.max(1, Math.ceil(segmentDurationMs / sampleIntervalMs))
      
      for (let i = 0; i < numSamples; i++) {
        const timestampMs = segmentStartMs + (i * sampleIntervalMs)
        const elapsedMs = timestampMs - keypressStartTimestampMs
        
        lines.push(`${sampleNumber}\t${timestampMs.toFixed(3)}\t${elapsedMs.toFixed(3)}\t${segment.label}`)
        sampleNumber++
      }
    }
    
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19)
    a.download = `keypress_labels_edited_${timestamp}.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  const handleExportBoth = () => {
    handleExportSignals()
    setTimeout(() => handleExportLabels(), 100)
  }

  const handleApplyCrop = (cropStartStr: string, cropEndStr: string) => {
    if (rawData.length === 0) return
    
    const timeMin = rawData[0].timestamp
    const timeMax = rawData[rawData.length - 1].timestamp
    
    const startTime = cropStartStr ? parseFloat(cropStartStr) : timeMin
    const endTime = cropEndStr ? parseFloat(cropEndStr) : timeMax
    
    if (isNaN(startTime) || isNaN(endTime)) {
      setError("Invalid crop times. Please enter valid numbers.")
      return
    }
    
    if (startTime >= endTime) {
      setError("Crop start time must be less than end time.")
      return
    }
    
    if (startTime < timeMin || endTime > timeMax) {
      setError(`Crop times must be within data range (${timeMin.toFixed(2)}s - ${timeMax.toFixed(2)}s).`)
      return
    }
    
    const trimmedRawData = rawData.filter(
      (point) => point.timestamp >= startTime && point.timestamp <= endTime
    )
    
    if (trimmedRawData.length === 0) {
      setError("Crop range contains no data points.")
      return
    }
    
    const offset = startTime
    
    const normalizedRawData = trimmedRawData.map((point) => ({
      ...point,
      timestamp: point.timestamp - offset,
    }))
    
    const sampleStep = Math.max(1, Math.floor(normalizedRawData.length / 10000))
    const normalizedSampledData = normalizedRawData.filter((_, idx) => idx % sampleStep === 0)
    
    const croppedSegments = labelSegments
      .map((segment) => {
        const clampedStart = Math.max(segment.start, startTime)
        const clampedEnd = Math.min(segment.end, endTime)
        return {
          ...segment,
          start: clampedStart - offset,
          end: clampedEnd - offset,
        }
      })
      .filter((segment) => segment.end > segment.start)
    
    setRawData(normalizedRawData)
    setData(normalizedSampledData)
    setLabelSegments(croppedSegments)
    
    let minA4 = Number.POSITIVE_INFINITY
    let maxA4 = Number.NEGATIVE_INFINITY
    normalizedRawData.forEach((point) => {
      minA4 = Math.min(minA4, point.A4)
      maxA4 = Math.max(maxA4, point.A4)
    })
    setYRange([minA4, maxA4])
    
    const newTimeMin = normalizedRawData[0].timestamp
    const newTimeMax = normalizedRawData[normalizedRawData.length - 1].timestamp
    const totalDuration = newTimeMax - newTimeMin
    const windowSize = Math.min(totalDuration, 10)
    setXDomain([newTimeMin, newTimeMin + windowSize])
    
    const offsetMs = offset * 1000
    setSignalStartTimestampMs((prev) => (prev !== null ? prev + offsetMs : prev))
    setKeypressStartTimestampMs((prev) => (prev !== null ? prev + offsetMs : prev))
    
    setSelectedSegmentIndex(null)
    setError(null)
  }

  const handleQuickAddSegment = (startTime: number) => {
    if (data.length === 0) return
    
    const timeMax = data[data.length - 1].timestamp
    const endTime = Math.min(startTime + 0.2, timeMax)
    
    // Pre-fill the form
    setNewSegmentStart(startTime.toFixed(2))
    setNewSegmentEnd(endTime.toFixed(2))
    setIsCustomLabel(false)
    
    // Scroll to the form
    const formElement = document.getElementById('add-segment-form')
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const handleAddNewSegment = (startStr: string, endStr: string, label: string) => {
    if (data.length === 0) return
    
    const timeMin = data[0].timestamp
    const timeMax = data[data.length - 1].timestamp
    
    const startTime = parseFloat(startStr)
    const endTime = parseFloat(endStr)
    const trimmedLabel = label.trim()
    
    if (!trimmedLabel) {
      setError("Please enter a label for the new segment.")
      return
    }
    
    if (isNaN(startTime) || isNaN(endTime)) {
      setError("Invalid segment times. Please enter valid numbers.")
      return
    }
    
    if (startTime >= endTime) {
      setError("Segment start time must be less than end time.")
      return
    }
    
    if (startTime < timeMin || endTime > timeMax) {
      setError(`Segment times must be within data range (${timeMin.toFixed(2)}s - ${timeMax.toFixed(2)}s).`)
      return
    }
    
    const newSegment: LabelSegment = {
      start: startTime,
      end: endTime,
      label: trimmedLabel
    }
    
    const processedSegments: LabelSegment[] = []
    
    for (const segment of labelSegments) {
      const overlaps = !(segment.end <= startTime || segment.start >= endTime)
      
      if (!overlaps) {
        processedSegments.push(segment)
      } else {
        if (startTime <= segment.start && endTime >= segment.end) {
          continue
        }
        
        if (segment.start < startTime && segment.end > endTime) {
          processedSegments.push({
            ...segment,
            end: startTime
          })
          processedSegments.push({
            ...segment,
            start: endTime
          })
          continue
        }
        
        if (startTime <= segment.start && endTime < segment.end) {
          processedSegments.push({
            ...segment,
            start: endTime
          })
          continue
        }
        
        if (startTime > segment.start && endTime >= segment.end) {
          processedSegments.push({
            ...segment,
            end: startTime
          })
          continue
        }
      }
    }
    
    const newSegments = [...processedSegments, newSegment].sort((a, b) => a.start - b.start)
    setLabelSegments(newSegments)
    
    // Clear the form
    setNewSegmentStart("")
    setNewSegmentEnd("")
    setNewSegmentLabel("")
    setIsCustomLabel(false)
    setError(null)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    
    const timeMin = data.length > 0 ? data[0].timestamp : 0
    const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0
    const currentDomain = xDomain || [timeMin, timeMax]
    
    const edge = findEdgeNearMouse(e.clientX, currentDomain)
    
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
    
    const segmentIndex = findSegmentAtMouse(e.clientX, currentDomain)
    
    if (segmentIndex !== null) {
      e.preventDefault()
      e.stopPropagation()
      setSelectedSegmentIndex(segmentIndex)
      return
    }
    
    setSelectedSegmentIndex(null)
    navHandleMouseDown(e, currentDomain)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingEdge || isDragging.current) return
    
    const timeMin = data.length > 0 ? data[0].timestamp : 0
    const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0
    const currentDomain = xDomain || [timeMin, timeMax]
    
    const edge = findEdgeNearMouse(e.clientX, currentDomain)
    
    if (edge) {
      setHoveredEdge({
        segmentIndex: edge.segmentIndex,
        edge: edge.edge
      })
    } else if (hoveredEdge) {
      setHoveredEdge(null)
    }
  }

  if (rawData.length === 0 && !loading) {
    return (
      <FileUpload
        signalFile={signalFile}
        keypressFile={keypressFile}
        loading={loading}
        error={error}
        signalInputRef={signalInputRef}
        keypressInputRef={keypressInputRef}
        onSignalFileChange={handleSignalFileChange}
        onKeypressFileChange={handleKeypressFileChange}
        onLoadFiles={handleLoadFiles}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    )
  }

  if (error && rawData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  const uniqueLabelNames = Array.from(new Set(labelSegments.map((segment) => segment.label)))
  const timeMin = data.length > 0 ? data[0].timestamp : 0
  const timeMax = data.length > 0 ? data[data.length - 1].timestamp : 0
  const currentDomain = xDomain || [timeMin, timeMax]

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">OpenSignals Data Visualization - A4</h2>
            <p className="text-sm text-muted-foreground">
              {rawData.length.toLocaleString()} data points ({data.length.toLocaleString()} displayed)
              {xDomain && (
                <span className="ml-2">
                  | Showing {currentDomain[0].toFixed(2)}s - {currentDomain[1].toFixed(2)}s
                </span>
              )}
            </p>
            {selectedSegmentIndex !== null && labelSegments[selectedSegmentIndex] && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Selected:</span>
                <div className="flex items-center gap-1.5 rounded-md border px-2 py-0.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: getLabelColor(labelSegments[selectedSegmentIndex].label) }}
                  />
                  <span className="font-medium">{labelSegments[selectedSegmentIndex].label}</span>
                  <span className="text-muted-foreground">
                    ({labelSegments[selectedSegmentIndex].start.toFixed(2)}s - {labelSegments[selectedSegmentIndex].end.toFixed(2)}s)
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTooltips(!showTooltips)}
            >
              {showTooltips ? "Hide" : "Show"} Tooltips
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportBoth}
              disabled={labelSegments.length === 0 || rawData.length === 0}
            >
              Export Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <ChartControls
        timeMin={timeMin}
        timeMax={timeMax}
        cropStart={cropStart}
        cropEnd={cropEnd}
        setCropStart={setCropStart}
        setCropEnd={setCropEnd}
        setShowCropPreview={setShowCropPreview}
        onApplyCrop={handleApplyCrop}
      />
      <SegmentForm
        timeMin={timeMin}
        timeMax={timeMax}
        uniqueLabelNames={uniqueLabelNames}
        newSegmentStart={newSegmentStart}
        newSegmentEnd={newSegmentEnd}
        newSegmentLabel={newSegmentLabel}
        isCustomLabel={isCustomLabel}
        setNewSegmentStart={setNewSegmentStart}
        setNewSegmentEnd={setNewSegmentEnd}
        setNewSegmentLabel={setNewSegmentLabel}
        setIsCustomLabel={setIsCustomLabel}
        onAddSegment={handleAddNewSegment}
      />
      <ChartView
        data={data}
        labelSegments={labelSegments}
        xDomain={xDomain}
        yRange={yRange}
        chartRef={chartRef}
        showTooltips={showTooltips}
        selectedSegmentIndex={selectedSegmentIndex}
        draggingEdge={draggingEdge}
        hoveredEdge={hoveredEdge}
        hoveredQuickAdd={hoveredQuickAdd}
        cropStart={cropStart}
        cropEnd={cropEnd}
        showCropPreview={showCropPreview}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={(e) => handleWheel(e, currentDomain)}
        onBrushChange={handleBrushChange}
        onQuickAddSegment={handleQuickAddSegment}
        setHoveredQuickAdd={setHoveredQuickAdd}
      />
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
        Scroll with mouse wheel or drag the brush below to navigate. Drag on the chart to pan. Click on a segment to select it, then press Delete or Backspace to remove it. Drag the colored circles at segment edges to adjust label boundaries (adjacent segments will move together to maintain continuity). Click the green "+" button at the end of any segment to quickly add a 0.2s segment starting at that point. Press Escape to deselect. Use the "Add New Segment" section to create new labeled segments, and the crop controls to permanently trim the data to a specific time range.
      </p>
    </div>
  )
}

