export function getAnonId() {
  let id = localStorage.getItem("anonId");
  if (!id) {
    id = crypto.randomUUID(); // modern browser
    localStorage.setItem("anonId", id);
  }
  return id;
}
