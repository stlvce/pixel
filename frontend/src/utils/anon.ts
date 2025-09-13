import { v4 as uuidv4 } from 'uuid';

export function getAnonId() {
  let id = localStorage.getItem("anonId");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("anonId", id);
  }
  return id;
}
