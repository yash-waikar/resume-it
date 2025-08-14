"use client"

import { useEffect, useState } from "react"
import { Button } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Textarea } from "./components/ui/textarea"
import { Badge } from "./components/ui/badge"
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  Eye,
  User,
} from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { getResumeSuggestions, rewriteAllBullets } from "./lib/ai"
import { config } from "./config"
import { AIAnalyzingCard } from "./components/ai-card"


function splitLeftRight(text) {
  if (!text) return { left: "", right: "" }
  const delimiters = [" — ", " – ", " - "]
  for (const d of delimiters) {
    const idx = text.lastIndexOf(d)
    if (idx !== -1) {
      return { left: text.slice(0, idx).trim(), right: text.slice(idx + d.length).trim() }
    }
  }
  return { left: text, right: "" }
}

const initialResume = {
  name: "",
  contact: "",
  sections: [
    {
      id: "education",
      title: "EDUCATION",
      items: [
        {
          heading: "",
          subheading: "",
          bullets: [""],
        },
      ],
    },
    {
      id: "tech",
      title: "TECHNICAL SKILLS",
      items: [
        {
          heading: "",
          subheading: "",
          bullets: ["", ""],
        },
      ],
    },
    {
      id: "experience",
      title: "EXPERIENCE",
      items: [
        {
          heading: "",
          subheading: "",
          bullets: ["", "", "", ""],
        },
        {
          heading: "",
          subheading: "",
          bullets: ["", "", ""],
        },
      ],
    },
    {
      id: "projects",
      title: "PROJECTS",
      items: [
        {
          heading: "",
          subheading: "",
          bullets: ["", ""],
        },
        {
          heading: "",
          subheading: "",
          bullets: ["", ""],
        },
        {
          heading: "",
          subheading: "",
          bullets: ["", ""],
        },
      ],
    },
    {
      id: "leadership",
      title: "LEADERSHIP",
      items: [
        {
          heading: "",
          subheading: "",
          bullets: [""],
        },
      ],
    },
  ],
}

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).substr(2, 9)
}

