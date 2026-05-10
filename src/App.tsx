import { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Activity,
  Cpu,
  Search
} from 'lucide-react';

import { extractPdfText } from './lib/pdf';

import {
  extractClaims,
  verifyClaimsBatch
} from './services/gemini';

import {
  FactCheckResult,
  ProcessingStep
} from './types';

// Extend Performance for Chrome-specific memory property
interface ChromePerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);

  const [extractedText, setExtractedText] =
    useState<string>('');

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [results, setResults] = useState<
    FactCheckResult[]
  >([]);

  const [error, setError] = useState<
    string | null
  >(null);

  const [steps, setSteps] = useState<
    ProcessingStep[]
  >([
    {
      id: 'parse',
      label: 'PDF_PARSE',
      status: 'idle',
    },
    {
      id: 'extract',
      label: 'CLAIM_EXTRACT',
      status: 'idle',
    },
    {
      id: 'verify',
      label: 'CROSS_REF_AI',
      status: 'idle',
    },
  ]);

  const updateStep = (
    id: string,
    status: ProcessingStep['status']
  ) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status }
          : s
      )
    );
  };

  const handleUpload = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      e.target.files?.[0];

    if (!selectedFile) return;

    processFile(selectedFile);
  };

  const processFile = async (
    file: File
  ) => {
    setFile(file);

    setIsProcessing(true);

    setResults([]);

    setError(null);

    setSteps((s) =>
      s.map((step) => ({
        ...step,
        status: 'idle',
      }))
    );

    try {
      // ======================================
      // STEP 1 — PDF PARSE
      // ======================================

      updateStep('parse', 'loading');

      const text =
        await extractPdfText(file);

      setExtractedText(text);

      updateStep(
        'parse',
        'completed'
      );

      // ======================================
      // STEP 2 — CLAIM EXTRACTION
      // ======================================

      updateStep(
        'extract',
        'loading'
      );

      const claims =
        await extractClaims(text);

      updateStep(
        'extract',
        'completed'
      );

      // ======================================
      // STEP 3 — VERIFY CLAIMS
      // ======================================

      updateStep(
        'verify',
        'loading'
      );

      await verifyClaimsBatch(
        claims,

        // LIVE STREAM RESULTS
        (
          partialResults
        ) => {
          setResults((prev) => {
            const existing =
              new Set(
                prev.map(
                  (r) => r.claim
                )
              );

            const filtered =
              partialResults.filter(
                (r) =>
                  !existing.has(
                    r.claim
                  )
              );

            return [
              ...prev,
              ...filtered,
            ];
          });
        }
      );

      updateStep(
        'verify',
        'completed'
      );
    } catch (err) {
      console.error(err);

      setError(
        'SYSTEM ERROR: LOG_FAILURE_INSPECT_API_KEY'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (
    status: FactCheckResult['status']
  ) => {
    switch (status) {
      case 'verified':
        return (
          <span className="bg-green-600 text-white px-1.5 py-0.5 text-[9px] font-mono font-bold">
            VERIFIED
          </span>
        );

      case 'inaccurate':
        return (
          <span className="bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-mono font-bold">
            DISPUTED
          </span>
        );

      case 'false':
        return (
          <span className="bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-mono font-bold">
            CONTRADICTED
          </span>
        );

      default:
        return (
          <span className="bg-black/20 px-1.5 py-0.5 text-[9px] font-mono font-bold">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden border border-black">
      {/* Navigation */}

      <nav className="h-12 border-b border-black flex items-center justify-between px-6 bg-white/50 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-black text-xl tracking-tighter flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            VERA.CHECK

            <span className="text-[10px] font-mono border border-black px-1.5 align-middle ml-1">
              BETA v0.9
            </span>
          </span>

          <div className="h-4 w-px bg-black/20 mx-2"></div>

          <div className="flex items-center gap-2">
            <span className="font-serif italic text-sm opacity-60">
              Session:
            </span>

            <span className="text-xs font-mono font-bold">
              {file
                ? file.name
                : 'NO_SOURCE_LOADED'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isProcessing
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-green-500'
              }`}
            ></div>

            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
              {isProcessing
                ? 'Agent Processing...'
                : 'QWEN LOCAL MODEL ACTIVE'}
            </span>
          </div>

          <div className="px-3 py-1 border border-black text-[10px] font-mono bg-black text-white">
            LOCALHOST:11434
          </div>
        </div>
      </nav>

      {/* Main Content */}

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL */}

        <div className="w-1/3 border-r border-black flex flex-col bg-white/30 overflow-hidden">
          <div className="h-10 border-b border-black px-4 flex items-center justify-between bg-panel shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Source Document
            </span>

            <span className="text-[10px] font-mono opacity-50">
              {extractedText.length.toLocaleString()}{' '}
              chars
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 font-serif text-[15px] leading-relaxed text-justify relative">
            {!file ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/20 backdrop-blur-sm">
                <div className="p-4 bg-black/5 rounded-2xl mb-4">
                  <Upload className="w-10 h-10 text-black/30" />
                </div>

                <h3 className="text-lg font-bold mb-2">
                  INITIALIZE_SYSTEM
                </h3>

                <p className="text-sm opacity-60 mb-8">
                  Load a PDF document to
                  begin claim extraction and
                  truth-layer verification.
                </p>

                <label className="border-2 border-black px-6 py-3 bg-black text-white hover:bg-white hover:text-black transition-colors font-mono text-xs font-bold cursor-pointer uppercase tracking-widest">
                  LOAD_SOURCE.EXE

                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleUpload}
                  />
                </label>
              </div>
            ) : (
              <div className="whitespace-pre-wrap opacity-80">
                {extractedText ||
                  'Analyzing content structure...'}
              </div>
            )}
          </div>

          {/* CONTROLS */}

          <div className="h-40 border-t border-black bg-black p-4 text-canvas font-mono shrink-0">
            <div className="text-[10px] opacity-60 uppercase mb-3 flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              Analysis Controls
            </div>

            <div className="grid grid-cols-2 gap-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`border p-2 text-[10px] transition-colors flex items-center justify-between ${
                    step.status === 'loading'
                      ? 'bg-canvas text-black border-canvas'
                      : step.status ===
                        'completed'
                      ? 'border-green-500 text-green-500'
                      : 'border-canvas/20 text-canvas/50 cursor-default'
                  }`}
                >
                  <span>
                    [{step.label}]
                  </span>

                  {step.status ===
                    'loading' && (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  )}

                  {step.status ===
                    'completed' && (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                </div>
              ))}

              <div
                onClick={() =>
                  setFile(null)
                }
                className="border border-canvas/30 p-2 text-[10px] hover:bg-canvas hover:text-black cursor-pointer uppercase"
              >
                [4] CLEAR_SYSTEM
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div className="flex-1 flex flex-col overflow-hidden bg-white/10">
          <div className="h-10 border-b border-black px-4 flex items-center justify-between bg-panel shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Extracted Claims &
                Verification
              </span>

              <span className="text-[10px] font-mono px-2 bg-black text-white">
                TOTAL:{' '}
                {results.length
                  .toString()
                  .padStart(2, '0')}
              </span>
            </div>

            <div className="text-[10px] font-mono opacity-50 uppercase">
              Analysis: LOCAL_QWEN
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-[60px_1.5fr_1fr_1fr] h-8 items-center border-b border-black px-4 text-[9px] font-mono uppercase opacity-50 bg-white/30 sticky top-0 z-10 backdrop-blur-sm">
              <div>ID</div>

              <div>Claim Statement</div>

              <div>
                Status / Confidence
              </div>

              <div>
                Source / Evidence
              </div>
            </div>

            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {results.length === 0 &&
                !isProcessing ? (
                  <div className="p-20 text-center opacity-20 flex flex-col items-center">
                    <Search className="w-16 h-16 mb-4" />

                    <p className="font-mono text-xs uppercase tracking-widest">
                      Waiting for process
                      start...
                    </p>
                  </div>
                ) : (
                  results.map(
                    (result, idx) => (
                      <motion.div
                        key={`${result.claim}-${idx}`}
                        initial={{
                          opacity: 0,
                          borderBottomWidth: 0,
                        }}
                        animate={{
                          opacity: 1,
                          borderBottomWidth: 1,
                        }}
                        className="grid grid-cols-[60px_1.5fr_1fr_1fr] min-h-30 border-black px-4 py-6 hover:bg-black group transition-colors duration-200 cursor-default"
                      >
                        <div className="font-mono text-xs opacity-40 group-hover:text-canvas transition-colors">
                          #
                          {(idx + 1)
                            .toString()
                            .padStart(
                              2,
                              '0'
                            )}
                        </div>

                        <div className="pr-6">
                          <p className="text-sm font-bold leading-tight group-hover:text-canvas transition-colors">
                            {result.claim}
                          </p>

                          <p className="text-[10px] mt-2 opacity-50 font-serif italic group-hover:text-canvas/60 transition-colors">
                            Extracted from
                            source document.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          {getStatusBadge(
                            result.status
                          )}

                          <div className="text-[10px] font-mono group-hover:text-canvas/60 transition-colors flex items-center gap-1">
                            <Activity className="w-3 h-3" />

                            CONF:{' '}
                            {(
                              result.confidence *
                              100
                            ).toFixed(0)}
                            %
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <p className="text-[11px] font-mono leading-tight opacity-80 group-hover:text-canvas transition-colors">
                            {
                              result.explanation
                            }
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {result.sources
  .slice(0, 5)
  .map(
                              (
                                source,
                                sIdx
                              ) => (
                                <a
                                  key={
                                    sIdx
                                  }
                                  href={
                                    source.url
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold border border-black/10 px-1.5 py-0.5 bg-panel/50 hover:bg-black hover:text-white hover:border-canvas group-hover:border-canvas/20 group-hover:bg-white/10 group-hover:text-canvas transition-all"
                                >
                                  REF_
                                  {sIdx +
                                    1}

                                  <ExternalLink className="w-2 h-2" />
                                </a>
                              )
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  )
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* BOTTOM LOGS */}

          <div className="h-24 border-t border-black bg-white flex shrink-0">
            <div className="w-1/2 border-r border-black p-3 overflow-hidden">
              <div className="text-[9px] uppercase font-bold mb-2 flex items-center gap-2">
                <Cpu className="w-3 h-3" />
                Model Latency Log
              </div>

              <div className="font-mono text-[10px] leading-tight space-y-1">
                <div className="flex justify-between">
                  <span>
                    INITIALIZE_AGENT
                  </span>

                  <span className="text-green-600 font-bold">
                    OK
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>
                    CONTEXT_STREAM
                  </span>

                  <span className="text-green-600 font-bold">
                    ACTIVE
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>
                    TOKEN_USAGE
                  </span>

                  <span className="text-ink/40">
                    CALCULATING...
                  </span>
                </div>
              </div>
            </div>

            <div className="w-1/2 p-3">
              <div className="text-[9px] uppercase font-bold mb-2">
                Verification Heatmap
              </div>

              <div className="flex gap-1 h-8">
                {results.length > 0
                  ? results.map(
                      (r, i) => (
                        <div
                          key={i}
                          className={`flex-1 border border-black transition-colors ${
                            r.status ===
                            'verified'
                              ? 'bg-green-500'
                              : r.status ===
                                'inaccurate'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        />
                      )
                    )
                  : Array.from({
                      length: 8,
                    }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-black/5 border border-black/10"
                      />
                    ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}

      <footer className="h-8 border-t border-black bg-panel flex items-center px-4 justify-between font-mono text-[9px] font-bold shrink-0">
        <div className="flex gap-6 uppercase">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>

            SYSTEM: STABLE
          </span>

          <span>
            MEMORY:{' '}
            {Math.round(
              ((performance as ChromePerformance)
                .memory
                ?.usedJSHeapSize ||
                0) /
                1024 /
                1024
            )}
            MB / 512MB
          </span>

          <span>
            VERIFICATION_ENGINE:
            v1.0.2
          </span>
        </div>

        <div className="uppercase text-right tracking-widest opacity-50">
          ENCRYPTION: RSA-4096 |
          AUTH: LOCAL_SESSION
        </div>
      </footer>
    </div>
  );
}