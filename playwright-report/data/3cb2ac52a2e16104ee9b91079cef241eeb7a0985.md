# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke — unauthenticated user >> login page renders with username and password fields
- Location: tests\e2e\smoke.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /entrar/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /entrar/i })

```

```yaml
- heading "Botifarra Online" [level=1]
- text: Usuari
- textbox "Usuari"
- text: Contrasenya
- textbox "Contrasenya"
- button "Inicia sessió"
- paragraph:
  - text: No tens compte?
  - link "Registra't":
    - /url: /register
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Smoke — unauthenticated user', () => {
  4  |   test('landing page redirects to /login', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     // Should end up on login or home page (requires auth)
  7  |     await expect(page).toHaveURL(/\/(login|home)?/);
  8  |   });
  9  | 
  10 |   test('login page renders with username and password fields', async ({ page }) => {
  11 |     await page.goto('/login');
  12 |     await expect(page.getByLabel(/usuari/i)).toBeVisible();
  13 |     await expect(page.getByLabel(/contrasenya/i)).toBeVisible();
> 14 |     await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  15 |   });
  16 | 
  17 |   test('register page renders link from login', async ({ page }) => {
  18 |     await page.goto('/login');
  19 |     const registerLink = page.getByRole('link', { name: /registra/i });
  20 |     await expect(registerLink).toBeVisible();
  21 |     await registerLink.click();
  22 |     await expect(page).toHaveURL(/\/register/);
  23 |   });
  24 | });
  25 | 
```