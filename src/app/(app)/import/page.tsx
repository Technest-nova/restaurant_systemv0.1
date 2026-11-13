"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileUp, History, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Field, PageHeader, useMoney } from "@/components/app/common"
import { fmtDate } from "@/lib/calc"
import { downloadText, errorsToCsv, parseGenericSales, parseSquareSales, type ParsedSale, type ParseResult } from "@/lib/csv"
import { actions, useAppState } from "@/lib/store"
import { cn } from "@/lib/utils"

type Source = "generic" | "square"

const CHANNEL_LABEL: Record<string, string> = { in_house: "In-house", deliveroo: "Deliveroo", uber_eats: "Uber Eats", just_eat: "Just Eat" }

export default function ImportPage() {
  const state = useAppState()
  const router = useRouter()
  const money = useMoney()
  const [source, setSource] = React.useState<Source>("square")
  const [fileName, setFileName] = React.useState("")
  const [result, setResult] = React.useState<ParseResult<ParsedSale> | null>(null)
  const [period, setPeriod] = React.useState({ start: "", end: "" })
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  function handleText(text: string, name: string) {
    const res = source === "square" ? parseSquareSales(text, state.restaurant.country) : parseGenericSales(text, state.restaurant.country)
    setFileName(name)
    setResult(res)
    const dates = res.rows.map((r) => r.date).sort()
    setPeriod({ start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" })
  }

  async function handleFile(f?: File) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith(".csv")) return toast.error("Please upload a .csv file")
    handleText(await f.text(), f.name)
  }

  async function useSample() {
    const path = source === "square" ? "/templates/square-item-sales-sample.csv" : "/templates/sales-template.csv"
    const text = await (await fetch(path)).text()
    handleText(text, path.split("/").pop()!)
  }

  const inPeriod = React.useMemo(
    () => (result ? result.rows.filter((r) => (!period.start || r.date >= period.start) && (!period.end || r.date <= period.end)) : []),
    [result, period]
  )
  const newNames = React.useMemo(
    () => [...new Set(inPeriod.map((r) => r.posName))].filter((n) => !state.mappings[n] && !state.dishes.some((d) => d.name.toLowerCase() === n.toLowerCase())),
    [inPeriod, state.mappings, state.dishes]
  )
  const overlap = state.imports.filter((i) => period.start && period.end && i.periodStart <= period.end && i.periodEnd >= period.start)

  function confirm() {
    if (!result || inPeriod.length === 0) return
    actions.addSalesImport({ source, fileName, periodStart: period.start, periodEnd: period.end }, inPeriod)
    toast.success(`Imported ${inPeriod.length} sales rows`)
    setResult(null)
    setFileName("")
    if (newNames.length) router.push("/matching")
    else router.push("/dashboard")
  }

  return (
    <>
      <PageHeader title="Import sales" description="Upload last week's sales export. We preview the rows and show any errors before anything is saved." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Where is the file from?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { id: "square", t: "Square", d: "Reports → Item Sales → Export (CSV)" },
                  { id: "generic", t: "Generic template", d: "Any POS: date, item_name, channel, quantity, gross_sales" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSource(s.id)
                    setResult(null)
                    setFileName("")
                  }}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    source === s.id ? "border-primary bg-accent ring-2 ring-primary/20" : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <FileSpreadsheet className="size-4 text-primary" /> {s.t}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.d}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Upload the CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = "" }} />
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  handleFile(e.dataTransfer.files?.[0])
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragging ? "border-primary bg-accent" : "border-border"
                )}
              >
                <Upload className="mb-3 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">{fileName || "Drag your CSV here"}</p>
                <p className="mb-4 text-xs text-muted-foreground">or</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileRef.current?.click()}>
                    <FileUp /> Upload file
                  </Button>
                  <Button variant="outline" onClick={useSample}>
                    Try a sample {source === "square" ? "Square" : "template"} file
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 text-xs">
                <a className="text-primary hover:underline" href="/templates/sales-template.csv" download>
                  Download generic template
                </a>
                <a className="text-primary hover:underline" href="/templates/square-item-sales-sample.csv" download>
                  Download Square sample
                </a>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>3. Check and confirm</CardTitle>
                <CardDescription>
                  {result.totalRows} rows in file · <span className="text-success">{result.rows.length} valid</span>
                  {result.errors.length > 0 && <span className="text-destructive"> · {result.errors.length} with errors (will be skipped)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Period start">
                    <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
                  </Field>
                  <Field label="Period end">
                    <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
                  </Field>
                  <div className="grid content-end gap-1 text-sm">
                    <span className="text-muted-foreground">Rows in period</span>
                    <span className="text-lg font-semibold tabular-nums">{inPeriod.length}</span>
                  </div>
                </div>

                {overlap.length > 0 && (
                  <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                    This period overlaps an earlier import ({overlap.map((o) => o.fileName).join(", ")}). Delete the old one below if you&apos;re replacing it, or sales will be counted twice.
                  </p>
                )}

                {result.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5">
                    <div className="flex items-center justify-between border-b border-destructive/20 px-3 py-2">
                      <span className="text-sm font-medium text-destructive">Errors</span>
                      <Button size="xs" variant="outline" onClick={() => downloadText("sales-import-errors.csv", errorsToCsv(result.errors))}>
                        <Download /> Download error file
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-auto p-3 text-sm">
                      {result.errors.map((e, i) => (
                        <div key={i} className="flex gap-2">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                          {e.line > 1 ? `Line ${e.line}: ` : ""}
                          {e.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-sm font-medium">Preview (first 20 rows)</div>
                  <div className="max-h-80 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {result.headers.slice(0, 10).map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.preview.map((row, i) => (
                          <TableRow key={i}>
                            {result.headers.slice(0, 10).map((h) => (
                              <TableCell key={h} className="text-xs">
                                {row[h]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {inPeriod.length > 0 && (
                  <div className="grid gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-muted-foreground">Gross sales</div>
                      <div className="font-semibold tabular-nums">{money(inPeriod.reduce((s, r) => s + r.grossSales, 0))}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">By channel</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(
                          inPeriod.reduce<Record<string, number>>((acc, r) => ((acc[r.channel] = (acc[r.channel] ?? 0) + r.quantity), acc), {})
                        ).map(([c, q]) => (
                          <Badge key={c} variant="outline">
                            {CHANNEL_LABEL[c]} {q}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">New item names</div>
                      <div className="font-semibold">{newNames.length === 0 ? "None, all known" : `${newNames.length} to match next`}</div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setResult(null); setFileName("") }}>
                    Cancel
                  </Button>
                  <Button onClick={confirm} disabled={inPeriod.length === 0}>
                    <CheckCircle2 /> Confirm import
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> Import history
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {state.imports.length === 0 && <p className="text-sm text-muted-foreground">No imports yet. Your first upload will appear here.</p>}
            {state.imports.map((i) => (
              <div key={i.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)} · {i.rowCount} rows · {i.source === "square" ? "Square" : "Generic"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete import"
                  onClick={() => {
                    actions.deleteImport(i.id)
                    toast.success("Import deleted")
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
            {state.imports.length > 0 && (
              <Link href="/matching" className="mt-1 text-xs text-primary hover:underline">
                Review item matching →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
