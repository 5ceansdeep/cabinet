---
name: visual-check
description: 화면·3D·애니메이션을 바꾼 뒤 헤드리스 크롬으로 스크린샷을 찍어 눈으로 확인하는 절차. "스크린샷으로 확인", "눈으로 봐", 화면 변경 검증이 필요할 때.
---

# 헤드리스 스크린샷 확인

설치된 크롬을 puppeteer-core 로 붙여 쓴다(크롬을 새로 받지 않는다).

1. 개발 서버가 떠 있는지 본다: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`.
   꺼져 있으면 `frontend` 에서 `npm run dev` 를 백그라운드로 켜고, 200 이 올 때까지 기다린다(첫 컴파일은 오래 걸린다).
2. `frontend` 에서 `npm i -D puppeteer-core --silent`.
3. 스크래치패드에 `.mjs` 스크립트를 쓴다. import 는 절대 경로로 해야 풀린다:
   ```js
   import puppeteer from "file:///C:/Users/HKCMC/cabinet/frontend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
   const browser = await puppeteer.launch({
     executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
     headless: "new",
     args: ["--enable-unsafe-swiftshader"],
   });
   const page = await browser.newPage();
   page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
   page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
   await page.setViewport({ width: 1440, height: 900 });
   await page.goto("http://localhost:3000/<경로>", { waitUntil: "networkidle2" });
   await new Promise((r) => setTimeout(r, 3000)); // 3D 첫 프레임을 기다린다
   await page.screenshot({ path: "<스크래치패드>/shot.png" });
   await browser.close();
   ```
   - 조작은 `page.mouse.move/down/up`, `page.keyboard.type`. 빠른 손놀림은 move 사이에 `setTimeout(8)` 정도.
   - 상태 확인은 `page.evaluate(() => document.querySelector(...)?.textContent)`.
   - 로직 추적이 필요하면 코드에 잠깐 `console.log("XXXDBG", ...)` 를 넣고 `page.on("console")` 로 거른 뒤, 끝나면 반드시 지운다.
4. 찍은 PNG 를 Read 로 열어 직접 본다. 오른쪽 아래 Next "Issue" 배지가 보이면 콘솔·HTTP 오류부터 확인.
5. 끝나면 `npm uninstall puppeteer-core --silent`, 켠 개발 서버는 끈다
   (PowerShell: `Get-NetTCPConnection -LocalPort 3000 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).
