import HawkCatcher from "@hawk.so/javascript";

const hawk = new HawkCatcher({
  token: import.meta.env.VITE_HAWK_TOKEN ?? "",
  release: window.HAWK_RELEASE,
});
export default hawk;
