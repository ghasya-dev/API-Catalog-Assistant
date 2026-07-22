export interface CatalogApi {
  name: string;
  domain: string;
  status: string;
  tags: string[];
  endpoints: number;
  onboardedDate: string;
  owner: string | null;
  dependencies: string[];
  protocol: string;
  gateway: string | null;
}

export interface Catalog { apis: CatalogApi[] }

export type Severity = 'low' | 'medium' | 'high';
export interface RubricRule {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  example: string;
}
export interface RubricCategory {
  id: string;
  name: string;
  rules: RubricRule[];
}
export interface Rubric {
  version: string;
  description: string;
  categories: RubricCategory[];
}

export interface Finding {
  ruleId: string;
  title: string;
  category: string;
  severity: Severity;
  passed: boolean;
  evidence: string[];
  recommendation?: string;
}

export interface QualityReport {
  api: string;
  file: string;
  score: number;
  grade: string;
  passedRules: number;
  failedRules: number;
  findings: Finding[];
}

export interface AssistantResponse {
  intent: string;
  answer: string;
  data?: unknown;
  assumptions?: string[];
  clarification?: {
    question: string;
    candidates?: string[];
  };
}
