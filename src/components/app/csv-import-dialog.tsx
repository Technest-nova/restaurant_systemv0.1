"use client"

import * as React from "react"
import { AlertCircle, Download, FileUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadText, errorsToCsv, type ParseResult } from "@/lib/csv"

export function CsvImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  templateHref,
  templateName,
  parse,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  templateHref: string
  templateName: string
  parse: (text: string) => ParseResult<T>
  onConfirm: (rows: T[]) => void
}) {
  const [result, setResult] = React.useState<ParseResult<T> | null>(null)
  const [fileName, setFileName] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setResult(null)
      setFileName("")
    }
  }, [open])

  async function onFile(f: File | undefined) {
    if (!f) return
    setFileName(f.name)
    setResult(parse(await f.text()))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileUp /> {fileName ? "Choose another file" : "Choose CSV file"}
          </Button>
          <Button variant="link" asChild>
            <a href={templateHref} download={templateName}>
              <Download /> Download template
            </a>
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        </div>

        {result && (
          <div className="grid gap-3">
            <div className="text-sm">
              <strong>{result.rows.length}</strong> valid row{result.rows.length === 1 ? "" : "s"}
              {result.errors.length > 0 && (
                <span className="text-destructive">
                  {" "}
                  · {result.errors.length} with errors (skipped)
                </span>
              )}
            </div>
            {result.preview.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {result.headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.preview.map((r, i) => (
                      <TableRow key={i}>
                        {result.headers.map((h) => (
                          <TableCell key={h}>{r[h]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                {result.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <span>
                      {e.line > 1 ? `Line ${e.line}: ` : ""}
                      {e.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result && result.errors.length > 0 && (
            <Button variant="outline" onClick={() => downloadText("import-errors.csv", errorsToCsv(result.errors))}>
              <Download /> Download error file
            </Button>
          )}
          <Button
            disabled={!result || result.rows.length === 0}
            onClick={() => {
              if (!result) return
              onConfirm(result.rows)
              toast.success(`Imported ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}`)
              onOpenChange(false)
            }}
          >
            Confirm import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
