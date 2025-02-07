/// <reference types="node" />
import { EventEmitter } from "events";
import { CommentItem } from "./parser";
/**
 * YouTubeライブチャット取得イベント
 */
export declare class LiveChat extends EventEmitter {
    private interval;
    private static readonly headers;
    readonly channelId?: string;
    liveId?: string;
    private key?;
    private continuation?;
    private clientName?;
    private clientVersion?;
    private prevTime;
    private observer?;
    private axiosInstance;
    constructor(options: {
        channelId: string;
        axiosInstance: any;
    } | {
        liveId: string;
        axiosInstance: any;
    }, interval?: number);
    start(): Promise<boolean>;
    stop(reason?: string): void;
    private fetchChat;
    on(event: "comment", listener: (comment: CommentItem) => void): this;
    on(event: "start", listener: (liveId: string) => void): this;
    on(event: "end", listener: (reason?: string) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
}
