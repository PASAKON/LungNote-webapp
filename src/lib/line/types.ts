export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export type LineTextMessageEvent = {
  type: "message";
  replyToken: string;
  source: LineSource;
  timestamp: number;
  message: { id: string; type: "text"; text: string };
};

export type LineFollowEvent = {
  type: "follow";
  replyToken: string;
  source: LineSource;
  timestamp: number;
};

export type LineUnfollowEvent = {
  type: "unfollow";
  source: LineSource;
  timestamp: number;
};

export type LineEvent =
  | LineTextMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | { type: string; [key: string]: unknown };

export type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};
