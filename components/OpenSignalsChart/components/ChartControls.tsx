import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ChartControlsProps {
  timeMin: number
  timeMax: number
  cropStart: string
  cropEnd: string
  setCropStart: (value: string) => void
  setCropEnd: (value: string) => void
  setShowCropPreview: (value: boolean) => void
  onApplyCrop: (startTime: string, endTime: string) => void
}

export function ChartControls({ 
  timeMin, 
  timeMax, 
  cropStart,
  cropEnd,
  setCropStart,
  setCropEnd,
  setShowCropPreview,
  onApplyCrop 
}: ChartControlsProps) {
  const handleApply = () => {
    onApplyCrop(cropStart, cropEnd)
    setCropStart("")
    setCropEnd("")
    setShowCropPreview(false)
  }

  const handleClear = () => {
    setCropStart("")
    setCropEnd("")
    setShowCropPreview(false)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Crop Data</h3>
          <p className="text-xs text-muted-foreground">
            Set start and end times to permanently crop the data (range: {timeMin.toFixed(2)}s - {timeMax.toFixed(2)}s)
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="crop-start" className="text-xs font-medium">
            Start Time (seconds)
          </label>
          <Input
            id="crop-start"
            type="number"
            step="0.01"
            min={timeMin}
            max={timeMax}
            placeholder={`${timeMin.toFixed(2)}`}
            value={cropStart}
            onChange={(e) => setCropStart(e.target.value)}
            onFocus={() => setShowCropPreview(true)}
            onBlur={() => {
              if (!cropStart && !cropEnd) {
                setShowCropPreview(false)
              }
            }}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="crop-end" className="text-xs font-medium">
            End Time (seconds)
          </label>
          <Input
            id="crop-end"
            type="number"
            step="0.01"
            min={timeMin}
            max={timeMax}
            placeholder={`${timeMax.toFixed(2)}`}
            value={cropEnd}
            onChange={(e) => setCropEnd(e.target.value)}
            onFocus={() => setShowCropPreview(true)}
            onBlur={() => {
              if (!cropStart && !cropEnd) {
                setShowCropPreview(false)
              }
            }}
          />
        </div>
        <Button
          onClick={handleApply}
          disabled={!cropStart && !cropEnd}
          size="default"
        >
          Apply Crop
        </Button>
        {(cropStart || cropEnd) && (
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

