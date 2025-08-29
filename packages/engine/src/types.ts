export type Suit = "OROS"|"COPAS"|"ESPADAS"|"BASTOS";
export type Rank = "9"|"A"|"K"|"C"|"J"|"8"|"7"|"6"|"5"|"4"|"3"|"2";
export type Trump = Suit | "BOTIFARRA";
export type Card = { suit: Suit; rank: Rank };

export type Trick = { leader: number; plays: Array<{ seat: number; card: Card }> };
export type Contract = { trump: Trump; delegated: boolean; doubles: 0|1|2|3 };

export type HandState = {
  dealer: number;
  contract?: Contract;
  hands: Card[][]; // 4 hands
  currentTrick: Trick;
  completed: Trick[];
};
