import { SAMPLE_AEM_ERROR_LOG } from '../sample/aem-error-log';
/** Intentionally mock-only. Future Splunk adapter implements the same port. */
export interface LogReader { getRelevantLog(): Promise<string> }
export const splunkMock: LogReader = {
  async getRelevantLog() { return SAMPLE_AEM_ERROR_LOG; },
};
