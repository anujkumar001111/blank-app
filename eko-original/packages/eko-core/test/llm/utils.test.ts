import { call_timeout, sleep } from "../../src/common/utils";

describe("call_timeout utility", () => {
  test("should resolve when operation completes before timeout", async () => {
    const result = await call_timeout(
      async () => {
        await sleep(100);
        return 1;
      },
      200,
      (e) => {
        console.log("error:", e);
      }
    );
    expect(result).toBe(1);
  });

  test("should reject when operation exceeds timeout", async () => {
    await expect(
      call_timeout(
        async () => {
          await sleep(300);
          return 2;
        },
        200,
        () => { } // suppress error logging
      )
    ).rejects.toThrow("Timeout");
  });
});
