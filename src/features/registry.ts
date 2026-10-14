/**
 * Central feature handler registry.
 *
 * Every feature module exports a `Record<string, FeatureHandler>` map of
 * channel -> async handler. They are aggregated here and exposed uniformly to
 * both the Electron main process (ipcMain) and the standalone web server
 * (WebSocket dispatch). The renderer calls them through
 * `window.dgodterm.invokeFeature(channel, payload)`.
 */
import { dockerHandlers } from './docker-service';
import { processHandlers } from './process-service';
import { aiHandlers } from './ai-copilot';
import { batchPushHandlers } from './batch-push';
import { keyDeployHandlers } from './key-deploy';
import { uptimeHandlers } from './uptime-monitor';
import { cloudImportHandlers } from './cloud-import';

export type FeatureHandler = (payload: any) => Promise<any>;

export const featureHandlers: Record<string, FeatureHandler> = {
  ...dockerHandlers,
  ...processHandlers,
  ...aiHandlers,
  ...batchPushHandlers,
  ...keyDeployHandlers,
  ...uptimeHandlers,
  ...cloudImportHandlers
};

export async function invokeFeature(channel: string, payload: any): Promise<any> {
  const handler = featureHandlers[channel];
  if (!handler) {
    throw new Error(`Unknown feature channel: ${channel}`);
  }
  return handler(payload);
}
