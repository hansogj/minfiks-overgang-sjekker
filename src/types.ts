// --- Type Definitions ---
export interface CacheItem<T> {
  key: string | number;
  data: T;
  timestamp: number;
}

export interface Club {
  id: number;
  name: string;
}
export interface Competition {
  id: number;
  name: string;
}
export interface Team {
  id: number;
  name: string;
  clubId: number;
  clubName: string;
  competitions: Competition[];
  ageCategory: { name: string };
  genre: { name: string };
}
export interface Match {
  id: number;
  week: number;
  homeTeam: { id: number; name: string; players: Player[] };
  awayTeam: { id: number; name: string; players: Player[] };
}
export interface Player {
  personId: number;
  firstName: string;
  lastName: string;
}
export interface PlayerUsageData {
  players: { [key: string]: string }; // playerId -> playerName
  weeks: string[]; // sorted week numbers
  usage: { [key: string]: { [key: string]: string } }; // playerId -> { week -> teamName }
}
