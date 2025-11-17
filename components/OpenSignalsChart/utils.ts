import type { DataPoint, LabelSegment } from "./types"
import { LABEL_COLORS, DEFAULT_LABEL_COLOR, SEGMENT_MATCH_EPSILON } from "./constants"

export function getLabelColor(label: string): string {
  return LABEL_COLORS[label] ?? DEFAULT_LABEL_COLOR
}

export function formatSegmentRange(segment: LabelSegment): string {
  return `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`
}

export function findSegmentAtTimestamp(
  segments: LabelSegment[],
  timestamp: number
): LabelSegment | undefined {
  return segments.find(
    (segment) =>
      timestamp >= segment.start - SEGMENT_MATCH_EPSILON &&
      timestamp <= segment.end + SEGMENT_MATCH_EPSILON
  )
}

export function parseKeypressLabelSegmentsWithMetadata(
  fileContents: string,
  signalStartTimestampMs: number | null,
  signalTimeRange: [number, number]
): {
  segments: LabelSegment[]
  keypressStartTimestampMs: number | null
  samplingRate: number
} {
  if (!fileContents) {
    return { segments: [], keypressStartTimestampMs: null, samplingRate: 1000 }
  }
  if (signalStartTimestampMs === null) {
    console.warn("Missing OpenSignals start timestamp; cannot align keypress labels.")
    return { segments: [], keypressStartTimestampMs: null, samplingRate: 1000 }
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
    return { segments: [], keypressStartTimestampMs: recordingStartTimestampMs, samplingRate }
  }

  const segments = rawSegments
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
  
  return {
    segments,
    keypressStartTimestampMs: recordingStartTimestampMs,
    samplingRate
  }
}

export function isEventFromBrush(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(".recharts-brush")
}

