export const TIME = {
  VIEW: 0x1,    // 1
  EDIT: 0x2,    // 2
  DELETE: 0x4,  // 4
  RESET: 0x8,   // 8
} as const;

export const USER = {
  VIEW: 0x10,     // 16
  EDIT: 0x20,     // 32
  DELETE: 0x40,   // 64
  CREATE: 0x80,   // 128
} as const;