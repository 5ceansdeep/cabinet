// 프론트(3000)와 백엔드(4000)를 한 터미널에서 같이 띄운다. Ctrl+C 한 번이면 둘 다 종료.
import { spawn } from "node:child_process";

spawn("npm", ["run", "dev"], { cwd: "frontend", stdio: "inherit", shell: true });
spawn("npm", ["run", "start:dev"], { cwd: "backend", stdio: "inherit", shell: true });
