import { getAnonId } from "@src/utils/anon";

const API_URL = process.env.API_URL;

export default class RequestAPI {
  static async getBoard() {
    return fetch(API_URL + "/board");
  }

  static openSocket(token: string | null) {
    const anonId = getAnonId();

    const params = new URLSearchParams();
    if (token) params.set("token", token);
    else params.set("anon_id", anonId);

    return new WebSocket(process.env.API_URL_WS + "/ws?" + params.toString());
  }
}
