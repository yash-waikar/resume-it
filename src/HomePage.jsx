"use client"

import React, { useEffect, useState } from "react"
import { Button } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Upload, FileText, Sparkles, Download, Edit3, Zap, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { getResumeSuggestions } from "./lib/ai"
import { config } from "./config"
import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist/build/pdf"

export default function HomePage() {
  try {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`
  } catch (_) {}
  const [uploadedResume, setUploadedResume] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiFeedback, setAiFeedback] = useState(null)
  const [apiKey] = useState(config.OPENROUTER_API_KEY)


  const [isParsing, setIsParsing] = useState(false)
  const [parsePercent, setParsePercent] = useState(0)
  const [parseMessage, setParseMessage] = useState("")
  const [parseError, setParseError] = useState("")

  function buildPrefilledResumeFromText(text, fileName) {
    const raw = (text || "").replace(/\s+/g, " ").trim()
    let bullets = []
    const bulletSplit = raw.split(/(?:\s[•\-–—·‣\*]\s+)/g).map((s) => s.trim())
    if (bulletSplit.length > 1) {
      bullets = bulletSplit
    } else {
      bullets = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim())
    }
    bullets = bullets.filter((b) => b && b.length > 2).map((b) => b.replace(/^•\s*/, "").slice(0, 240))
    if (bullets.length === 0) bullets = [raw.slice(0, 240)]

    return {
      name: "Uploaded Resume",
      contact: "",
      sections: [
        {
          id: "imported",
          title: "IMPORTED FROM PDF",
          items: [
            {
              heading: "Imported Content",
              subheading: fileName || "",
              bullets: bullets.slice(0, 50),
            },
          ],
        },
      ],
    }
  }

  const extractTextFromPDF = async (arrayBuffer, onProgress) => {
    const loadingTask = getDocument({ data: arrayBuffer })
    if (loadingTask.onProgress) {
      loadingTask.onProgress = (p) => {
        const percent = p.total ? Math.min(40, Math.round((p.loaded / p.total) * 40)) : 20
        onProgress(percent, "Loading PDF…")
      }
    }

    const pdf = await loadingTask.promise
    onProgress(45, "Extracting text…")

    let fullText = ""
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const strings = content.items.map((item) => item.str)
      fullText += strings.join(" ") + "\n"
      const pageProgress = 45 + Math.round((pageNum / pdf.numPages) * 55)
      onProgress(Math.min(100, pageProgress), `Extracting text (page ${pageNum}/${pdf.numPages})…`)
    }
    onProgress(100, "Parsed successfully")
    return { text: fullText, pageCount: pdf.numPages }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        if (!file.type || !file.type.includes("pdf")) {

          console.warn("File type not reported as PDF, attempting parse anyway")
        }
        setIsParsing(true)
        setParsePercent(0)
        setParseMessage("Starting…")
        setParseError("")

        const arrayBuffer = await file.arrayBuffer()
        const { text, pageCount } = await extractTextFromPDF(arrayBuffer, (pct, msg) => {
          setParsePercent(pct)
          setParseMessage(msg)
        })
        setUploadedResume({ text, fileName: file.name, pageCount })
        setAiFeedback(null)
      
        if (apiKey) {
          setTimeout(() => {
            analyzeResume().catch(() => {})
          }, 200)
        }
      } catch (error) {
        console.error("Error reading PDF:", error)
        setParseMessage(`Failed to read PDF: ${error?.message || "Unknown error"}`)
        setParseError(error?.message || "Unknown error")
      } finally {
        setIsParsing(false)
      }
    }
  }

  const analyzeResume = async () => {
    if (!uploadedResume || !apiKey) return

    setIsAnalyzing(true)
    try {
      const mockResume = {
        name: "Uploaded Resume",
        contact: "From PDF",
        sections: [
          {
            id: "content",
            title: "RESUME CONTENT",
            items: [
              {
                heading: "PDF Analysis",
                subheading: uploadedResume.fileName,
                bullets: [uploadedResume.text.substring(0, 1500) + "..."],
              },
            ],
          },
        ],
      }

      const feedback = await getResumeSuggestions(mockResume, apiKey)
      setAiFeedback(feedback)
    } catch (error) {
      console.error("Error analyzing resume:", error)
      setAiFeedback({
        suggestions: ["Error analyzing resume. Please check your API key and try again."],
        risks: [],
        summary: "Analysis failed",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-gray-900/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-500/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 py-12 relative z-10">
        <div className="max-w-7xl mx-auto mb-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl" />
              <div className="relative p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl shadow-lg shadow-blue-500/25">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect x="14" y="3" width="5" height="18" rx="1"/>
                  <rect x="5" y="3" width="5" height="18" rx="1"/>
                </svg>
              </div>
            </div>
            
            {/* Title with Accent Line */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-6xl font-black bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent tracking-tight">
                  Resume It.
                </h1>
                <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-transparent rounded-full" />
              </div>
              <div className="h-0.5 w-32 bg-gradient-to-r from-blue-500/50 to-transparent rounded-full mt-1 ml-1" />
            </div>
            
            {/* Optional Badge */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-semibold">AI-Powered</span>
            </div>
          </div>
          
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed ml-1">
            Create a professional resume in minutes. Upload your existing resume or start from scratch with our
            <span className="text-white font-semibold"> AI-powered builder</span>.
          </p>
        </div>

        
        {uploadedResume && aiFeedback ? (
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto mb-16">
           
            <Card className="relative overflow-hidden border border-gray-700/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-gray-700 to-gray-600 rounded-full flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-300" />
                  </div>
                  <CardTitle className="text-xl text-white">Uploaded Resume</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
                  <p className="text-green-300 text-sm">
                    ✓ {uploadedResume.fileName} ({uploadedResume.pageCount} page{uploadedResume.pageCount > 1 ? 's' : ''})
                  </p>
                </div>

                <div className="relative mb-3">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Different Resume
                  </Button>
                </div>

                <div className="relative group mb-3">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-md blur-md opacity-40 group-hover:opacity-70 transition-all duration-300 -z-10" />
                  <Button
                    onClick={analyzeResume}
                    disabled={isAnalyzing}
                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-500 text-white shadow-lg hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 active:scale-95 disabled:hover:scale-100 font-semibold"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Re-analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Re-analyze with AI
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-md blur-md opacity-40 group-hover:opacity-70 transition-all duration-300 -z-10" />
                  <Button
                    onClick={() => {
                      const prefill = buildPrefilledResumeFromText(
                        uploadedResume?.text || "",
                        uploadedResume?.fileName || "Imported PDF"
                      )
                      try {
                        localStorage.setItem("resume_v1", JSON.stringify(prefill))
                      } catch (_) {}
                      window.location.href = "/builder"
                    }}
                    className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit in Builder
                  </Button>
                </div>
              </CardContent>
            </Card>

          
            <Card className="relative overflow-hidden border border-blue-700/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">AI Analysis Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-left">
                {aiFeedback.error && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                    <div className="text-sm font-medium text-red-400 mb-1">Provider Error</div>
                    <p className="text-xs text-red-300">{aiFeedback.error}</p>
                  </div>
                )}

                {aiFeedback.summary && (
                  <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                    <div className="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Summary
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{aiFeedback.summary}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {aiFeedback.suggestions?.length > 0 && (
                    <div className="p-4 bg-green-900/10 border border-green-700/30 rounded-lg">
                      <div className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Suggestions ({aiFeedback.suggestions.length})
                      </div>
                      <ul className="space-y-2 text-sm text-gray-300">
                        {aiFeedback.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiFeedback.risks?.length > 0 && (
                    <div className="p-4 bg-red-900/10 border border-red-700/30 rounded-lg">
                      <div className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Areas for Improvement ({aiFeedback.risks.length})
                      </div>
                      <ul className="space-y-2 text-sm text-gray-300">
                        {aiFeedback.risks.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Original two-card layout for initial state */
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            <Card className="relative overflow-hidden border border-gray-700/50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 group hover:shadow-2xl hover:shadow-blue-500/10">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="text-center pb-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-600 rounded-full flex items-center justify-center mb-4 group-hover:from-blue-600 group-hover:to-blue-500 transition-all duration-300 shadow-lg">
                  <Upload className="h-8 w-8 text-gray-300 group-hover:text-white transition-colors duration-300" />
                </div>
                <CardTitle className="text-xl text-white">Upload Existing Resume</CardTitle>
              </CardHeader>
              <CardContent className="text-center relative z-10">
                <p className="text-gray-400 mb-4 leading-relaxed">
                  Have a resume already? Upload your PDF and we'll help you improve and customize it with AI.
                </p>

                <div className="relative mb-4">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-500 rounded-lg blur-sm opacity-0 group-hover:opacity-40 transition-all duration-300 -z-10" />
                    <Button
                      size="lg"
                      className="w-full gap-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-gray-100 hover:text-white border border-gray-600/50 hover:border-gray-500/50 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 font-medium text-base"
                    >
                      <Upload className="h-5 w-5" />
                      {isParsing ? "Uploading..." : "Choose PDF File"}
                    </Button>
                  </div>
                </div>

                {!isParsing && !uploadedResume && (
                  <p className="text-xs text-gray-500 mb-4 flex items-center justify-center gap-2">
                    <span> Or drag and drop your file</span>
                  </p>
                )}

                {isParsing && (
                  <div className="mb-4 text-left">
                    <div className="h-2 bg-gray-700/50 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{ width: `${parsePercent}%`, transition: "width 200ms ease" }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {parseMessage} ({parsePercent}%)
                    </p>
                  </div>
                )}

                {uploadedResume && !isParsing && !aiFeedback && (
                  <div className="mb-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg text-left">
                    <p className="text-green-300 text-sm">
                      ✓ {uploadedResume.fileName} uploaded ({uploadedResume.pageCount} page{uploadedResume.pageCount > 1 ? 's' : ''})
                    </p>
                  </div>
                )}

                {!isParsing && parseError && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-left">
                    <p className="text-red-300 text-sm">Failed to parse PDF: {parseError}</p>
                  </div>
                )}

                {uploadedResume && !isParsing && !aiFeedback && (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur-md opacity-60 group-hover:opacity-100 transition-all duration-300 -z-10" />
                    <Button
                      onClick={analyzeResume}
                      disabled={isAnalyzing}
                      className="w-full gap-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-500 text-white border-0 shadow-xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 disabled:hover:scale-100 font-semibold text-base"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Analyzing Resume...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-3">Supports PDF files up to 10MB</p>
              </CardContent>
            </Card>

          
            <Card className="relative overflow-hidden border border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-gray-900/20 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-gray-500/10" />
              <CardHeader className="text-center pb-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-900 to-blue-900 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                  <Edit3 className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-white">Start from Scratch</CardTitle>
              </CardHeader>
              <CardContent className="text-center relative z-10">
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Build your resume from the ground up with our step-by-step builder and professional templates.
                </p>
                <Link to="/builder">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur-md opacity-60 group-hover:opacity-100 transition-all duration-300 -z-10" />
                    <Button
                      size="lg"
                      className="w-full gap-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 shadow-xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 font-semibold text-base"
                    >
                      <Edit3 className="h-5 w-5" />
                      Start Building
                    </Button>
                  </div>
                </Link>
                <p className="text-xs text-gray-500 mt-3">No experience required</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="max-w-6xl mx-auto">
        
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-14 h-14 bg-gradient-to-r from-transparent-600 to-transparent-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-all duration-300">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-3 text-lg">Professional Templates</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Clean, ATS-friendly designs that get you noticed by recruiters and hiring managers.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 bg-gradient-to-r from-transparent-600 to-transparent-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300">
                <Edit3 className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-3 text-lg">Easy Customization</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Drag, drop, and edit sections with our intuitive interface. No design skills needed.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 bg-gradient-to-r from-transparent-600 to-transparent-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/25 group-hover:shadow-orange-500/40 transition-all duration-300">
                <Download className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-3 text-lg">Instant Download</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Export your resume as a high-quality PDF ready for job applications.
              </p>
            </div>
          </div>
        </div>

        {/* Additional CTA Section */}
        <div className="text-center mt-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-gray-500/20 rounded-full border border-blue-500/30 mb-6">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-gray-300 font-medium">AI-Powered Resume Enhancement</span>
          </div>
        </div>
        <div className="border-t border-gray-700/50 mt-24 pt-12 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-3">
              <p className="text-gray-400 text-sm">
                Crafted with <span className="text-red-500">❤️</span> and way too much coffee by <span className="text-blue-400 font-semibold">Yash Waikar</span>
              </p>
             
              <p className="text-gray-600 text-xs mt-6">
                Built with React, Tailwind, and questionable life choices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

