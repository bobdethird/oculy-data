import { useState, useRef } from "react"
import type { DataPoint, LabelSegment } from "../types"
import { parseKeypressLabelSegmentsWithMetadata } from "../utils"

export function useChartData() {
  const [data, setData] = useState<DataPoint[]>([])
  const [rawData, setRawData] = useState<DataPoint[]>([])
  const [labelSegments, setLabelSegments] = useState<LabelSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [yRange, setYRange] = useState<[number, number] | null>(null)
  const [signalFile, setSignalFile] = useState<File | null>(null)
  const [keypressFile, setKeypressFile] = useState<File | null>(null)
  const signalInputRef = useRef<HTMLInputElement | null>(null)
  const keypressInputRef = useRef<HTMLInputElement | null>(null)
  
  const [signalStartTimestampMs, setSignalStartTimestampMs] = useState<number | null>(null)
  const [keypressStartTimestampMs, setKeypressStartTimestampMs] = useState<number | null>(null)
  const [keypressSamplingRate, setKeypressSamplingRate] = useState(1000)
  const [signalSamplingRate, setSignalSamplingRate] = useState(1000)
  const [signalDeviceId, setSignalDeviceId] = useState<string | null>(null)

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
      let parsedSignalStartTimestampMs: number | null = null
      let deviceId: string | null = null

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
              deviceId = deviceKey
              const deviceInfo = headerData[deviceKey]
              if (deviceInfo?.["sampling rate"]) {
                samplingRate = deviceInfo["sampling rate"]
              }
              if (deviceInfo?.date && deviceInfo?.time) {
                const isoString = `${deviceInfo.date}T${deviceInfo.time}`
                const parsedDate = new Date(isoString)
                if (!isNaN(parsedDate.getTime())) {
                  parsedSignalStartTimestampMs = parsedDate.getTime()
                }
              }
            }
          } catch (e) {
            console.warn("Could not parse header JSON, using default sampling rate", e)
          }
        }
      }
      
      setSignalSamplingRate(samplingRate)
      setSignalDeviceId(deviceId)
      
      // Parse data rows - first parse all data at full resolution
      const fullResData: DataPoint[] = []
      let minA4 = Number.POSITIVE_INFINITY
      let maxA4 = Number.NEGATIVE_INFINITY
      const sampleInterval = 1 / samplingRate // seconds per sample
      
      for (let i = dataStartIndex; i < lines.length; i++) {
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

        fullResData.push({
          timestamp,
          A1,
          A2,
          A3,
          A4,
          A5,
          A6,
        })
      }
      
      // Store full resolution data for export
      setRawData(fullResData)
      
      // Sample data for visualization to improve performance
      const sampleStep = Math.max(1, Math.floor(fullResData.length / 10000))
      const sampledData = fullResData.filter((_, idx) => idx % sampleStep === 0)
      
      setData(sampledData)

      if (fullResData.length > 0) {
        setYRange([minA4, maxA4])
      } else {
        setYRange(null)
      }
      
      const timeMin = fullResData.length > 0 ? fullResData[0].timestamp : 0
      const timeMax = fullResData.length > 0 ? fullResData[fullResData.length - 1].timestamp : 0

      // Align keypress labels with the OpenSignals timestamps
      const result = parseKeypressLabelSegmentsWithMetadata(
        keypressText,
        parsedSignalStartTimestampMs,
        [timeMin, timeMax]
      )
      setLabelSegments(result.segments)
      setSignalStartTimestampMs(parsedSignalStartTimestampMs)
      setKeypressStartTimestampMs(result.keypressStartTimestampMs)
      setKeypressSamplingRate(result.samplingRate)

      setLoading(false)
      return { timeMin, timeMax }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
      return null
    }
  }

  const handleSignalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSignalFile(file)
    }
  }

  const handleKeypressFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setKeypressFile(file)
    }
  }

  const resetAll = () => {
    setData([])
    setRawData([])
    setLabelSegments([])
    setSignalFile(null)
    setKeypressFile(null)
    setYRange(null)
    setError(null)
    setSignalStartTimestampMs(null)
    setKeypressStartTimestampMs(null)
    setKeypressSamplingRate(1000)
    setSignalSamplingRate(1000)
    setSignalDeviceId(null)
    if (signalInputRef.current) signalInputRef.current.value = ""
    if (keypressInputRef.current) keypressInputRef.current.value = ""
  }

  return {
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
  }
}

