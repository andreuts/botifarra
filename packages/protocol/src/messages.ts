import { z } from "zod";

export const Card = z.object({
  suit: z.enum(["OROS","COPES","ESPASES","BASTOS"]),
  rank: z.enum(["9","A","K","C","J","8","7","6","5","4","3","2"])
});
export type Card = z.infer<typeof Card>;

export const Trump = z.enum(["OROS","COPES","ESPASES","BASTOS","BOTIFARRA"]);
export type Trump = z.infer<typeof Trump>;

export const ClientToServer = {
  JoinRoom: z.object({ type: z.literal("JoinRoom"), roomId: z.string(), name: z.string().min(1) }),
  Sit: z.object({ type: z.literal("Sit"), seat: z.number().int().min(0).max(3) }),
  Bid: z.object({ type: z.literal("Bid"), trump: Trump, delegate: z.boolean().optional() }),
  Pass: z.object({ type: z.literal("Pass") }),
  Double: z.object({ type: z.literal("Double"), level: z.enum(["CONTRAR","RECONTRAR","SANT_VICENS"]) }),
  PlayCard: z.object({ type: z.literal("PlayCard"), card: Card }),
  Chat: z.object({ type: z.literal("Chat"), text: z.string().max(200) }),
  Unsit: z.object({ type: z.literal("Unsit") }),
  StartHand: z.object({ type: z.literal("StartHand") }),
} as const;

export type ClientMessage = 
  | z.infer<typeof ClientToServer.JoinRoom>
  | z.infer<typeof ClientToServer.Sit>
  | z.infer<typeof ClientToServer.Bid>
  | z.infer<typeof ClientToServer.Pass>
  | z.infer<typeof ClientToServer.Double>
  | z.infer<typeof ClientToServer.PlayCard>
  | z.infer<typeof ClientToServer.Chat>
  | z.infer<typeof ClientToServer.StartHand>;

export const ServerToClient = {
  Welcome: z.object({ type: z.literal("Welcome"), you: z.string(), roomId: z.string() }),
  RoomState: z.object({ type: z.literal("RoomState"), state: z.any() }), // TODO: type state
  StatePatch: z.object({ type: z.literal("StatePatch"), patch: z.any(), rev: z.number() }),
  Error: z.object({ type: z.literal("Error"), code: z.string(), message: z.string() }),
  Chat: z.object({ type: z.literal("Chat"), from: z.string(), text: z.string() }),
} as const;

export type ServerMessage =
  | z.infer<typeof ServerToClient.Welcome>
  | z.infer<typeof ServerToClient.RoomState>
  | z.infer<typeof ServerToClient.StatePatch>
  | z.infer<typeof ServerToClient.Error>
  | z.infer<typeof ServerToClient.Chat>;
