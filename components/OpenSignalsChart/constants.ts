import type { ChartConfig } from "@/components/ui/chart"

export const LABEL_COLORS: Record<string, string> = {
  stare: "hsl(221 83% 65%)",
  left: "hsl(0 84% 60%)",
  up: "hsl(142 71% 45%)",
  down: "hsl(25 95% 53%)",
  right: "hsl(291 64% 42%)",
  unknown: "hsl(220 13% 69%)",
  blink: "hsl(192 85% 44%)",
}

export const DEFAULT_LABEL_COLOR = "hsl(217 22% 67%)"
export const SEGMENT_MATCH_EPSILON = 0.002

export const chartConfig = {
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

