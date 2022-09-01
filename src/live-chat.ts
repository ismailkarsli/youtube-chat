import { EventEmitter } from "events";
import axios, { AxiosInstance } from "axios";
import { actionToRenderer, CommentItem, parseData, usecToTime } from "./parser";
import { Action } from "./yt-response";

/**
 * YouTubeライブチャット取得イベント
 */
export class LiveChat extends EventEmitter {
  private static readonly headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
  };
  public readonly channelId?: string;
  public liveId?: string;
  private key?: string;
  private continuation?: string;
  private clientName?: string;
  private clientVersion?: string;
  private prevTime = Date.now();
  private observer?: NodeJS.Timeout;
  private axiosInstance: AxiosInstance;

  constructor(
    options:
      | { channelId: string; axiosInstance: AxiosInstance }
      | { liveId: string; axiosInstance: AxiosInstance },
    private interval = 1000
  ) {
    super();
    if ("channelId" in options) {
      this.channelId = options.channelId;
    } else if ("liveId" in options) {
      this.liveId = options.liveId;
    } else {
      throw TypeError("Required channelId or liveId.");
    }

    if (options.axiosInstance) {
      this.axiosInstance = options.axiosInstance;
    } else {
      this.axiosInstance = axios.create();
    }
  }

  public async start(): Promise<boolean> {
    var liveRes = null;
    if (this.liveId) {
      liveRes = await this.axiosInstance.get(
        `https://www.youtube.com/watch?v=${this.liveId}`,
        { headers: LiveChat.headers }
      );
      if (liveRes.data.match(/LIVE_STREAM_OFFLINE/)) {
        this.emit("error", new Error("Live stream offline"));
        return false;
      }
    }

    if (this.channelId) {
      liveRes = await this.axiosInstance.get(
        `https://www.youtube.com/channel/${this.channelId}/live`,
        { headers: LiveChat.headers }
      );
      if (liveRes.data.match(/LIVE_STREAM_OFFLINE/)) {
        this.emit("error", new Error("Live stream offline"));
        return false;
      }
      this.liveId = liveRes.data.match(
        /"liveStreamabilityRenderer":{"videoId":"(\S*?)",/
      )![1] as string;
    }

    if (!this.liveId || liveRes === null) {
      this.emit("error", new Error("Live stream not found"));
      return false;
    }

    this.key = liveRes.data.match(/"INNERTUBE_API_KEY":"(\S*?)"/)![1] as string;
    this.continuation = liveRes.data.match(
      /"continuation":"(\S*?)"/
    )![1] as string;
    this.clientName = liveRes.data.match(/"clientName":"(\S*?)"/)![1] as string;
    this.clientVersion = liveRes.data.match(
      /"clientVersion":"(\S*?)"/
    )![1] as string;

    this.observer = setInterval(() => this.fetchChat(), this.interval);

    this.emit("start", this.liveId);
    return true;
  }

  public stop(reason?: string) {
    if (this.observer) {
      clearInterval(this.observer);
      this.emit("end", reason);
    }
  }

  private async fetchChat() {
    const res = await this.axiosInstance.post(
      `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.key}`,
      {
        context: {
          client: {
            clientName: this.clientName,
            clientVersion: this.clientVersion,
          },
        },
        continuation: this.continuation,
      },
      { headers: LiveChat.headers }
    );

    if (res.data.continuationContents.messageRenderer) {
      this.stop("Live stream is finished");
      return;
    }

    const items = res.data.continuationContents.liveChatContinuation.actions
      .slice(0, -1)
      .filter((v: Action) => {
        const messageRenderer = actionToRenderer(v);
        if (messageRenderer !== null) {
          if (messageRenderer) {
            return usecToTime(messageRenderer.timestampUsec) > this.prevTime;
          }
        }
        return false;
      })
      .map((v: Action) => parseData(v));

    items.forEach((v: CommentItem) => {
      this.emit("comment", v);
    });

    if (items.length > 0) {
      this.prevTime = items[items.length - 1].timestamp;
    }
  }

  public on(event: "comment", listener: (comment: CommentItem) => void): this;
  public on(event: "start", listener: (liveId: string) => void): this;
  public on(event: "end", listener: (reason?: string) => void): this;
  public on(event: "error", listener: (err: Error) => void): this;
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