export default function ResumeEditor() {
  const [resume, setResume] = useState(() => {
    try {
      const saved = localStorage.getItem("resume_v1")
      return saved ? JSON.parse(saved) : initialResume
    } catch (e) {
      return initialResume
    }
  })

  const [isExporting, setIsExporting] = useState(false)
  const [apiKey, setApiKey] = useState(config.GEMINI_API_KEY)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState({ suggestions: [], risks: [], summary: "" })

  useEffect(() => {
    localStorage.setItem("resume_v1", JSON.stringify(resume))
  }, [resume])


  function updateSection(sectionId, updater) {
    setResume((r) => ({
      ...r,
      sections: r.sections.map((s) => (s.id === sectionId ? updater(s) : s)),
    }))
  }

  function addSection() {
    const id = uid("section")
    setResume((r) => ({
      ...r,
      sections: [
        ...r.sections,
        { id, title: "New Section", items: [{ heading: "", subheading: "", bullets: ["New bullet"] }] },
      ],
    }))
  }

  function removeSection(id) {
    setResume((r) => ({ ...r, sections: r.sections.filter((s) => s.id !== id) }))
  }

  function addItem(sectionId) {
    updateSection(sectionId, (s) => ({
      ...s,
      items: [...s.items, { heading: "", subheading: "", bullets: ["New bullet"] }],
    }))
  }

  function removeItem(sectionId, idx) {
    updateSection(sectionId, (s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))
  }

  function addBullet(sectionId, itemIdx) {
    updateSection(sectionId, (s) => {
      const items = s.items.map((it, i) => (i === itemIdx ? { ...it, bullets: [...it.bullets, "New bullet"] } : it))
      return { ...s, items }
    })
  }

  function removeBullet(sectionId, itemIdx, bIdx) {
    updateSection(sectionId, (s) => {
      const items = s.items.map((it, i) =>
        i === itemIdx ? { ...it, bullets: it.bullets.filter((_, b) => b !== bIdx) } : it,
      )
      return { ...s, items }
    })
  }

  function updateField(path, value) {
    setResume((r) => {
      const copy = JSON.parse(JSON.stringify(r))
      let cur = copy
      for (let i = 0; i < path.length - 1; i++) {
        cur = cur[path[i]]
      }
      cur[path[path.length - 1]] = value
      return copy
    })
  }

  function moveItem(sectionId, fromIdx, toIdx) {
    updateSection(sectionId, (s) => {
      if (toIdx < 0 || toIdx >= s.items.length) return s
      const items = [...s.items]
      const [m] = items.splice(fromIdx, 1)
      items.splice(toIdx, 0, m)
      return { ...s, items }
    })
  }

  function moveBullet(sectionId, itemIdx, fromB, toB) {
    updateSection(sectionId, (s) => {
      const items = s.items.map((it, i) => {
        if (i !== itemIdx) return it
        if (toB < 0 || toB >= it.bullets.length) return it
        const bullets = [...it.bullets]
        const [m] = bullets.splice(fromB, 1)
        bullets.splice(toB, 0, m)
        return { ...it, bullets }
      })
      return { ...s, items }
    })
  }

  function changeIndent(sectionId, itemIdx, bIdx, delta) {
    updateSection(sectionId, (s) => {
      const items = s.items.map((it, i) => {
        if (i !== itemIdx) return it
        const bullets = it.bullets.map((b, k) => {
          if (k !== bIdx) return b
          let indent = 0
          while (b.startsWith("\t")) {
            indent++
            b = b.slice(1)
          }
          indent = Math.max(0, Math.min(4, indent + delta))
          return "\t".repeat(indent) + b
        })
        return { ...it, bullets }
      })
      return { ...s, items }
    })
  }

  async function exportToPDF() {
    setIsExporting(true)
    try {
    
      window.print()
    } finally {
      setIsExporting(false)
    }
  }

  async function downloadPDF() {
    const element = document.getElementById("print-area")
    if (!element) return

    setIsExporting(true)
    
    const prevStyle = {
      width: element.style.width,
      padding: element.style.padding,
      background: element.style.background,
      transform: element.style.transform,
      transformOrigin: element.style.transformOrigin,
    }

    try {
      
      const pageWidthMm = 210
      const pageHeightMm = 297
      const marginMm = 15
      const contentWidthMm = pageWidthMm - marginMm * 2
      const contentHeightMm = pageHeightMm - marginMm * 2

      
      const pxPerMm = 96 / 25.4
      const contentWidthPx = Math.round(contentWidthMm * pxPerMm)

      
      element.classList.add("exporting")
      element.style.width = `${contentWidthPx}px`
      element.style.padding = "0px"
      element.style.background = "#ffffff"

      
      await new Promise((r) => requestAnimationFrame(() => r()))

      
      const canvas = await html2canvas(element, {
        scale: 3.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      })

      const imgData = canvas.toDataURL("image/jpeg", 1.0)

      
      let imgWidthMm = contentWidthMm
      let imgHeightMm = (canvas.height * imgWidthMm) / canvas.width

      if (imgHeightMm > contentHeightMm) {
        const scale = contentHeightMm / imgHeightMm
        imgWidthMm = imgWidthMm * scale
        imgHeightMm = imgHeightMm * scale
      }

      const pdf = new jsPDF("p", "mm", "a4")
      const x = (pageWidthMm - imgWidthMm) / 2
      const y = (pageHeightMm - imgHeightMm) / 2
      pdf.addImage(imgData, "JPEG", x, y, imgWidthMm, imgHeightMm)
      pdf.save(`${resume.name.replace(/\s+/g, "_")}_Resume.pdf`)
    } catch (e) {
      console.error(e)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      
      element.classList.remove("exporting")
      element.style.width = prevStyle.width
      element.style.padding = prevStyle.padding
      element.style.background = prevStyle.background
      element.style.transform = prevStyle.transform
      element.style.transformOrigin = prevStyle.transformOrigin
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-500 via-gray-500 to-gray-500 relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(238, 238, 239, 0.2),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255, 255, 255, 0.15),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(226, 227, 228, 0.1),transparent_50%)]"></div>

      <div className="container mx-auto p-4 lg:p-6 max-w-7xl relative z-10">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-600 rounded-xl text-white shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pause-icon lucide-pause">
                    <rect x="14" y="3" width="5" height="18" rx="1"/>
                    <rect x="5" y="3" width="5" height="18" rx="1"/>
                  </svg>
                </div>
                <div>
                </div>
              </div>
             
            </div>

            <div className="flex flex-wrap gap-2">
              
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("resume_v1")
                  setResume(initialResume)
                }}
                className="gap-2 bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50 backdrop-blur-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={downloadPDF}
                className="gap-2 bg-gradient-to-r from-gray-600 to-gray-600 hover:from-gray-700 text-white shadow-lg"
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Generating PDF..." : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={exportToPDF}
                className="gap-2 bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50 backdrop-blur-sm"
                disabled={isExporting}
              >
                <Eye className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <div className="space-y-6">
            <Card className="border-0 shadow-2xl bg-gray-800/30 backdrop-blur-md border border-gray-700/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
                  <User className="h-5 w-5 text-green-400" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Full Name</label>
                  <Input
                    value={resume.name}
                    onChange={(e) => setResume({ ...resume, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Contact Information</label>
                  <Input
                    value={resume.contact}
                    onChange={(e) => setResume({ ...resume, contact: e.target.value })}
                    placeholder="Phone • Email • LinkedIn • GitHub"
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
              </CardContent>
            </Card>

           

            <div className="space-y-4">
              {resume.sections.map((section, sIdx) => {
                const IconComponent = section.icon || FileText
                return (
                  <Card
                    key={section.id}
                    className="border-0 shadow-2xl bg-gray-800/30 backdrop-blur-md border border-gray-700/50 overflow-hidden"
                  >
                    <CardHeader className="pb-3 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <IconComponent className="h-5 w-5 text-blue-400" />
                          <Input
                            value={section.title}
                            onChange={(e) =>
                              setResume((r) => ({
                                ...r,
                                sections: r.sections.map((ss) =>
                                  ss.id === section.id ? { ...ss, title: e.target.value } : ss,
                                ),
                              }))
                            }
                            className="font-semibold text-base border-none bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-100"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (sIdx === 0) return
                              setResume((r) => {
                                const sections = [...r.sections]
                                const [m] = sections.splice(sIdx, 1)
                                sections.splice(sIdx - 1, 0, m)
                                return { ...r, sections }
                              })
                            }}
                            disabled={sIdx === 0}
                            className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (sIdx === resume.sections.length - 1) return
                              setResume((r) => {
                                const sections = [...r.sections]
                                const [m] = sections.splice(sIdx, 1)
                                sections.splice(sIdx + 1, 0, m)
                                return { ...r, sections }
                              })
                            }}
                            disabled={sIdx === resume.sections.length - 1}
                            className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSection(section.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                      {section.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-600/50 rounded-xl p-4 bg-gray-900/30 hover:bg-gray-900/50 transition-colors backdrop-blur-sm"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-1 space-y-3">
                              <Input
                                placeholder="Position/Institution"
                                value={item.heading}
                                onChange={(e) =>
                                  updateField(["sections", sIdx, "items", idx, "heading"], e.target.value)
                                }
                                className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                              />
                              <Input
                                placeholder="Company/Degree • Date Range"
                                value={item.subheading}
                                onChange={(e) =>
                                  updateField(["sections", sIdx, "items", idx, "subheading"], e.target.value)
                                }
                                className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveItem(section.id, idx, idx - 1)}
                                disabled={idx === 0}
                                className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveItem(section.id, idx, idx + 1)}
                                disabled={idx === section.items.length - 1}
                                className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(section.id, idx)}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {item.bullets.map((b, bi) => (
                              <div key={bi} className="flex items-start gap-2 group">
                                <div className="flex flex-col gap-1 mt-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveBullet(section.id, idx, bi, bi - 1)}
                                    disabled={bi === 0}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveBullet(section.id, idx, bi, bi + 1)}
                                    disabled={bi === item.bullets.length - 1}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <Textarea
                                  rows={2}
                                  value={b}
                                  onChange={(e) =>
                                    updateField(["sections", sIdx, "items", idx, "bullets", bi], e.target.value)
                                  }
                                  className="flex-1 resize-none bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                                  placeholder="Describe your achievement or responsibility..."
                                />
                                <div className="flex flex-col gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => changeIndent(section.id, idx, bi, 1)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                                    title="Indent right"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => changeIndent(section.id, idx, bi, -1)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:bg-gray-700/50 hover:text-gray-100"
                                    title="Indent left"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBullet(section.id, idx, bi)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addBullet(section.id, idx)}
                              className="gap-2 bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                            >
                              <Plus className="h-4 w-4" />
                              Add Bullet Point
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => addItem(section.id)}
                        className="w-full gap-2 bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                      >
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
              <Button
                onClick={addSection}
                className="w-full gap-2 bg-gradient-to-r from-blue-400 to-blue-400 hover:from-gray-700 hover:to-gray-700 text-white shadow-lg"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Add New Section
              </Button>
            </div>
          </div>

          <div className="xl:sticky xl:top-6 xl:h-fit">
          <div className="space-y-6">
            
          {aiLoading ? (
              <AIAnalyzingCard 
                title="AI Analyzing Resume"
                subtitle="Processing your resume for suggestions..."
                variant="default"
                className="border-0 shadow-2xl bg-gradient-to-br from-blue-900/20 to-gray-900/20 backdrop-blur-md border border-blue-700/30"
              />
            ) : (
              <Card className="border-0 shadow-2xl bg-gradient-to-br from-blue-900/20 to-gray-900/20 backdrop-blur-md border border-blue-700/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 space-y-2">
                  </div>
                
                </div>

                <div className="flex gap-2">
                  <Button
                    disabled={aiLoading || !apiKey}
                    onClick={async () => {
                      setAiLoading(true)
                      const res = await getResumeSuggestions(resume, apiKey)
                      setAiSuggestions(res)
                      setAiLoading(false)
                    }}
                    className="bg-gradient-to-r from-gray-600 to-gray-600 hover:from-gray-900 hover:to-gray-900 text-white shadow-lg"
                  >
                    {aiLoading ? "Analyzing…" : "Get Suggestions"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={aiLoading || !apiKey}
                    onClick={async () => {
                      setAiLoading(true)
                      const { resume: rewritten } = await rewriteAllBullets(resume, apiKey)
                      setResume(rewritten)
                      setAiLoading(false)
                    }}
                    className="bg-gray-800/50 border-blue-600/50 text-gray-200 hover:bg-blue-900/30"
                  >
                    Rewrite Bullets
                  </Button>
                </div>

                {(aiSuggestions.summary || (aiSuggestions.suggestions?.length || 0) > 0) && (
                  <div className="space-y-3 p-4 bg-gray-900/40 rounded-lg border border-blue-700/30 backdrop-blur-sm">
                    {aiSuggestions.summary && (
                      <div>
                        <div className="text-sm font-semibold text-blue-300">Summary</div>
                        <p className="text-sm text-gray-300">{aiSuggestions.summary}</p>
                      </div>
                    )}
                    {aiSuggestions.suggestions?.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-blue-300">Suggestions</div>
                        <ul className="list-disc pl-6 space-y-1 text-sm text-gray-300">
                          {aiSuggestions.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSuggestions.risks?.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-red-400">Risks</div>
                        <ul className="list-disc pl-6 space-y-1 text-sm text-gray-300">
                          {aiSuggestions.risks.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            <Card className="border-0 shadow-2xl bg-gray-800/40 backdrop-blur-md border border-gray-700/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
                    <Eye className="h-5 w-5 text-blue-400" />
                    Resume Preview
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-blue-900/50 text-blue-200 border border-blue-700/50"
                  >
                    {resume.sections.reduce(
                      (total, section) =>
                        total +
                        section.items.reduce(
                          (itemTotal, item) =>
                            itemTotal +
                            (item.heading?.length || 0) +
                            (item.subheading?.length || 0) +
                            item.bullets.reduce((bulletTotal, bullet) => bulletTotal + bullet.length, 0),
                          0,
                        ),
                      0,
                    )}{" "}
                    chars
                  </Badge>
                </div>
             
                
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-gray-600/50 rounded-lg overflow-hidden">
                  <div id="print-area" className="bg-white p-8">
                    {/* Header */}
                    <div className="border-b pb-3 mb-4 text-center">
                      <h1 className="text-xl font-bold mb-1 text-[#1f4e79]" style={{ fontSize: 21 }}>
                        {resume.name}
                      </h1>
                      <p className="text-xs text-gray-700">{resume.contact}</p>
                    </div>

                    {/* Sections */}
                    <div className="space-y-3">
                      {resume.sections.map((s) => (
                        <div key={s.id} className="mb-3">
                          <h2 className="text-xs font-bold tracking-wider mb-2 uppercase border-b pb-1 text-[#1f4e79]">
                            {s.title}
                          </h2>
                          <div className="space-y-2">
                            {s.items.map((it, i) => (
                              <div key={i} className="mb-2">
                                {(() => {
                                  const h = splitLeftRight(it.heading)
                                  const sub = splitLeftRight(it.subheading)
                                  const isProjects = s.id === "projects"
                                  let topLeft = h.left
                                  let topRight = h.right
                                  let italicLeft = sub.left
                                  let italicRight = sub.right

                                  const subLooksLikeDates = sub.right === "" && /\d{4}/.test(sub.left || "")
                                  if (subLooksLikeDates) {
                                    topRight = sub.left
                                    italicLeft = h.left
                                    italicRight = ""
                                    topLeft = h.right || h.left
                                  }

                                  if (!sub.left && sub.right) {
                                    topLeft = h.right || h.left
                                    topRight = ""
                                    italicLeft = h.left
                                    italicRight = sub.right
                                  }

                                  return (
                                    <>
                                      <div className="flex justify-between items-baseline mb-0.5">
                                        {/* Projects heading: name normal, tech stack italic */}
                                        {isProjects && topLeft.includes(" | ") ? (
                                          (() => {
                                            const [name, tech] = topLeft.split(" | ")
                                            return (
                                              <h3 className="font-semibold text-black">
                                                <span>{name.trim()}</span>
                                                {tech && (
                                                  <span
                                                    className="italic font-normal"
                                                    style={{ marginLeft: 4, fontSize: 10 }}
                                                  >
                                                    | {tech.trim()}
                                                  </span>
                                                )}
                                              </h3>
                                            )
                                          })()
                                        ) : (
                                          <h3 className="font-semibold text-black" style={{ fontSize: 10 }}>
                                            {topLeft}
                                          </h3>
                                        )}
                                        {topRight && (
                                          <span
                                            className="text-xs text-gray-800"
                                            style={{ whiteSpace: "nowrap", fontSize: 10 }}
                                          >
                                            {topRight}
                                          </span>
                                        )}
                                      </div>
                                      {(italicLeft || italicRight) && (
                                        <div
                                          className="flex justify-between items-baseline italic text-gray-800 mb-1"
                                          style={{ fontSize: 10 }}
                                        >
                                          <span>{italicLeft}</span>
                                          {italicRight && <span style={{ whiteSpace: "nowrap" }}>{italicRight}</span>}
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                                <ul className="space-y-0.5">
                                  {it.bullets.map((b, bi) => {
                                    let indent = 0
                                    let text = b
                                    while (text.startsWith("\t")) {
                                      indent++
                                      text = text.slice(1)
                                    }
                                    return (
                                      <li
                                        key={bi}
                                        className="text-xs text-gray-800 flex items-start"
                                        style={{
                                          marginLeft: indent * 16,
                                          marginBottom: "1px",
                                        }}
                                      >
                                        <span
                                          className="flex-shrink-0"
                                          style={{ fontSize: 8, lineHeight: "14px", marginRight: 6 }}
                                        >
                                          •
                                        </span>
                                        <span style={{ fontSize: 10 }}>{text}</span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area,
          #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            font-family: 'Times New Roman', serif !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
            padding: 20mm !important;
            margin: 0 !important;
          }
          #print-area h1 {
            text-align: center !important;
            font-size: 21px !important;
            font-weight: bold !important;
            margin-bottom: 4px !important;
          }
          #print-area h2 {
            font-size: 10px !important;
            font-weight: bold !important;
            letter-spacing: 0.05em !important;
            text-transform: uppercase !important;
            border-bottom: 1px solid #000000 !important;
            padding-bottom: 2px !important;
            margin-bottom: 8px !important;
          }
          #print-area h3 {
            font-size: 10px !important;
            font-weight: 600 !important;
          }
          #print-area p, #print-area li {
            font-size: 10px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
          }
        }
        /* soft pulsing backlit shadow for homepage feature icons */
        .glow-pulse {
          position: relative;
        }
        .glow-pulse::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          filter: blur(16px);
          opacity: 0.5;
          z-index: -1;
          animation: glowPulse 2.2s ease-in-out infinite;
        }
        .glow-emerald::after { box-shadow: 0 0 32px 4px rgba(16, 185, 129, 0.35); }
        .glow-blue::after    { box-shadow: 0 0 32px 4px rgba(59, 130, 246, 0.35); }
        .glow-orange::after  { box-shadow: 0 0 32px 4px rgba(249, 115, 22, 0.35); }
        @keyframes glowPulse {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.06); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
