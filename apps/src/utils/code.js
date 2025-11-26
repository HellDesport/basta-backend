import { customAlphabet } from 'nanoid';
const nano = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);
export const makeRoomCode = () => nano();

