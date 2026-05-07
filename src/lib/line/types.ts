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

export type LinePostbackEvent = {
  type: "postback";
  replyToken: string;
  source: LineSource;
  timestamp: number;
  postback: { data: string; params?: Record<string, string> };
};

export type LineEvent =
  | LineTextMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LinePostbackEvent
  | { type: string; [key: string]: unknown };

export type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};
