import type { ComponentProps } from "react"
import { ChartTooltipContent } from "@/components/ui/chart"
import type { LabelSegment } from "../types"
import { getLabelColor, formatSegmentRange, findSegmentAtTimestamp } from "../utils"

type TooltipContentProps = ComponentProps<typeof ChartTooltipContent>

export function HighlightAwareTooltipContent({
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

