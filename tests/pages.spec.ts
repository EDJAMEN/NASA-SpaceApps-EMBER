import { expect, test, type Page } from "@playwright/test";

const APP_PAGES = [
  { path: "/dashboard", heading: "Test User", nav: "Overview" },
  { path: "/alerts", heading: "Settlement proximity alerts", nav: "Alerts" },
  { path: "/analytics", heading: "Burn-zone analytics" },
  { path: "/calendar", heading: "Burning calendar", nav: "Burn calendar" },
  { path: "/detections", heading: "Thermal hotspot detections", nav: "Detections" },
  { path: "/ingestion", heading: "NASA FIRMS ingestion", nav: "Ingestion" },
];

async function seedProfile(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("ember.profile.v1", JSON.stringify({ name: "Test User" }));
  });
}

test("landing page introduces EMBER and links to dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Protect what matters");
  await page.getByRole("link", { name: "Open dashboard", exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const { path, heading } of APP_PAGES) {
  test(`${path} renders without errors`, async ({ page }) => {
    if (path === "/dashboard") await seedProfile(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);

    if (path === "/dashboard") {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Test User");
      await expect(page.locator(".ember-map-canvas")).toBeVisible();
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test("first visit asks for name and allows continuing without location", async ({ page }) => {
  await page.goto("/dashboard");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue without location" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
});

test("sidebar navigation reaches app pages", async ({ page }) => {
  await seedProfile(page);
  await page.goto("/dashboard");
  for (const { path, heading, nav } of APP_PAGES.slice(1).filter((item) => item.nav)) {
    await page.getByRole("link", { name: nav, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }
});
