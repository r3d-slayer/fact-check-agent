export type ClaimStatus = 'verified' | 'inaccurate' | 'false' | 'unknown';

export interface FactCheckResult {
  claim: string;
  originalText: string;
  status: ClaimStatus;
  explanation: string;
  confidence: number;
  sources: {
    title: string;
    url: string;
  }[];
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'completed' | 'error';
}
