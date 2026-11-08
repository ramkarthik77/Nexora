import { z } from 'zod';
import type { CanonicalIssueOpened, AgentId } from '../events/canonical';
import type { RepositoryKind } from '../router/repositories';

export const analysisSchema = z.object({
  summary: z.string().min(1).max(2500),
  likelyRootCause: z.string().min(1).max(3000),
  affectedModule: z.enum(['core', 'ui.apps', 'ui.config', 'dispatcher', 'frontend', 'backend', 'src', 'docs', 'infrastructure', 'unknown']),
  suggestedFix: z.string().min(1).max(4000),
  confidence: z.enum(['low', 'medium', 'high']),
  questions: z.array(z.string().max(500)).max(5),
}).strict();

export type Analysis = z.infer<typeof analysisSchema>;
export interface RepoFile { path: string; content: string }
export interface AgentInput {
  event: CanonicalIssueOpened;
  files: RepoFile[];
  mockLog?: string;
  repositoryKind: RepositoryKind;
  claude: ClaudeProvider;
  signal?: AbortSignal;
}
export interface Agent {
  id: AgentId;
  execute(input: AgentInput): Promise<Analysis>;
}
export interface ClaudeProvider {
  analyze(systemPrompt: string, input: AgentInput): Promise<Analysis>;
}

/** JSON Schema recognized by Anthropic structured outputs; Zod remains final authority. */
export const analysisJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    likelyRootCause: { type: 'string' },
    affectedModule: { type: 'string', enum: ['core', 'ui.apps', 'ui.config', 'dispatcher', 'frontend', 'backend', 'src', 'docs', 'infrastructure', 'unknown'] },
    suggestedFix: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'likelyRootCause', 'affectedModule', 'suggestedFix', 'confidence', 'questions'],
  additionalProperties: false,
} as const;
