// Electron API Types
declare global {
  interface Window {
    electronAPI: {
      getBackendUrl: () => string;
      openExternal?: (url: string) => void;
      isBackendReady?: () => boolean;
      getSources: (types: string[]) => Promise<any[]>;
      getGPUInfo: () => Promise<any>;
      checkForUpdates: () => Promise<any>;
      onUpdateMessage: (callback: (message: string) => void) => void;
      restartAndInstall: () => Promise<void>;
      getVersion: () => Promise<string>;
      onGuildChat: (callback: (data: any) => void) => void;
      getConfig: () => Promise<any>;
      saveWoWPath: (path: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export { };