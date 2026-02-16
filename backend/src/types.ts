export type RoleSlot = "Main" | "Twink1" | "Twink2" | "Twink3";

export interface Guild {
  id: string;
  name: string;
  realm?: string;
  region?: string;
}

export interface Member {
  id: string;
  discordUserId: string;
  username: string;
  guildId: string;
  joinedAt?: string;
}

export interface Character {
  id: string;
  memberId: string;
  name: string;
  classId: string;
  specId: string;
  isMain: boolean;
  slot: RoleSlot;
}

export interface Raid {
  id: string;
  guildId: string;
  title: string;
  startTime: string;
  duration?: number;
  recurring?: boolean;
  dayOfWeek?: number;
  nextOccurrence?: string;
}

export interface Attendance {
  id: string;
  raidId: string;
  memberId: string;
  characterId: string;
  status: "attending" | "absent" | "late" | "unknown";
  comment?: string;
}
