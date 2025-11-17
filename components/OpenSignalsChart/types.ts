export interface DataPoint {
  timestamp: number
  A1: number
  A2: number
  A3: number
  A4: number
  A5: number
  A6: number
}

export interface LabelSegment {
  start: number
  end: number
  label: string
}

export interface DraggingEdgeState {
  segmentIndex: number
  edge: 'start' | 'end'
  initialX: number
  initialTime: number
}

export interface HoveredEdgeState {
  segmentIndex: number
  edge: 'start' | 'end'
}

export interface DragState {
  x: number
  domain: [number, number]
}

