import { expect, it } from "vitest";
import { allowedPushEndpoint } from "./_core/webPush";

it("accepts known browser push providers including Edge WNS", () => {
  expect(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/test")).toBe(true);
  expect(allowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/test")).toBe(true);
  expect(allowedPushEndpoint("https://web.push.apple.com/test")).toBe(true);
  expect(allowedPushEndpoint("https://wns2.example.notify.windows.com/w/?token=example")).toBe(true);
});

it("rejects malformed, unrelated or misleading push URLs", () => {
  expect(allowedPushEndpoint("not a url")).toBe(false);
  expect(allowedPushEndpoint("https://wns2.notify.windows.com.example.org/w/?token=example")).toBe(false);
  expect(allowedPushEndpoint("https://wns2.notify.windows.com/w/?token=example&other=example")).toBe(false);
  expect(allowedPushEndpoint("http://wns2.notify.windows.com/w/?token=example")).toBe(false);
});
