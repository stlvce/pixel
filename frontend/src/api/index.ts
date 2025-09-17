import { getAnonId } from "@src/utils/anon";

const API_URL = import.meta.env.VITE_API_URL;

type TPixel = { x: number; y: number; color: string; user: string };

export type TUser = {
  id: number;
  is_admin: number;
  google_id: string;
  email: string;
};

export default class RequestAPI {
  static async getBoard(): Promise<TPixel[]> {
    return fetch(API_URL + "/board").then((res) => res.json());
  }

  static openSocket(token: string | null) {
    const anonId = getAnonId();

    const params = new URLSearchParams();
    if (token) params.set("token", token);
    else params.set("anon_id", anonId);

    return new WebSocket(
      import.meta.env.VITE_API_URL_WS + "/ws?" + params.toString(),
    );
  }

  static async getMe(token: string): Promise<TUser> {
    const res = fetch(API_URL + "/me" + `?token=${token}`);

    return res.then((res) => {
      if (!res.ok) return Promise.reject(res);

      return res.json();
    });
  }
}
