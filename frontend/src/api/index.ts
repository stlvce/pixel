const API_URL = import.meta.env.VITE_API_URL;

type TPixel = { x: number; y: number; color: string; user: string };

type DeletePixelsIn = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type TUser = {
  id: number;
  role: number;
  email: string;
  status: "active" | "banned";
};

export default class RequestAPI {
  static async getBoard(): Promise<TPixel[]> {
    return fetch(API_URL + "/board").then((res) => res.json());
  }

  static async createSession() {
    return fetch(API_URL + "/auth/session", {
      method: "POST",
      credentials: "include",
    });
  }

  static async checkSession(): Promise<boolean> {
    const res = await fetch(API_URL + "/auth/session", {
      credentials: "include",
    });
    const data = await res.json();

    return data.exists;
  }

  static openSocket() {
    return new WebSocket(import.meta.env.VITE_API_URL_WS + "/board/ws");
  }

  static async getMe(token: string): Promise<TUser> {
    const res = fetch(API_URL + "/user" + `?token=${token}`);

    return res.then((res) => {
      if (!res.ok) return Promise.reject(res);

      return res.json();
    });
  }

  static async deletePixels(
    token: string,
    payload: DeletePixelsIn,
  ): Promise<TPixel[]> {
    const response = await fetch(
      API_URL + "/board/delete_pixels" + `?token=${token}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to delete pixels: ${errorData.detail || response.statusText}`,
      );
    }

    return response.json();
  }

  static async checkCaptcha(token: string, captcha: string) {
    const res = fetch(
      API_URL + "/auth/google/check" + `?code=${captcha}&token=${token}`,
      {
        method: "POST",
      },
    );

    return res.then((res) => {
      if (!res.ok) return Promise.reject(res);

      return res.json();
    });
  }
}
