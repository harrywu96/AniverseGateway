export * from './types';
export declare const API_PATHS: {
    ROOT: string;
    HEALTH: string;
    VIDEOS: string;
    VIDEOS_UPLOAD: string;
    VIDEOS_UPLOAD_LOCAL: string;
    VIDEOS_DETAIL: (id: string) => string;
    SUBTITLES: string;
    SUBTITLES_EXTRACT: string;
    SUBTITLES_DETAIL: (id: string) => string;
    TASKS: string;
    TASKS_DETAIL: (id: string) => string;
    TRANSLATE: string;
    CONFIG: string;
    CONFIG_UPDATE: string;
    PROVIDERS: string;
    MODELS: (provider: string) => string;
    TEMPLATES: string;
    TEMPLATES_DETAIL: (id: string) => string;
    EXPORT: string;
    EXPORT_FORMATS: string;
    WEBSOCKET: string;
};
export declare const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
export declare const TRANSLATION_STYLES: {
    id: string;
    name: string;
}[];
export declare const LANGUAGE_OPTIONS: {
    code: string;
    name: string;
}[];
export declare function formatDuration(seconds: number): string;
