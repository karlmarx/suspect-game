import { test, expect, type BrowserContext, type Page } from "@playwright/test";

async function newPlayer(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  return page;
}

async function fillJoinForm(page: Page, name: string) {
  await expect(page.getByText("JOINING ROOM")).toBeVisible();
  await page.getByPlaceholder("Name").fill(name);
  await page.getByRole("button", { name: "JOIN GAME" }).click();
}

test.describe("Suspect multiplayer", () => {
  test("3 players can create a room, join, and see each other in the lobby", async ({ browser }) => {
    // Each player gets an isolated context so they don't share localStorage (sessionId).
    const hostCtx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();

    const host = await newPlayer(hostCtx);
    const p2 = await newPlayer(p2Ctx);
    const p3 = await newPlayer(p3Ctx);

    // Host creates a room
    await host.goto("/");
    await host.getByRole("button", { name: "CREATE ROOM" }).click();
    await expect(host).toHaveURL(/\/room\/[A-Z]{4}$/);
    const url = host.url();
    const roomCode = url.split("/").pop()!;
    await fillJoinForm(host, "Alice");

    // Lobby should show the room code and one player
    await expect(host.getByText("ROOM CODE")).toBeVisible();
    await expect(host.locator("text=" + roomCode).first()).toBeVisible();
    await expect(host.getByText("Alice")).toBeVisible();

    // Players 2 and 3 join via direct URL
    await p2.goto(`/room/${roomCode}`);
    await fillJoinForm(p2, "Bob");

    await p3.goto(`/room/${roomCode}`);
    await fillJoinForm(p3, "Carol");

    // All three should see all three players in their lobbies
    for (const page of [host, p2, p3]) {
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Bob")).toBeVisible();
      await expect(page.getByText("Carol")).toBeVisible();
      await expect(page.getByText("PLAYERS (3/8)")).toBeVisible();
    }

    // Only the host sees the START GAME button
    await expect(host.getByRole("button", { name: "START GAME" })).toBeVisible();
    await expect(p2.getByText("Waiting for host to start")).toBeVisible();
    await expect(p3.getByText("Waiting for host to start")).toBeVisible();

    await hostCtx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  test("host can start the game and all players see the round begin", async ({ browser }) => {
    const ctxs = await Promise.all([1, 2, 3].map(() => browser.newContext()));
    const pages = await Promise.all(ctxs.map((c) => c.newPage()));
    const [host, p2, p3] = pages;

    await host.goto("/");
    await host.getByRole("button", { name: "CREATE ROOM" }).click();
    const roomCode = host.url().split("/").pop()!;
    await fillJoinForm(host, "Hosty");

    await p2.goto(`/room/${roomCode}`);
    await fillJoinForm(p2, "Two");

    await p3.goto(`/room/${roomCode}`);
    await fillJoinForm(p3, "Three");

    // Wait until host sees 3 players
    await expect(host.getByText("PLAYERS (3/8)")).toBeVisible();

    // Host starts the game
    await host.getByRole("button", { name: "START GAME" }).click();

    // The round view shows an "R1 / N" badge and a role banner.
    for (const page of pages) {
      await expect(page.getByText(/R1\s*\/\s*\d+/)).toBeVisible({ timeout: 15_000 });
    }

    // Exactly one player is the Suspect — they see "you are The Suspect".
    // The other two see "You are Innocent".
    const suspectCount = (
      await Promise.all(
        pages.map((p) =>
          p
            .getByText(/you are\s*The Suspect/i)
            .isVisible()
            .catch(() => false),
        ),
      )
    ).filter(Boolean).length;
    expect(suspectCount).toBe(1);

    const innocentCount = (
      await Promise.all(
        pages.map((p) =>
          p
            .getByText(/You are Innocent/i)
            .isVisible()
            .catch(() => false),
        ),
      )
    ).filter(Boolean).length;
    expect(innocentCount).toBe(2);

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
