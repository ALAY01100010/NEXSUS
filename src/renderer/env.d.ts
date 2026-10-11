// Made by Alay
import type { NexsusApi } from '../shared/contracts';

declare global {
  interface Window {
    nexsus: NexsusApi;
  }
}

export {};
