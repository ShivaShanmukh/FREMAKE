/**
 * Minimal server-side logger. Webhook and billing paths must leave an
 * audit trail; everything else may stay quiet in production.
 */
export const logger = {
  info(message: string): void {
    console.info(message);
  },
  warn(message: string): void {
    console.warn(message);
  },
  error(message: string): void {
    console.error(message);
  },
};
