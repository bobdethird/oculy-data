import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getLabelColor } from "../utils"

interface SegmentFormProps {
  timeMin: number
  timeMax: number
  uniqueLabelNames: string[]
  newSegmentStart: string
  newSegmentEnd: string
  newSegmentLabel: string
  isCustomLabel: boolean
  setNewSegmentStart: (value: string) => void
  setNewSegmentEnd: (value: string) => void
  setNewSegmentLabel: (value: string) => void
  setIsCustomLabel: (value: boolean) => void
  onAddSegment: (start: string, end: string, label: string) => void
}

export function SegmentForm({
  timeMin,
  timeMax,
  uniqueLabelNames,
  newSegmentStart,
  newSegmentEnd,
  newSegmentLabel,
  isCustomLabel,
  setNewSegmentStart,
  setNewSegmentEnd,
  setNewSegmentLabel,
  setIsCustomLabel,
  onAddSegment,
}: SegmentFormProps) {
  const handleAdd = () => {
    onAddSegment(newSegmentStart, newSegmentEnd, newSegmentLabel)
  }

  const handleClear = () => {
    setNewSegmentStart("")
    setNewSegmentEnd("")
    setNewSegmentLabel("")
    setIsCustomLabel(false)
  }

  return (
    <div id="add-segment-form" className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Add New Segment</h3>
          <p className="text-xs text-muted-foreground">
            Create a new labeled segment by specifying start time, end time, and label. If it overlaps with existing segments, those parts will be replaced. (Range: {timeMin.toFixed(2)}s - {timeMax.toFixed(2)}s)
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="new-segment-start" className="text-xs font-medium">
            Start Time (seconds)
          </label>
          <Input
            id="new-segment-start"
            type="number"
            step="0.01"
            min={timeMin}
            max={timeMax}
            placeholder="e.g., 10.00"
            value={newSegmentStart}
            onChange={(e) => setNewSegmentStart(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="new-segment-end" className="text-xs font-medium">
            End Time (seconds)
          </label>
          <Input
            id="new-segment-end"
            type="number"
            step="0.01"
            min={timeMin}
            max={timeMax}
            placeholder="e.g., 15.00"
            value={newSegmentEnd}
            onChange={(e) => setNewSegmentEnd(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="new-segment-label" className="text-xs font-medium">
            Label
          </label>
          <Select
            value={isCustomLabel ? "__custom__" : newSegmentLabel}
            onValueChange={(value) => {
              if (value === "__custom__") {
                setIsCustomLabel(true)
                setNewSegmentLabel("")
              } else {
                setIsCustomLabel(false)
                setNewSegmentLabel(value)
              }
            }}
          >
            <SelectTrigger id="new-segment-label" className="w-full">
              <SelectValue placeholder="Select a label..." />
            </SelectTrigger>
            <SelectContent>
              {uniqueLabelNames.length === 0 ? (
                <SelectItem value="__custom__">Enter custom label</SelectItem>
              ) : (
                <>
                  {uniqueLabelNames.map((label) => (
                    <SelectItem key={label} value={label}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: getLabelColor(label) }}
                        />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom...</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          {isCustomLabel && (
            <Input
              type="text"
              placeholder="Enter custom label"
              value={newSegmentLabel}
              onChange={(e) => setNewSegmentLabel(e.target.value)}
              autoFocus
            />
          )}
        </div>
        <Button
          onClick={handleAdd}
          disabled={!newSegmentStart || !newSegmentEnd || !newSegmentLabel}
          size="default"
        >
          Add Segment
        </Button>
        {(newSegmentStart || newSegmentEnd || newSegmentLabel) && (
          <Button
            onClick={handleClear}
            variant="outline"
            size="default"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

