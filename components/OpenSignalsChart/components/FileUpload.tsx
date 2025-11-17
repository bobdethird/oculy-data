import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface FileUploadProps {
  signalFile: File | null
  keypressFile: File | null
  loading: boolean
  error: string | null
  signalInputRef: React.RefObject<HTMLInputElement | null>
  keypressInputRef: React.RefObject<HTMLInputElement | null>
  onSignalFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeypressFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onLoadFiles: () => void
}

export function FileUpload({
  signalFile,
  keypressFile,
  loading,
  error,
  signalInputRef,
  keypressInputRef,
  onSignalFileChange,
  onKeypressFileChange,
  onLoadFiles,
}: FileUploadProps) {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">OpenSignals Data Visualization</h2>
        <p className="text-sm text-muted-foreground">
          Upload your OpenSignals data file and keypress labels file to visualize the data.
        </p>
      </div>
      <div className="space-y-4 rounded-lg border p-6">
        <div className="space-y-2">
          <label htmlFor="signal-file" className="text-sm font-medium">
            OpenSignals Data File
          </label>
          <Input
            ref={signalInputRef}
            id="signal-file"
            type="file"
            accept=".txt"
            onChange={onSignalFileChange}
          />
          {signalFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {signalFile.name}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="keypress-file" className="text-sm font-medium">
            Keypress Labels File
          </label>
          <Input
            ref={keypressInputRef}
            id="keypress-file"
            type="file"
            accept=".txt"
            onChange={onKeypressFileChange}
          />
          {keypressFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {keypressFile.name}
            </p>
          )}
        </div>
        <Button
          onClick={onLoadFiles}
          disabled={!signalFile || !keypressFile || loading}
          className="w-full"
        >
          {loading ? "Loading..." : "Load Data"}
        </Button>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}

