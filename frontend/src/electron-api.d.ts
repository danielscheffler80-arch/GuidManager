export { };

declare global {
    interface Window {
        electronAPI: {
            openExternal: (url: string) => void;
            getBackendUrl: () => string;
            getSources: (types: string[]) => Promise<any>;
            getGPUInfo: () => Promise<any>;
            isBackendReady: () => boolean;
            isCheckFinished: () => boolean;
            checkForUpdates: () => Promise<any>;
            onUpdateMessage: (callback: (message: string) => void) => void;
            restartAndInstall: () => Promise<void>;
            getVersion: () => Promise<string>;
            onGuildChat: (callback: (data: any) => void) => void;
            toggleWindowFullscreen: () => Promise<boolean>;
            setWindowFullscreen: (flag: boolean) => Promise<void>;
            refreshDiscovery: () => Promise<boolean>;
        };
    }
}
